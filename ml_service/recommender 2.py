"""Normalize API inputs and map pipeline outputs to JSON-friendly dicts."""

from __future__ import annotations

import math
from typing import Any

from .schemas import RecommendationItem

_BINARY_GRID_KEYS = frozenset({"has_call_to_action", "features_resident_story"})


def public_candidate_fallbacks(raw: dict[str, Any]) -> dict[str, list[Any]]:
    """
    Frontend-safe option lists from manifest fallbacks.
    Binary grid dims use true/false instead of 0.0/1.0.
    """
    out: dict[str, list[Any]] = {}
    for k, v in raw.items():
        if k in _BINARY_GRID_KEYS and isinstance(v, list):
            ordered: list[bool] = []
            seen: set[bool] = set()
            for x in v:
                if isinstance(x, bool):
                    b = x
                elif isinstance(x, (int, float)):
                    b = float(x) >= 0.5
                else:
                    b = bool(x)
                if b not in seen:
                    seen.add(b)
                    ordered.append(b)
            if False in seen and True in seen:
                out[k] = [False, True]
            else:
                out[k] = ordered
        else:
            out[k] = v
    return out


def normalize_fixed_inputs(d: dict[str, Any]) -> dict[str, Any]:
    """Drop nulls; coerce booleans to 0.0/1.0 for model features."""
    out: dict[str, Any] = {}
    for k, v in d.items():
        if v is None:
            continue
        if k in _BINARY_GRID_KEYS:
            if isinstance(v, bool):
                out[k] = 1.0 if v else 0.0
            elif isinstance(v, (int, float)):
                out[k] = 1.0 if float(v) >= 0.5 else 0.0
            else:
                out[k] = float(v)
            continue
        if k == "post_hour":
            out[k] = int(v)
            continue
        out[k] = v
    return out


def pipeline_row_to_item(row: dict[str, Any]) -> RecommendationItem:
    def fnum(x: Any, default: float = 0.0) -> float:
        try:
            v = float(x)
        except (TypeError, ValueError):
            return default
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            return default
        return v

    ref = row.get("predicted_referrals_count")
    ref_f: float | None
    if ref is None or (isinstance(ref, float) and math.isnan(ref)):
        ref_f = None
    else:
        ref_f = fnum(ref)

    return RecommendationItem(
        platform=str(row.get("platform", "")),
        post_type=str(row.get("post_type", "")),
        media_type=str(row.get("media_type", "")),
        post_hour=int(row.get("post_hour", 0)),
        content_topic=str(row.get("content_topic", "")),
        has_call_to_action=fnum(row.get("has_call_to_action", 0)) >= 0.5,
        call_to_action_type=str(row.get("call_to_action_type", "")),
        features_resident_story=fnum(row.get("features_resident_story", 0)) >= 0.5,
        predicted_engagement_rate=fnum(row.get("predicted_engagement_rate", 0)),
        predicted_p_any_referral=fnum(row.get("predicted_p_any_referral", 0)),
        predicted_referrals_count=ref_f,
        ranking_score=fnum(row.get("ranking_score", 0)),
        goal=str(row.get("goal", "")),
        why_recommended=str(row.get("why_recommended", "")),
    )


def normalize_predict_features(features: dict[str, Any]) -> dict[str, Any]:
    out = dict(features)
    for key in _BINARY_GRID_KEYS:
        if key not in out:
            continue
        v = out[key]
        if isinstance(v, bool):
            out[key] = 1.0 if v else 0.0
        elif isinstance(v, (int, float)):
            out[key] = 1.0 if float(v) >= 0.5 else 0.0
    return out
