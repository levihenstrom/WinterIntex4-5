"""
Classification metrics, confusion matrix, ROC-AUC; emphasize recall for high-stakes FN discussion.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)


def classification_report_dict(
    y_true: np.ndarray | pd.Series,
    y_pred: np.ndarray | pd.Series,
    y_proba: np.ndarray | None = None,
    threshold: float = 0.5,
) -> dict[str, Any]:
    """Scalar metrics for Completed (positive class = 1)."""
    yt = np.asarray(y_true).ravel()
    yp = np.asarray(y_pred).ravel()
    out: dict[str, Any] = {
        "accuracy": float(accuracy_score(yt, yp)),
        "precision": float(precision_score(yt, yp, zero_division=0)),
        "recall": float(recall_score(yt, yp, zero_division=0)),
        "f1": float(f1_score(yt, yp, zero_division=0)),
        "confusion_matrix": confusion_matrix(yt, yp).tolist(),
    }
    if y_proba is not None:
        try:
            out["roc_auc"] = float(roc_auc_score(yt, np.asarray(y_proba).ravel()))
        except ValueError:
            out["roc_auc"] = None
    out["threshold"] = threshold
    return out


def evaluate_pipeline(
    pipeline,
    X_test_model: pd.DataFrame,
    y_test: pd.Series,
    threshold: float = 0.5,
) -> dict[str, Any]:
    """Run predict_proba + threshold; return metrics dict."""
    proba = pipeline.predict_proba(X_test_model)[:, 1]
    y_hat = (proba >= threshold).astype(int)
    return classification_report_dict(y_test, y_hat, proba, threshold=threshold)


def feature_importance_dataframe(pipeline) -> pd.DataFrame | None:
    """If final step is tree-based with feature_importances_, return sorted DataFrame."""
    model = pipeline.named_steps.get("model")
    prep = pipeline.named_steps.get("prep")
    if model is None or prep is None:
        return None
    if not hasattr(model, "feature_importances_"):
        return None
    names = list(prep.get_feature_names_out())
    imp = model.feature_importances_
    return (
        pd.DataFrame({"feature": names, "importance": imp})
        .sort_values("importance", ascending=False)
        .reset_index(drop=True)
    )


if __name__ == "__main__":
    print("Import evaluate functions from training workflow.")
