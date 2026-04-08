"""
Serialize amount + allocation pipelines, metadata, sample API payloads, combined funding summary.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from . import config
from .allocation_model import combine_amount_and_allocation, train_allocation_forest
from .dataset_utils import feature_target_columns
from .train_explanatory import run_explanatory
from .train_predictive import train_compare_amount


def _amount_feature_importance(pipe: Any) -> list[dict[str, float]] | None:
    model = pipe.named_steps.get("model")
    prep = pipe.named_steps.get("prep")
    if model is None or prep is None or not hasattr(model, "feature_importances_"):
        return None
    names = list(prep.get_feature_names_out())
    imps = model.feature_importances_
    df = pd.DataFrame({"feature": names, "importance": imps}).sort_values("importance", ascending=False)
    return df.head(25).to_dict(orient="records")


def _alloc_feature_importance(pipe: Any) -> list[dict[str, float]] | None:
    return _amount_feature_importance(pipe)


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


def export_all(df: pd.DataFrame, meta: dict, serialized_dir: Path | None = None) -> dict[str, Any]:
    serialized_dir = serialized_dir or config.SERIALIZED_DIR
    config.OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    serialized_dir.mkdir(parents=True, exist_ok=True)

    run_explanatory(df, meta, outputs_dir=config.OUTPUTS_DIR)

    amt_bundle = train_compare_amount(df, meta)
    best_pipe = amt_bundle["best_pipeline"]
    num, cat, _ = feature_target_columns(df, meta)
    alloc_bundle = train_allocation_forest(df, meta, num, cat)

    X_test = amt_bundle["X_test"]
    y_test = amt_bundle["y_test"]
    pred_log = np.clip(best_pipe.predict(X_test), 0, 25)
    y_amt_pred = np.expm1(pred_log)

    alloc_pred = alloc_bundle["Y_pred"]
    combined = combine_amount_and_allocation(y_amt_pred, alloc_pred, meta)

    from .evaluate import regression_metrics

    holdout_amount = regression_metrics(y_test, y_amt_pred)

    metadata: dict[str, Any] = {
        "target_amount": "next monetary donation PHP amount; prior-only features; time-based split",
        "allocation_outputs": meta["allocation_targets_program"] + meta["allocation_targets_safehouse"],
        "allocation_n_program": len(meta["allocation_targets_program"]),
        "best_amount_model": amt_bundle["best_name"],
        "holdout_amount_metrics": holdout_amount,
        "amount_model_comparison": amt_bundle["all_results"].to_dict(orient="records"),
        "random_forest_time_series_cv": amt_bundle.get("random_forest_cv_meta"),
        "allocation_holdout": alloc_bundle["program_area_metrics"],
        "numeric_features": num,
        "categorical_features": cat,
        "combined_predicted_funding_test_rows": combined,
        "amount_feature_importance": _amount_feature_importance(best_pipe),
        "allocation_feature_importance": _alloc_feature_importance(alloc_bundle["pipeline"]),
        "ethics": "Forecasts are uncertain; do not replace donor relationships or commitments.",
    }

    joblib.dump(best_pipe, serialized_dir / "donation_amount_pipeline.joblib")
    joblib.dump(alloc_bundle["pipeline"], serialized_dir / "donation_allocation_pipeline.joblib")
    safe_meta = _json_sanitize(metadata)
    with open(serialized_dir / "donation_forecasting_metadata.json", "w", encoding="utf-8") as f:
        json.dump(safe_meta, f, indent=2, default=str, allow_nan=False)

    sample = amt_bundle["test_df"].iloc[[0]]
    X_s = sample[num + cat]
    pl_amt = best_pipe.predict(X_s)
    pl_amt = float(np.expm1(np.clip(pl_amt[0], 0, 25)))
    pl_alloc = alloc_bundle["pipeline"].predict(X_s)[0]
    prog = meta["allocation_targets_program"]
    sh = meta["allocation_targets_safehouse"]
    n_p = len(prog)
    ap = np.clip(pl_alloc, 0, None)
    ap[:n_p] = ap[:n_p] / max(ap[:n_p].sum(), 1e-9)
    if sh:
        ap[n_p:] = ap[n_p:] / max(ap[n_p:].sum(), 1e-9)

    sid = int(sample["supporter_id"].iloc[0])
    inp = {
        "schema": "donor_next_gift_features_v1",
        "supporter_id": sid,
        "features": X_s.iloc[0].to_dict(),
    }
    with open(serialized_dir / "sample_payload_input.json", "w", encoding="utf-8") as f:
        json.dump(inp, f, indent=2, default=str)

    alloc_dict = {p.replace("y_alloc_", ""): round(float(ap[i]), 4) for i, p in enumerate(prog)}
    sh_dict = (
        {s.replace("y_sh_", "safehouse_"): round(float(ap[n_p + j]), 4) for j, s in enumerate(sh)}
        if sh
        else {}
    )
    top_pos, top_neg = _top_coef_hints()
    out = {
        "supporter_id": f"D-{sid}",
        "predicted_next_donation_php": round(pl_amt, 2),
        "allocation_program_area": alloc_dict,
        "allocation_safehouse": sh_dict,
        "implied_split_example_php": {k: round(pl_amt * v, 2) for k, v in alloc_dict.items()},
        "top_positive_factors": top_pos,
        "top_negative_factors": top_neg,
    }
    with open(serialized_dir / "sample_prediction_output.json", "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)

    return {
        "amount_pipeline": serialized_dir / "donation_amount_pipeline.joblib",
        "allocation_pipeline": serialized_dir / "donation_allocation_pipeline.joblib",
        "metadata": serialized_dir / "donation_forecasting_metadata.json",
        "holdout_amount_metrics": holdout_amount,
    }


def _top_coef_hints() -> tuple[list[str], list[str]]:
    """Load saved Ridge coefs if present for narrative hints."""
    p = config.OUTPUTS_DIR / "explanatory_ridge_coefficients_log_amount.csv"
    if not p.is_file():
        p = config.OUTPUTS_DIR / "explanatory_ols_coefficients_log_amount.csv"
    if not p.is_file():
        return [], []
    c = pd.read_csv(p)
    c = c[c["feature"] != "intercept"]
    c = c.sort_values("coef", ascending=False)
    pos = [f"{r.feature} (coef={r.coef:.4f})" for r in c.head(5).itertuples()]
    neg = [f"{r.feature} (coef={r.coef:.4f})" for r in c.tail(5).itertuples()]
    return pos, list(reversed(neg))


if __name__ == "__main__":
    from .data_prep import load_donation_tables, parse_dates
    from .feature_engineering import build_supervised_rows

    tabs = parse_dates(load_donation_tables(config.DEFAULT_DATA_DIR))
    df, meta = build_supervised_rows(tabs["donations"], tabs["donation_allocations"], tabs["supporters"])
    info = export_all(df, meta)
    print(json.dumps(info["holdout_amount_metrics"], indent=2))
