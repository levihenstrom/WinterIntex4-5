"""
Build resident-level features and the reintegration outcome label from Lighthouse tables.

Leakage control
---------------
- ``window_end`` = observation_date - gap_days (no events in the last ``gap_days`` inform features).
- Aggregates use only rows with event dates in (window_start, window_end].
- Excludes current reintegration status, current risk tier, case_status, and narrative fields from X.

The label uses ``reintegration_status == 'Completed'`` on the master row (see README for censoring).
"""

from __future__ import annotations

import re
from typing import Any

import numpy as np
import pandas as pd

from . import config

# Ordinal emotional proxy for session start/end (higher = more positive affect). Exploratory only.
_EMOTION_SCORE: dict[str, float] = {
    "Withdrawn": 1.0,
    "Distressed": 1.5,
    "Angry": 2.0,
    "Sad": 2.5,
    "Anxious": 3.0,
    "Calm": 4.0,
    "Hopeful": 4.5,
    "Happy": 5.0,
}

_RISK_ORD: dict[str, int] = {"Low": 1, "Medium": 2, "High": 3, "Critical": 4}

_SEVERITY_ORD: dict[str, float] = {"Low": 1.0, "Medium": 2.0, "High": 3.0}


def _years_from_text(s: str | float | None) -> float:
    """Parse strings like '15 Years 9 months' to approximate decimal years."""
    if s is None or (isinstance(s, float) and np.isnan(s)):
        return np.nan
    t = str(s)
    m = re.search(r"(\d+)\s*Year", t, re.I)
    years = float(m.group(1)) if m else np.nan
    mo = re.search(r"(\d+)\s*month", t, re.I)
    if mo and not np.isnan(years):
        years += int(mo.group(1)) / 12.0
    return years


def _bool_series_to_int(s: pd.Series) -> pd.Series:
    return s.map({True: 1, False: 0, "True": 1, "False": 0}).fillna(0).astype(int)


def build_label(residents: pd.DataFrame, positive: str = config.TARGET_POSITIVE_LABEL) -> pd.Series:
    """Binary label: 1 if reintegration marked Completed."""
    st = residents["reintegration_status"].fillna("").astype(str).str.strip()
    return (st == positive).astype(int)


def _process_features(
    pr: pd.DataFrame, resident_ids: np.ndarray, w_start: pd.Timestamp, w_end: pd.Timestamp
) -> pd.DataFrame:
    pr = pr.copy()
    pr = pr[pr["session_date"].notna()]
    mask = (pr["session_date"] > w_start) & (pr["session_date"] <= w_end)
    pr_w = pr.loc[mask]

    pr_w = pr_w.assign(
        _prog=pr_w["progress_noted"].astype(str).str.lower().eq("true"),
        _con=pr_w["concerns_flagged"].astype(str).str.lower().eq("true"),
        _ref=pr_w["referral_made"].astype(str).str.lower().eq("true"),
    )
    pr_w["_start_s"] = pr_w["emotional_state_observed"].map(_EMOTION_SCORE)
    pr_w["_end_s"] = pr_w["emotional_state_end"].map(_EMOTION_SCORE)
    pr_w["_delta"] = pr_w["_end_s"] - pr_w["_start_s"]

    def _gap_mean(g: pd.DataFrame) -> float:
        g = g.sort_values("session_date")
        if len(g) < 2:
            return 0.0
        d = g["session_date"].diff().dt.days.dropna()
        return float(d.mean()) if len(d) else 0.0

    rows = []
    for rid in resident_ids:
        g = pr_w[pr_w["resident_id"] == rid]
        if g.empty:
            rows.append(
                {
                    "resident_id": rid,
                    "pr_sessions_prior": 0,
                    "pr_mean_duration": 0.0,
                    "pr_progress_rate": 0.0,
                    "pr_concern_rate": 0.0,
                    "pr_referral_rate": 0.0,
                    "pr_mean_emotional_delta": 0.0,
                    "pr_gap_mean_days": 0.0,
                    "pr_days_since_last": 9999.0,
                }
            )
            continue
        last = g["session_date"].max()
        days_since = (w_end - last).days
        rows.append(
            {
                "resident_id": rid,
                "pr_sessions_prior": len(g),
                "pr_mean_duration": float(g["session_duration_minutes"].mean()),
                "pr_progress_rate": float(g["_prog"].mean()),
                "pr_concern_rate": float(g["_con"].mean()),
                "pr_referral_rate": float(g["_ref"].mean()),
                "pr_mean_emotional_delta": float(g["_delta"].mean()),
                "pr_gap_mean_days": _gap_mean(g),
                "pr_days_since_last": float(days_since),
            }
        )
    return pd.DataFrame(rows)


def _home_visit_features(
    hv: pd.DataFrame, resident_ids: np.ndarray, w_start: pd.Timestamp, w_end: pd.Timestamp
) -> pd.DataFrame:
    hv = hv.copy()
    hv = hv[hv["visit_date"].notna()]
    mask = (hv["visit_date"] > w_start) & (hv["visit_date"] <= w_end)
    h = hv.loc[mask]
    h = h.assign(
        _fav=h["visit_outcome"].astype(str).str.lower().eq("favorable"),
        _uncoop=h["family_cooperation_level"].astype(str).str.lower().eq("uncooperative"),
    )

    rows = []
    for rid in resident_ids:
        g = h[h["resident_id"] == rid]
        if g.empty:
            rows.append(
                {
                    "resident_id": rid,
                    "hv_visits_prior": 0,
                    "hv_favorable_rate": 0.0,
                    "hv_uncooperative_rate": 0.0,
                }
            )
            continue
        rows.append(
            {
                "resident_id": rid,
                "hv_visits_prior": len(g),
                "hv_favorable_rate": float(g["_fav"].mean()),
                "hv_uncooperative_rate": float(g["_uncoop"].mean()),
            }
        )
    return pd.DataFrame(rows)


def _education_features(
    edu: pd.DataFrame, resident_ids: np.ndarray, w_start: pd.Timestamp, w_end: pd.Timestamp
) -> pd.DataFrame:
    edu = edu.copy()
    edu = edu[edu["record_date"].notna()]
    mask = (edu["record_date"] > w_start) & (edu["record_date"] <= w_end)
    e = edu.loc[mask]
    rows = []
    for rid in resident_ids:
        g = e[e["resident_id"] == rid]
        if g.empty:
            rows.append(
                {
                    "resident_id": rid,
                    "edu_rows_prior": 0,
                    "edu_mean_attendance": 0.0,
                    "edu_mean_progress": 0.0,
                }
            )
            continue
        rows.append(
            {
                "resident_id": rid,
                "edu_rows_prior": len(g),
                "edu_mean_attendance": float(
                    pd.to_numeric(g["attendance_rate"], errors="coerce").mean()
                ),
                "edu_mean_progress": float(pd.to_numeric(g["progress_percent"], errors="coerce").mean()),
            }
        )
    return pd.DataFrame(rows)


def _health_features(
    hw: pd.DataFrame, resident_ids: np.ndarray, w_start: pd.Timestamp, w_end: pd.Timestamp
) -> pd.DataFrame:
    hw = hw.copy()
    hw = hw[hw["record_date"].notna()]
    mask = (hw["record_date"] > w_start) & (hw["record_date"] <= w_end)
    h = hw.loc[mask]
    rows = []
    for rid in resident_ids:
        g = h[h["resident_id"] == rid]
        if g.empty:
            rows.append(
                {
                    "resident_id": rid,
                    "hw_rows_prior": 0,
                    "hw_mean_general": 0.0,
                    "hw_mean_energy": 0.0,
                }
            )
            continue
        rows.append(
            {
                "resident_id": rid,
                "hw_rows_prior": len(g),
                "hw_mean_general": float(
                    pd.to_numeric(g["general_health_score"], errors="coerce").mean()
                ),
                "hw_mean_energy": float(
                    pd.to_numeric(g["energy_level_score"], errors="coerce").mean()
                ),
            }
        )
    return pd.DataFrame(rows)


def _intervention_features(
    ip: pd.DataFrame, resident_ids: np.ndarray, w_end: pd.Timestamp
) -> pd.DataFrame:
    """Plans created on or before window_end (status is snapshot — documented limitation)."""
    ip = ip.copy()
    ip = ip[ip["created_at"].notna()]
    ip = ip[ip["created_at"] <= w_end]
    st = ip["status"].astype(str).str.strip()
    ip = ip.assign(_ach=st.isin(["Achieved", "Closed"]))

    rows = []
    for rid in resident_ids:
        g = ip[ip["resident_id"] == rid]
        if g.empty:
            rows.append(
                {
                    "resident_id": rid,
                    "ip_plans_prior": 0,
                    "ip_achieved_rate": 0.0,
                    "ip_on_hold_rate": 0.0,
                }
            )
            continue
        stg = g["status"].astype(str).str.strip()
        rows.append(
            {
                "resident_id": rid,
                "ip_plans_prior": len(g),
                "ip_achieved_rate": float(g["_ach"].mean()),
                "ip_on_hold_rate": float(stg.str.lower().eq("on hold").mean()),
            }
        )
    return pd.DataFrame(rows)


def _incident_features(
    inc: pd.DataFrame, resident_ids: np.ndarray, w_start: pd.Timestamp, w_end: pd.Timestamp
) -> pd.DataFrame:
    inc = inc.copy()
    inc = inc[inc["incident_date"].notna()]
    mask = (inc["incident_date"] > w_start) & (inc["incident_date"] <= w_end)
    i = inc.loc[mask]
    i = i.assign(_sev=i["severity"].map(_SEVERITY_ORD).fillna(2.0))
    rows = []
    for rid in resident_ids:
        g = i[i["resident_id"] == rid]
        if g.empty:
            rows.append({"resident_id": rid, "inc_count_prior": 0, "inc_mean_severity": 0.0})
            continue
        rows.append(
            {
                "resident_id": rid,
                "inc_count_prior": len(g),
                "inc_mean_severity": float(g["_sev"].mean()),
            }
        )
    return pd.DataFrame(rows)


def build_feature_matrix(
    tables: dict[str, pd.DataFrame],
    observation_date: pd.Timestamp,
    gap_days: int = config.GAP_DAYS,
    lookback_days: int = config.LOOKBACK_DAYS,
) -> tuple[pd.DataFrame, pd.Series, dict[str, Any]]:
    """
    Build X (model inputs), y (Completed=1), and metadata for documentation.

    Returns
    -------
    X : DataFrame
        One row per resident with ``resident_id`` + ``case_control_no`` + features.
    y : Series
        Aligned binary label.
    meta : dict
        Window boundaries, observation date, column groups.
    """
    res = tables["residents"].copy()
    window_end = observation_date - pd.Timedelta(days=gap_days)
    window_start = window_end - pd.Timedelta(days=lookback_days)

    res = res[res["date_of_admission"].notna()].copy()
    y = build_label(res)
    resident_ids = res["resident_id"].values

    sub_cols = [c for c in res.columns if c.startswith("sub_cat_")]
    static = res[
        [
            "resident_id",
            "case_control_no",
            "safehouse_id",
            "case_category",
            "initial_case_assessment",
            "initial_risk_level",
            "date_of_admission",
            "age_upon_admission",
            "length_of_stay",
        ]
        + sub_cols
    ].copy()

    for c in sub_cols:
        static[c] = _bool_series_to_int(static[c])

    static["initial_risk_ord"] = static["initial_risk_level"].map(_RISK_ORD).fillna(2).astype(int)
    _age = static["age_upon_admission"].map(_years_from_text)
    static["age_at_admission_years"] = _age.fillna(_age.median()).fillna(0.0)
    static["stay_years_approx"] = static["length_of_stay"].map(_years_from_text).fillna(0.0)
    static["days_in_program_at_window_end"] = (
        (window_end - static["date_of_admission"]).dt.days.clip(lower=0).astype(float)
    )

    sh = tables["safehouses"][["safehouse_id", "region"]].drop_duplicates()
    static = static.merge(sh, on="safehouse_id", how="left")
    static["region"] = static["region"].fillna("Unknown")

    pr_f = _process_features(tables["process_recordings"], resident_ids, window_start, window_end)
    hv_f = _home_visit_features(tables["home_visitations"], resident_ids, window_start, window_end)
    ed_f = _education_features(tables["education_records"], resident_ids, window_start, window_end)
    hw_f = _health_features(tables["health_wellbeing_records"], resident_ids, window_start, window_end)
    ip_f = _intervention_features(tables["intervention_plans"], resident_ids, window_end)
    inc_f = _incident_features(tables["incident_reports"], resident_ids, window_start, window_end)

    feat = static.merge(pr_f, on="resident_id", how="left")
    for block in (hv_f, ed_f, hw_f, ip_f, inc_f):
        feat = feat.merge(block, on="resident_id", how="left")

    num_cols = [
        "initial_risk_ord",
        "age_at_admission_years",
        "stay_years_approx",
        "days_in_program_at_window_end",
        "pr_sessions_prior",
        "pr_mean_duration",
        "pr_progress_rate",
        "pr_concern_rate",
        "pr_referral_rate",
        "pr_mean_emotional_delta",
        "pr_gap_mean_days",
        "pr_days_since_last",
        "hv_visits_prior",
        "hv_favorable_rate",
        "hv_uncooperative_rate",
        "edu_rows_prior",
        "edu_mean_attendance",
        "edu_mean_progress",
        "hw_rows_prior",
        "hw_mean_general",
        "hw_mean_energy",
        "ip_plans_prior",
        "ip_achieved_rate",
        "ip_on_hold_rate",
        "inc_count_prior",
        "inc_mean_severity",
    ] + sub_cols

    cat_cols = ["case_category", "initial_case_assessment", "region"]

    for c in num_cols:
        if c in feat.columns:
            feat[c] = pd.to_numeric(feat[c], errors="coerce").fillna(0.0)

    X = feat[["resident_id", "case_control_no"] + num_cols + cat_cols].copy()

    meta = {
        "observation_date": str(observation_date.date()),
        "window_start": str(window_start.date()),
        "window_end": str(window_end.date()),
        "gap_days": gap_days,
        "lookback_days": lookback_days,
        "n_residents": len(X),
        "positive_rate": float(y.mean()),
        "numeric_features": num_cols,
        "categorical_features": cat_cols,
        "label_definition": (
            f"y=1 if reintegration_status=='{config.TARGET_POSITIVE_LABEL}' on master record; "
            "Active/In Progress treated as 0 (censored — see README)."
        ),
    }
    return X, y.reset_index(drop=True), meta
