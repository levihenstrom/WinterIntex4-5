"""Infer numeric vs categorical feature columns from engineered frame."""

from __future__ import annotations

import pandas as pd


def feature_target_columns(df: pd.DataFrame, meta: dict) -> tuple[list[str], list[str], list[str]]:
    """
    Returns
    -------
    numeric_features, categorical_features, y_allocation_columns
    """
    y_alloc = list(meta.get("allocation_targets_program", [])) + list(meta.get("allocation_targets_safehouse", []))
    drop = {
        "supporter_id",
        "target_donation_id",
        "target_donation_date",
        "y_amount",
        *y_alloc,
    }
    feat_cols = [c for c in df.columns if c not in drop]
    numeric = []
    categorical = []
    for c in feat_cols:
        if pd.api.types.is_numeric_dtype(df[c]):
            numeric.append(c)
        else:
            categorical.append(c)
    return numeric, categorical, y_alloc
