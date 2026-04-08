"""Logistic regression coefficients (associational, not causal)."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

from . import config
from .preprocess import build_preprocess


def fit_logistic_coefficients(
    X: pd.DataFrame,
    y: np.ndarray,
    numeric_features: list[str],
    categorical_features: list[str],
) -> tuple[Pipeline, pd.DataFrame]:
    prep = build_preprocess(numeric_features, categorical_features)
    pipe = Pipeline(
        [
            ("prep", prep),
            (
                "model",
                LogisticRegression(
                    max_iter=3000,
                    class_weight="balanced",
                    random_state=config.RANDOM_STATE,
                ),
            ),
        ]
    )
    pipe.fit(X, y)
    names = list(pipe.named_steps["prep"].get_feature_names_out())
    coefs = pipe.named_steps["model"].coef_.ravel()
    inter = float(pipe.named_steps["model"].intercept_[0])
    out = pd.DataFrame({"feature": names, "coef": coefs}).assign(abs_coef=lambda x: x["coef"].abs())
    out = pd.concat(
        [pd.DataFrame([{"feature": "intercept", "coef": inter, "abs_coef": abs(inter)}]), out],
        ignore_index=True,
    ).sort_values("abs_coef", ascending=False)
    return pipe, out


def run_explanatory(
    X_train: pd.DataFrame,
    y_train: np.ndarray,
    num: list[str],
    cat: list[str],
    outputs_dir: Path | None = None,
) -> tuple[Pipeline, pd.DataFrame]:
    outputs_dir = outputs_dir or config.OUTPUTS_DIR
    outputs_dir.mkdir(parents=True, exist_ok=True)
    pipe, coef_df = fit_logistic_coefficients(X_train, y_train, num, cat)
    coef_df.to_csv(outputs_dir / "explanatory_logistic_coefficients.csv", index=False)
    return pipe, coef_df
