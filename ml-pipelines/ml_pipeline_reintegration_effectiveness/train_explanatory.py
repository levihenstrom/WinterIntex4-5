"""
Explanatory (associational) model: logistic regression on scaled features.

This answers: which factors are associated with Completed reintegration in this snapshot,
**not** which interventions cause success (no causal identification).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

from . import config
from .preprocess import build_preprocess


def split_xy(X: pd.DataFrame, numeric: list[str], categorical: list[str]) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Separate identifiers from model matrix."""
    id_cols = [c for c in ("resident_id", "case_control_no") if c in X.columns]
    X_ids = X[id_cols].copy() if id_cols else pd.DataFrame()
    X_model = X[numeric + categorical].copy()
    return X_ids, X_model


def fit_explanatory_logistic(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    numeric_features: list[str],
    categorical_features: list[str],
    random_state: int = config.RANDOM_STATE,
) -> tuple[Pipeline, pd.DataFrame]:
    """
    Fit logistic regression pipeline (preprocess + LR, balanced class weights).

    Returns
    -------
    pipe : Pipeline
        Fitted pipeline.
    coef_df : DataFrame
        Transformed feature names with coefficients and odds ratios (exp(coef)).
    """
    prep = build_preprocess(numeric_features, categorical_features)
    pipe = Pipeline(
        [
            ("prep", prep),
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
    )
    pipe.fit(X_train, y_train)

    prep_fitted: Any = pipe.named_steps["prep"]
    model = pipe.named_steps["model"]
    import numpy as np

    names = list(prep_fitted.get_feature_names_out())
    coefs = model.coef_.ravel()
    odds = np.exp(coefs)
    coef_df = (
        pd.DataFrame({"feature": names, "logistic_coef": coefs, "odds_ratio": odds})
        .assign(abs_coef=lambda d: d["logistic_coef"].abs())
        .sort_values("abs_coef", ascending=False)
    )
    return pipe, coef_df


def run_explanatory(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    meta: dict,
    outputs_dir: Path | None = None,
) -> tuple[Pipeline, pd.DataFrame]:
    """Fit explanatory model and write coefficient table to outputs."""
    outputs_dir = outputs_dir or config.OUTPUTS_DIR
    outputs_dir.mkdir(parents=True, exist_ok=True)
    numeric = meta["numeric_features"]
    categorical = meta["categorical_features"]
    _, X_tr = split_xy(X_train, numeric, categorical)
    pipe, coef_df = fit_explanatory_logistic(X_tr, y_train, numeric, categorical)
    coef_path = outputs_dir / "explanatory_logistic_coefficients.csv"
    coef_df.to_csv(coef_path, index=False)
    joblib.dump(pipe, outputs_dir / "explanatory_logistic_pipeline.joblib")
    return pipe, coef_df


if __name__ == "__main__":
    from .data_prep import prepare_tables
    from .feature_engineering import build_feature_matrix
    from sklearn.model_selection import train_test_split

    tables, obs = prepare_tables(config.DEFAULT_DATA_DIR)
    X, y, meta = build_feature_matrix(tables, obs)
    num = meta["numeric_features"]
    cat = meta["categorical_features"]
    X_train, _, y_train, _ = train_test_split(
        X, y, test_size=config.TEST_SIZE, random_state=config.RANDOM_STATE, stratify=y
    )
    _, coef_df = run_explanatory(X_train, y_train, meta)
    print(coef_df.head(20).to_string())
