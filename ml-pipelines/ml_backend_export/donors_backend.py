"""
Backend JSON for donor churn / outreach prioritization.

Uses a documented **heuristic** from ``supporters.csv`` + ``donations.csv`` so exports always work
for Phase 1. When a trained ``donor_churn_pipeline.joblib`` exists and is wired to this module,
replace the heuristic path while keeping the same output field names.

**Donor universe:** Only supporters with at least one qualifying donation are scored:
``donation_type == "Monetary"`` and ``amount`` is non-null. Volunteers and other non-donor
supporter types are excluded unless they have such a gift on file.
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from .io_utils import write_json_atomic
from .paths import DONORS_BACKEND_DIR, LIGHTHOUSE_DATA_DIR, ensure_backend_ml_dirs

DONOR_ELIGIBILITY_RULE = (
    "Supporters included only if they have ≥1 donation row with donation_type='Monetary' "
    "and a non-null amount (same rule as the donor-retention cohort)."
)


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
    return obj


def _risk_band(score: float) -> str:
    if score >= 0.75:
        return "Critical"
    if score >= 0.5:
        return "High"
    if score >= 0.25:
        return "Moderate"
    return "Lower"


def _heuristic_churn_frame(data_dir: Path) -> pd.DataFrame:
    """
    Heuristic churn risk [0,1]: higher = more likely to need retention outreach.

    **Population:** Only supporters with ≥1 qualifying monetary gift (see module docstring).
    Rows are joined to ``supporters.csv`` for ``display_name`` only after eligibility is set.

    Rule (documented):
    - reference_date = max monetary donation date in file (proxy for "as of" data freshness).
    - days_since_last_monetary: larger gap => higher risk component.
    - inverse lifetime monetary sum (log scale): lower giving => slight risk bump.

    This is NOT the notebook's supervised model; train + export joblib for production parity.
    """
    sup = pd.read_csv(data_dir / "supporters.csv").drop_duplicates(subset=["supporter_id"], keep="first")
    don = pd.read_csv(data_dir / "donations.csv")
    don["donation_date"] = pd.to_datetime(don["donation_date"], errors="coerce")
    mon = don[don["donation_type"].astype(str).str.strip().eq("Monetary")].copy()
    mon["amount_num"] = pd.to_numeric(mon["amount"], errors="coerce")
    mon = mon[mon["amount_num"].notna()].copy()
    if mon.empty:
        return pd.DataFrame(
            columns=[
                "supporter_id",
                "display_name",
                "last_monetary",
                "monetary_sum",
                "days_since_last_monetary",
                "churn_risk_score",
            ]
        )

    ref = mon["donation_date"].max()
    if pd.isna(ref):
        ref = pd.Timestamp.utcnow()

    last_m = mon.groupby("supporter_id")["donation_date"].max().rename("last_monetary")
    sum_m = mon.groupby("supporter_id")["amount_num"].sum().rename("monetary_sum")

    eligible_ids = pd.Index(mon["supporter_id"].dropna().unique())
    feats = sup[sup["supporter_id"].isin(eligible_ids)][["supporter_id", "display_name"]].copy()
    feats = feats.merge(last_m, on="supporter_id", how="left")
    feats = feats.merge(sum_m, on="supporter_id", how="left")
    feats["days_since_last_monetary"] = (ref - feats["last_monetary"]).dt.days
    feats.loc[feats["last_monetary"].isna(), "days_since_last_monetary"] = 9999.0
    feats["monetary_sum"] = feats["monetary_sum"].fillna(0.0)

    d_max = float(feats["days_since_last_monetary"].clip(lower=0).max()) or 1.0
    gap_score = (feats["days_since_last_monetary"].clip(lower=0) / d_max).clip(0, 1)
    ms = np.log1p(feats["monetary_sum"].clip(lower=0))
    ms_norm = 1.0 - (ms - ms.min()) / (ms.max() - ms.min() + 1e-9)
    raw = 0.65 * gap_score + 0.35 * ms_norm
    feats["churn_risk_score"] = raw.clip(0, 1)

    return feats


def _top_drivers_row(row: pd.Series) -> list[str]:
    drivers: list[str] = []
    d = float(row.get("days_since_last_monetary", 0) or 0)
    if d > 365:
        drivers.append("No monetary gift in over 12 months (or never on file)")
    elif d > 180:
        drivers.append("Extended gap since last monetary gift")
    elif pd.isna(row.get("last_monetary")):
        drivers.append("No monetary gift history in dataset")
    msum = float(row.get("monetary_sum", 0) or 0)
    if msum > 0 and msum < 500:
        drivers.append("Lower cumulative monetary giving in history window")
    if not drivers:
        drivers.append("Relative risk from recency and giving volume heuristic")
    return drivers[:5]


def build_donor_backend_tables(
    data_dir: Path | None = None,
    *,
    top_at_risk_n: int = 25,
    outreach_min_risk: float = 0.35,
) -> tuple[tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]], dict[str, Any]]:
    data_dir = data_dir or LIGHTHOUSE_DATA_DIR
    df = _heuristic_churn_frame(data_dir)
    if df.empty:
        meta_empty: dict[str, Any] = {
            "export_mode": "heuristic",
            "donor_eligibility_rule": DONOR_ELIGIBILITY_RULE,
            "note": (
                "No qualifying monetary donations in the extract; donor churn JSON lists are empty. "
                "When donor_churn_pipeline.joblib is wired, keep the same eligibility rule."
            ),
            "high_priority_outreach_rule": "N/A — no scored donors",
            "high_priority_outreach_fallback": None,
            "n_supporters": 0,
            "n_scored_donors": 0,
            "n_outreach_queue": 0,
        }
        return ([], [], []), meta_empty

    df = df.sort_values("churn_risk_score", ascending=False).reset_index(drop=True)
    df["outreach_priority_rank"] = range(1, len(df) + 1)
    df["risk_band"] = df["churn_risk_score"].map(_risk_band)
    df["top_drivers"] = df.apply(_top_drivers_row, axis=1)

    median_sum = float(df["monetary_sum"].median())
    primary_rule = (
        f"churn_risk_score >= {outreach_min_risk} AND monetary_sum >= cohort median "
        f"({median_sum:.2f} PHP) — prioritizes at-risk donors with above-median historical monetary total."
    )
    outreach = df[
        (df["churn_risk_score"] >= outreach_min_risk) & (df["monetary_sum"] >= median_sum)
    ].copy()
    outreach = outreach.sort_values("churn_risk_score", ascending=False).reset_index(drop=True)

    outreach_fallback_note: str | None = None
    if len(outreach) == 0:
        cand = df[(df["churn_risk_score"] >= outreach_min_risk) & (df["monetary_sum"] > 0)].copy()
        if len(cand) > 0:
            cand["_outreach_score"] = cand["churn_risk_score"] * np.log1p(cand["monetary_sum"])
            outreach = cand.nlargest(min(15, len(cand)), "_outreach_score").drop(columns=["_outreach_score"])
            outreach = outreach.sort_values("churn_risk_score", ascending=False).reset_index(drop=True)
            outreach_fallback_note = (
                "Primary queue was empty; used fallback: churn_risk_score >= threshold AND monetary_sum > 0, "
                "ranked by churn_risk_score × log1p(monetary_sum), top 15."
            )
        else:
            at_risk = df[df["churn_risk_score"] >= outreach_min_risk].head(15).copy()
            if len(at_risk) > 0:
                outreach = at_risk.sort_values("churn_risk_score", ascending=False).reset_index(drop=True)
                outreach_fallback_note = (
                    "Primary and value-weighted fallbacks empty (no at-risk donors with monetary_sum > 0); "
                    "queue is top at-risk donors by churn_risk_score only (still a valid staff triage list)."
                )

    meta = {
        "export_mode": "heuristic",
        "donor_eligibility_rule": DONOR_ELIGIBILITY_RULE,
        "note": (
            "churn_risk_score is a recency + lifetime-giving heuristic until donor_churn_pipeline.joblib "
            "is trained (see donor_retention_churn.ipynb) and wired to this export. "
            "Scores apply only to the donor-eligible cohort (qualifying monetary gifts), not all supporters."
        ),
        "high_priority_outreach_rule": primary_rule,
        "high_priority_outreach_fallback": outreach_fallback_note,
        "n_supporters": len(df),
        "n_scored_donors": len(df),
        "n_outreach_queue": len(outreach),
    }

    def row_to_api(r: pd.Series, outreach_note: str | None = None) -> dict[str, Any]:
        o: dict[str, Any] = {
            "supporter_id": int(r["supporter_id"]),
            "display_name": str(r.get("display_name", "")),
            "churn_risk_score": round(float(r["churn_risk_score"]), 4),
            "outreach_priority_rank": int(r["outreach_priority_rank"]),
            "risk_band": str(r["risk_band"]),
            "top_drivers": list(r["top_drivers"]),
        }
        if outreach_note is not None:
            o["outreach_note"] = outreach_note
        return o

    full = [row_to_api(r) for _, r in df.iterrows()]
    top_at_risk = [row_to_api(r) for _, r in df.head(top_at_risk_n).iterrows()]

    outreach_rows: list[dict[str, Any]] = []
    if outreach_fallback_note is None:
        outreach_note_default = (
            "Above-median historical giving with elevated lapse risk — good candidate for personalized outreach."
        )
    elif "log1p" in outreach_fallback_note:
        outreach_note_default = (
            "Elevated lapse risk with some monetary history — good candidate for personalized outreach."
        )
    else:
        outreach_note_default = (
            "High modeled lapse risk; limited or no monetary history in this extract — still worth a "
            "light-touch re-engagement check."
        )

    for q_rank, (_, r) in enumerate(outreach.iterrows(), start=1):
        o = row_to_api(r, outreach_note=outreach_note_default)
        o["outreach_priority_rank"] = q_rank
        outreach_rows.append(o)

    return (full, top_at_risk, outreach_rows), meta


def write_donor_backend_json(
    data_dir: Path | None = None,
    *,
    backend_dir: Path | None = None,
    top_at_risk_n: int = 25,
) -> dict[str, Any]:
    ensure_backend_ml_dirs()
    backend_dir = backend_dir or DONORS_BACKEND_DIR
    (full, top_at_risk, outreach_rows), meta = build_donor_backend_tables(
        data_dir, top_at_risk_n=top_at_risk_n
    )

    paths = {
        "current_donor_scores": backend_dir / "current_donor_scores.json",
        "top_at_risk_donors": backend_dir / "top_at_risk_donors.json",
        "high_priority_outreach": backend_dir / "high_priority_outreach_donors.json",
        "metadata": backend_dir / "donor_churn_backend_export_metadata.json",
    }
    backend_dir.mkdir(parents=True, exist_ok=True)

    write_json_atomic(paths["current_donor_scores"], _json_safe(full))
    write_json_atomic(paths["top_at_risk_donors"], _json_safe(top_at_risk))
    write_json_atomic(paths["high_priority_outreach"], _json_safe(outreach_rows))
    write_json_atomic(paths["metadata"], _json_safe(meta))

    return {
        "paths": paths,
        "meta": meta,
        "counts": {"full": len(full), "top_at_risk": len(top_at_risk), "outreach": len(outreach_rows)},
    }
