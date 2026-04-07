"""
Time-aware snapshot rows: features use ONLY events strictly before observation time T.

Target reintegration_success_next_60_days = 1 iff reintegration completion occurs in (T, T+60 days].
Completion date = residents.date_closed when available; if Completed but date_closed missing, falls back to created_at (document limitation).
"""

from __future__ import annotations

import re
from typing import Any

import numpy as np
import pandas as pd

from . import config

_RISK_ORD: dict[str, int] = {"Low": 1, "Medium": 2, "High": 3, "Critical": 4}
_SEVERITY_ORD: dict[str, float] = {"Low": 1.0, "Medium": 2.0, "High": 3.0}

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


def _years_from_age_text(s: str | float | None) -> float:
    if s is None or (isinstance(s, float) and np.isnan(s)):
        return np.nan
    t = str(s)
    m = re.search(r"(\d+)\s*Year", t, re.I)
    years = float(m.group(1)) if m else np.nan
    mo = re.search(r"(\d+)\s*month", t, re.I)
    if mo and not np.isnan(years):
        years += int(mo.group(1)) / 12.0
    return years


def _slope_trend(dates: pd.Series, values: pd.Series) -> float:
    """Linear slope of values vs time (days since first); 0 if ill-defined."""
    ok = dates.notna() & values.notna()
    if ok.sum() < 2:
        return 0.0
    d = dates.loc[ok].sort_values()
    v = values.loc[d.index].astype(float)
    t0 = d.min()
    x = (d - t0).dt.days.astype(float).values
    y = v.values
    if np.std(x) < 1e-9:
        return 0.0
    coef = np.polyfit(x, y, 1)
    return float(coef[0])


def global_data_cutoff(tables: dict[str, pd.DataFrame]) -> pd.Timestamp:
    """Latest event timestamp across tables (for censoring snapshots)."""
    ts: list[pd.Timestamp] = []
    pr = tables["process_recordings"]["session_date"].dropna()
    if len(pr):
        ts.append(pr.max())
    hv = tables["home_visitations"]["visit_date"].dropna()
    if len(hv):
        ts.append(hv.max())
    ed = tables["education_records"]["record_date"].dropna()
    if len(ed):
        ts.append(ed.max())
    hw = tables["health_wellbeing_records"]["record_date"].dropna()
    if len(hw):
        ts.append(hw.max())
    inc = tables["incident_reports"]["incident_date"].dropna()
    if len(inc):
        ts.append(inc.max())
    ip = tables["intervention_plans"]["created_at"].dropna()
    if len(ip):
        ts.append(ip.max())
    if not ts:
        return pd.Timestamp("2027-01-01")
    return max(ts)


def completion_dates(residents: pd.DataFrame) -> pd.Series:
    """resident_id -> completion date or NaT if not Completed."""
    out: dict[int, pd.Timestamp] = {}
    for _, row in residents.iterrows():
        rid = int(row["resident_id"])
        st = str(row.get("reintegration_status", "")).strip()
        if st != config.COMPLETED_STATUS:
            out[rid] = pd.NaT
            continue
        dc = row.get("date_closed")
        if pd.notna(dc):
            out[rid] = pd.to_datetime(dc)
        else:
            out[rid] = pd.to_datetime(row.get("created_at"), errors="coerce")
    return pd.Series(out)


def _snapshot_times(
    enrolled: pd.Timestamp,
    completion: pd.Timestamp | float | None,
    data_cutoff: pd.Timestamp,
) -> list[pd.Timestamp]:
    """Generate observation dates T from enrolled+MIN_DAYS until min(completion, cutoff) exclusive."""
    start = enrolled + pd.Timedelta(days=config.MIN_DAYS_AFTER_ENROLL)
    if pd.isna(enrolled):
        return []
    end = data_cutoff
    if completion is not None and not pd.isna(completion):
        end = min(end, completion - pd.Timedelta(days=1))
    if end < start:
        return []
    times = []
    t = start
    while t <= end:
        times.append(t)
        t = t + pd.Timedelta(days=config.SNAPSHOT_INTERVAL_DAYS)
    return times


def _label_next_60(T: pd.Timestamp, completion: pd.Timestamp | None) -> int:
    if completion is None or pd.isna(completion):
        return 0
    if completion <= T:
        return 0
    if completion <= T + pd.Timedelta(days=config.SUCCESS_HORIZON_DAYS):
        return 1
    return 0


def build_snapshot_frame(tables: dict[str, pd.DataFrame]) -> tuple[pd.DataFrame, dict[str, Any]]:
    residents = tables["residents"].copy()
    cutoff = global_data_cutoff(tables)
    comp_series = completion_dates(residents)

    rows: list[dict[str, Any]] = []
    for _, row in residents.iterrows():
        rid = int(row["resident_id"])
        enrolled = pd.to_datetime(row.get("date_enrolled"), errors="coerce")
        if pd.isna(enrolled):
            enrolled = pd.to_datetime(row.get("date_of_admission"), errors="coerce")
        comp = comp_series.loc[rid] if rid in comp_series.index else pd.NaT
        comp_ts = comp if pd.notna(comp) else None
        for T in _snapshot_times(enrolled, comp_ts, cutoff):
            y = _label_next_60(T, comp_ts)
            feat = compute_features_before_snapshot(tables, rid, T)
            feat["resident_id"] = rid
            feat["internal_code"] = row.get("internal_code", "")
            feat["observation_date"] = T
            feat[config.TARGET_COL] = y
            rows.append(feat)

    df = pd.DataFrame(rows)
    meta = {
        "n_snapshots": len(df),
        "n_residents": residents["resident_id"].nunique(),
        "data_cutoff": str(cutoff),
        "success_horizon_days": config.SUCCESS_HORIZON_DAYS,
        "positive_rate": float(df[config.TARGET_COL].mean()) if len(df) else 0.0,
    }
    return df, meta


def compute_features_before_snapshot(
    tables: dict[str, pd.DataFrame],
    resident_id: int,
    T: pd.Timestamp,
) -> dict[str, Any]:
    """Aggregate features from events with event_date < T (strictly before snapshot)."""
    T = pd.Timestamp(T)
    w_start = T - pd.Timedelta(days=config.FEATURE_LOOKBACK_DAYS)
    out: dict[str, Any] = {}

    # --- process_recordings ---
    pr = tables["process_recordings"]
    pr = pr[pr["resident_id"] == resident_id].copy()
    pr = pr[pr["session_date"].notna()]
    pr_w = pr[(pr["session_date"] >= w_start) & (pr["session_date"] < T)]
    pr_30 = pr_w[pr_w["session_date"] >= T - pd.Timedelta(days=30)]
    if len(pr_w) == 0:
        out.update(
            {
                "pr_sessions_total": 0.0,
                "pr_sessions_last_30d": 0.0,
                "pr_mean_duration": 0.0,
                "pr_progress_rate": 0.0,
                "pr_concern_rate": 0.0,
                "pr_mean_gap_days": 0.0,
                "pr_emotional_improvement_trend": 0.0,
            }
        )
    else:
        prog = pr_w["progress_noted"].astype(str).str.lower().eq("true")
        con = pr_w["concerns_flagged"].astype(str).str.lower().eq("true")
        pr_w = pr_w.assign(
            _prog=prog,
            _con=con,
            _start=pr_w["emotional_state_observed"].map(_EMOTION_SCORE),
            _end=pr_w["emotional_state_end"].map(_EMOTION_SCORE),
        )
        pr_w["_delta"] = pr_w["_end"] - pr_w["_start"]
        g = pr_w.sort_values("session_date")
        gaps = g["session_date"].diff().dt.days.dropna()
        gap_mean = float(gaps.mean()) if len(gaps) else 0.0
        out.update(
            {
                "pr_sessions_total": float(len(pr_w)),
                "pr_sessions_last_30d": float(len(pr_30)),
                "pr_mean_duration": float(pd.to_numeric(pr_w["session_duration_minutes"], errors="coerce").mean() or 0.0),
                "pr_progress_rate": float(pr_w["_prog"].mean()),
                "pr_concern_rate": float(pr_w["_con"].mean()),
                "pr_mean_gap_days": gap_mean,
                "pr_emotional_improvement_trend": _slope_trend(pr_w["session_date"], pr_w["_delta"]),
            }
        )

    # --- home_visitations ---
    hv = tables["home_visitations"]
    hv = hv[hv["resident_id"] == resident_id].copy()
    hv = hv[hv["visit_date"].notna()]
    hv_w = hv[(hv["visit_date"] >= w_start) & (hv["visit_date"] < T)]
    if len(hv_w) == 0:
        out.update(
            {
                "hv_total_visits": 0.0,
                "hv_favorable_rate": 0.0,
                "hv_family_cooperation_rate": 0.0,
            }
        )
    else:
        fav = hv_w["visit_outcome"].astype(str).str.contains("Favorable", case=False, na=False)
        coop = hv_w["family_cooperation_level"].astype(str).str.lower().eq("cooperative")
        out.update(
            {
                "hv_total_visits": float(len(hv_w)),
                "hv_favorable_rate": float(fav.mean()),
                "hv_family_cooperation_rate": float(coop.mean()),
            }
        )

    # --- education_records ---
    ed = tables["education_records"]
    ed = ed[ed["resident_id"] == resident_id].copy()
    ed = ed[ed["record_date"].notna()]
    ed_w = ed[(ed["record_date"] >= w_start) & (ed["record_date"] < T)]
    if len(ed_w) == 0:
        out.update(
            {
                "edu_mean_attendance": 0.0,
                "edu_mean_progress": 0.0,
                "edu_progress_trend": 0.0,
            }
        )
    else:
        att = pd.to_numeric(ed_w["attendance_rate"], errors="coerce")
        prog = pd.to_numeric(ed_w["progress_percent"], errors="coerce")
        out.update(
            {
                "edu_mean_attendance": float(att.mean() or 0.0),
                "edu_mean_progress": float(prog.mean() or 0.0),
                "edu_progress_trend": _slope_trend(ed_w["record_date"], prog),
            }
        )

    # --- health_wellbeing_records ---
    hw = tables["health_wellbeing_records"]
    hw = hw[hw["resident_id"] == resident_id].copy()
    hw = hw[hw["record_date"].notna()]
    hw_w = hw[(hw["record_date"] >= w_start) & (hw["record_date"] < T)]
    if len(hw_w) == 0:
        out.update({"hw_mean_general_health": 0.0, "hw_health_trend": 0.0})
    else:
        gh = pd.to_numeric(hw_w["general_health_score"], errors="coerce")
        out.update(
            {
                "hw_mean_general_health": float(gh.mean() or 0.0),
                "hw_health_trend": _slope_trend(hw_w["record_date"], gh),
            }
        )

    # --- incident_reports ---
    inc = tables["incident_reports"]
    inc = inc[inc["resident_id"] == resident_id].copy()
    inc = inc[inc["incident_date"].notna()]
    inc_w = inc[(inc["incident_date"] >= w_start) & (inc["incident_date"] < T)]
    inc_30 = inc_w[inc_w["incident_date"] >= T - pd.Timedelta(days=30)]
    if len(inc_w) == 0:
        out.update(
            {
                "inc_total": 0.0,
                "inc_last_30d": 0.0,
                "inc_mean_severity": 0.0,
            }
        )
    else:
        sev = inc_w["severity"].map(_SEVERITY_ORD).fillna(1.5)
        out.update(
            {
                "inc_total": float(len(inc_w)),
                "inc_last_30d": float(len(inc_30)),
                "inc_mean_severity": float(sev.mean()),
            }
        )

    # --- intervention_plans ---
    ip = tables["intervention_plans"]
    ip = ip[ip["resident_id"] == resident_id].copy()
    ip = ip[ip["created_at"].notna()]
    ip_w = ip[ip["created_at"] < T]
    if len(ip_w) == 0:
        out.update(
            {
                "ip_total_plans": 0.0,
                "ip_achieved_rate": 0.0,
                "ip_overdue_count": 0.0,
            }
        )
    else:
        st = ip_w["status"].astype(str).str.strip()
        achieved = st.str.lower().eq("achieved")
        td = ip_w["target_date"]
        overdue = (td.notna()) & (td < T) & (~st.str.lower().isin(["achieved", "completed"]))
        out.update(
            {
                "ip_total_plans": float(len(ip_w)),
                "ip_achieved_rate": float(achieved.mean()),
                "ip_overdue_count": float(overdue.sum()),
            }
        )

    # --- static resident (known at admission; no future status) ---
    res = tables["residents"]
    res = res[res["resident_id"] == resident_id].iloc[0]
    out["age_at_admission_years"] = _years_from_age_text(res.get("age_upon_admission"))
    out["case_category"] = str(res.get("case_category", "Unknown"))
    ir = str(res.get("initial_risk_level", "Medium"))
    out["initial_risk_ord"] = float(_RISK_ORD.get(ir, 2))
    out["days_since_enrollment"] = float((T - pd.to_datetime(res.get("date_enrolled"), errors="coerce")).days)
    if np.isnan(out["days_since_enrollment"]):
        out["days_since_enrollment"] = float(
            (T - pd.to_datetime(res.get("date_of_admission"), errors="coerce")).days
        )

    return out


def feature_columns(df: pd.DataFrame) -> tuple[list[str], list[str]]:
    """Numeric + categorical column names for modeling (exclude ids, dates, target)."""
    drop = {"resident_id", "internal_code", "observation_date", config.TARGET_COL}
    num = []
    cat = []
    for c in df.columns:
        if c in drop:
            continue
        if pd.api.types.is_numeric_dtype(df[c]):
            num.append(c)
        else:
            cat.append(c)
    return num, cat
