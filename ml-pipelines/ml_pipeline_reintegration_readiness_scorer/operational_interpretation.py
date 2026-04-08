"""
Distribution-aware interpretation for batch (cohort) resident scoring.

Raw model outputs are P(success in next N days); in rare-event settings they are often small and
compressed. Operational fields here are relative to the **current cohort only** — they do not
change the model and do not introduce leakage (computed after scoring all active residents).
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

# Quartile by priority rank (rank 1 = lowest raw score = highest intervention need)
SUPPORT_PRIORITY_GROUPS = ("Top Priority", "High Priority", "Moderate Priority", "Lower Priority")

# Maps quartile group → staff-facing operational band (distinct from raw-probability READINESS_BANDS)
OPERATIONAL_BAND_BY_GROUP: dict[str, str] = {
    "Top Priority": "Needs Immediate Review",
    "High Priority": "Needs Close Follow-up",
    "Moderate Priority": "Routine Monitoring",
    "Lower Priority": "Lower Urgency",
}

INTERPRETATION_NOTE_SHORT = (
    "Raw scores are best interpreted as relative near-term readiness under a rare-event setting. "
    "For active residents, priority rank and percentile are more operationally useful than the absolute probability alone."
)


def cohort_readiness_percentile(
    scores: pd.Series | np.ndarray,
    index: pd.Index | None = None,
) -> pd.Series:
    """
    Percentile of readiness **within the cohort** (0–100), higher = higher modeled readiness (higher raw score).
    Uses mid-rank: rank 1 (lowest score) → ~lowest percentile, rank n (highest score) → ~highest.
    """
    s = pd.Series(scores, index=index) if not isinstance(scores, pd.Series) else scores
    n = len(s)
    if n == 0:
        return pd.Series(dtype=float)
    if n == 1:
        return pd.Series([50.0], index=s.index)
    r = s.rank(method="average", ascending=True)
    return 100.0 * (r - 0.5) / n


def support_priority_group_from_rank(rank: int, n: int) -> str:
    """
    Assign quartile bucket from **support_priority_rank** (1 = lowest raw score, needs most support).
    Bottom 25% of ranks → Top Priority, next 25% → High Priority, etc.
    """
    if n <= 0:
        return SUPPORT_PRIORITY_GROUPS[-1]
    if n == 1:
        return SUPPORT_PRIORITY_GROUPS[0]
    # rank/n in (0,1]; quartile boundaries at 0.25, 0.5, 0.75
    frac = rank / n
    if frac <= 0.25:
        return SUPPORT_PRIORITY_GROUPS[0]
    if frac <= 0.50:
        return SUPPORT_PRIORITY_GROUPS[1]
    if frac <= 0.75:
        return SUPPORT_PRIORITY_GROUPS[2]
    return SUPPORT_PRIORITY_GROUPS[3]


def operational_band_for_group(group: str) -> str:
    return OPERATIONAL_BAND_BY_GROUP.get(group, "Routine Monitoring")


def raw_score_note(compression: dict[str, Any] | None = None) -> str:
    base = (
        "Raw probability is often small in absolute terms; use rank, percentile, and operational band "
        "for prioritization in this rare-event setting — not as a literal certainty."
    )
    if compression and compression.get("score_compression_flag"):
        return (
            base
            + " Cohort scores show strong compression near zero; relative ordering matters more than the number on the scale."
        )
    return base


def score_compression_diagnostics(scores: np.ndarray | pd.Series) -> dict[str, Any]:
    s = np.asarray(scores, dtype=float).ravel()
    n = len(s)
    if n == 0:
        return {
            "n_scores": 0,
            "score_min": None,
            "score_max": None,
            "score_range": None,
            "score_median": None,
            "unique_scores_rounded_6": 0,
            "quantiles_0_25_50_75_100": [],
            "pct_scores_below_0_05": None,
            "score_compression_flag": False,
            "compression_note": "No scores.",
        }
    rng = float(np.max(s) - np.min(s))
    uniq = int(len(np.unique(np.round(s, 6))))
    qs = [float(x) for x in np.quantile(s, [0, 0.25, 0.5, 0.75, 1.0])]
    pct_below = float(np.mean(s < 0.05)) * 100.0
    # Heuristic: very narrow range or almost everyone below 0.05
    compression = (rng < 0.03 and n >= 3) or (pct_below >= 90.0 and n >= 5) or (uniq <= 3 and n >= 8)
    note = (
        "Scores are tightly clustered near zero; use cohort rank and percentile for triage."
        if compression
        else "Score spread is sufficient for both rank and raw scale context."
    )
    return {
        "n_scores": n,
        "score_min": float(np.min(s)),
        "score_max": float(np.max(s)),
        "score_range": rng,
        "score_median": float(np.median(s)),
        "unique_scores_rounded_6": uniq,
        "quantiles_0_25_50_75_100": qs,
        "pct_scores_below_0_05": pct_below,
        "score_compression_flag": compression,
        "compression_note": note,
    }
