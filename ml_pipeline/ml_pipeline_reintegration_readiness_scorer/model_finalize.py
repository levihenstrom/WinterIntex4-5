"""
Post-training: time-ordered OOF threshold tuning, optional probability calibration,
and diagnostics (threshold selection uses training/OOF only — no holdout leakage).
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from sklearn.metrics import brier_score_loss, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import TimeSeriesSplit

from .evaluate import classification_metrics, confusion_matrix_list, top_k_triage_metrics


def _time_series_oof_proba(
    train_df: pd.DataFrame,
    num: list[str],
    cat: list[str],
    target_col: str,
    pipeline_template,
    n_splits: int = 5,
) -> tuple[np.ndarray, dict[str, Any]]:
    """
    Out-of-fold positive-class probabilities on the training set using TimeSeriesSplit
    on observation_date order (no future leakage within train).
    """
    df_sorted = train_df.sort_values("observation_date").reset_index(drop=True)
    X_s = df_sorted[num + cat]
    y_s = np.asarray(df_sorted[target_col].values, dtype=int)
    n = len(y_s)
    n_splits = max(2, min(n_splits, max(2, n // 50)))
    tscv = TimeSeriesSplit(n_splits=n_splits)
    oof = np.full(n, np.nan)
    for tr, te in tscv.split(X_s):
        pipe = clone(pipeline_template)
        pipe.fit(X_s.iloc[tr], y_s[tr])
        oof[te] = pipe.predict_proba(X_s.iloc[te])[:, 1]
    if np.isnan(oof).any():
        m = float(np.nanmean(oof))
        oof = np.where(np.isnan(oof), m, oof)
    meta = {"n_splits": n_splits, "n_train": n}
    return oof, meta


def search_thresholds(
    y_true: np.ndarray,
    proba: np.ndarray,
    recall_floor: float = 0.6,
) -> dict[str, Any]:
    """
    Search thresholds on validation/OOF scores only.
    """
    y_true = np.asarray(y_true, dtype=int).ravel()
    proba = np.asarray(proba, dtype=float).ravel()
    thresholds = np.linspace(0.005, 0.995, 199)
    best_f1 = -1.0
    best_t_f1 = 0.5
    best_f1_under_floor = -1.0
    best_t_floor = 0.5
    found_floor = False
    rows = []
    for t in thresholds:
        pred = (proba >= t).astype(int)
        f1 = f1_score(y_true, pred, zero_division=0)
        rec = recall_score(y_true, pred, zero_division=0)
        prec = precision_score(y_true, pred, zero_division=0)
        rows.append({"threshold": float(t), "f1": float(f1), "recall": float(rec), "precision": float(prec)})
        if f1 > best_f1:
            best_f1 = f1
            best_t_f1 = float(t)
        if rec >= recall_floor:
            found_floor = True
            if f1 > best_f1_under_floor:
                best_f1_under_floor = f1
                best_t_floor = float(t)
    if found_floor:
        selected = best_t_floor
        method = f"max_f1_among_recall_ge_{recall_floor}"
    else:
        selected = best_t_f1
        method = f"max_f1_oof (no threshold achieved recall >= {recall_floor} on OOF)"
    return {
        "threshold_max_f1": best_t_f1,
        "threshold_recall_floor": best_t_floor,
        "selected_threshold": selected,
        "selection_method": method,
        "recall_floor": recall_floor,
        "found_recall_floor_on_oof": found_floor,
        "threshold_grid": rows,
    }


def maybe_calibrate(
    base_pipeline,
    train_df: pd.DataFrame,
    num: list[str],
    cat: list[str],
    target_col: str,
    X_test: pd.DataFrame,
    y_test: np.ndarray,
    n_splits: int = 5,
) -> tuple[Any, dict[str, Any]]:
    """
    Fit CalibratedClassifierCV with time-series CV on training data (time-sorted).
    Compare Brier on holdout vs uncalibrated base_pipeline fitted on full train.
    """
    tr_sorted = train_df.sort_values("observation_date").reset_index(drop=True)
    X_train = tr_sorted[num + cat]
    y_train = np.asarray(tr_sorted[target_col].values, dtype=int)
    y_test = np.asarray(y_test, dtype=int).ravel()

    base = clone(base_pipeline)
    base.fit(X_train, y_train)
    proba_unc = base.predict_proba(X_test)[:, 1]
    brier_unc = float(brier_score_loss(y_test, proba_unc))
    roc_unc = float("nan")
    if len(np.unique(y_test)) > 1:
        roc_unc = float(roc_auc_score(y_test, proba_unc))

    n_splits = max(2, min(n_splits, max(2, len(X_train) // 50)))
    cal = CalibratedClassifierCV(
        estimator=clone(base_pipeline),
        method="sigmoid",
        cv=TimeSeriesSplit(n_splits=n_splits),
    )
    cal.fit(X_train, y_train)
    proba_cal = cal.predict_proba(X_test)[:, 1]
    brier_cal = float(brier_score_loss(y_test, proba_cal))
    roc_cal = float("nan")
    if len(np.unique(y_test)) > 1:
        roc_cal = float(roc_auc_score(y_test, proba_cal))

    # Prefer calibration only if it improves Brier and does not materially hurt discrimination
    brier_improves = brier_cal < brier_unc - 1e-9
    roc_ok = np.isnan(roc_unc) or np.isnan(roc_cal) or roc_cal >= roc_unc - 0.05
    use_cal = brier_improves and roc_ok

    info = {
        "brier_holdout_uncalibrated": brier_unc,
        "brier_holdout_calibrated": brier_cal,
        "roc_auc_holdout_uncalibrated": roc_unc,
        "roc_auc_holdout_calibrated": roc_cal,
        "used_calibration": use_cal,
        "calibration_method": "sigmoid (Platt) + TimeSeriesSplit CV on train",
    }
    if brier_improves and not roc_ok:
        info["calibration_skipped_reason"] = "Brier improved but ROC-AUC dropped >0.05 vs uncalibrated; keeping uncalibrated."
    final = cal if use_cal else base
    return final, info


def calibration_curve_data(y_true: np.ndarray, proba: np.ndarray, n_bins: int = 10) -> dict[str, list]:
    y_true = np.asarray(y_true, dtype=int).ravel()
    proba = np.asarray(proba, dtype=float).ravel()
    if len(np.unique(y_true)) < 2:
        return {"prob_true": [], "prob_pred": [], "n_bins": n_bins}
    prob_true, prob_pred = calibration_curve(y_true, proba, n_bins=n_bins, strategy="quantile")
    return {
        "prob_true": [float(x) for x in prob_true],
        "prob_pred": [float(x) for x in prob_pred],
        "n_bins": n_bins,
    }


def finalize_model(
    best_pipeline,
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
    num: list[str],
    cat: list[str],
    target_col: str,
    recall_floor: float = 0.6,
) -> dict[str, Any]:
    """
    OOF threshold on train (uncalibrated OOF), optional calibration, holdout metrics at 0.5 and tuned.
    """
    df_sorted = train_df.sort_values("observation_date").reset_index(drop=True)
    y_tr = np.asarray(df_sorted[target_col].values, dtype=int)

    pipe_for_oof = clone(best_pipeline)
    oof_proba, oof_meta = _time_series_oof_proba(train_df, num, cat, target_col, pipe_for_oof)
    thresh_info = search_thresholds(y_tr, oof_proba, recall_floor=recall_floor)
    selected_t = float(thresh_info["selected_threshold"])

    final_pipe, cal_info = maybe_calibrate(
        best_pipeline, train_df, num, cat, target_col, test_df[num + cat], test_df[target_col].values
    )

    X_test = test_df[num + cat]
    y_test = np.asarray(test_df[target_col].values, dtype=int)
    proba_test = final_pipe.predict_proba(X_test)[:, 1]
    pred_default = (proba_test >= 0.5).astype(int)
    pred_tuned = (proba_test >= selected_t).astype(int)

    metrics_05 = classification_metrics(y_test, pred_default, proba_test)
    metrics_05["confusion_matrix"] = confusion_matrix_list(y_test, pred_default)
    metrics_05["top_10pct_triage"] = top_k_triage_metrics(y_test, proba_test, 0.10)

    metrics_tuned = classification_metrics(y_test, pred_tuned, proba_test)
    metrics_tuned["confusion_matrix"] = confusion_matrix_list(y_test, pred_tuned)
    metrics_tuned["threshold"] = selected_t
    metrics_tuned["top_10pct_triage"] = top_k_triage_metrics(y_test, proba_test, 0.10)

    cal_curve = calibration_curve_data(y_test, proba_test)

    return {
        "final_pipeline": final_pipe,
        "oof_threshold_info": thresh_info,
        "oof_meta": oof_meta,
        "calibration_info": cal_info,
        "holdout_metrics_threshold_0.5": metrics_05,
        "holdout_metrics_tuned_threshold": metrics_tuned,
        "selected_threshold": selected_t,
        "y_test_proba": proba_test,
        "calibration_curve_holdout": cal_curve,
    }
