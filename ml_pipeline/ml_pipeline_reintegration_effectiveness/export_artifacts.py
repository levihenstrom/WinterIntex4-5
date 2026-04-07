"""
Serialize predictive pipeline + metadata + sample API payloads for the web app.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from . import config
from .evaluate import evaluate_pipeline, feature_importance_dataframe
from .train_explanatory import run_explanatory, split_xy
from .train_predictive import train_predictive_full


def build_metadata(
    meta: dict,
    tuning: dict,
    test_metrics: dict,
    best_model_name: str,
) -> dict[str, Any]:
    """JSON-serializable deployment metadata."""
    return {
        "pipeline_purpose": "decision_support_reintegration_completed",
        "label": meta.get("label_definition"),
        "observation_date": meta.get("observation_date"),
        "feature_window": [meta.get("window_start"), meta.get("window_end")],
        "numeric_features": meta.get("numeric_features"),
        "categorical_features": meta.get("categorical_features"),
        "model_selection": tuning,
        "holdout_metrics": test_metrics,
        "best_predictive_family": best_model_name,
        "ethics": "Human review required; do not automate removal of care.",
    }


def export_from_trained_bundle(
    pred_bundle: dict[str, Any],
    X: pd.DataFrame,
    y: pd.Series,
    fe_meta: dict,
    serialized_dir: Path | None = None,
    outputs_dir: Path | None = None,
) -> dict[str, Any]:
    """
    Write artifacts using an existing ``train_predictive_full`` result (no second full train).
    """
    serialized_dir = serialized_dir or config.SERIALIZED_DIR
    outputs_dir = outputs_dir or config.OUTPUTS_DIR
    serialized_dir.mkdir(parents=True, exist_ok=True)
    outputs_dir.mkdir(parents=True, exist_ok=True)

    X_train = pred_bundle["X_train"]
    y_train = pred_bundle["y_train"]
    X_test = pred_bundle["X_test"]
    y_test = pred_bundle["y_test"]
    pipe = pred_bundle["pipeline"]
    numeric = pred_bundle["numeric_features"]
    categorical = pred_bundle["categorical_features"]

    _, coef_df = run_explanatory(X_train, y_train, fe_meta, outputs_dir=outputs_dir)

    _, X_test_m = split_xy(X_test, numeric, categorical)
    test_metrics = evaluate_pipeline(pipe, X_test_m, y_test)

    best_name = str(pred_bundle["tuning"].get("selected", "unknown"))
    metadata = build_metadata(fe_meta, pred_bundle["tuning"], test_metrics, best_name)

    imp_df = feature_importance_dataframe(pipe)
    if imp_df is not None:
        imp_path = outputs_dir / "predictive_feature_importances.csv"
        imp_df.to_csv(imp_path, index=False)
        metadata["top_importance_features"] = imp_df.head(15).to_dict(orient="records")

    joblib.dump(pipe, serialized_dir / "reintegration_predictive_pipeline.joblib")
    with open(serialized_dir / "reintegration_model_metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, default=str)

    sample_row = X_test.iloc[[0]].copy()
    sample_payload = {
        "schema": "reintegration_features_v1",
        "features": sample_row.drop(columns=["resident_id"], errors="ignore")
        .iloc[0]
        .to_dict(),
    }
    with open(serialized_dir / "sample_payload_input.json", "w", encoding="utf-8") as f:
        json.dump(sample_payload, f, indent=2, default=str)

    proba = pipe.predict_proba(X_test_m.iloc[[0]])[:, 1][0]
    code = str(sample_row["case_control_no"].iloc[0])
    if code and not code.startswith("C"):
        code = "C-" + code.lstrip("C")

    top_pos, top_risk = _top_factors_from_coef(coef_df, k=5)
    sample_out = {
        "resident_code": code,
        "reintegration_readiness_score": round(float(proba), 4),
        "risk_of_regression": round(float(1.0 - proba), 4),
        "top_positive_factors": top_pos,
        "top_risk_factors": top_risk,
        "note": "Scores are associational / predictive estimates, not clinical facts.",
    }
    with open(serialized_dir / "sample_prediction_output.json", "w", encoding="utf-8") as f:
        json.dump(sample_out, f, indent=2)

    return {
        "metadata_path": serialized_dir / "reintegration_model_metadata.json",
        "pipeline_path": serialized_dir / "reintegration_predictive_pipeline.joblib",
        "test_metrics": test_metrics,
        "coef_path": outputs_dir / "explanatory_logistic_coefficients.csv",
    }


def export_full_run(
    X: pd.DataFrame,
    y: pd.Series,
    fe_meta: dict,
    serialized_dir: Path | None = None,
    outputs_dir: Path | None = None,
) -> dict[str, Any]:
    """
    Train explanatory + predictive, evaluate, write joblib + JSON artifacts.
    """
    pred_bundle = train_predictive_full(X, y, fe_meta)
    return export_from_trained_bundle(
        pred_bundle, X, y, fe_meta, serialized_dir=serialized_dir, outputs_dir=outputs_dir
    )


def _top_factors_from_coef(coef_df: pd.DataFrame, k: int = 5) -> tuple[list[str], list[str]]:
    """Map largest positive / negative logistic coefs to short strings."""
    df = coef_df.sort_values("logistic_coef", ascending=False)
    pos = [f"{r.feature} (OR={r.odds_ratio:.2f})" for r in df.head(k).itertuples()]
    neg = [f"{r.feature} (OR={r.odds_ratio:.2f})" for r in df.tail(k).itertuples()]
    return pos, list(reversed(neg))


if __name__ == "__main__":
    from .data_prep import prepare_tables
    from .feature_engineering import build_feature_matrix

    tables, obs = prepare_tables(config.DEFAULT_DATA_DIR)
    X, y, fe_meta = build_feature_matrix(tables, obs)
    info = export_full_run(X, y, fe_meta)
    print(json.dumps(info["test_metrics"], indent=2))
