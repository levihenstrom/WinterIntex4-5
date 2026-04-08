"""
API-shaped JSON for reintegration readiness (subset of fields, stable names).
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from .io_utils import write_json_atomic
from .paths import REINTEGRATION_BACKEND_DIR, ensure_backend_ml_dirs


def _factor_short(line: str, max_len: int = 72) -> str:
    s = line.strip()
    for sep in (" and associated", " — ", "\n"):
        if sep in s:
            s = s.split(sep)[0].strip()
            break
    if len(s) > max_len:
        s = s[: max_len - 1].rstrip() + "…"
    return s


def _json_safe(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_json_safe(v) for v in obj]
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    if isinstance(obj, np.floating) and (np.isnan(obj) or np.isinf(obj)):
        return None
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    return obj


def full_cohort_backend_records(full_df: pd.DataFrame) -> list[dict[str, Any]]:
    """One object per resident; keys match backend contract."""
    rows: list[dict[str, Any]] = []
    for _, r in full_df.iterrows():
        pct = r.get("readiness_percentile_among_current_residents")
        pct_f = round(float(pct), 4) if pd.notna(pct) else None
        rows.append(
            {
                "resident_code": str(r["resident_code"]),
                "as_of_date": str(r.get("as_of_date", "")),
                "reintegration_readiness_score": float(r["reintegration_readiness_score"]),
                "readiness_percentile_among_current_residents": pct_f,
                "support_priority_rank": int(r["support_priority_rank"]),
                "operational_band": str(r["operational_band"]),
                "top_positive_factors": list(r.get("top_positive_factors") or []),
                "top_risk_factors": list(r.get("top_risk_factors") or []),
                "raw_score_note": str(r.get("raw_score_note", "")),
            }
        )
    return rows


def dashboard_backend_records(full_df: pd.DataFrame) -> list[dict[str, Any]]:
    """Compact dashboard rows (short factor lists)."""
    out: list[dict[str, Any]] = []
    for _, r in full_df.iterrows():
        pos = [_factor_short(x) for x in (r.get("top_positive_factors") or [])[:4]]
        risk = [_factor_short(x) for x in (r.get("top_risk_factors") or [])[:4]]
        pct = r.get("readiness_percentile_among_current_residents")
        pct_f = round(float(pct), 4) if pd.notna(pct) else None
        out.append(
            {
                "resident_code": str(r["resident_code"]),
                "reintegration_readiness_score": float(r["reintegration_readiness_score"]),
                "readiness_percentile_among_current_residents": pct_f,
                "support_priority_rank": int(r["support_priority_rank"]),
                "operational_band": str(r["operational_band"]),
                "top_positive_factors_short": pos,
                "top_risk_factors_short": risk,
            }
        )
    return out


def write_reintegration_backend_json(
    full_df: pd.DataFrame,
    *,
    backend_dir: Path | None = None,
    top_n: int = 10,
) -> dict[str, Path]:
    """
    Write standardized JSON under App_Data/ml/reintegration/.

    ``top_10_priority_residents.json`` always contains the first ``top_n`` rows by
    ``support_priority_rank`` (1 = highest support need), independent of the pipeline's
    ``top_k`` CSV/JSON naming under ``outputs/``.
    """
    backend_dir = backend_dir or REINTEGRATION_BACKEND_DIR
    ensure_backend_ml_dirs()

    top_df = full_df.sort_values("support_priority_rank", ascending=True).head(int(top_n))
    full_records = full_cohort_backend_records(full_df)
    top_records = full_cohort_backend_records(top_df)
    dash_records = dashboard_backend_records(full_df)

    paths = {
        "current_resident_scores": backend_dir / "current_resident_scores.json",
        "top_10_priority_residents": backend_dir / "top_10_priority_residents.json",
        "dashboard": backend_dir / "current_resident_scores_dashboard.json",
    }
    for p in paths.values():
        p.parent.mkdir(parents=True, exist_ok=True)

    write_json_atomic(paths["current_resident_scores"], _json_safe(full_records))
    write_json_atomic(paths["top_10_priority_residents"], _json_safe(top_records))
    write_json_atomic(paths["dashboard"], _json_safe(dash_records))

    return paths
