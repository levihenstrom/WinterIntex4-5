"""
Recommendation engine for planning next social posts.

Uses already-trained pipelines from serialized_models (no retraining).
"""

from __future__ import annotations

import json
from itertools import product
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from . import config
from .data_prep import load_social_media_posts


GOAL_WEIGHTS = {
    "donations": {"engagement": 0.10, "p_any_referral": 0.55, "referrals_count": 0.35},
    "awareness": {"engagement": 0.75, "p_any_referral": 0.20, "referrals_count": 0.05},
    "mixed": {"engagement": 0.40, "p_any_referral": 0.35, "referrals_count": 0.25},
}


def _hour_bucket(h: Any) -> str:
    try:
        hi = int(h)
    except (TypeError, ValueError):
        return "unknown"
    if 5 <= hi < 12:
        return "morning"
    if 12 <= hi < 17:
        return "afternoon"
    if 17 <= hi < 21:
        return "evening"
    return "night"


def _caption_len_bucket(cl: Any) -> str:
    try:
        v = int(cl)
    except (TypeError, ValueError):
        return "unknown"
    if v < 80:
        return "short"
    if v <= 150:
        return "medium"
    return "long"


def _minmax(s: pd.Series) -> pd.Series:
    lo = float(s.min())
    hi = float(s.max())
    if hi <= lo:
        return pd.Series(np.zeros(len(s)), index=s.index)
    return (s - lo) / (hi - lo)


def _load_artifacts() -> tuple[dict[str, Any], Any, Any, Any]:
    meta_path = config.SERIALIZED_DIR / "social_media_engagement_metadata.json"
    if not meta_path.is_file():
        raise FileNotFoundError("Missing social_media_engagement_metadata.json. Run run_all first.")
    with open(meta_path, encoding="utf-8") as f:
        meta = json.load(f)
    eng = joblib.load(config.SERIALIZED_DIR / "engagement_rate_pipeline.joblib")
    clf = joblib.load(config.SERIALIZED_DIR / "any_referral_classifier_pipeline.joblib")
    ref = None
    ref_path = config.SERIALIZED_DIR / "donation_referrals_count_pipeline.joblib"
    if ref_path.is_file():
        ref = joblib.load(ref_path)
    return meta, eng, clf, ref


def _default_feature_template(meta: dict[str, Any], raw: pd.DataFrame) -> dict[str, Any]:
    """
    Use sample payload when available, otherwise derive medians/modes from raw.
    """
    sample_path = config.SERIALIZED_DIR / "sample_payload_input.json"
    if sample_path.is_file():
        with open(sample_path, encoding="utf-8") as f:
            payload = json.load(f)
        base = dict(payload.get("features", {}))
    else:
        base = {}
    for c in meta["numeric_features"]:
        if c not in base:
            vals = pd.to_numeric(raw.get(c), errors="coerce")
            base[c] = float(np.nanmedian(vals)) if vals is not None and vals.notna().any() else 0.0
    for c in meta["categorical_features"]:
        if c not in base:
            s = raw.get(c)
            if s is not None and len(s.dropna()) > 0:
                base[c] = str(s.mode(dropna=True).iloc[0])
            else:
                base[c] = "unknown"
    # Make sure core helper values exist even if not in saved sample
    base.setdefault("caption_length", 140.0)
    base.setdefault("num_hashtags", 2.0)
    base.setdefault("mentions_count", 0.0)
    base.setdefault("follower_count_at_post", 1500.0)
    base.setdefault("boost_budget_php", 0.0)
    base.setdefault("boost_budget_missing", 1.0)
    base.setdefault("campaign_present", 0.0)
    base.setdefault("month", 6.0)
    base.setdefault("day_of_week", "Wednesday")
    base.setdefault("media_type", "Photo")
    base.setdefault("sentiment_tone", "Grateful")
    return base


def _candidate_grid(raw: pd.DataFrame, fixed_inputs: dict[str, Any] | None) -> dict[str, list[Any]]:
    fixed_inputs = fixed_inputs or {}

    def top_values(col: str, fallback: list[Any], k: int = 6) -> list[Any]:
        if col in fixed_inputs:
            return [fixed_inputs[col]]
        if col in raw.columns:
            vals = raw[col].dropna().astype(str).value_counts().head(k).index.tolist()
            if vals:
                return vals
        return fallback

    grid = {
        "platform": top_values(
            "platform",
            ["Instagram", "Facebook", "TikTok", "Twitter", "YouTube", "LinkedIn", "WhatsApp"],
            k=7,
        ),
        "post_type": top_values(
            "post_type",
            ["ImpactStory", "FundraisingAppeal", "EducationalContent", "Campaign", "ThankYou"],
            k=7,
        ),
        "media_type": top_values(
            "media_type",
            ["Photo", "Video", "Reel", "Carousel", "Text"],
            k=6,
        ),
        "post_hour": [fixed_inputs["post_hour"]] if "post_hour" in fixed_inputs else [9, 12, 15, 18, 20],
        "has_call_to_action": (
            [float(fixed_inputs["has_call_to_action"])]
            if "has_call_to_action" in fixed_inputs
            else [0.0, 1.0]
        ),
        "call_to_action_type": top_values("call_to_action_type", ["DonateNow", "LearnMore", "SignUp", "ShareStory"], k=5),
        "features_resident_story": (
            [float(fixed_inputs["features_resident_story"])]
            if "features_resident_story" in fixed_inputs
            else [0.0, 1.0]
        ),
        "content_topic": top_values(
            "content_topic",
            ["Education", "Reintegration", "AwarenessRaising", "DonorImpact", "Health"],
            k=7,
        ),
    }
    return grid


def _apply_fixed_and_derive(base: dict[str, Any], row: dict[str, Any], fixed_inputs: dict[str, Any] | None) -> dict[str, Any]:
    x = dict(base)
    x.update(row)
    if fixed_inputs:
        x.update(fixed_inputs)

    # Keep CTA coherent
    if float(x.get("has_call_to_action", 0.0)) < 0.5:
        x["call_to_action_type"] = "__none__"
    elif str(x.get("call_to_action_type", "")).strip() in ("", "nan", "None", "__none__"):
        x["call_to_action_type"] = "LearnMore"

    # Derived features expected by trained pipelines
    x["time_of_day_bucket"] = _hour_bucket(x.get("post_hour", 12))
    x["caption_length_bucket"] = _caption_len_bucket(x.get("caption_length", 140))
    x["platform_post_type"] = f"{x.get('platform', '')}|{x.get('post_type', '')}"
    x["is_weekend"] = 1.0 if str(x.get("day_of_week", "")).lower() in ("saturday", "sunday") else 0.0

    cap_len = max(float(x.get("caption_length", 1.0) or 1.0), 1.0)
    x["hashtag_density"] = float(x.get("num_hashtags", 0.0) or 0.0) / cap_len

    is_boosted = 1.0 if float(x.get("is_boosted", 0.0) or 0.0) >= 0.5 else 0.0
    budget = float(x.get("boost_budget_php", 0.0) or 0.0)
    x["boosted_with_budget"] = 1.0 if (is_boosted >= 0.5 and budget > 0) else 0.0
    x["boost_budget_missing"] = 0.0 if budget > 0 else float(x.get("boost_budget_missing", 1.0) or 1.0)

    fc = float(x.get("follower_count_at_post", 0.0) or 0.0)
    x["log_follower_count"] = float(np.log1p(max(fc, 0.0)))

    return x


def _explain_row(row: pd.Series, goal: str) -> str:
    notes = []
    if "media_type" in row.index and pd.notna(row.get("media_type")):
        notes.append(f"media {row['media_type']}")
    notes.append(f"Pred engagement {row['predicted_engagement_rate']:.3f}")
    notes.append(f"P(any referral) {row['predicted_p_any_referral']:.3f}")
    if not np.isnan(row["predicted_referrals_count"]):
        notes.append(f"expected referrals {row['predicted_referrals_count']:.1f}")
    if float(row.get("has_call_to_action", 0.0)) >= 0.5:
        notes.append("CTA included")
    if float(row.get("features_resident_story", 0.0)) >= 0.5:
        notes.append("resident story content")
    notes.append(f"{goal} goal weighting")
    return "; ".join(notes)


def recommend_next_post(
    goal: str,
    fixed_inputs: dict[str, Any] | None = None,
    top_k: int = 3,
) -> tuple[pd.DataFrame, list[dict[str, Any]]]:
    """
    Generate and rank candidate next-post configurations.

    Parameters
    ----------
    goal:
        One of {"donations", "awareness", "mixed"}.
    fixed_inputs:
        Optional dict to lock any model features (e.g. {"platform":"Instagram","media_type":"Video","month":7}).
    top_k:
        Number of recommendations to return.
    """
    goal_key = goal.strip().lower()
    if goal_key not in GOAL_WEIGHTS:
        raise ValueError(f"goal must be one of {sorted(GOAL_WEIGHTS)}")

    meta, eng_model, any_ref_model, ref_model = _load_artifacts()
    raw = load_social_media_posts(config.DEFAULT_SOCIAL_CSV)
    base = _default_feature_template(meta, raw)
    grid = _candidate_grid(raw, fixed_inputs)

    rows: list[dict[str, Any]] = []
    for vals in product(
        grid["platform"],
        grid["post_type"],
        grid["media_type"],
        grid["post_hour"],
        grid["has_call_to_action"],
        grid["call_to_action_type"],
        grid["features_resident_story"],
        grid["content_topic"],
    ):
        candidate = {
            "platform": vals[0],
            "post_type": vals[1],
            "media_type": str(vals[2]),
            "post_hour": int(vals[3]),
            "has_call_to_action": float(vals[4]),
            "call_to_action_type": str(vals[5]),
            "features_resident_story": float(vals[6]),
            "content_topic": str(vals[7]),
        }
        feat = _apply_fixed_and_derive(base, candidate, fixed_inputs)
        rows.append(feat)

    cand = pd.DataFrame(rows)
    # Deduplicate after fixed overrides / derived fields
    cand = cand.drop_duplicates().reset_index(drop=True)

    use_cols = meta["numeric_features"] + meta["categorical_features"]
    for c in use_cols:
        if c not in cand.columns:
            cand[c] = np.nan
    X = cand[use_cols]

    cand["predicted_engagement_rate"] = eng_model.predict(X).astype(float)
    if hasattr(any_ref_model, "predict_proba"):
        cand["predicted_p_any_referral"] = any_ref_model.predict_proba(X)[:, 1].astype(float)
    else:
        cand["predicted_p_any_referral"] = any_ref_model.predict(X).astype(float)
    if ref_model is not None:
        cand["predicted_referrals_count"] = ref_model.predict(X).astype(float)
    else:
        cand["predicted_referrals_count"] = np.nan

    cand["eng_norm"] = _minmax(cand["predicted_engagement_rate"])
    cand["p_any_norm"] = _minmax(cand["predicted_p_any_referral"])
    if cand["predicted_referrals_count"].notna().any():
        cand["ref_count_norm"] = _minmax(cand["predicted_referrals_count"])
    else:
        cand["ref_count_norm"] = 0.0

    w = dict(GOAL_WEIGHTS[goal_key])
    if cand["predicted_referrals_count"].isna().all():
        w["engagement"] += w["referrals_count"] * 0.4
        w["p_any_referral"] += w["referrals_count"] * 0.6
        w["referrals_count"] = 0.0

    cand["ranking_score"] = (
        w["engagement"] * cand["eng_norm"]
        + w["p_any_referral"] * cand["p_any_norm"]
        + w["referrals_count"] * cand["ref_count_norm"]
    )

    keep_cols = [
        "platform",
        "post_type",
        "media_type",
        "post_hour",
        "content_topic",
        "has_call_to_action",
        "call_to_action_type",
        "features_resident_story",
        "predicted_engagement_rate",
        "predicted_p_any_referral",
        "predicted_referrals_count",
        "ranking_score",
    ]
    out = cand.sort_values("ranking_score", ascending=False).head(max(int(top_k), 1)).copy()
    out["goal"] = goal_key
    out["why_recommended"] = out.apply(lambda r: _explain_row(r, goal_key), axis=1)

    # Pretty rounded values for display
    out["predicted_engagement_rate"] = out["predicted_engagement_rate"].round(4)
    out["predicted_p_any_referral"] = out["predicted_p_any_referral"].round(4)
    out["predicted_referrals_count"] = out["predicted_referrals_count"].round(2)
    out["ranking_score"] = out["ranking_score"].round(4)

    out = out[keep_cols + ["goal", "why_recommended"]]
    return out.reset_index(drop=True), out.to_dict(orient="records")


def save_recommendations_outputs(
    goal: str,
    fixed_inputs: dict[str, Any] | None = None,
    top_k: int = 3,
    output_stem: str | None = None,
) -> tuple[pd.DataFrame, list[dict[str, Any]], Path, Path]:
    df, rec_json = recommend_next_post(goal=goal, fixed_inputs=fixed_inputs, top_k=top_k)
    config.OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    stem = output_stem or f"recommendations_{goal}"
    csv_path = config.OUTPUTS_DIR / f"{stem}.csv"
    json_path = config.OUTPUTS_DIR / f"{stem}.json"
    df.to_csv(csv_path, index=False)
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(rec_json, f, indent=2, default=str)
    return df, rec_json, csv_path, json_path
