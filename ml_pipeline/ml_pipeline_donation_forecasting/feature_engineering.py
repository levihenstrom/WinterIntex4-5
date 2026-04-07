"""
Donor-level supervised rows: predict *next* monetary gift amount and allocation mix from prior history only.

Target construction
--------------------
For each supporter with >= 2 Monetary donations (PHP ``amount`` present), each row uses
donations strictly before date ``t`` as features and the donation at ``t`` as:
- ``y_amount`` = next donation amount (PHP)
- ``y_alloc_*`` = normalized program_area shares for that donation's allocation rows

Leakage: no information from the target donation except what we predict (amount + shares).
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from . import config as _cfg


def _monetary_frame(donations: pd.DataFrame) -> pd.DataFrame:
    d = donations.copy()
    if "donation_type" not in d.columns or "amount" not in d.columns:
        raise ValueError("donations must include donation_type and amount")
    m = d[d["donation_type"].astype(str).eq("Monetary")].copy()
    m = m[m["amount"].notna() & (pd.to_numeric(m["amount"], errors="coerce") > 0)]
    m["amount"] = pd.to_numeric(m["amount"], errors="coerce")
    m = m[m["donation_date"].notna()]
    return m.sort_values(["supporter_id", "donation_date", "donation_id"])


def allocation_shares_by_donation(
    allocations: pd.DataFrame,
    categories: list[str],
    split_col: str,
    amount_col: str = "amount_allocated",
) -> pd.DataFrame:
    """
    Rows: donation_id; columns: share of each category value (sums to ~1 per donation when data complete).
    """
    a = allocations.copy()
    if "donation_id" not in a.columns or split_col not in a.columns:
        raise ValueError(f"donation_allocations must include donation_id, {split_col}")
    a["_split"] = a[split_col].map(lambda x: str(int(x)) if pd.notna(x) and str(x).replace(".", "").isdigit() else str(x))
    cats = [str(c) for c in categories]
    g = a.groupby(["donation_id", "_split"], as_index=False)[amount_col].sum()
    tot = g.groupby("donation_id")[amount_col].transform("sum")
    g["share"] = np.where(tot > 0, g[amount_col] / tot, 0.0)
    piv = g.pivot_table(index="donation_id", columns="_split", values="share", aggfunc="sum").fillna(0.0)
    for c in cats:
        if c not in piv.columns:
            piv[c] = 0.0
    return piv.reindex(columns=cats).fillna(0.0)


def discover_program_areas(allocations: pd.DataFrame) -> list[str]:
    s = allocations["program_area"].dropna().astype(str).unique().tolist()
    return sorted(s)


def discover_safehouse_keys(allocations: pd.DataFrame) -> list[str]:
    """String keys for safehouse columns (e.g. '3')."""
    if "safehouse_id" not in allocations.columns:
        return []
    keys: set[str] = set()
    for x in allocations["safehouse_id"].dropna().unique():
        if isinstance(x, (int, float)) and not (isinstance(x, float) and np.isnan(x)):
            keys.add(str(int(x)))
        else:
            keys.add(str(x))
    return sorted(keys)


def prior_donation_features(prev: pd.DataFrame, compact: bool = False) -> dict[str, float]:
    """Aggregate stats from prior monetary donations (already filtered, sorted by date)."""
    amt = prev["amount"].astype(float)
    n = len(prev)
    dates = prev["donation_date"]
    span_days = max((dates.max() - dates.min()).days, 1)
    rec = prev["is_recurring"].astype(str).str.lower().isin(["true", "1"]) if "is_recurring" in prev.columns else pd.Series([False] * n)
    chans = prev["channel_source"].fillna("") if "channel_source" in prev.columns else pd.Series([""] * n)
    base: dict[str, float] = {
        "prior_n_monetary": float(n),
        "prior_mean_amount": float(amt.mean()),
        "prior_std_amount": float(amt.std(ddof=0)) if n > 1 else 0.0,
        "prior_last_amount": float(amt.iloc[-1]),
        "prior_span_days": float(span_days),
        "prior_freq_per_month": float(n / max(span_days / 30.0, 1 / 30.0)),
        "prior_recurring_any": float(rec.any()),
        "prior_distinct_campaigns": float(prev["campaign_name"].nunique()) if "campaign_name" in prev.columns else 0.0,
        "prior_distinct_channels": float(chans.astype(str).nunique()),
        "prior_roll3_mean": float(amt.iloc[-3:].mean()) if n >= 1 else 0.0,
        "prior_trend_amount": float((amt.iloc[-1] - amt.iloc[0]) / max(n, 1)),
    }
    if not compact:
        base.update(
            {
                "prior_min_amount": float(amt.min()),
                "prior_max_amount": float(amt.max()),
                "prior_sum_amount": float(amt.sum()),
            }
        )
    return base


def mean_prior_allocation_shares(
    prev_donation_ids: list[int],
    share_matrix: pd.DataFrame,
    categories: list[str],
    prefix: str,
) -> dict[str, float]:
    if not prev_donation_ids:
        return {f"prior_mean_{prefix}_{c}": 0.0 for c in categories}
    rows = share_matrix.reindex(prev_donation_ids).fillna(0.0)
    m = rows.mean(axis=0)
    return {f"prior_mean_{prefix}_{c}": float(m[c]) for c in categories}


def build_supervised_rows(
    donations: pd.DataFrame,
    allocations: pd.DataFrame,
    supporters: pd.DataFrame,
    program_areas: list[str] | None = None,
    safehouse_keys: list[str] | None = None,
    *,
    compact_amount_features: bool | None = None,
    allocation_program_only: bool | None = None,
) -> tuple[pd.DataFrame, dict[str, Any]]:
    """
    Returns
    -------
    df :
        One row per (supporter, k-th monetary donation) for k>=1.
    meta :
        program_areas, column groups, row counts.
    """
    if compact_amount_features is None:
        compact_amount_features = bool(_cfg.COMPACT_AMOUNT_FEATURES)
    if allocation_program_only is None:
        allocation_program_only = bool(_cfg.ALLOCATION_PREDICT_PROGRAM_ONLY)

    mon = _monetary_frame(donations)
    if program_areas is None:
        program_areas = discover_program_areas(allocations)
    if safehouse_keys is None:
        safehouse_keys = [] if allocation_program_only else discover_safehouse_keys(allocations)
    share_prog = allocation_shares_by_donation(allocations, program_areas, "program_area")
    share_sh = (
        allocation_shares_by_donation(allocations, safehouse_keys, "safehouse_id")
        if safehouse_keys
        else None
    )

    sup_cols = [c for c in supporters.columns if c not in ("email", "phone", "display_name", "first_name", "last_name")]
    sup = supporters[sup_cols].drop_duplicates(subset=["supporter_id"])

    rows: list[dict[str, Any]] = []
    for sid, grp in mon.groupby("supporter_id", sort=False):
        grp = grp.reset_index(drop=True)
        if len(grp) < 2:
            continue
        srow = sup.loc[sup["supporter_id"] == sid]
        if srow.empty:
            continue
        srow = srow.iloc[0]
        for i in range(1, len(grp)):
            prev = grp.iloc[:i]
            cur = grp.iloc[i]
            did = int(cur["donation_id"])
            feats = prior_donation_features(prev, compact=compact_amount_features)
            prev_ids = prev["donation_id"].astype(int).tolist()
            feats.update(mean_prior_allocation_shares(prev_ids, share_prog, program_areas, "share_prog"))
            if share_sh is not None:
                feats.update(mean_prior_allocation_shares(prev_ids, share_sh, safehouse_keys, "share_sh"))
            td = cur["donation_date"]
            feats["days_since_prior_donation"] = float((td - prev["donation_date"].max()).days)
            feats["target_donation_month"] = float(td.month)
            feats["target_donation_quarter"] = float(td.quarter)
            feats["supporter_id"] = int(sid)
            feats["target_donation_id"] = did
            feats["target_donation_date"] = td
            feats["y_amount"] = float(cur["amount"])
            shp = share_prog.reindex([did]).iloc[0]
            for pa in program_areas:
                feats[f"y_alloc_{pa}"] = float(shp[pa])
            if share_sh is not None:
                shs = share_sh.reindex([did]).iloc[0]
                for sk in safehouse_keys:
                    feats[f"y_sh_{sk}"] = float(shs[sk])
            # static supporter fields (known before target event)
            for col in ("supporter_type", "relationship_type", "region", "country", "acquisition_channel"):
                if col in srow.index:
                    feats[f"sup_{col}"] = srow[col]
            rows.append(feats)

    df = pd.DataFrame(rows)
    meta = {
        "program_areas": program_areas,
        "safehouse_keys": safehouse_keys,
        "compact_amount_features": compact_amount_features,
        "allocation_program_only": allocation_program_only,
        "n_rows": len(df),
        "n_supporters": df["supporter_id"].nunique() if len(df) else 0,
        "target": "y_amount = monetary amount of donation at target_donation_date; features use only prior gifts",
        "allocation_targets_program": [f"y_alloc_{pa}" for pa in program_areas],
        "allocation_targets_safehouse": [f"y_sh_{sk}" for sk in safehouse_keys],
    }
    return df, meta
