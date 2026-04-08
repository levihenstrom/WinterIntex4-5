"""
Associational (explanatory) models: Ridge on scaled one-hot + numeric features.

Coefficients are **not causal** — they describe linear associations in-sample.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import RidgeCV, LogisticRegression
from sklearn.pipeline import Pipeline

from . import config
from .feature_engineering import get_X_y
from .preprocess import build_preprocess


def fit_ridge_coefficients(
    X: pd.DataFrame,
    y: np.ndarray,
    numeric_features: list[str],
    categorical_features: list[str],
    alphas: tuple[float, ...] | None = None,
) -> tuple[Pipeline, pd.DataFrame]:
    alphas = alphas or config.RIDGE_ALPHAS
    prep = build_preprocess(numeric_features, categorical_features)
    pipe = Pipeline(
        [
            ("prep", prep),
            ("model", RidgeCV(alphas=np.asarray(alphas, dtype=float), cv=None)),
        ]
    )
    pipe.fit(X, y)
    names = list(pipe.named_steps["prep"].get_feature_names_out())
    coefs = pipe.named_steps["model"].coef_.ravel()
    inter = float(pipe.named_steps["model"].intercept_)
    out = pd.DataFrame({"feature": names, "coef": coefs}).assign(abs_coef=lambda x: x["coef"].abs())
    out = pd.concat(
        [pd.DataFrame([{"feature": "intercept", "coef": inter, "abs_coef": abs(inter)}]), out],
        ignore_index=True,
    ).sort_values("abs_coef", ascending=False)
    return pipe, out


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
                LogisticRegression(max_iter=2000, class_weight="balanced", random_state=config.RANDOM_STATE),
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


def run_explanatory_suite(
    df: pd.DataFrame,
    meta: dict,
    outputs_dir: Path | None = None,
) -> dict[str, tuple[Pipeline, pd.DataFrame]]:
    outputs_dir = outputs_dir or config.OUTPUTS_DIR
    outputs_dir.mkdir(parents=True, exist_ok=True)
    num, cat = meta["numeric_features"], meta["categorical_features"]

    results: dict[str, tuple[Pipeline, pd.DataFrame]] = {}

    X_eng, y_eng = get_X_y(df, meta, meta["target_engagement"])
    pipe_eng, coef_eng = fit_ridge_coefficients(X_eng, y_eng, num, cat)
    coef_eng.to_csv(outputs_dir / "explanatory_ridge_engagement_rate.csv", index=False)
    results["engagement_rate"] = (pipe_eng, coef_eng)

    X_ref, y_ref = get_X_y(df, meta, meta["target_referrals"])
    pipe_ref, coef_ref = fit_ridge_coefficients(X_ref, y_ref, num, cat)
    coef_ref.to_csv(outputs_dir / "explanatory_ridge_donation_referrals.csv", index=False)
    results["donation_referrals"] = (pipe_ref, coef_ref)

    y_val = np.log1p(df[meta["target_donation_value"]].clip(lower=0).astype(float).values)
    pipe_val, coef_val = fit_ridge_coefficients(X_ref, y_val, num, cat)
    coef_val.to_csv(outputs_dir / "explanatory_ridge_log1p_donation_value.csv", index=False)
    results["log1p_donation_value"] = (pipe_val, coef_val)

    X_bin, y_bin = get_X_y(df, meta, meta["target_referrals_binary"])
    y_bin_int = y_bin.astype(int)
    pipe_bin, coef_bin = fit_logistic_coefficients(X_bin, y_bin_int, num, cat)
    coef_bin.to_csv(outputs_dir / "explanatory_logistic_any_referral.csv", index=False)
    results["any_referral_logistic"] = (pipe_bin, coef_bin)

    return results
