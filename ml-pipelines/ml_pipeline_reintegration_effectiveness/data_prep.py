"""
Load and lightly clean Lighthouse CSV extracts used by the reintegration pipeline.

No PII columns are dropped here (downstream modeling excludes narrative text);
callers should not log raw notes to external systems.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd


TABLE_FILES: dict[str, str] = {
    "residents": "residents.csv",
    "process_recordings": "process_recordings.csv",
    "home_visitations": "home_visitations.csv",
    "education_records": "education_records.csv",
    "health_wellbeing_records": "health_wellbeing_records.csv",
    "intervention_plans": "intervention_plans.csv",
    "incident_reports": "incident_reports.csv",
    "safehouses": "safehouses.csv",
}


def load_tables(data_dir: str | Path) -> dict[str, pd.DataFrame]:
    """
    Load all required tables from ``data_dir``.

    Parameters
    ----------
    data_dir:
        Path to folder containing lighthouse_csv_v7-style CSV files.

    Returns
    -------
    dict
        Table name -> DataFrame
    """
    root = Path(data_dir)
    if not root.is_dir():
        raise FileNotFoundError(f"Data directory not found: {root}")

    out: dict[str, pd.DataFrame] = {}
    for name, fname in TABLE_FILES.items():
        fp = root / fname
        if not fp.is_file():
            raise FileNotFoundError(f"Missing required file: {fp}")
        out[name] = pd.read_csv(fp)
    return out


def parse_datetime_columns(tables: dict[str, pd.DataFrame]) -> dict[str, pd.DataFrame]:
    """Return shallow copy with known date columns parsed to datetime64."""
    t = {k: v.copy() for k, v in tables.items()}

    if "session_date" in t["process_recordings"].columns:
        t["process_recordings"]["session_date"] = pd.to_datetime(
            t["process_recordings"]["session_date"], errors="coerce"
        )
    if "visit_date" in t["home_visitations"].columns:
        t["home_visitations"]["visit_date"] = pd.to_datetime(
            t["home_visitations"]["visit_date"], errors="coerce"
        )
    if "record_date" in t["education_records"].columns:
        t["education_records"]["record_date"] = pd.to_datetime(
            t["education_records"]["record_date"], errors="coerce"
        )
    if "record_date" in t["health_wellbeing_records"].columns:
        t["health_wellbeing_records"]["record_date"] = pd.to_datetime(
            t["health_wellbeing_records"]["record_date"], errors="coerce"
        )
    if "incident_date" in t["incident_reports"].columns:
        t["incident_reports"]["incident_date"] = pd.to_datetime(
            t["incident_reports"]["incident_date"], errors="coerce"
        )
    for col in ("created_at", "updated_at"):
        if col in t["intervention_plans"].columns:
            t["intervention_plans"][col] = pd.to_datetime(
                t["intervention_plans"][col], errors="coerce"
            )

    if "date_of_admission" in t["residents"].columns:
        t["residents"]["date_of_admission"] = pd.to_datetime(
            t["residents"]["date_of_admission"], errors="coerce"
        )

    return t


def compute_global_observation_date(tables: dict[str, pd.DataFrame]) -> pd.Timestamp:
    """
    Latest timestamp across dated activity tables (same idea as other ml-pipelines notebooks).

    Used to define a single 'as of' date for the extract so feature windows are comparable.
    """
    candidates: list[pd.Series] = []
    pr = tables["process_recordings"]
    hv = tables["home_visitations"]
    edu = tables["education_records"]
    hw = tables["health_wellbeing_records"]
    inc = tables["incident_reports"]
    ip = tables["intervention_plans"]

    if "session_date" in pr.columns:
        candidates.append(pr["session_date"].dropna())
    if "visit_date" in hv.columns:
        candidates.append(hv["visit_date"].dropna())
    if "record_date" in edu.columns:
        candidates.append(edu["record_date"].dropna())
    if "record_date" in hw.columns:
        candidates.append(hw["record_date"].dropna())
    if "incident_date" in inc.columns:
        candidates.append(inc["incident_date"].dropna())
    if "updated_at" in ip.columns:
        candidates.append(ip["updated_at"].dropna())
    elif "created_at" in ip.columns:
        candidates.append(ip["created_at"].dropna())

    if not candidates:
        raise ValueError("No date columns found to compute observation date.")

    return pd.concat(candidates).max()


def prepare_tables(data_dir: str | Path) -> tuple[dict[str, pd.DataFrame], pd.Timestamp]:
    """
    Load CSVs, parse dates, return tables and global observation timestamp.
    """
    raw = load_tables(data_dir)
    tables = parse_datetime_columns(raw)
    obs = compute_global_observation_date(tables)
    return tables, obs
