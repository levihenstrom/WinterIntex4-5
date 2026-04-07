"""Compare logistic, random forest, gradient boosting on time-based holdout."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.utils.class_weight import compute_sample_weight

from . import config
from .evaluate import classification_metrics, top_k_triage_metrics
from .preprocess import build_preprocess

try:
    from imblearn.ensemble import BalancedRandomForestClassifier

    _HAS_IMBLEARN = True
except ImportError:
    BalancedRandomForestClassifier = None  # type: ignore[misc, assignment]
    _HAS_IMBLEARN = False


def time_ordered_split(
    df: pd.DataFrame,
    train_fraction: float = config.TRAIN_FRACTION,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Split by observation_date — train on earlier snapshots, test on later (no shuffle)."""
    d = df.sort_values("observation_date").reset_index(drop=True)
    n = len(d)
    k = max(int(n * train_fraction), 1)
    if k >= n:
        k = n - 1
    return d.iloc[:k].copy(), d.iloc[k:].copy()


def train_compare_models(
    df: pd.DataFrame,
    numeric_features: list[str],
    categorical_features: list[str],
    target_col: str = config.TARGET_COL,
) -> dict[str, Any]:
    train_df, test_df = time_ordered_split(df)
    X_train = train_df[numeric_features + categorical_features]
    X_test = test_df[numeric_features + categorical_features]
    y_train = train_df[target_col].astype(int).values
    y_test = test_df[target_col].astype(int).values

    prep = build_preprocess(numeric_features, categorical_features)
    models = {
        "logistic_regression": LogisticRegression(
            max_iter=4000,
            class_weight="balanced",
            random_state=config.RANDOM_STATE,
        ),
        "random_forest": RandomForestClassifier(
            n_estimators=300,
            max_depth=8,
            min_samples_leaf=5,
            class_weight="balanced",
            random_state=config.RANDOM_STATE,
            n_jobs=-1,
        ),
        "gradient_boosting": GradientBoostingClassifier(
            random_state=config.RANDOM_STATE,
            max_depth=3,
            n_estimators=150,
            learning_rate=0.06,
            min_samples_leaf=10,
        ),
    }
    if _HAS_IMBLEARN and BalancedRandomForestClassifier is not None:
        models["balanced_random_forest"] = BalancedRandomForestClassifier(
            n_estimators=200,
            max_depth=8,
            min_samples_leaf=5,
            random_state=config.RANDOM_STATE,
            n_jobs=-1,
            sampling_strategy="auto",
        )
    rows = []
    fitted: dict[str, Pipeline] = {}
    best_name = None
    best_score = -1.0
    for name, est in models.items():
        pipe = Pipeline([("prep", clone(prep)), ("model", est)])
        if name == "gradient_boosting":
            sw = compute_sample_weight("balanced", y_train)
            pipe.fit(X_train, y_train, model__sample_weight=sw)
        else:
            pipe.fit(X_train, y_train)
        proba = pipe.predict_proba(X_test)[:, 1]
        pred = pipe.predict(X_test)
        m = classification_metrics(y_test, pred, proba)
        triage = top_k_triage_metrics(y_test, proba, 0.10)
        m["precision_at_top_10pct"] = triage["precision_at_top_k"]
        m["recall_at_top_10pct"] = triage["recall_at_top_k"]
        rows.append({"model": name, **m})
        fitted[name] = pipe
        auc = float(m.get("roc_auc", float("nan")))
        pr = float(m.get("pr_auc", float("nan")))
        tri_p = float(triage["precision_at_top_k"]) if not np.isnan(triage["precision_at_top_k"]) else 0.0
        tri_r = float(triage["recall_at_top_k"]) if not np.isnan(triage["recall_at_top_k"]) else 0.0
        # Holdout: emphasize discrimination + triage value, not accuracy
        composite = 0.0
        if not np.isnan(auc):
            composite += 0.45 * auc
        if not np.isnan(pr):
            composite += 0.40 * pr
        composite += 0.10 * tri_p + 0.05 * tri_r
        if composite > best_score:
            best_score = composite
            best_name = name
    if best_name is None:
        best_name = "logistic_regression"
    return {
        "best_name": best_name,
        "best_pipeline": fitted[best_name],
        "all_results": pd.DataFrame(rows),
        "fitted": fitted,
        "train_df": train_df,
        "test_df": test_df,
        "X_test": X_test,
        "y_test": y_test,
        "X_train": X_train,
        "y_train": y_train,
        "numeric_features": numeric_features,
        "categorical_features": categorical_features,
    }
