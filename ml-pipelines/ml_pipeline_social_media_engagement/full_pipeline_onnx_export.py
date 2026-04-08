"""
Parallel **full-graph** ONNX export for the social recommender (raw features → prediction).

This **retrains** sklearn Pipelines using ``build_preprocess_onnx`` + categorical sentinel
(see ``preprocess_onnx.py``). It is **not** the same model as production ``export_artifacts`` /
joblib (different OneHotEncoder cardinality rules).

Outputs (under chosen directory, e.g. ``App_Data/ml/social/``)::

    *_pipeline_full.onnx
    social_net_preprocessing_spec.json
    social_onnx_full_pipeline_metadata.json

**Runtime note:** ``onnxruntime`` CPU often **cannot execute** these graphs (missing
``ai.onnx.ml`` Imputer kernels for some string/float paths). Conversion is still valid for
tooling; for production inference prefer joblib/FastAPI until ORT / extensions catch up, or
implement preprocessing in .NET using ``social_net_preprocessing_spec.json`` + estimator-only
ONNX from ``export_onnx.py``.

Run::

    PYTHONPATH=. python3 -m ml_pipeline_social_media_engagement.full_pipeline_onnx_export --output-dir /path/to/social
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import numpy as np
import onnx
import pandas as pd
from skl2onnx import to_onnx

from . import config
from .data_prep import load_social_media_posts
from .feature_engineering import apply_categorical_onnx_sentinel, build_modeling_frame, get_X_y
from .net_preprocessing_spec import write_net_preprocessing_spec
from .preprocess_onnx import build_preprocess_onnx
from .train_predictive import run_predictive_suite

FULL_ONNX_FILENAMES: dict[str, str] = {
    "engagement_rate": "engagement_rate_pipeline_full.onnx",
    "donation_referrals_count": "donation_referrals_count_pipeline_full.onnx",
    "donation_value_log1p": "donation_value_log1p_pipeline_full.onnx",
    "p_any_referral": "any_referral_classifier_pipeline_full.onnx",
}

META_FULL = "social_onnx_full_pipeline_metadata.json"


def _prepare_raw_frame(X: pd.DataFrame, num: list[str], cat: list[str]) -> pd.DataFrame:
    out = X.copy()
    for c in num:
        out[c] = pd.to_numeric(out[c], errors="coerce").astype(np.float64)
    for c in cat:
        out[c] = out[c].astype(str)
    return out


def _try_ort_parity(
    pipe: Any,
    onnx_path: Path,
    Xs: pd.DataFrame,
    num: list[str],
    cat: list[str],
    *,
    clf: bool,
) -> dict[str, Any]:
    import onnxruntime as ort  # noqa: PLC0415

    sk_out = pipe.predict_proba(Xs)[:, 1] if clf else pipe.predict(Xs)
    sk_out = np.asarray(sk_out, dtype=np.float64).ravel()
    try:
        sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    except Exception as exc:  # noqa: BLE001
        return {
            "onnxruntime_cpu_session": False,
            "onnxruntime_error": str(exc),
            "sklearn_preview": float(sk_out[0]),
        }
    feeds = {}
    for inp in sess.get_inputs():
        col = inp.name
        if col in num:
            feeds[inp.name] = Xs[col].values.astype(np.float32).reshape(-1, 1)
        else:
            feeds[inp.name] = Xs[col].values.astype(object).reshape(-1, 1)
    outs = sess.run(None, feeds)
    if clf:
        o = outs[1] if len(outs) > 1 and getattr(outs[1], "ndim", 0) == 2 else outs[0]
        ort_out = np.asarray(o[:, 1], dtype=np.float64).ravel()
    else:
        ort_out = np.asarray(outs[0], dtype=np.float64).ravel()
    return {
        "onnxruntime_cpu_session": True,
        "max_abs_diff_sklearn_vs_ort": float(np.max(np.abs(sk_out - ort_out))),
        "sklearn_preview": float(sk_out[0]),
        "ort_preview": float(ort_out[0]),
    }


def export_full_pipeline_onnx_artifacts(
    output_dir: Path,
    *,
    n_sample_rows: int = 10,
) -> dict[str, Any]:
    output_dir = Path(output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    raw = load_social_media_posts()
    df, meta = build_modeling_frame(raw)
    df = apply_categorical_onnx_sentinel(df, meta["categorical_features"])

    pred = run_predictive_suite(df, meta, preprocess_builder=build_preprocess_onnx)

    eng = pred["engagement"]["best_pipeline"]
    ref = pred["referrals_count"]["best_pipeline"]
    dval = pred["donation_value_log1p"]["best_pipeline"]
    clf = pred["any_referral"]["best_pipeline"]

    num = meta["numeric_features"]
    cat = meta["categorical_features"]
    X_eng, _y = get_X_y(df, meta, meta["target_engagement"])
    Xs = _prepare_raw_frame(X_eng.iloc[: max(1, n_sample_rows)], num, cat)

    write_net_preprocessing_spec(eng.named_steps["prep"], meta, output_dir / "social_net_preprocessing_spec.json")

    summary: dict[str, Any] = {
        "package": "ml_pipeline_social_media_engagement",
        "skl2onnx_full_pipeline_conversion": True,
        "preprocess_variant": "preprocess_onnx (sentinel + OneHotEncoder without max_categories)",
        "production_joblib_differences": [
            "Production uses max_categories=35 on OneHotEncoder; ONNX path does not.",
            "Production categorical imputer uses default np.nan missing; ONNX path uses string sentinel.",
            "Full-graph classifier ONNX is uncalibrated (no CalibratedClassifierCV wrapper).",
        ],
        "models": {},
    }

    jobs: list[tuple[str, Any, bool]] = [
        ("engagement_rate", eng, False),
        ("donation_referrals_count", ref, False),
        ("donation_value_log1p", dval, False),
        ("p_any_referral", clf, True),
    ]

    for key, pipe, is_clf in jobs:
        fname = FULL_ONNX_FILENAMES[key]
        out_p = output_dir / fname
        opts = {id(pipe.named_steps["model"]): {"zipmap": False}} if is_clf else {}
        try:
            onx = to_onnx(pipe, Xs.head(1), target_opset=15, options=opts)
            onnx.checker.check_model(onx)
            out_p.write_bytes(onx.SerializeToString())
            parity = _try_ort_parity(pipe, out_p, Xs, num, cat, clf=is_clf)
            summary["models"][key] = {
                "onnx_file": fname,
                "onnx_bytes": len(onx.SerializeToString()),
                **parity,
            }
        except Exception as exc:  # noqa: BLE001
            summary["models"][key] = {"error": str(exc), "onnx_file": fname}

    meta_path = output_dir / META_FULL
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, default=str, allow_nan=False)
    summary["metadata_path"] = str(meta_path)
    return summary


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Retrain ONNX-friendly pipelines and export full-graph ONNX.")
    ap.add_argument(
        "--output-dir",
        type=Path,
        required=True,
        help="e.g. backend/.../App_Data/ml/social or serialized_models",
    )
    args = ap.parse_args(argv)
    try:
        out = export_full_pipeline_onnx_artifacts(args.output_dir)
    except Exception as e:  # noqa: BLE001
        print(f"Full pipeline ONNX export failed: {e}", file=sys.stderr)
        return 1
    print(json.dumps({"metadata_path": out.get("metadata_path"), "models": list(out.get("models", {}))}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
