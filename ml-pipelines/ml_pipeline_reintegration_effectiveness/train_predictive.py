"""
Predictive models: compare logistic, decision tree, random forest, histogram gradient boosting.

Model selection uses stratified CV on the training split; final metrics on held-out test.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GridSearchCV, StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.tree import DecisionTreeClassifier

from . import config
from .preprocess import build_preprocess
from .train_explanatory import split_xy


def build_candidate_pipelines(
    numeric_features: list[str],
    categorical_features: list[str],
    random_state: int = config.RANDOM_STATE,
) -> dict[str, Pipeline]:
    """Named sklearn Pipelines (prep + classifier)."""
    prep = build_preprocess(numeric_features, categorical_features)
    return {
        "logistic": Pipeline(
            [
                ("prep", clone(prep)),
                (
                    "model",
                    LogisticRegression(
                        max_iter=5000,
                        class_weight="balanced",
                        random_state=random_state,
                        solver="lbfgs",
                    ),
                ),
            ]
        ),
        "decision_tree": Pipeline(
            [
                ("prep", clone(prep)),
                (
                    "model",
                    DecisionTreeClassifier(
                        class_weight="balanced",
                        random_state=random_state,
                        max_depth=4,
                        min_samples_leaf=2,
                    ),
                ),
            ]
        ),
        "random_forest": Pipeline(
            [
                ("prep", clone(prep)),
                (
                    "model",
                    RandomForestClassifier(
                        class_weight="balanced",
                        random_state=random_state,
                        n_estimators=200,
                        n_jobs=-1,
                    ),
                ),
            ]
        ),
        "hist_gradient_boosting": Pipeline(
            [
                ("prep", clone(prep)),
                (
                    "model",
                    HistGradientBoostingClassifier(
                        random_state=random_state,
                        max_depth=3,
                        max_iter=100,
                        learning_rate=0.08,
                    ),
                ),
            ]
        ),
    }


def select_and_tune(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    numeric_features: list[str],
    categorical_features: list[str],
    cv_splits: int = config.CV_SPLITS,
    random_state: int = config.RANDOM_STATE,
) -> tuple[Pipeline, pd.DataFrame, dict[str, Any]]:
    """
    Cross-validate candidate models; tune the best family (random forest) on training only.
    """
    _, X_tr = split_xy(X_train, numeric_features, categorical_features)
    candidates = build_candidate_pipelines(numeric_features, categorical_features, random_state)
    y_tr = np.asarray(y_train)

    n_pos = int(y_tr.sum())
    n_neg = int(len(y_tr) - n_pos)
    cv_splits = min(cv_splits, n_pos, n_neg)
    cv_splits = max(cv_splits, 2)
    cv = StratifiedKFold(n_splits=cv_splits, shuffle=True, random_state=random_state)

    rows = []
    for name, pipe in candidates.items():
        scores = cross_val_score(pipe, X_tr, y_tr, cv=cv, scoring="roc_auc", n_jobs=-1)
        rows.append(
            {
                "model": name,
                "cv_roc_auc_mean": float(scores.mean()),
                "cv_roc_auc_std": float(scores.std()),
            }
        )
    cv_df = pd.DataFrame(rows).sort_values("cv_roc_auc_mean", ascending=False)
    best_name = cv_df.iloc[0]["model"]

    base = candidates[best_name]
    tuned = base
    tuning: dict[str, Any] = {"selected": best_name, "grid_best_params": None}

    if best_name == "random_forest":
        param_grid = {
            "model__n_estimators": [100, 300],
            "model__max_depth": [2, 4, None],
            "model__min_samples_leaf": [1, 2],
        }
        grid = GridSearchCV(
            clone(base),
            param_grid,
            cv=cv,
            scoring="roc_auc",
            n_jobs=-1,
        )
        grid.fit(X_tr, y_tr)
        tuned = grid.best_estimator_
        tuning["grid_best_params"] = grid.best_params_
        tuning["grid_best_cv_roc_auc"] = float(grid.best_score_)

    else:
        tuned.fit(X_tr, y_tr)

    return tuned, cv_df, tuning


def train_predictive_full(
    X: pd.DataFrame,
    y: pd.Series,
    meta: dict,
    test_size: float = config.TEST_SIZE,
    random_state: int = config.RANDOM_STATE,
) -> dict[str, Any]:
    """
    Train/test split, model selection + optional tuning, return bundles for evaluate/export.
    """
    numeric = meta["numeric_features"]
    categorical = meta["categorical_features"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=y
    )

    best_pipe, cv_df, tuning = select_and_tune(X_train, y_train, numeric, categorical)

    return {
        "pipeline": best_pipe,
        "X_train": X_train,
        "X_test": X_test,
        "y_train": y_train,
        "y_test": y_test,
        "cv_results": cv_df,
        "tuning": tuning,
        "numeric_features": numeric,
        "categorical_features": categorical,
    }


if __name__ == "__main__":
    from .data_prep import prepare_tables
    from .evaluate import classification_report_dict
    from .feature_engineering import build_feature_matrix

    tables, obs = prepare_tables(config.DEFAULT_DATA_DIR)
    X, y, meta = build_feature_matrix(tables, obs)
    out = train_predictive_full(X, y, meta)
    print(out["cv_results"])
    _, X_te = split_xy(out["X_test"], meta["numeric_features"], meta["categorical_features"])
    proba = out["pipeline"].predict_proba(X_te)[:, 1]
    rep = classification_report_dict(out["y_test"], (proba >= 0.5).astype(int), proba)
    print(rep)
