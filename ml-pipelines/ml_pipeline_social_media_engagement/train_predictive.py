"""
Predictive models with held-out evaluation (no leakage features in X).

Engagement: Ridge, RandomForest, GradientBoosting regressors.
Referrals count: RF / GB regressors.
Any referral + high referrals (>= median): Logistic + RF classifier.
Donation value: log1p target, same regressors as engagement.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import (
    GradientBoostingClassifier,
    GradientBoostingRegressor,
    RandomForestClassifier,
    RandomForestRegressor,
)
from sklearn.linear_model import LogisticRegression, RidgeCV
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

from . import config
from .evaluate import classification_metrics, regression_metrics
from .feature_engineering import get_X_y
from .preprocess import build_preprocess


def _compare_regressors(
    X: pd.DataFrame,
    y: np.ndarray,
    num: list[str],
    cat: list[str],
    random_state: int,
    *,
    preprocess_builder: Callable[[list[str], list[str]], ColumnTransformer] | None = None,
) -> dict[str, Any]:
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=config.TEST_SIZE, random_state=random_state
    )
    prep_fn = preprocess_builder or build_preprocess
    prep = prep_fn(num, cat)
    models = {
        "ridge": RidgeCV(alphas=np.asarray(config.RIDGE_ALPHAS, dtype=float), cv=None),
        "random_forest": RandomForestRegressor(
            n_estimators=300,
            max_depth=12,
            min_samples_leaf=3,
            random_state=random_state,
            n_jobs=-1,
        ),
        "gradient_boosting": GradientBoostingRegressor(
            random_state=random_state,
            max_depth=4,
            n_estimators=200,
            learning_rate=0.08,
            min_samples_leaf=4,
        ),
    }
    rows = []
    fitted: dict[str, Pipeline] = {}
    best_name = None
    best_rmse = float("inf")
    for name, est in models.items():
        pipe = Pipeline([("prep", clone(prep)), ("model", est)])
        pipe.fit(X_train, y_train)
        pred = pipe.predict(X_test)
        m = regression_metrics(y_test, pred)
        rows.append({"model": name, **m})
        fitted[name] = pipe
        if m["rmse"] < best_rmse:
            best_rmse = m["rmse"]
            best_name = name
    assert best_name is not None
    return {
        "best_name": best_name,
        "best_pipeline": fitted[best_name],
        "all_results": pd.DataFrame(rows),
        "X_test": X_test,
        "y_test": y_test,
        "fitted": fitted,
    }


def _compare_regressors_with_target_transform(
    X: pd.DataFrame,
    y_raw: np.ndarray,
    num: list[str],
    cat: list[str],
    random_state: int,
    *,
    y_transform: Callable[[np.ndarray], np.ndarray],
    y_inverse: Callable[[np.ndarray], np.ndarray],
    preprocess_builder: Callable[[list[str], list[str]], ColumnTransformer] | None = None,
) -> dict[str, Any]:
    X_train, X_test, y_train_raw, y_test_raw = train_test_split(
        X, y_raw, test_size=config.TEST_SIZE, random_state=random_state
    )
    y_train = y_transform(np.asarray(y_train_raw, dtype=float))
    prep_fn = preprocess_builder or build_preprocess
    prep = prep_fn(num, cat)
    models = {
        "ridge": RidgeCV(alphas=np.asarray(config.RIDGE_ALPHAS, dtype=float), cv=None),
        "random_forest": RandomForestRegressor(
            n_estimators=300,
            max_depth=12,
            min_samples_leaf=3,
            random_state=random_state,
            n_jobs=-1,
        ),
        "gradient_boosting": GradientBoostingRegressor(
            random_state=random_state,
            max_depth=4,
            n_estimators=200,
            learning_rate=0.08,
            min_samples_leaf=4,
        ),
    }
    rows = []
    fitted: dict[str, Pipeline] = {}
    best_name = None
    best_rmse = float("inf")
    for name, est in models.items():
        pipe = Pipeline([("prep", clone(prep)), ("model", est)])
        pipe.fit(X_train, y_train)
        pred_t = pipe.predict(X_test)
        pred = np.clip(y_inverse(np.asarray(pred_t, dtype=float)), 0.0, None)
        m = regression_metrics(np.asarray(y_test_raw, dtype=float), pred)
        rows.append({"model": name, **m})
        fitted[name] = pipe
        if m["rmse"] < best_rmse:
            best_rmse = m["rmse"]
            best_name = name
    assert best_name is not None
    return {
        "best_name": best_name,
        "best_pipeline": fitted[best_name],
        "all_results": pd.DataFrame(rows),
        "X_test": X_test,
        "y_test": y_test_raw,
        "fitted": fitted,
        "target_transform": "log1p",
        "prediction_inverse": "expm1+clip_min_0",
    }


def _compare_classifiers(
    X: pd.DataFrame,
    y: np.ndarray,
    num: list[str],
    cat: list[str],
    random_state: int,
    *,
    preprocess_builder: Callable[[list[str], list[str]], ColumnTransformer] | None = None,
) -> dict[str, Any]:
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=config.TEST_SIZE, random_state=random_state, stratify=y
    )
    prep_fn = preprocess_builder or build_preprocess
    prep = prep_fn(num, cat)
    models = {
        "logistic": LogisticRegression(max_iter=2000, class_weight="balanced", random_state=random_state),
        "random_forest": RandomForestClassifier(
            n_estimators=300,
            max_depth=10,
            min_samples_leaf=2,
            class_weight="balanced",
            random_state=random_state,
            n_jobs=-1,
        ),
        "gradient_boosting": GradientBoostingClassifier(
            random_state=random_state,
            max_depth=4,
            n_estimators=200,
            learning_rate=0.08,
        ),
    }
    rows = []
    fitted: dict[str, Pipeline] = {}
    best_name = None
    best_auc = -1.0
    for name, est in models.items():
        pipe = Pipeline([("prep", clone(prep)), ("model", est)])
        pipe.fit(X_train, y_train)
        if hasattr(pipe.named_steps["model"], "predict_proba"):
            proba = pipe.predict_proba(X_test)[:, 1]
        else:
            proba = None
        pred = pipe.predict(X_test)
        m = classification_metrics(y_test, pred, proba)
        rows.append({"model": name, **m})
        fitted[name] = pipe
        auc = m.get("roc_auc", float("nan"))
        if not np.isnan(auc) and auc > best_auc:
            best_auc = auc
            best_name = name
    if best_name is None:
        best_name = "logistic"
    return {
        "best_name": best_name,
        "best_pipeline": fitted[best_name],
        "all_results": pd.DataFrame(rows),
        "X_test": X_test,
        "y_test": y_test,
        "fitted": fitted,
    }


def run_predictive_suite(
    df: pd.DataFrame,
    meta: dict,
    *,
    preprocess_builder: Callable[[list[str], list[str]], ColumnTransformer] | None = None,
) -> dict[str, Any]:
    num, cat = meta["numeric_features"], meta["categorical_features"]
    rs = config.RANDOM_STATE
    out: dict[str, Any] = {}

    X_e, y_e = get_X_y(df, meta, meta["target_engagement"])
    out["engagement"] = _compare_regressors(X_e, y_e, num, cat, rs, preprocess_builder=preprocess_builder)

    X_r, y_r = get_X_y(df, meta, meta["target_referrals"])
    out["referrals_count"] = _compare_regressors_with_target_transform(
        X_r,
        y_r,
        num,
        cat,
        rs,
        y_transform=np.log1p,
        y_inverse=np.expm1,
        preprocess_builder=preprocess_builder,
    )

    y_log = np.log1p(df.loc[X_r.index, meta["target_donation_value"]].clip(lower=0).astype(float).values)
    out["donation_value_log1p"] = _compare_regressors(X_r, y_log, num, cat, rs, preprocess_builder=preprocess_builder)

    X_b, y_b = get_X_y(df, meta, meta["target_referrals_binary"])
    y_b_int = y_b.astype(int)
    out["any_referral"] = _compare_classifiers(X_b, y_b_int, num, cat, rs, preprocess_builder=preprocess_builder)
    out["any_referral"]["target_definition"] = meta.get("target_referrals_binary_definition")
    out["any_referral"]["positive_rate"] = float(np.mean(y_b_int))

    X_h, y_h = get_X_y(df, meta, meta["target_referrals_high_median"])
    out["referrals_ge_median"] = _compare_classifiers(X_h, y_h.astype(int), num, cat, rs, preprocess_builder=preprocess_builder)

    return out
