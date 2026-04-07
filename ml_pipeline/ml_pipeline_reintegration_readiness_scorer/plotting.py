"""Save ROC, PR, and calibration plots for the readiness scorer."""

from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from sklearn.metrics import (
    average_precision_score,
    precision_recall_curve,
    roc_auc_score,
    roc_curve,
)


def save_evaluation_plots(
    out_dir: Path,
    y_true: np.ndarray,
    y_proba: np.ndarray,
    prob_true: list[float],
    prob_pred: list[float],
) -> dict[str, str]:
    out_dir.mkdir(parents=True, exist_ok=True)
    y_true = np.asarray(y_true, dtype=int).ravel()
    y_proba = np.asarray(y_proba, dtype=float).ravel()
    paths: dict[str, str] = {}

    # ROC
    if len(np.unique(y_true)) > 1:
        fpr, tpr, _ = roc_curve(y_true, y_proba)
        auc = roc_auc_score(y_true, y_proba)
        fig, ax = plt.subplots(figsize=(6, 5))
        ax.plot(fpr, tpr, label=f"ROC (AUC={auc:.3f})")
        ax.plot([0, 1], [0, 1], "k--", alpha=0.4)
        ax.set_xlabel("False positive rate")
        ax.set_ylabel("True positive rate")
        ax.set_title("Holdout ROC curve")
        ax.legend(loc="lower right")
        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1)
        p = out_dir / "holdout_roc_curve.png"
        fig.tight_layout()
        fig.savefig(p, dpi=120)
        plt.close(fig)
        paths["roc_png"] = str(p)

        prec, rec, _ = precision_recall_curve(y_true, y_proba)
        pr_auc = average_precision_score(y_true, y_proba)
        fig, ax = plt.subplots(figsize=(6, 5))
        ax.plot(rec, prec, label=f"PR (AP={pr_auc:.3f})")
        base = float(y_true.mean())
        ax.axhline(base, color="k", linestyle="--", alpha=0.4, label=f"Baseline prevalence={base:.3f}")
        ax.set_xlabel("Recall")
        ax.set_ylabel("Precision")
        ax.set_title("Holdout precision-recall curve")
        ax.legend(loc="upper right")
        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1)
        p = out_dir / "holdout_pr_curve.png"
        fig.tight_layout()
        fig.savefig(p, dpi=120)
        plt.close(fig)
        paths["pr_png"] = str(p)

    # Calibration
    if prob_true and prob_pred:
        fig, ax = plt.subplots(figsize=(6, 5))
        ax.plot([0, 1], [0, 1], "k--", alpha=0.4, label="Perfect calibration")
        ax.plot(prob_pred, prob_true, "o-", label="Model")
        ax.set_xlabel("Mean predicted probability")
        ax.set_ylabel("Fraction of positives")
        ax.set_title("Calibration (holdout)")
        ax.legend(loc="lower right")
        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1)
        p = out_dir / "holdout_calibration_curve.png"
        fig.tight_layout()
        fig.savefig(p, dpi=120)
        plt.close(fig)
        paths["calibration_png"] = str(p)

    return paths
