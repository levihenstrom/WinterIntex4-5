"""Load Lighthouse tables used for reintegration readiness snapshots."""

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
    "incident_reports": "incident_reports.csv",
    "intervention_plans": "intervention_plans.csv",
}


def load_tables(data_dir: str | Path) -> dict[str, pd.DataFrame]:
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
    t = {k: v.copy() for k, v in tables.items()}
    if "session_date" in t["process_recordings"].columns:
        t["process_recordings"]["session_date"] = pd.to_datetime(
            t["process_recordings"]["session_date"], errors="coerce"
        )
    if "visit_date" in t["home_visitations"].columns:
        t["home_visitations"]["visit_date"] = pd.to_datetime(t["home_visitations"]["visit_date"], errors="coerce")
    if "record_date" in t["education_records"].columns:
        t["education_records"]["record_date"] = pd.to_datetime(t["education_records"]["record_date"], errors="coerce")
    if "record_date" in t["health_wellbeing_records"].columns:
        t["health_wellbeing_records"]["record_date"] = pd.to_datetime(
            t["health_wellbeing_records"]["record_date"], errors="coerce"
        )
    if "incident_date" in t["incident_reports"].columns:
        t["incident_reports"]["incident_date"] = pd.to_datetime(t["incident_reports"]["incident_date"], errors="coerce")
    for col in ("created_at", "updated_at", "target_date", "case_conference_date"):
        if col in t["intervention_plans"].columns:
            t["intervention_plans"][col] = pd.to_datetime(t["intervention_plans"][col], errors="coerce")
    r = t["residents"]
    for col in ("date_of_admission", "date_enrolled", "date_closed", "created_at"):
        if col in r.columns:
            r[col] = pd.to_datetime(r[col], errors="coerce")
    t["residents"] = r
    return t


def profile_tables(tables: dict[str, pd.DataFrame]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for name, df in tables.items():
        miss = df.isna().mean().sort_values(ascending=False)
        out[name] = {
            "rows": len(df),
            "columns": list(df.columns),
            "missing_top": miss.head(12).to_dict(),
        }
    return out
