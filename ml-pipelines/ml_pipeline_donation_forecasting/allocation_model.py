"""
Multi-output regression for allocation shares (program area + safehouse) on the same donor features.

Predictions are clipped to non-negative and row-normalized to sum to 1 per *program* block and per *safehouse*
block separately (two simplices), matching how gifts can be split across programs and locations.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.pipeline import Pipeline

from . import config
from .evaluate import allocation_metrics
from .preprocess import build_preprocess
from .train_explanatory import time_ordered_split


def _normalize_block(mat: np.ndarray) -> np.ndarray:
    mat = np.clip(np.asarray(mat, dtype=float), 0, None)
    s = mat.sum(axis=1, keepdims=True)
    s = np.where(s > 0, s, 1.0)
    return mat / s


def train_allocation_forest(
    df: pd.DataFrame,
    meta: dict,
    numeric_features: list[str],
    categorical_features: list[str],
    train_fraction: float = config.TRAIN_FRACTION,
    random_state: int = config.RANDOM_STATE,
) -> dict[str, Any]:
    prog = meta["allocation_targets_program"]
    sh = meta["allocation_targets_safehouse"]
    y_cols = prog + sh
    train_df, test_df = time_ordered_split(df, train_fraction)
    X_train = train_df[numeric_features + categorical_features]
    X_test = test_df[numeric_features + categorical_features]
    Y_train = train_df[y_cols].astype(float).values
    Y_test = test_df[y_cols].astype(float).values

    prep = build_preprocess(numeric_features, categorical_features)
    model = RandomForestRegressor(
        n_estimators=220,
        max_depth=6,
        min_samples_leaf=5,
        min_samples_split=8,
        max_features="sqrt",
        random_state=random_state,
        n_jobs=-1,
    )
    pipe = Pipeline([("prep", prep), ("model", model)])
    pipe.fit(X_train, Y_train)
    pred = pipe.predict(X_test)
    n_p = len(prog)
    pred[:, :n_p] = _normalize_block(pred[:, :n_p])
    if sh:
        pred[:, n_p:] = _normalize_block(pred[:, n_p:])

    m_prog = allocation_metrics(Y_test[:, :n_p], pred[:, :n_p], prog)
    m_all = allocation_metrics(Y_test, pred, y_cols)

    return {
        "pipeline": pipe,
        "program_area_metrics": m_prog,
        "full_metrics": m_all,
        "y_columns": y_cols,
        "n_program": n_p,
        "train_df": train_df,
        "test_df": test_df,
        "X_test": X_test,
        "Y_test": Y_test,
        "Y_pred": pred,
    }


def combine_amount_and_allocation(
    y_amount_pred: np.ndarray,
    alloc_pred: np.ndarray,
    meta: dict,
) -> dict[str, Any]:
    """
    Expected PHP flowing to each program area and each safehouse on the scored rows.

    Uses: predicted_amount * program_share for program block; same amount * safehouse_share for location block
    (both derived from the same gift — interpret as compositional views, not double-counting totals across both).
    """
    prog = meta["allocation_targets_program"]
    sh = meta["allocation_targets_safehouse"]
    n_p = len(prog)
    a = np.asarray(y_amount_pred, dtype=float).ravel()
    P = np.asarray(alloc_pred, dtype=float)
    prog_part = P[:, :n_p] if n_p else np.zeros((len(a), 0))
    sh_part = P[:, n_p:] if sh else np.zeros((len(a), 0))
    by_prog = {prog[j]: float((a * prog_part[:, j]).sum()) for j in range(n_p)}
    by_sh = {sh[j].replace("y_sh_", "SH_"): float((a * sh_part[:, j]).sum()) for j in range(len(sh))}
    return {
        "total_predicted_php_sample": float(a.sum()),
        "predicted_php_by_program_area": by_prog,
        "predicted_php_by_safehouse": by_sh,
        "note": "Program and safehouse splits are two views of the same predicted gifts; do not add both totals for 'overall budget'.",
    }
