"""Classification metrics for imbalanced rare-event settings."""

from __future__ import annotations

from typing import Any

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)


def classification_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_proba: np.ndarray | None = None,
) -> dict[str, float]:
    y_true = np.asarray(y_true, dtype=int).ravel()
    y_pred = np.asarray(y_pred, dtype=int).ravel()
    out: dict[str, Any] = {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
        "positive_rate_pred": float(np.mean(y_pred)),
    }
    if y_proba is not None:
        proba = np.asarray(y_proba, dtype=float).ravel()
        try:
            out["brier_score"] = float(brier_score_loss(y_true, proba))
        except ValueError:
            out["brier_score"] = float("nan")
        if len(np.unique(y_true)) > 1:
            try:
                out["roc_auc"] = float(roc_auc_score(y_true, proba))
            except ValueError:
                out["roc_auc"] = float("nan")
            try:
                out["pr_auc"] = float(average_precision_score(y_true, proba))
            except ValueError:
                out["pr_auc"] = float("nan")
        else:
            out["roc_auc"] = float("nan")
            out["pr_auc"] = float("nan")
    else:
        out["brier_score"] = float("nan")
        out["roc_auc"] = float("nan")
        out["pr_auc"] = float("nan")
    return out


def confusion_matrix_list(y_true: np.ndarray, y_pred: np.ndarray) -> list[list[int]]:
    y_true = np.asarray(y_true, dtype=int).ravel()
    y_pred = np.asarray(y_pred, dtype=int).ravel()
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    return [[int(cm[0, 0]), int(cm[0, 1])], [int(cm[1, 0]), int(cm[1, 1])]]


def precision_at_top_k_fraction(y_true: np.ndarray, y_proba: np.ndarray, k_frac: float = 0.10) -> dict[str, float]:
    """
    Among the top k_frac highest-scored rows, fraction that are positive (operational triage view).
    """
    y_true = np.asarray(y_true, dtype=int).ravel()
    proba = np.asarray(y_proba, dtype=float).ravel()
    n = len(y_true)
    if n == 0:
        return {"precision_at_top_k": float("nan"), "k_n": 0, "k_frac": k_frac}
    k = max(1, int(np.ceil(n * k_frac)))
    order = np.argsort(-proba)
    top = order[:k]
    prec = float(y_true[top].mean()) if k else float("nan")
    return {"precision_at_top_k": prec, "k_n": k, "k_frac": k_frac}


def recall_at_top_k_fraction(y_true: np.ndarray, y_proba: np.ndarray, k_frac: float = 0.10) -> dict[str, float]:
    """Fraction of all positives that fall in the top k_frac highest-scored rows."""
    y_true = np.asarray(y_true, dtype=int).ravel()
    proba = np.asarray(y_proba, dtype=float).ravel()
    n = len(y_true)
    pos_total = int(y_true.sum())
    if n == 0 or pos_total == 0:
        return {"recall_at_top_k": float("nan"), "positives_in_top_k": 0, "positives_total": pos_total, "k_n": 0, "k_frac": k_frac}
    k = max(1, int(np.ceil(n * k_frac)))
    order = np.argsort(-proba)
    top = order[:k]
    captured = int(y_true[top].sum())
    return {
        "recall_at_top_k": float(captured) / pos_total,
        "positives_in_top_k": captured,
        "positives_total": pos_total,
        "k_n": k,
        "k_frac": k_frac,
    }


def top_k_triage_metrics(y_true: np.ndarray, y_proba: np.ndarray, k_frac: float = 0.10) -> dict[str, Any]:
    p = precision_at_top_k_fraction(y_true, y_proba, k_frac)
    r = recall_at_top_k_fraction(y_true, y_proba, k_frac)
    return {**p, **r}


def metrics_report(
    y_true: np.ndarray,
    y_proba: np.ndarray,
    threshold: float,
) -> dict[str, Any]:
    """Full report at a given probability threshold."""
    y_pred = (np.asarray(y_proba, dtype=float).ravel() >= threshold).astype(int)
    m = classification_metrics(y_true, y_pred, y_proba)
    m["threshold"] = float(threshold)
    m["confusion_matrix"] = confusion_matrix_list(y_true, y_pred)
    m["top_10pct_triage"] = top_k_triage_metrics(y_true, y_proba, 0.10)
    return m


def cohort_probability_compression_diagnostics(scores: np.ndarray) -> dict[str, Any]:
    """Batch active-resident score spread (delegates to ``operational_interpretation``)."""
    from .operational_interpretation import score_compression_diagnostics

    return score_compression_diagnostics(scores)
