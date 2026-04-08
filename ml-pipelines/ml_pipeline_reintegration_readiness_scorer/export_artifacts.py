"""
Train models, threshold tuning, calibration, plots, save pipeline + metadata + sample I/O.
"""

from __future__ import annotations

import json
import math
import shutil
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from . import config
from .data_prep import load_tables, parse_datetime_columns
from .feature_engineering import build_snapshot_frame, feature_columns
from .inference_explain import build_inference_payload
from .model_finalize import finalize_model
from .plotting import save_evaluation_plots
from .train_explanatory import run_explanatory
from .train_predictive import train_compare_models


def _json_sanitize(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _json_sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_json_sanitize(v) for v in obj]
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    if isinstance(obj, np.floating) and (np.isnan(obj) or np.isinf(obj)):
        return None
    return obj


def _importance_transformed(pipe: Any, k: int = 30) -> list[dict[str, float]] | None:
    model = pipe.named_steps.get("model")
    prep = pipe.named_steps.get("prep")
    if model is None or prep is None or not hasattr(model, "feature_importances_"):
        return None
    names = list(prep.get_feature_names_out())
    imps = model.feature_importances_
    df = pd.DataFrame({"feature": names, "importance": imps}).sort_values("importance", ascending=False)
    return df.head(k).to_dict(orient="records")


def _importance_aggregate_csv(pipe: Any, num: list[str], cat: list[str], path: Path) -> None:
    model = pipe.named_steps.get("model")
    prep = pipe.named_steps.get("prep")
    if model is None or prep is None or not hasattr(model, "feature_importances_"):
        return
    names = np.array(prep.get_feature_names_out())
    imps = model.feature_importances_
    agg: dict[str, float] = {c: 0.0 for c in num + cat}
    for n, w in zip(names, imps):
        n = str(n)
        for c in num:
            if n == f"num__{c}":
                agg[c] += float(w)
                break
        else:
            for c in cat:
                if n.startswith(f"cat__{c}_"):
                    agg[c] += float(w)
                    break
    out = pd.DataFrame([{"feature": k, "importance": v} for k, v in agg.items()])
    out = out.sort_values("importance", ascending=False)
    out.to_csv(path, index=False)


def export_all(data_dir: Path | None = None, serialized_dir: Path | None = None) -> dict[str, Any]:
    data_dir = data_dir or config.DEFAULT_DATA_DIR
    serialized_dir = serialized_dir or config.SERIALIZED_DIR
    config.OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    serialized_dir.mkdir(parents=True, exist_ok=True)

    tables = parse_datetime_columns(load_tables(data_dir))
    df, snap_meta = build_snapshot_frame(tables)
    num, cat = feature_columns(df)
    Xcols = num + cat

    bundle = train_compare_models(df, num, cat)
    best_name = bundle["best_name"]
    best_uncalibrated = bundle["best_pipeline"]
    train_df = bundle["train_df"]
    test_df = bundle["test_df"]

    run_explanatory(
        train_df[Xcols],
        train_df[config.TARGET_COL].astype(int).values,
        num,
        cat,
        outputs_dir=config.OUTPUTS_DIR,
    )

    finalized = finalize_model(
        best_uncalibrated,
        train_df,
        test_df,
        num,
        cat,
        config.TARGET_COL,
        recall_floor=0.6,
    )
    final_pipe = finalized["final_pipeline"]
    selected_t = finalized["selected_threshold"]
    y_test = np.asarray(test_df[config.TARGET_COL].values, dtype=int)
    proba_test = finalized["y_test_proba"]
    cal_curve = finalized["calibration_curve_holdout"]

    plot_paths = save_evaluation_plots(
        config.OUTPUTS_DIR,
        y_test,
        proba_test,
        cal_curve.get("prob_true", []),
        cal_curve.get("prob_pred", []),
    )

    # Importance from base estimator (same trees/weights as pre-calibration); calibration is Platt on scores
    _importance_aggregate_csv(best_uncalibrated, num, cat, config.OUTPUTS_DIR / "final_model_feature_importance.csv")
    imp_top = _importance_transformed(best_uncalibrated, 25)

    thresh_grid = finalized["oof_threshold_info"].get("threshold_grid", [])
    pd.DataFrame(thresh_grid).to_csv(config.OUTPUTS_DIR / "threshold_search_oof.csv", index=False)

    train_medians = train_df[num].median(numeric_only=True).to_dict()
    with open(serialized_dir / "train_reference_medians.json", "w", encoding="utf-8") as f:
        json.dump(_json_sanitize(train_medians), f, indent=2, default=str)

    train_stds = train_df[num].std(numeric_only=True).to_dict()
    with open(serialized_dir / "train_reference_stds.json", "w", encoding="utf-8") as f:
        json.dump(_json_sanitize(train_stds), f, indent=2, default=str)

    coef_src = config.OUTPUTS_DIR / "explanatory_logistic_coefficients.csv"
    if coef_src.is_file():
        shutil.copy(coef_src, serialized_dir / "explanation_logistic_coefficients.csv")

    oof_raw = finalized["oof_threshold_info"]
    oof_for_meta = {k: v for k, v in oof_raw.items() if k != "threshold_grid"}
    oof_for_meta["threshold_grid_sample"] = oof_raw.get("threshold_grid", [])[:10]
    oof_for_meta["full_threshold_grid_csv"] = "outputs/threshold_search_oof.csv"

    metadata: dict[str, Any] = {
        "pipeline": "reintegration_readiness_scorer",
        "target": config.TARGET_COL,
        "label_definition": (
            f"1 if reintegration Completed with completion date in (T, T+{config.SUCCESS_HORIZON_DAYS} days] "
            "from observation snapshot T; features use only events with date < T."
        ),
        "snapshot_meta": snap_meta,
        "numeric_features": num,
        "categorical_features": cat,
        "best_model": best_name,
        "model_selection_note": (
            "Models ranked by composite holdout score: 0.45×ROC-AUC + 0.40×PR-AUC + 0.10×precision@top10% "
            "+ 0.05×recall@top10% (discrimination and triage coverage, not accuracy)."
        ),
        "model_comparison": bundle["all_results"].to_dict(orient="records"),
        "holdout_metrics_threshold_0.5": finalized["holdout_metrics_threshold_0.5"],
        "holdout_metrics_tuned_threshold": finalized["holdout_metrics_tuned_threshold"],
        "default_proba_threshold": config.DEFAULT_PROBA_THRESHOLD,
        "selected_threshold": selected_t,
        "oof_threshold_tuning": oof_for_meta,
        "calibration": finalized["calibration_info"],
        "calibration_curve_holdout": cal_curve,
        "brier_score_holdout": finalized["holdout_metrics_tuned_threshold"].get("brier_score"),
        "readiness_bands": [
            {"range": [a, b], "label": lbl} for a, b, lbl in config.READINESS_BANDS
        ],
        "imbalance_notes": (
            "High ROC-AUC with low PR-AUC is common when positives are very rare: ROC ranks scores well, "
            "but baseline precision is near the positive rate, so PR-AUC stays modest. "
            "Precision/recall/F1 at threshold 0.5 were often zero because almost no scores exceed 0.5 on the holdout."
        ),
        "decision_support_note": (
            "Readiness score is decision support for prioritization and conversation — not an automated eligibility decision."
        ),
        "explanation_note": (
            "Factor direction uses coefficients from the explanatory logistic regression on training snapshots "
            "(higher feature values vs median: sign of coef maps to stronger/weaker readiness). "
            "Which factors appear first uses predictive-model feature importance × |coef| × local deviation. "
            "The displayed readiness score comes from the selected predictive model (e.g. random forest)."
        ),
        "n_train_snapshots": len(train_df),
        "n_test_snapshots": len(test_df),
        "n_residents_approx": int(df["resident_id"].nunique()) if "resident_id" in df.columns else None,
        "positive_rate_train": float(train_df[config.TARGET_COL].mean()),
        "positive_rate_test": float(test_df[config.TARGET_COL].mean()),
        "feature_importance_best": imp_top,
        "output_plots": plot_paths,
        "ethics": "Readiness scores are statistical associations on historical snapshots, not deterministic outcomes.",
    }

    joblib.dump(final_pipe, serialized_dir / "reintegration_readiness_pipeline.joblib")

    safe = _json_sanitize(metadata)
    with open(serialized_dir / "reintegration_readiness_metadata.json", "w", encoding="utf-8") as f:
        json.dump(safe, f, indent=2, default=str, allow_nan=False)

    te = test_df.iloc[[0]]
    Xs = te[Xcols]
    proba = float(final_pipe.predict_proba(Xs)[0, 1])
    code = str(te["internal_code"].iloc[0]) if "internal_code" in te.columns else str(te["resident_id"].iloc[0])

    sample_in = {
        "schema": "reintegration_readiness_snapshot_v1",
        "resident_id": int(te["resident_id"].iloc[0]),
        "internal_code": code,
        "observation_date": str(te["observation_date"].iloc[0]),
        "features": {c: (float(te[c].iloc[0]) if c in num else str(te[c].iloc[0])) for c in Xcols},
    }
    sample_out = build_inference_payload(
        proba,
        selected_t,
        final_pipe,
        Xs,
        num,
        cat,
        config.TARGET_COL,
        train_df=train_df,
        coef_csv_path=config.OUTPUTS_DIR / "explanatory_logistic_coefficients.csv",
    )
    sample_out["calibration_applied"] = bool(finalized["calibration_info"].get("used_calibration"))
    sample_out["resident_code"] = code

    with open(serialized_dir / "sample_readiness_input.json", "w", encoding="utf-8") as f:
        json.dump(sample_in, f, indent=2, default=str)
    with open(serialized_dir / "sample_readiness_output.json", "w", encoding="utf-8") as f:
        json.dump(sample_out, f, indent=2, default=str)

    summary = {
        "rows": len(df),
        "best_model": best_name,
        "selected_threshold": selected_t,
        "holdout_roc_auc": finalized["holdout_metrics_tuned_threshold"].get("roc_auc"),
        "holdout_pr_auc": finalized["holdout_metrics_tuned_threshold"].get("pr_auc"),
        "brier_holdout": finalized["holdout_metrics_tuned_threshold"].get("brier_score"),
        "calibration_used": finalized["calibration_info"].get("used_calibration"),
        "metrics_at_0.5": finalized["holdout_metrics_threshold_0.5"],
        "metrics_at_tuned": finalized["holdout_metrics_tuned_threshold"],
        "top_features": imp_top[:8] if imp_top else [],
        "sample_inference": sample_out,
        "metadata_path": serialized_dir / "reintegration_readiness_metadata.json",
    }

    return summary


if __name__ == "__main__":
    print(json.dumps(export_all(), indent=2, default=str))
