"""
Export ONNX versions of the **fitted estimators** inside the social sklearn Pipelines.

Full Pipeline → ONNX conversion (ColumnTransformer + categorical SimpleImputer with
``missing_values=np.nan``) is **not** supported by skl2onnx today (see
``full_pipeline_onnx_blocker`` in the emitted metadata). This module therefore exports
only the final estimator step, which expects a **float32** matrix of shape
``[batch, n_transformed_features]`` — i.e. the output of ``pipeline.named_steps["prep"].transform(X)``.

Production inference remains **joblib** (full pipeline including calibration for the
referral classifier). ONNX artifacts are for a future .NET ONNX Runtime path where
preprocessing must be replicated or wrapped separately.

Run from ``ml-pipelines``::

    PYTHONPATH=. python3 -m ml_pipeline_social_media_engagement.export_onnx

Or pass ``--output-dir`` / ``--joblib-dir`` for custom paths.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from . import config

# Public filenames (parallel to *.joblib names under App_Data/ml/social).
ONNX_FILENAMES: dict[str, str] = {
    "engagement_rate": "engagement_rate_pipeline.onnx",
    "p_any_referral": "any_referral_classifier_pipeline.onnx",
    "donation_referrals_count": "donation_referrals_count_pipeline.onnx",
    "donation_value_log1p": "donation_value_log1p_pipeline.onnx",
}

JOBLIB_KEYS: dict[str, str] = {
    "engagement_rate": "engagement_rate_pipeline.joblib",
    "p_any_referral": "any_referral_classifier_pipeline.joblib",
    "donation_referrals_count": "donation_referrals_count_pipeline.joblib",
    "donation_value_log1p": "donation_value_log1p_pipeline.joblib",
}

SIDECAR_NAME = "social_onnx_export_metadata.json"

FULL_PIPELINE_ONNX_BLOCKER = (
    "Default production joblib pipelines: skl2onnx cannot convert the full ColumnTransformer "
    "because categorical SimpleImputer uses missing_values=float (np.nan) on strings "
    "(NotImplementedError). Mitigation: parallel path preprocess_onnx + categorical sentinel "
    "+ OneHotEncoder without max_categories — see full_pipeline_onnx_export (retrains; "
    "skl2onnx conversion succeeds; onnxruntime CPU may still lack Imputer kernels)."
)

CLASSIFIER_ONNX_NOTE = (
    "The saved joblib for p_any_referral is CalibratedClassifierCV (Platt-calibrated, "
    "CV-averaged). ONNX exports the **fold-0** underlying Pipeline's gradient boosting "
    "classifier on preprocessed X only (uncalibrated). Probabilities will **not** match "
    "the calibrated joblib model; rankings may be similar."
)


def _require_skl2onnx():
    try:
        from skl2onnx import convert_sklearn  # noqa: PLC0415
        from skl2onnx.common.data_types import FloatTensorType  # noqa: PLC0415
    except ImportError as e:  # pragma: no cover
        raise ImportError(
            "Install skl2onnx and onnx (see ml-pipelines/requirements.txt) to export ONNX.",
        ) from e
    return convert_sklearn, FloatTensorType


def _load_meta(joblib_dir: Path) -> dict[str, Any]:
    p = joblib_dir / "social_media_engagement_metadata.json"
    if not p.is_file():
        raise FileNotFoundError(f"Missing metadata JSON: {p}")
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def _sample_X(joblib_dir: Path, meta: dict[str, Any]) -> pd.DataFrame:
    """Single-row frame matching training column order and dtypes for prep.transform."""
    num = meta["numeric_features"]
    cat = meta["categorical_features"]
    sample_path = joblib_dir / "sample_payload_input.json"
    if not sample_path.is_file():
        raise FileNotFoundError(f"Missing {sample_path} (needed for ONNX validation sample).")
    with open(sample_path, encoding="utf-8") as f:
        payload = json.load(f)
    row = dict(payload.get("features") or {})
    X = pd.DataFrame([row])
    for c in num:
        if c not in X.columns:
            X[c] = 0.0
        X[c] = pd.to_numeric(X[c], errors="coerce").astype(np.float64)
    for c in cat:
        if c not in X.columns:
            X[c] = "unknown"
        X[c] = X[c].astype(str)
    return X[num + cat]


def _unwrap_classifier_pipeline(pipe: Any) -> tuple[Any, str]:
    """
    Return (sklearn Pipeline with prep+model, note).
    CalibratedClassifierCV wraps a single estimator Pipeline across folds.
    """
    name = type(pipe).__name__
    if name == "CalibratedClassifierCV":
        inner = pipe.calibrated_classifiers_[0].estimator
        return inner, "used_fold0_inner_pipeline"
    return pipe, "plain_pipeline"


def _export_estimator_to_onnx(
    model: Any,
    n_features: int,
    out_path: Path,
    *,
    is_classifier: bool,
) -> dict[str, Any]:
    convert_sklearn, FloatTensorType = _require_skl2onnx()
    opts = {id(model): {"zipmap": False}} if is_classifier else {}
    onx = convert_sklearn(
        model,
        initial_types=[("X", FloatTensorType([None, n_features]))],
        options=opts,
        target_opset=15,
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    data = onx.SerializeToString()
    out_path.write_bytes(data)
    in_name = onx.graph.input[0].name
    return {"onnx_input_name": in_name, "onnx_bytes": len(data)}


def _onnx_run_reg(sess: Any, in_name: str, Xt: np.ndarray) -> np.ndarray:
    out = sess.run(None, {in_name: Xt})[0]
    return np.asarray(out).ravel()


def _onnx_run_clf_proba(sess: Any, in_name: str, Xt: np.ndarray) -> np.ndarray:
    outs = sess.run(None, {in_name: Xt})
    # zipmap=False → [label, probabilities] for tree-based classifiers
    if len(outs) >= 2 and getattr(outs[1], "ndim", 0) == 2 and outs[1].shape[1] >= 2:
        return outs[1][:, 1]
    if len(outs) == 1 and outs[0].ndim == 2 and outs[0].shape[1] >= 2:
        return outs[0][:, 1]
    raise RuntimeError(f"Unexpected ONNX classifier outputs: {[o.shape for o in outs]}")


def export_social_pipelines_to_onnx(
    *,
    joblib_dir: Path | None = None,
    onnx_dir: Path | None = None,
) -> dict[str, Any]:
    """
    Read trained *.joblib from ``joblib_dir``, write *.onnx + ``social_onnx_export_metadata.json``
    into ``onnx_dir`` (often the same directory as deployed social artifacts).
    """
    import onnxruntime as ort  # noqa: PLC0415

    joblib_dir = Path(joblib_dir or config.SERIALIZED_DIR).resolve()
    onnx_dir = Path(onnx_dir or joblib_dir).resolve()
    onnx_dir.mkdir(parents=True, exist_ok=True)

    meta = _load_meta(joblib_dir)
    X = _sample_X(joblib_dir, meta)
    summary: dict[str, Any] = {
        "package": "ml_pipeline_social_media_engagement",
        "full_pipeline_onnx_blocker": FULL_PIPELINE_ONNX_BLOCKER,
        "classifier_calibration_note": CLASSIFIER_ONNX_NOTE,
        "numeric_features": meta["numeric_features"],
        "categorical_features": meta["categorical_features"],
        "raw_feature_column_order": meta["numeric_features"] + meta["categorical_features"],
        "models": {},
    }

    # Use engagement pipeline prep as reference for transformed shape & feature names.
    eng_path = joblib_dir / JOBLIB_KEYS["engagement_rate"]
    if not eng_path.is_file():
        raise FileNotFoundError(f"Missing {eng_path}")

    eng_full = joblib.load(eng_path)
    prep = eng_full.named_steps["prep"]
    Xt_ref = prep.transform(X).astype(np.float32)
    n_out = int(Xt_ref.shape[1])
    names_out = [str(x) for x in prep.get_feature_names_out()]
    summary["n_transformed_features"] = n_out
    summary["transformed_feature_names"] = names_out

    def parity_reg(pipe: Any, Xt: np.ndarray, onnx_path: Path) -> dict[str, float]:
        sk = np.asarray(pipe.named_steps["model"].predict(Xt), dtype=np.float64).ravel()
        sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
        in_name = sess.get_inputs()[0].name
        onx = _onnx_run_reg(sess, in_name, Xt)
        return {
            "max_abs_diff_sklearn_vs_onnx": float(np.max(np.abs(sk - onx))),
            "sklearn_preview": float(sk[0]),
            "onnx_preview": float(onx[0]),
        }

    def parity_clf(inner_pipe: Any, X_raw: pd.DataFrame, onnx_path: Path) -> dict[str, Any]:
        prep_i = inner_pipe.named_steps["prep"]
        model = inner_pipe.named_steps["model"]
        Xt_i = prep_i.transform(X_raw).astype(np.float32)
        sk = np.asarray(model.predict_proba(Xt_i)[:, 1], dtype=np.float64)
        sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
        in_name = sess.get_inputs()[0].name
        onx = np.asarray(_onnx_run_clf_proba(sess, in_name, Xt_i), dtype=np.float64)
        return {
            "max_abs_diff_inner_sklearn_vs_onnx": float(np.max(np.abs(sk - onx))),
            "inner_sklearn_proba_preview": float(sk[0]),
            "onnx_proba_preview": float(onx[0]),
        }

    # --- engagement_rate ---
    key = "engagement_rate"
    m = eng_full.named_steps["model"]
    out_p = onnx_dir / ONNX_FILENAMES[key]
    info = _export_estimator_to_onnx(m, n_out, out_p, is_classifier=False)
    info.update(parity_reg(eng_full, Xt_ref, out_p))
    info["joblib_source"] = JOBLIB_KEYS[key]
    summary["models"][key] = info

    # --- donation_referrals_count ---
    key = "donation_referrals_count"
    path = joblib_dir / JOBLIB_KEYS[key]
    if path.is_file():
        pipe = joblib.load(path)
        Xt = pipe.named_steps["prep"].transform(X).astype(np.float32)
        if Xt.shape[1] != n_out:
            summary["models"][key] = {"error": f"n_features mismatch {Xt.shape[1]} != {n_out}"}
        else:
            out_p = onnx_dir / ONNX_FILENAMES[key]
            info = _export_estimator_to_onnx(pipe.named_steps["model"], n_out, out_p, is_classifier=False)
            info.update(parity_reg(pipe, Xt, out_p))
            info["joblib_source"] = JOBLIB_KEYS[key]
            summary["models"][key] = info
    else:
        summary["models"][key] = {"skipped": True, "reason": f"missing {path.name}"}

    # --- donation_value_log1p ---
    key = "donation_value_log1p"
    path = joblib_dir / JOBLIB_KEYS[key]
    if path.is_file():
        pipe = joblib.load(path)
        Xt = pipe.named_steps["prep"].transform(X).astype(np.float32)
        if Xt.shape[1] != n_out:
            summary["models"][key] = {"error": f"n_features mismatch {Xt.shape[1]} != {n_out}"}
        else:
            out_p = onnx_dir / ONNX_FILENAMES[key]
            info = _export_estimator_to_onnx(pipe.named_steps["model"], n_out, out_p, is_classifier=False)
            info.update(parity_reg(pipe, Xt, out_p))
            info["joblib_source"] = JOBLIB_KEYS[key]
            summary["models"][key] = info
    else:
        summary["models"][key] = {"skipped": True, "reason": f"missing {path.name}"}

    # --- p_any_referral (CalibratedClassifierCV → fold-0 inner Pipeline) ---
    key = "p_any_referral"
    path = joblib_dir / JOBLIB_KEYS[key]
    if path.is_file():
        clf_cal = joblib.load(path)
        inner, unwrap_note = _unwrap_classifier_pipeline(clf_cal)
        prep_i = inner.named_steps["prep"]
        model = inner.named_steps["model"]
        Xt_i = prep_i.transform(X).astype(np.float32)
        if Xt_i.shape[1] != n_out:
            summary["models"][key] = {"error": f"n_features mismatch {Xt_i.shape[1]} != {n_out}"}
        else:
            out_p = onnx_dir / ONNX_FILENAMES[key]
            info = _export_estimator_to_onnx(model, n_out, out_p, is_classifier=True)
            info.update(parity_clf(inner, X, out_p))
            info["joblib_source"] = JOBLIB_KEYS[key]
            info["unwrap"] = unwrap_note
            summary["models"][key] = info
    else:
        summary["models"][key] = {"skipped": True, "reason": f"missing {path.name}"}

    eng_info = summary["models"].get("engagement_rate") or {}
    summary["onnx_export_schema_version"] = 1
    summary["onnx_input_layout"] = {
        "tensor_name": eng_info.get("onnx_input_name", "X"),
        "dtype": "float32",
        "shape": [None, n_out],
        "semantics": "Output of sklearn ColumnTransformer prep (same space as joblib pipelines).",
    }

    sidecar = onnx_dir / SIDECAR_NAME
    with open(sidecar, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, default=str, allow_nan=False)

    summary["sidecar_path"] = str(sidecar)
    return summary


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Export social recommender estimators to ONNX (post-prep tensors).")
    ap.add_argument(
        "--joblib-dir",
        type=Path,
        default=None,
        help="Directory containing *.joblib and social_media_engagement_metadata.json",
    )
    ap.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Where to write *.onnx and social_onnx_export_metadata.json (default: same as joblib-dir)",
    )
    args = ap.parse_args(argv)
    try:
        out = export_social_pipelines_to_onnx(joblib_dir=args.joblib_dir, onnx_dir=args.output_dir)
    except Exception as e:  # noqa: BLE001
        print(f"ONNX export failed: {e}", file=sys.stderr)
        return 1
    print(json.dumps({k: out[k] for k in ("n_transformed_features", "sidecar_path") if k in out}, indent=2))
    for mk, mv in out.get("models", {}).items():
        st = "ok" if "onnx_bytes" in mv else mv.get("error") or mv.get("reason") or str(mv)
        print(f"  {mk}: {st}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
