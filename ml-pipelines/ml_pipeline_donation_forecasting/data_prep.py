"""
Load donation-related CSVs. Column names are taken from files — no hardcoded schema beyond joins.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

DEFAULT_FILES = ("donations.csv", "donation_allocations.csv", "supporters.csv")


def load_donation_tables(data_dir: str | Path) -> dict[str, pd.DataFrame]:
    root = Path(data_dir)
    if not root.is_dir():
        raise FileNotFoundError(root)
    out: dict[str, pd.DataFrame] = {}
    for fname in DEFAULT_FILES:
        fp = root / fname
        if not fp.is_file():
            raise FileNotFoundError(fp)
        key = fname.replace(".csv", "")
        out[key] = pd.read_csv(fp)
    return out


def parse_dates(tables: dict[str, pd.DataFrame]) -> dict[str, pd.DataFrame]:
    t = {k: v.copy() for k, v in tables.items()}
    if "donation_date" in t["donations"].columns:
        t["donations"]["donation_date"] = pd.to_datetime(t["donations"]["donation_date"], errors="coerce")
    if "allocation_date" in t["donation_allocations"].columns:
        t["donation_allocations"]["allocation_date"] = pd.to_datetime(
            t["donation_allocations"]["allocation_date"], errors="coerce"
        )
    if "created_at" in t["supporters"].columns:
        t["supporters"]["created_at"] = pd.to_datetime(t["supporters"]["created_at"], errors="coerce")
    if "first_donation_date" in t["supporters"].columns:
        t["supporters"]["first_donation_date"] = pd.to_datetime(
            t["supporters"]["first_donation_date"], errors="coerce"
        )
    return t
