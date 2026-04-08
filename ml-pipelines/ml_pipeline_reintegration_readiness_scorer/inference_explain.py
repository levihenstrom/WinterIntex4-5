"""
Readiness bands and local explanations.

Direction for explanations comes from the explanatory logistic regression (coefficients on
preprocessed features). The readiness score still comes from the predictive model (e.g. RF).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV

from . import config


def unwrap_for_explanations(pipeline: Any) -> Any:
    """CalibratedClassifierCV wraps the fitted prep+model; explanations use the inner estimator."""
    if isinstance(pipeline, CalibratedClassifierCV):
        ccs = getattr(pipeline, "calibrated_classifiers_", None)
        if ccs is not None and len(ccs) and hasattr(ccs[0], "estimator"):
            return ccs[0].estimator
    return pipeline


def readiness_band(score: float) -> str:
    """Map score to product label using metadata bands."""
    s = float(score)
    for lo, hi, label in config.READINESS_BANDS:
        if lo <= s < hi:
            return label
    return config.READINESS_BANDS[-1][2]


def _aggregate_rf_importance(names: np.ndarray, imps: np.ndarray, num: list[str], cat: list[str]) -> dict[str, float]:
    agg: dict[str, float] = {c: 0.0 for c in num + cat}
    for n, w in zip(names, imps):
        n = str(n)
        for c in num:
            if n == f"num__{c}":
                agg[c] += float(w)
                break
        else:
            for c in cat:
                prefix = f"cat__{c}_"
                if n.startswith(prefix):
                    agg[c] += float(w)
                    break
    return agg


def load_logistic_coef_maps(coef_df: pd.DataFrame) -> tuple[dict[str, float], dict[str, float]]:
    """
    Numeric column name -> coef (from num__col rows).
    Full transformed name (e.g. cat__case_category_Foundling) -> coef.
    """
    num_coef: dict[str, float] = {}
    cat_coef: dict[str, float] = {}
    for _, r in coef_df.iterrows():
        f = str(r["feature"])
        if f == "intercept":
            continue
        v = float(r["coef"])
        if f.startswith("num__"):
            num_coef[f.replace("num__", "", 1)] = v
        else:
            cat_coef[f] = v
    return num_coef, cat_coef


def coef_for_categorical_level(cat_coef: dict[str, float], col: str, raw_value: Any) -> float | None:
    """Match one-hot coefficient for this category value."""
    v = str(raw_value).strip()
    exact = f"cat__{col}_{v}"
    if exact in cat_coef:
        return cat_coef[exact]
    prefix = f"cat__{col}_"
    for k, c in cat_coef.items():
        if not k.startswith(prefix):
            continue
        suffix = k[len(prefix) :]
        if suffix == v:
            return c
        if suffix.replace(" ", "_") == v.replace(" ", "_"):
            return c
    return None


def numeric_helps_readiness(coef: float, above_median: bool) -> bool:
    """
    Logistic coef on scaled numeric: coef>0 => higher value => higher log-odds of success.
    coef<0 => higher value => lower log-odds.
    """
    if coef > 0:
        return bool(above_median)
    if coef < 0:
        return not above_median
    return False


def format_numeric_line(label: str, above: bool, helps: bool) -> str:
    """Staff-friendly lines; direction matches logistic association with success."""
    if helps:
        if above:
            return (
                f"{label}: above typical for similar residents and associated with stronger readiness"
            )
        return f"{label}: below typical for similar residents and associated with stronger readiness"
    if above:
        return f"{label}: above typical for similar residents and associated with weaker readiness"
    return f"{label}: below typical for similar residents and associated with weaker readiness"


def format_categorical_line(label: str, value: str, coef: float) -> str:
    if coef > 0:
        return (
            f"{label}: {value} — compared with typical reference cases, associated with stronger readiness"
        )
    return f"{label}: {value} — compared with typical reference cases, associated with weaker readiness"


def categorical_helps_readiness(coef: float) -> bool:
    """One-hot coef is vs reference category; positive => this level increases log-odds vs reference."""
    return coef > 0


def local_impact_numeric(importance: float, coef: float, v: float, med: float, std: float) -> float:
    dev = abs(float(v) - float(med)) / (float(std) + 1e-9)
    return float(importance) * abs(float(coef)) * (1.0 + min(dev, 5.0))


def build_local_explanations(
    predict_pipeline: Any,
    X_row: pd.DataFrame,
    num: list[str],
    cat: list[str],
    coef_df: pd.DataFrame,
    reference_medians: dict[str, float],
    reference_stds: dict[str, float] | None,
    top_k: int = 5,
) -> tuple[list[str], list[str]]:
    """
    Rank candidate features by RF importance × |logistic coef| × local deviation scale.
    Assign each feature to exactly one of positive/risk using logistic direction + vs median (numeric)
    or vs reference category (categorical).
    """
    inner = unwrap_for_explanations(predict_pipeline)
    model = inner.named_steps.get("model")
    prep = inner.named_steps.get("prep")
    num_coef, cat_coef = load_logistic_coef_maps(coef_df)

    importance: dict[str, float] = {c: 0.0 for c in num + cat}
    if model is not None and prep is not None and hasattr(model, "feature_importances_"):
        names = np.array(prep.get_feature_names_out())
        imps = model.feature_importances_
        importance = _aggregate_rf_importance(names, imps, num, cat)
    else:
        for c in num:
            importance[c] = abs(num_coef.get(c, 0.0)) + 1e-6
        for c in cat:
            importance[c] = max(
                (abs(v) for k, v in cat_coef.items() if str(k).startswith(f"cat__{c}_")),
                default=1e-6,
            )

    stds = reference_stds or {}
    candidates: list[dict[str, Any]] = []

    for c in num:
        coef = num_coef.get(c)
        if coef is None or np.isnan(coef):
            continue
        v = pd.to_numeric(X_row[c].iloc[0], errors="coerce")
        m = reference_medians.get(c, np.nan)
        if np.isnan(v) or np.isnan(m):
            continue
        above = bool(v > m)
        helps = numeric_helps_readiness(coef, above)
        imp = max(importance.get(c, 0.0), 1e-12)
        sd = float(stds.get(c, 1.0)) if isinstance(stds, dict) else 1.0
        if np.isnan(sd) or sd < 1e-12:
            sd = 1.0
        score = local_impact_numeric(imp, coef, float(v), float(m), sd)
        label = c.replace("_", " ")
        msg = format_numeric_line(label, above, helps)
        candidates.append(
            {
                "key": f"num:{c}",
                "helps": helps,
                "impact": score,
                "line": msg,
            }
        )

    for c in cat:
        raw = X_row[c].iloc[0]
        if pd.isna(raw):
            continue
        coef = coef_for_categorical_level(cat_coef, c, raw)
        if coef is None or np.isnan(coef):
            continue
        helps = categorical_helps_readiness(coef)
        imp = max(importance.get(c, 0.0), 1e-12)
        score = imp * abs(coef)
        label = c.replace("_", " ")
        msg = format_categorical_line(label, str(raw), coef)
        candidates.append(
            {
                "key": f"cat:{c}",
                "helps": helps,
                "impact": score,
                "line": msg,
            }
        )

    pos = sorted([x for x in candidates if x["helps"]], key=lambda x: -x["impact"])[:top_k]
    risk = sorted([x for x in candidates if not x["helps"]], key=lambda x: -x["impact"])[:top_k]

    pos_lines = [x["line"] for x in pos]
    risk_lines = [x["line"] for x in risk]

    pos_keys = {x["key"] for x in pos}
    risk_keys = {x["key"] for x in risk}
    assert not (pos_keys & risk_keys), "feature keys overlap between positive and risk lists"

    return pos_lines, risk_lines


def build_inference_payload(
    score: float,
    decision_threshold: float,
    pipeline: Any,
    X_row: pd.DataFrame,
    num: list[str],
    cat: list[str],
    target_col: str,
    coef_csv_path: Path | str | None = None,
    reference_medians: dict[str, float] | None = None,
    reference_stds: dict[str, float] | None = None,
    train_df: pd.DataFrame | None = None,
) -> dict[str, Any]:
    band = readiness_band(score)
    pred_pos = bool(score >= decision_threshold)

    coef_path = Path(coef_csv_path) if coef_csv_path else None
    if coef_path is None or not coef_path.is_file():
        return {
            "reintegration_readiness_score": round(float(score), 4),
            "decision_threshold": round(float(decision_threshold), 4),
            "readiness_band": band,
            "predicted_positive_at_threshold": pred_pos,
            "top_positive_factors": [],
            "top_risk_factors": [],
            "note": "Explanations require explanation_logistic_coefficients.csv (run export_artifacts). Score is decision support only.",
        }

    coef_df = pd.read_csv(coef_path)

    if train_df is not None:
        medians = train_df[num].median(numeric_only=True).to_dict()
        raw_std = train_df[num].std(numeric_only=True).to_dict()
        stds = {}
        for k, v in raw_std.items():
            fv = float(v) if not (isinstance(v, float) and np.isnan(v)) else 1.0
            stds[k] = fv if fv > 1e-12 else 1.0
    elif reference_medians is not None:
        medians = {k: float(v) for k, v in reference_medians.items()}
        stds = {}
        if reference_stds:
            for k, v in reference_stds.items():
                fv = float(v) if not (isinstance(v, float) and np.isnan(v)) else 1.0
                stds[k] = fv if fv > 1e-12 else 1.0
    else:
        medians = {}
        stds = {}

    top_pos, top_risk = build_local_explanations(
        pipeline,
        X_row,
        num,
        cat,
        coef_df,
        medians,
        stds,
        top_k=5,
    )

    return {
        "reintegration_readiness_score": round(float(score), 4),
        "decision_threshold": round(float(decision_threshold), 4),
        "readiness_band": band,
        "predicted_positive_at_threshold": pred_pos,
        "top_positive_factors": top_pos[:5],
        "top_risk_factors": top_risk[:5],
        "note": "Directions follow the explanatory logistic model (associations on training data); the score is from the predictive model. Decision support only.",
    }


# Backward compatibility for export_artifacts / tests that still import this
def feature_success_direction(train_df: pd.DataFrame, num: list[str], target_col: str) -> dict[str, int]:
    """Deprecated for inference; kept for legacy scripts. Prefer logistic coefficients."""
    out: dict[str, int] = {}
    y = train_df[target_col].astype(float)
    for c in num:
        x = pd.to_numeric(train_df[c], errors="coerce")
        if x.notna().sum() < 10 or x.std() < 1e-12:
            continue
        r = x.corr(y, method="spearman")
        if np.isnan(r):
            continue
        out[c] = 1 if r >= 0 else -1
    return out
