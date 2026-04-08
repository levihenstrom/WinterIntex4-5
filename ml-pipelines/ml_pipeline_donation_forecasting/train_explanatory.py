"""
Explanatory (associational) model for donation amount: Ridge regression on log1p(amount).

Coefficients describe linear associations after scaling numerics — not causal effects.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import RidgeCV
from sklearn.pipeline import Pipeline

from . import config
from .dataset_utils import feature_target_columns
from .preprocess import build_preprocess


def time_ordered_split(df: pd.DataFrame, train_fraction: float = config.TRAIN_FRACTION) -> tuple[pd.DataFrame, pd.DataFrame]:
    d = df.sort_values("target_donation_date").reset_index(drop=True)
    n = len(d)
    k = max(int(n * train_fraction), 1)
    if k >= n:
        k = n - 1
    return d.iloc[:k].copy(), d.iloc[k:].copy()


def fit_amount_ridge_explanatory(
    X_train: pd.DataFrame,
    y_train_log: np.ndarray,
    numeric_features: list[str],
    categorical_features: list[str],
) -> tuple[Pipeline, pd.DataFrame]:
    prep = build_preprocess(numeric_features, categorical_features)
    pipe = Pipeline(
        [
            ("prep", prep),
            ("model", RidgeCV(alphas=np.asarray(config.RIDGE_ALPHAS, dtype=float), cv=None)),
        ]
    )
    pipe.fit(X_train, y_train_log)
    names = list(pipe.named_steps["prep"].get_feature_names_out())
    coefs = pipe.named_steps["model"].coef_.ravel()
    inter = float(pipe.named_steps["model"].intercept_)
    out = pd.DataFrame({"feature": names, "coef": coefs}).assign(abs_coef=lambda x: x["coef"].abs())
    out = pd.concat(
        [pd.DataFrame([{"feature": "intercept", "coef": inter, "abs_coef": abs(inter)}]), out],
        ignore_index=True,
    ).sort_values("abs_coef", ascending=False)
    return pipe, out


def run_explanatory(
    df: pd.DataFrame,
    meta: dict,
    outputs_dir: Path | None = None,
) -> tuple[Pipeline, pd.DataFrame]:
    outputs_dir = outputs_dir or config.OUTPUTS_DIR
    outputs_dir.mkdir(parents=True, exist_ok=True)
    num, cat, _ = feature_target_columns(df, meta)
    train_df, _ = time_ordered_split(df)
    X_tr = train_df[num + cat]
    y_tr = np.log1p(train_df["y_amount"].astype(float).values)
    pipe, coef_df = fit_amount_ridge_explanatory(X_tr, y_tr, num, cat)
    coef_df.to_csv(outputs_dir / "explanatory_ridge_coefficients_log_amount.csv", index=False)
    return pipe, coef_df
