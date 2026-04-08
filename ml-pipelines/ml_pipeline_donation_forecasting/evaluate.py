"""Regression metrics for amount (and log space) plus allocation error."""

from __future__ import annotations

from typing import Any

import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


def regression_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    y_true = np.asarray(y_true, dtype=float).ravel()
    y_pred = np.asarray(y_pred, dtype=float).ravel()
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    mae = float(mean_absolute_error(y_true, y_pred))
    r2 = float(r2_score(y_true, y_pred))
    return {"rmse": rmse, "mae": mae, "r2": r2}


def allocation_metrics(y_true: np.ndarray, y_pred: np.ndarray, labels: list[str]) -> dict[str, Any]:
    """Per-column MAE and mean L1 distance from true simplex."""
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.clip(np.asarray(y_pred, dtype=float), 0, None)
    row_sum = y_pred.sum(axis=1, keepdims=True)
    row_sum = np.where(row_sum > 0, row_sum, 1.0)
    y_pred = y_pred / row_sum
    per_mae = {
        labels[j]: float(mean_absolute_error(y_true[:, j], y_pred[:, j])) for j in range(y_true.shape[1])
    }
    mae_vec = np.abs(y_true - y_pred).sum(axis=1).mean()
    return {"per_area_mae": per_mae, "mean_abs_l1_row": float(mae_vec)}
