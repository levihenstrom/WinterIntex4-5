"""
Recommendation engine for planning next social posts.

Uses already-trained pipelines from serialized_models (no retraining).
"""

from __future__ import annotations

import json
from itertools import product
from pathlib import Path
from typing import Any, Iterable, Mapping

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
    if cl is None or (isinstance(cl, float) and np.isnan(cl)):
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


def _candidate_grid() -> dict[str, list[Any]]:
    """Search dimensions for next-post recommendations (aligned with backend manifest fallbacks)."""
    return {
        "platform": ["Instagram", "Facebook", "TikTok", "Twitter", "YouTube", "LinkedIn", "WhatsApp"],
        "post_type": ["ImpactStory", "FundraisingAppeal", "EducationalContent", "Campaign", "ThankYou"],
        "media_type": ["Photo", "Video", "Reel", "Carousel", "Text"],
        "post_hour": [9, 12, 15, 18, 20],
        "has_call_to_action": [0.0, 1.0],
        "call_to_action_type": ["DonateNow", "LearnMore", "SignUp", "ShareStory"],
        "features_resident_story": [0.0, 1.0],
        "content_topic": ["Education", "Reintegration", "AwarenessRaising", "DonorImpact", "Health"],
    }


def _apply_derived_features(frame: pd.DataFrame) -> pd.DataFrame:
    """Match training-time derived columns from ``feature_engineering.build_modeling_frame``."""
    out = frame.copy()
    if "post_hour" in out.columns:
        out["time_of_day_bucket"] = out["post_hour"].map(_hour_bucket)
    if "caption_length" in out.columns:
        out["caption_length_bucket"] = out["caption_length"].map(_caption_len_bucket)
    plat = out.get("platform", pd.Series("", index=out.index)).fillna("").astype(str).str.strip()
    ptyp = out.get("post_type", pd.Series("", index=out.index)).fillna("").astype(str).str.strip()
    out["platform_post_type"] = plat + "|" + ptyp
    cap_len = (
        out["caption_length"].replace(0, np.nan).fillna(1) if "caption_length" in out.columns else pd.Series(1.0, index=out.index)
    )
    nh = out.get("num_hashtags", pd.Series(0.0, index=out.index))
    out["hashtag_density"] = nh.astype(float) / cap_len.replace(0, 1).astype(float)
    if "call_to_action_type" in out.columns:
        s = out["call_to_action_type"].astype(str)
        out.loc[s.isin(["", "nan", "None"]), "call_to_action_type"] = "__none__"
    if "day_of_week" in out.columns:
        dow = out["day_of_week"].astype(str)
        out["is_weekend"] = dow.str.lower().isin(["saturday", "sunday"]).astype(float)
    return out


def _median_mode_base_row(df_hist: pd.DataFrame, meta: dict[str, Any]) -> dict[str, Any]:
    num = list(meta["numeric_features"])
    cat = list(meta["categorical_features"])
    out: dict[str, Any] = {}
    for c in num:
        if c in df_hist.columns and len(df_hist):
            out[c] = float(pd.to_numeric(df_hist[c], errors="coerce").median())
        else:
            out[c] = 0.0
    for c in cat:
        if c in df_hist.columns and len(df_hist):
            m = df_hist[c].mode(dropna=True)
            out[c] = m.iloc[0] if len(m) else "unknown"
        else:
            out[c] = "unknown"
    return out


def _merge_features(
    base: Mapping[str, Any],
    overrides: Mapping[str, Any] | None,
    *,
    meta: dict[str, Any],
) -> dict[str, Any]:
    row = dict(base)
    if overrides:
        for k, v in overrides.items():
            if v is None:
                continue
            row[k] = v
    num = meta["numeric_features"]
    cat = meta["categorical_features"]
    for c in num + cat:
        if c not in row:
            row[c] = np.nan
    return row


def _predict_row_bundle(
    X: pd.DataFrame,
    *,
    eng: Any,
    ref: Any,
    dval: Any,
    clf: Any,
    meta: dict[str, Any],
) -> tuple[float, float, float, float]:
    pe = float(eng.predict(X)[0])
    ref_raw = np.asarray(ref.predict(X), dtype=float)
    ref_post = meta.get("referrals_count_postprocess", {})
    if ref_post.get("inverse") == "expm1":
        ref_raw = np.expm1(ref_raw)
    clip_max = ref_post.get("clip_max")
    if clip_max is not None:
        try:
            ref_raw = np.clip(ref_raw, 0.0, float(clip_max))
        except (TypeError, ValueError):
            ref_raw = np.clip(ref_raw, 0.0, None)
    else:
        ref_raw = np.clip(ref_raw, 0.0, None)
    pr = float(ref_raw[0])
    pv = float(np.expm1(dval.predict(X)[0]))
    p_any = float(clf.predict_proba(X)[0, 1])
    p_cap = meta.get("prediction_guardrails", {}).get("p_any_referral_display_max")
    if p_cap is not None:
        try:
            p_any = float(np.clip(p_any, 0.0, float(p_cap)))
        except (TypeError, ValueError):
            p_any = float(np.clip(p_any, 0.0, 1.0))
    return pe, p_any, pr, pv


def _fixed_value_match(grid_val: Any, fixed_val: Any) -> bool:
    if isinstance(grid_val, float) and isinstance(fixed_val, (int, float)):
        return float(grid_val) == float(fixed_val)
    return grid_val == fixed_val


def _ranking_score(goal: str, pe: float, p_any: float, pr: float, weights: Mapping[str, dict[str, float]]) -> float:
    w = weights.get(goal) or GOAL_WEIGHTS[goal]
    return (
        w["engagement"] * float(pe)
        + w["p_any_referral"] * float(p_any)
        + w["referrals_count"] * float(pr)
    )


def _why_line(goal: str, pe: float, p_any: float, pr: float, weights: Mapping[str, dict[str, float]]) -> str:
    w = weights.get(goal) or GOAL_WEIGHTS[goal]
    parts = [
        ("engagement", w["engagement"] * pe),
        ("p_any_referral", w["p_any_referral"] * p_any),
        ("referrals_count", w["referrals_count"] * pr),
    ]
    parts.sort(key=lambda x: -x[1])
    top = parts[0][0]
    return f"Top weighted signal for {goal!r}: {top} (linear score mix)."


class SocialRecommenderSession:
    """Load joblibs + metadata from a deployment directory (e.g. App_Data/ml/social)."""

    def __init__(
        self,
        artifact_dir: Path | str,
        posts_csv: Path | str,
        *,
        goal_weights: Mapping[str, dict[str, float]] | None = None,
    ) -> None:
        self._artifact_dir = Path(artifact_dir).resolve()
        self._posts_csv = Path(posts_csv).resolve()
        self._goal_weights: dict[str, dict[str, float]] = dict(goal_weights) if goal_weights else dict(GOAL_WEIGHTS)

        meta_path = self._artifact_dir / "social_media_engagement_metadata.json"
        if not meta_path.is_file():
            raise FileNotFoundError(f"Missing metadata: {meta_path}")
        with open(meta_path, encoding="utf-8") as f:
            self._meta: dict[str, Any] = json.load(f)

        self._eng = joblib.load(self._artifact_dir / "engagement_rate_pipeline.joblib")
        self._ref = joblib.load(self._artifact_dir / "donation_referrals_count_pipeline.joblib")
        self._dval = joblib.load(self._artifact_dir / "donation_value_log1p_pipeline.joblib")
        self._clf = joblib.load(self._artifact_dir / "any_referral_classifier_pipeline.joblib")

        try:
            hist = load_social_media_posts(self._posts_csv)
        except FileNotFoundError:
            hist = pd.DataFrame()
        self._base_row = _median_mode_base_row(hist, self._meta)

    @property
    def meta(self) -> dict[str, Any]:
        return self._meta

    def evaluate_post_configuration(self, features: Mapping[str, Any]) -> dict[str, Any]:
        merged = _merge_features(self._base_row, features, meta=self._meta)
        row = pd.DataFrame([merged])
        row = _apply_derived_features(row)
        num = self._meta["numeric_features"]
        cat = self._meta["categorical_features"]
        X = row[num + cat]
        pe, p_any, pr, pv = _predict_row_bundle(X, eng=self._eng, ref=self._ref, dval=self._dval, clf=self._clf, meta=self._meta)
        return {
            "predicted_engagement_rate": round(pe, 6),
            "predicted_p_any_referral": round(p_any, 6),
            "predicted_referrals_count": round(pr, 4),
            "predicted_estimated_donation_value_php": round(pv, 4),
        }

    def recommend_next_post(
        self,
        goal: str,
        fixed_inputs: Mapping[str, Any] | None,
        top_k: int,
    ) -> tuple[pd.DataFrame, list[dict[str, Any]]]:
        if goal not in self._goal_weights and goal not in GOAL_WEIGHTS:
            raise ValueError(f"Unsupported goal: {goal!r}")

        grid = _candidate_grid()
        keys = list(grid.keys())
        combos: Iterable[tuple[Any, ...]] = product(*(grid[k] for k in keys))

        rows: list[dict[str, Any]] = []
        fixed = dict(fixed_inputs or {})
        for combo in combos:
            cand = dict(zip(keys, combo, strict=True))
            skip = False
            for fk, fv in fixed.items():
                if fk not in cand:
                    continue
                if not _fixed_value_match(cand[fk], fv):
                    skip = True
                    break
            if skip:
                continue
            extra = {k: v for k, v in fixed.items() if k not in cand}
            merged = _merge_features(self._base_row, {**cand, **extra}, meta=self._meta)
            rows.append(merged)

        if not rows:
            return pd.DataFrame(), []

        frame = pd.DataFrame(rows)
        frame = _apply_derived_features(frame)
        num = self._meta["numeric_features"]
        cat = self._meta["categorical_features"]
        X = frame[num + cat]

        pes: list[float] = []
        p_anys: list[float] = []
        prs: list[float] = []
        for i in range(len(frame)):
            Xi = X.iloc[[i]]
            pe, p_any, pr, _pv = _predict_row_bundle(
                Xi, eng=self._eng, ref=self._ref, dval=self._dval, clf=self._clf, meta=self._meta
            )
            pes.append(pe)
            p_anys.append(p_any)
            prs.append(pr)

        scores = [
            _ranking_score(goal, pes[i], p_anys[i], prs[i], self._goal_weights) for i in range(len(frame))
        ]
        frame = frame.copy()
        frame["predicted_engagement_rate"] = pes
        frame["predicted_p_any_referral"] = p_anys
        frame["predicted_referrals_count"] = prs
        frame["ranking_score"] = scores
        frame["goal"] = goal
        frame["why_recommended"] = [
            _why_line(goal, pes[i], p_anys[i], prs[i], self._goal_weights) for i in range(len(frame))
        ]

        frame = frame.sort_values("ranking_score", ascending=False).head(top_k)
        records = frame.to_dict(orient="records")
        return frame, records


def save_recommendations_outputs(
    *,
    goal: str,
    top_k: int = 3,
    output_stem: str,
    fixed_inputs: dict[str, Any] | None = None,
    serialized_dir: Path | None = None,
    posts_csv: Path | None = None,
) -> tuple[pd.DataFrame, pd.DataFrame, Path, Path]:
    """Write sample recommendation tables next to training outputs (notebook / CLI helper)."""
    sdir = serialized_dir or config.SERIALIZED_DIR
    csvp = posts_csv or config.DEFAULT_SOCIAL_CSV
    session = SocialRecommenderSession(sdir, csvp, goal_weights=GOAL_WEIGHTS)
    top, _recs = session.recommend_next_post(goal, fixed_inputs, top_k)
    config.OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    out_csv = config.OUTPUTS_DIR / f"{output_stem}.csv"
    out_json = config.OUTPUTS_DIR / f"{output_stem}.json"
    top.to_csv(out_csv, index=False)
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(top.to_dict(orient="records"), f, indent=2, default=str)
    return top, top, out_csv, out_json
