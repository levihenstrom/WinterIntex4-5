"""
Train explanatory + predictive stacks, save joblibs, metadata, sample I/O, charts.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.calibration import CalibratedClassifierCV
from sklearn.inspection import permutation_importance
from sklearn.model_selection import StratifiedKFold

from . import config
from .data_prep import load_social_media_posts
from .feature_engineering import build_modeling_frame, get_X_y
from .train_explanatory import run_explanatory_suite
from .train_predictive import run_predictive_suite


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


def _importance_records(pipe: Any, X: pd.DataFrame, y: np.ndarray, n_repeats: int = 8) -> list[dict[str, float]] | None:
    model = pipe.named_steps.get("model")
    prep = pipe.named_steps.get("prep")
    if model is None or prep is None:
        return None
    names = list(prep.get_feature_names_out())
    if hasattr(model, "feature_importances_"):
        imps = np.asarray(model.feature_importances_, dtype=float)
        if len(imps) != len(names):
            return None
        df = pd.DataFrame({"feature": names, "importance": imps}).sort_values("importance", ascending=False)
        return df.head(30).to_dict(orient="records")
    try:
        r = permutation_importance(
            pipe, X, y, n_repeats=n_repeats, random_state=config.RANDOM_STATE, n_jobs=-1
        )
        imps = r.importances_mean
    except Exception:
        return None
    if len(imps) != len(names):
        return None
    df = pd.DataFrame({"feature": names, "importance": imps}).sort_values("importance", ascending=False)
    return df.head(30).to_dict(orient="records")


def _top_coef_hints(csv_name: str, k: int = 5) -> tuple[list[str], list[str]]:
    p = config.OUTPUTS_DIR / csv_name
    if not p.is_file():
        return [], []
    c = pd.read_csv(p)
    c = c[c["feature"] != "intercept"]
    c = c.sort_values("coef", ascending=False)
    pos = [f"{r.feature} (coef={r.coef:.4g})" for r in c.head(k).itertuples()]
    neg = [f"{r.feature} (coef={r.coef:.4g})" for r in c.tail(k).itertuples()]
    return pos, list(reversed(neg))


def export_all(
    csv_path: Path | None = None,
    serialized_dir: Path | None = None,
) -> dict[str, Any]:
    serialized_dir = serialized_dir or config.SERIALIZED_DIR
    config.OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    serialized_dir.mkdir(parents=True, exist_ok=True)

    raw = load_social_media_posts(csv_path)
    df, meta = build_modeling_frame(raw)

    run_explanatory_suite(df, meta, outputs_dir=config.OUTPUTS_DIR)
    pred = run_predictive_suite(df, meta)

    eng = pred["engagement"]
    ref = pred["referrals_count"]
    dval = pred["donation_value_log1p"]
    any_ref = pred["any_referral"]

    eng_pipe = eng["best_pipeline"]
    ref_pipe = ref["best_pipeline"]
    dval_pipe = dval["best_pipeline"]
    clf_pipe = any_ref["best_pipeline"]
    ref_clip_q = float(getattr(config, "REFERRALS_COUNT_OUTPUT_CLIP_QUANTILE", 0.95))
    ref_clip_max = float(np.nanquantile(df[meta["target_referrals"]].astype(float).values, ref_clip_q))

    referral_calibration_meta: dict[str, Any] = {
        "applied": False,
        "reason": "Raw classifier probabilities are often miscalibrated (especially tree/boosting).",
    }
    if not getattr(config, "CALIBRATE_ANY_REFERRAL_CLASSIFIER", True):
        referral_calibration_meta = {
            "applied": False,
            "reason": "Disabled via config.CALIBRATE_ANY_REFERRAL_CLASSIFIER = False",
        }
    else:
        X_bin, y_bin = get_X_y(df, meta, meta["target_referrals_binary"])
        y_bin = y_bin.astype(int)
        pos, neg = int(y_bin.sum()), int(len(y_bin) - y_bin.sum())
        minor = min(pos, neg)
        # Stratified folds: need n_splits <= minority count (roughly); skip if too few
        n_splits = min(config.CALIBRATION_N_SPLITS, minor)
        if n_splits < 2:
            referral_calibration_meta = {
                "applied": False,
                "reason": f"minority class count {minor} too small for stratified calibration (need >=2 folds)",
            }
        else:
            try:
                cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=config.RANDOM_STATE)
                clf_pipe = CalibratedClassifierCV(
                    estimator=clone(clf_pipe),
                    cv=cv,
                    method=config.CALIBRATION_METHOD,
                )
                clf_pipe.fit(X_bin, y_bin)
                referral_calibration_meta = {
                    "applied": True,
                    "method": config.CALIBRATION_METHOD,
                    "cv_splits": n_splits,
                    "note": (
                        "Probabilities are Platt-scaled (sigmoid) via cross-fitted calibration on the full modeling frame. "
                        "Holdout metrics in predictive_holdout.any_referral still describe the *uncalibrated* model "
                        "used for model selection; ranking uses calibrated scores at inference."
                    ),
                }
            except Exception as exc:  # noqa: BLE001
                referral_calibration_meta = {
                    "applied": False,
                    "error": str(exc),
                    "note": "Calibration skipped; using uncalibrated classifier.",
                }

    # Charts
    fig, ax = plt.subplots(figsize=(8, 4))
    miss = raw.isna().mean().sort_values(ascending=True).tail(20)
    miss.plot(kind="barh", ax=ax, color="steelblue")
    ax.set_title("Top 20 columns by missing fraction (raw data)")
    ax.set_xlabel("fraction NA")
    plt.tight_layout()
    plt.savefig(config.OUTPUTS_DIR / "missingness_top20.png", dpi=120)
    plt.close()

    fig, ax = plt.subplots(figsize=(7, 4))
    raw.groupby("platform")["engagement_rate"].median().sort_values().plot(kind="barh", ax=ax, color="coral")
    ax.set_title("Median engagement_rate by platform (raw)")
    ax.set_xlabel("median engagement_rate")
    plt.tight_layout()
    plt.savefig(config.OUTPUTS_DIR / "median_engagement_by_platform.png", dpi=120)
    plt.close()

    X_eng, y_eng = df[meta["numeric_features"] + meta["categorical_features"]], df[meta["target_engagement"]].values
    imp_eng = _importance_records(eng_pipe, X_eng, y_eng)

    metadata = {
        "pipeline_purpose": "social_media_engagement_and_conversion",
        "n_rows_modeled": len(df),
        "leakage_columns_excluded_from_X": meta["leakage_columns"],
        "dropped_from_X": meta["dropped_from_X"],
        "numeric_features": meta["numeric_features"],
        "categorical_features": meta["categorical_features"],
        "targets": {
            "engagement_rate": meta["target_engagement"],
            "donation_referrals_count": meta["target_referrals"],
            "estimated_donation_value_php_log1p": "log1p(estimated_donation_value_php)",
            "any_referral_binary": meta["target_referrals_binary"],
            "referrals_ge_median": meta["target_referrals_high_median"],
            "any_referral_binary_definition": meta.get("target_referrals_binary_definition"),
            "any_referral_binary_threshold": meta.get("target_referrals_binary_threshold"),
            "legacy_any_referral_definition": meta.get("target_referrals_any_definition"),
        },
        "class_balance": {
            "legacy_any_referral_positive_rate": meta.get("target_referrals_any_rate"),
            "current_any_referral_positive_rate": meta.get("target_referrals_binary_rate"),
        },
        "predictive_holdout": {
            "engagement": {
                "best_model": eng["best_name"],
                "metrics": eng["all_results"]
                .loc[eng["all_results"]["model"] == eng["best_name"], ["rmse", "mae", "r2"]]
                .iloc[0]
                .to_dict(),
                "comparison": eng["all_results"].to_dict(orient="records"),
            },
            "donation_referrals_count": {
                "best_model": ref["best_name"],
                "metrics": ref["all_results"]
                .loc[ref["all_results"]["model"] == ref["best_name"], ["rmse", "mae", "r2"]]
                .iloc[0]
                .to_dict(),
                "comparison": ref["all_results"].to_dict(orient="records"),
            },
            "donation_value_log1p": {
                "best_model": dval["best_name"],
                "metrics": dval["all_results"]
                .loc[dval["all_results"]["model"] == dval["best_name"], ["rmse", "mae", "r2"]]
                .iloc[0]
                .to_dict(),
                "comparison": dval["all_results"].to_dict(orient="records"),
            },
            "any_referral": {
                "best_model": any_ref["best_name"],
                "metrics": any_ref["all_results"]
                .loc[any_ref["all_results"]["model"] == any_ref["best_name"]]
                .iloc[0]
                .to_dict(),
                "comparison": any_ref["all_results"].to_dict(orient="records"),
            },
            "referrals_ge_median": {
                "best_model": pred["referrals_ge_median"]["best_name"],
                "metrics": pred["referrals_ge_median"]["all_results"]
                .loc[pred["referrals_ge_median"]["all_results"]["model"] == pred["referrals_ge_median"]["best_name"]]
                .iloc[0]
                .to_dict(),
                "comparison": pred["referrals_ge_median"]["all_results"].to_dict(orient="records"),
            },
        },
        "referrals_count_postprocess": {
            "trained_target_transform": pred["referrals_count"].get("target_transform", "none"),
            "inverse": pred["referrals_count"].get("prediction_inverse", "identity"),
            "clip_min": 0.0,
            "clip_max": round(ref_clip_max, 4),
            "clip_max_quantile": ref_clip_q,
            "note": (
                "Referrals-count model is trained on log1p(target) and inverted with expm1 at inference; "
                "output is clipped to [0, q-quantile] for business-safe display/ranking."
            ),
        },
        "prediction_guardrails": {
            "p_any_referral_display_max": float(getattr(config, "P_ANY_REFERRAL_DISPLAY_MAX", 1.0)),
            "note": "Guardrails apply to recommendation/display outputs; holdout metrics are computed without this clipping.",
        },
        "permutation_importance_engagement_top": imp_eng,
        "any_referral_probability_calibration": referral_calibration_meta,
        "ethics": "Associations are not causal. Human judgment required for content and brand.",
    }

    joblib.dump(eng_pipe, serialized_dir / "engagement_rate_pipeline.joblib")
    joblib.dump(ref_pipe, serialized_dir / "donation_referrals_count_pipeline.joblib")
    joblib.dump(dval_pipe, serialized_dir / "donation_value_log1p_pipeline.joblib")
    joblib.dump(clf_pipe, serialized_dir / "any_referral_classifier_pipeline.joblib")

    safe = _json_sanitize(metadata)
    with open(serialized_dir / "social_media_engagement_metadata.json", "w", encoding="utf-8") as f:
        json.dump(safe, f, indent=2, default=str, allow_nan=False)

    # Sample row from test-like holdout: use first row of modeling frame
    sample = df.iloc[[0]]
    Xs = sample[meta["numeric_features"] + meta["categorical_features"]]
    inp = {"schema": "social_post_features_v1", "features": Xs.iloc[0].to_dict()}
    with open(serialized_dir / "sample_payload_input.json", "w", encoding="utf-8") as f:
        json.dump(inp, f, indent=2, default=str)

    pe = float(eng_pipe.predict(Xs)[0])
    ref_raw = np.asarray(ref_pipe.predict(Xs), dtype=float)
    if pred["referrals_count"].get("target_transform") == "log1p":
        ref_raw = np.expm1(ref_raw)
    pr = float(np.clip(ref_raw, 0.0, ref_clip_max)[0])
    pv = float(np.expm1(dval_pipe.predict(Xs)[0]))
    pconv = float(clf_pipe.predict_proba(Xs)[0, 1])
    pconv = float(np.clip(pconv, 0.0, float(getattr(config, "P_ANY_REFERRAL_DISPLAY_MAX", 1.0))))
    pos_e, neg_e = _top_coef_hints("explanatory_ridge_engagement_rate.csv")
    pos_r, neg_r = _top_coef_hints("explanatory_ridge_donation_referrals.csv")

    out = {
        "platform": str(sample["platform"].iloc[0]),
        "post_type": str(sample["post_type"].iloc[0]),
        "post_hour": int(sample["post_hour"].iloc[0]) if pd.notna(sample["post_hour"].iloc[0]) else None,
        "content_topic": str(sample["content_topic"].iloc[0]),
        "predicted_engagement_rate": round(pe, 4),
        "predicted_donation_referrals": round(pr, 2),
        "predicted_estimated_donation_value_php": round(pv, 2),
        "predicted_p_any_referral": round(pconv, 4),
        "top_positive_factors_engagement_explanatory": pos_e,
        "top_negative_factors_engagement_explanatory": neg_e,
        "top_positive_factors_referrals_explanatory": pos_r,
        "top_negative_factors_referrals_explanatory": neg_r,
        "note": "Explanatory factors are Ridge coefficients; predictions from best holdout models.",
    }
    with open(serialized_dir / "sample_prediction_output.json", "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, default=str)

    return {
        "metadata_path": serialized_dir / "social_media_engagement_metadata.json",
        "rows": len(df),
        "engagement_best": eng["best_name"],
    }


if __name__ == "__main__":
    info = export_all()
    print(json.dumps({"rows": info["rows"], "engagement_best": info["engagement_best"]}, indent=2))
