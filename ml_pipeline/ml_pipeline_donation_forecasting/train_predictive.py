"""
Predictive models for next donation amount (PHP): Ridge, tuned Random Forest, Gradient Boosting on log1p(y).

RF hyperparameters chosen via time-ordered CV on the training slice; final comparison on holdout (PHP scale).
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import RidgeCV
from sklearn.model_selection import RandomizedSearchCV, TimeSeriesSplit
from sklearn.pipeline import Pipeline

from . import config
from .dataset_utils import feature_target_columns
from .evaluate import regression_metrics
from .preprocess import build_preprocess
from .train_explanatory import time_ordered_split


def _cv_splits_for_train(n_train: int) -> int:
    k = min(config.TIME_SERIES_CV_SPLITS, max(2, n_train // 18))
    return max(k, 2)


def _rf_search(
    prep_template: Any,
    X_train: pd.DataFrame,
    y_train_log: np.ndarray,
    random_state: int,
) -> tuple[Pipeline, dict[str, Any]]:
    n_train = len(X_train)
    n_splits = min(_cv_splits_for_train(n_train), max(2, n_train - 1))
    tscv = TimeSeriesSplit(n_splits=n_splits)
    base_rf = RandomForestRegressor(random_state=random_state, n_jobs=-1)
    pipe = Pipeline([("prep", clone(prep_template)), ("model", base_rf)])
    param_dist = {
        "model__n_estimators": [120, 200, 300, 400],
        "model__max_depth": [3, 4, 5, 6, 8, 10, None],
        "model__min_samples_leaf": [1, 2, 4, 8],
        "model__min_samples_split": [2, 4, 8, 16],
        "model__max_features": ["sqrt", 0.5, 0.7, 1.0],
    }
    search = RandomizedSearchCV(
        pipe,
        param_distributions=param_dist,
        n_iter=config.RF_RANDOM_SEARCH_ITER,
        cv=tscv,
        scoring="neg_mean_squared_error",
        random_state=random_state,
        n_jobs=-1,
        refit=True,
    )
    search.fit(X_train, y_train_log)
    best: Pipeline = search.best_estimator_
    cv_mse = -search.cv_results_["mean_test_score"][search.best_index_]
    cv_rmse_log = float(np.sqrt(cv_mse))
    std = float(search.cv_results_["std_test_score"][search.best_index_])
    meta = {
        "best_params": search.best_params_,
        "cv_n_splits": n_splits,
        "cv_rmse_log_mean": cv_rmse_log,
        "cv_neg_mse_std": std,
    }
    return best, meta


def build_amount_models(random_state: int = config.RANDOM_STATE) -> dict[str, Any]:
    return {
        "ridge": RidgeCV(alphas=np.asarray(config.RIDGE_ALPHAS, dtype=float), cv=None),
        "random_forest": RandomForestRegressor(
            n_estimators=250,
            max_depth=8,
            min_samples_leaf=2,
            random_state=random_state,
            n_jobs=-1,
        ),
        "gradient_boosting": GradientBoostingRegressor(
            random_state=random_state,
            max_depth=3,
            n_estimators=200,
            learning_rate=0.06,
            min_samples_leaf=4,
            subsample=0.85,
        ),
    }


def train_compare_amount(
    df: pd.DataFrame,
    meta: dict,
    train_fraction: float = config.TRAIN_FRACTION,
) -> dict[str, Any]:
    num, cat, _ = feature_target_columns(df, meta)
    train_df, test_df = time_ordered_split(df, train_fraction)
    X_train, X_test = train_df[num + cat], test_df[num + cat]
    y_train = train_df["y_amount"].astype(float).values
    y_test = test_df["y_amount"].astype(float).values
    y_train_log = np.log1p(y_train)
    y_test_log = np.log1p(y_test)

    prep_template = build_preprocess(num, cat)
    results = []
    best_name = None
    best_rmse = float("inf")
    fitted: dict[str, Pipeline] = {}
    rf_cv_meta: dict[str, Any] | None = None

    for name, est in build_amount_models().items():
        if name == "random_forest":
            pipe, rf_cv_meta = _rf_search(prep_template, X_train, y_train_log, config.RANDOM_STATE)
        else:
            pipe = Pipeline([("prep", clone(prep_template)), ("model", est)])
            pipe.fit(X_train, y_train_log)
        pred_log = pipe.predict(X_test)
        pred_log = np.clip(pred_log, 0, 25)
        pred_amt = np.expm1(pred_log)
        m = regression_metrics(y_test, pred_amt)
        m_log = regression_metrics(y_test_log, pred_log)
        row: dict[str, Any] = {"model": name, **m, "r2_log": m_log["r2"], "rmse_log": m_log["rmse"]}
        if name == "random_forest" and rf_cv_meta is not None:
            row["cv_rmse_log_mean"] = rf_cv_meta["cv_rmse_log_mean"]
            row["cv_n_splits"] = rf_cv_meta["cv_n_splits"]
        else:
            row["cv_rmse_log_mean"] = None
            row["cv_n_splits"] = None
        results.append(row)
        fitted[name] = pipe
        if m["rmse"] < best_rmse:
            best_rmse = m["rmse"]
            best_name = name

    assert best_name is not None
    return {
        "best_name": best_name,
        "best_pipeline": fitted[best_name],
        "all_results": pd.DataFrame(results),
        "numeric_features": num,
        "categorical_features": cat,
        "train_df": train_df,
        "test_df": test_df,
        "X_test": X_test,
        "y_test": y_test,
        "random_forest_cv_meta": rf_cv_meta,
    }
