"""
Leakage-safe feature matrix for modeling.

Downstream performance fields (impressions, likes, clicks, etc.) must NOT be used
as predictors when explaining or forecasting engagement_rate / donation outcomes
from pre-posting information only.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

# Used only for EDA / optional secondary models — never as main strategy features.
LEAKAGE_COLUMNS = [
    "impressions",
    "reach",
    "likes",
    "comments",
    "shares",
    "saves",
    "click_throughs",
    "profile_visits",
    "video_views",
    "watch_time_seconds",
    "avg_view_duration_seconds",
    "subscriber_count_at_post",
    "forwards",
]

# Raw columns dropped from the modeling frame (identifiers, free text, hashtags string).
DROP_FROM_MODELING = [
    "post_id",
    "platform_post_id",
    "post_url",
    "caption",
    "hashtags",
    "campaign_name",  # sparse; use campaign_present instead
]


def _to_bool_series(s: pd.Series) -> pd.Series:
    def one(x: Any) -> float:
        if pd.isna(x):
            return np.nan
        if isinstance(x, (bool, np.bool_)):
            return float(bool(x))
        t = str(x).strip().lower()
        if t in ("true", "1", "yes", "t"):
            return 1.0
        if t in ("false", "0", "no", "f", ""):
            return 0.0
        return np.nan

    return s.map(one)


def _hour_bucket(h: Any) -> str:
    if pd.isna(h):
        return "unknown"
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
    if pd.isna(cl):
        return "unknown"
    try:
        v = int(cl)
    except (TypeError, ValueError):
        return "unknown"
    if v < 80:
        return "short"
    if v <= 150:
        return "medium"
    return "long"


def build_modeling_frame(raw: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, Any]]:
    """
    Returns modeling DataFrame (leakage columns removed) + metadata describing
    feature groups and targets.
    """
    df = raw.copy()

    # Targets (kept in frame until train_* strips them)
    targets = {
        "engagement_rate": "engagement_rate",
        "donation_referrals": "donation_referrals",
        "estimated_donation_value_php": "estimated_donation_value_php",
        "click_throughs": "click_throughs",
        "profile_visits": "profile_visits",
    }
    for tcol in targets:
        if tcol in df.columns:
            df[tcol] = pd.to_numeric(df[tcol], errors="coerce")

    # Booleans from CSV strings
    if "has_call_to_action" in df.columns:
        df["has_call_to_action"] = _to_bool_series(df["has_call_to_action"])
    if "features_resident_story" in df.columns:
        df["features_resident_story"] = _to_bool_series(df["features_resident_story"])
    if "is_boosted" in df.columns:
        df["is_boosted"] = _to_bool_series(df["is_boosted"])

    df["boost_budget_php"] = pd.to_numeric(df.get("boost_budget_php"), errors="coerce")
    df["boost_budget_missing"] = df["boost_budget_php"].isna().astype(float)
    df["boost_budget_php"] = df["boost_budget_php"].fillna(0.0)
    boosted = df["is_boosted"].fillna(0) > 0.5
    df.loc[~boosted, "boost_budget_php"] = 0.0

    df["campaign_present"] = (
        df["campaign_name"].notna() & (df["campaign_name"].astype(str).str.strip().ne(""))
        if "campaign_name" in df.columns
        else 0.0
    ).astype(float)

    df["post_hour"] = pd.to_numeric(df.get("post_hour"), errors="coerce")
    df["num_hashtags"] = pd.to_numeric(df.get("num_hashtags"), errors="coerce").fillna(0)
    df["mentions_count"] = pd.to_numeric(df.get("mentions_count"), errors="coerce").fillna(0)
    df["caption_length"] = pd.to_numeric(df.get("caption_length"), errors="coerce")

    df["follower_count_at_post"] = pd.to_numeric(df.get("follower_count_at_post"), errors="coerce")
    df["log_follower_count"] = np.log1p(df["follower_count_at_post"].clip(lower=0))

    df["month"] = df["created_at"].dt.month if "created_at" in df.columns else np.nan
    df["month"] = pd.to_numeric(df["month"], errors="coerce")

    dow = df["day_of_week"].astype(str) if "day_of_week" in df.columns else pd.Series("", index=df.index)
    df["is_weekend"] = dow.str.lower().isin(["saturday", "sunday"]).astype(float)

    df["time_of_day_bucket"] = df["post_hour"].map(_hour_bucket)
    df["caption_length_bucket"] = df["caption_length"].map(_caption_len_bucket)

    cap_len = df["caption_length"].replace(0, np.nan).fillna(1)
    df["hashtag_density"] = df["num_hashtags"] / cap_len.replace(0, 1)

    df["boosted_with_budget"] = ((df["is_boosted"].fillna(0) > 0.5) & (df["boost_budget_php"] > 0)).astype(float)

    df["call_to_action_type"] = df.get("call_to_action_type", pd.Series(index=df.index, dtype=object)).astype(str)
    df.loc[df["call_to_action_type"].isin(["", "nan", "None"]), "call_to_action_type"] = "__none__"

    plat = df.get("platform", pd.Series("", index=df.index)).fillna("").astype(str).str.strip()
    ptyp = df.get("post_type", pd.Series("", index=df.index)).fillna("").astype(str).str.strip()
    df["platform_post_type"] = plat + "|" + ptyp

    # Fill remaining bool NaNs for tree models
    for c in ("has_call_to_action", "features_resident_story", "is_boosted"):
        if c in df.columns:
            df[c] = df[c].fillna(0.0)

    # Classification helpers
    df["referrals_positive"] = (df["donation_referrals"].fillna(0) > 0).astype(int)
    med_ref = float(df["donation_referrals"].median())
    df["referrals_high"] = (df["donation_referrals"].fillna(0) >= med_ref).astype(int)

    meta: dict[str, Any] = {
        "leakage_columns": list(LEAKAGE_COLUMNS),
        "dropped_from_X": list(DROP_FROM_MODELING) + list(LEAKAGE_COLUMNS),
        "numeric_features": [
            "post_hour",
            "num_hashtags",
            "mentions_count",
            "caption_length",
            "boost_budget_php",
            "boost_budget_missing",
            "log_follower_count",
            "month",
            "is_weekend",
            "hashtag_density",
            "campaign_present",
            "boosted_with_budget",
            "has_call_to_action",
            "features_resident_story",
            "is_boosted",
        ],
        "categorical_features": [
            "platform",
            "day_of_week",
            "post_type",
            "media_type",
            "call_to_action_type",
            "content_topic",
            "sentiment_tone",
            "time_of_day_bucket",
            "caption_length_bucket",
            "platform_post_type",
        ],
        "target_engagement": "engagement_rate",
        "target_referrals": "donation_referrals",
        "target_donation_value": "estimated_donation_value_php",
        "target_referrals_binary": "referrals_positive",
        "target_referrals_high_median": "referrals_high",
        "secondary_targets_post_performance": ["click_throughs", "profile_visits"],
    }

    # Drop rows without main regression target
    df = df[df["engagement_rate"].notna()].copy()

    return df, meta


def get_X_y(
    df: pd.DataFrame,
    meta: dict[str, Any],
    target_col: str,
) -> tuple[pd.DataFrame, np.ndarray]:
    num = meta["numeric_features"]
    cat = meta["categorical_features"]
    for c in num + cat:
        if c not in df.columns:
            raise KeyError(f"Missing feature column: {c}")
    X = df[num + cat].copy()
    y = df[target_col].astype(float).values
    return X, y


def eda_frame_with_leakage(raw: pd.DataFrame) -> pd.DataFrame:
    """Full frame including leakage cols for notebook EDA only."""
    return raw.copy()
