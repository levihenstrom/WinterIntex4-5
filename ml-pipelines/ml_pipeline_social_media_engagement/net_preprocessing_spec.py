"""
Extract a **deterministic JSON spec** from a fitted ONNX-friendly ``ColumnTransformer``
(``build_preprocess_onnx``) for future .NET (or other) preprocessing implementations.

This mirrors sklearn's fitted state (medians, scaler mean/scale, per-column category lists).
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.compose import ColumnTransformer

from .preprocess_onnx import CAT_ONNX_MISSING


def _json_safe(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_json_safe(v) for v in obj]
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    if isinstance(obj, (np.floating,)):
        x = float(obj)
        if math.isnan(x) or math.isinf(x):
            return None
        return x
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj


def build_net_preprocessing_spec(prep: ColumnTransformer, meta: dict[str, Any]) -> dict[str, Any]:
    """Serialize fitted ``prep`` (num+cat branches) + column lists from ``meta``."""
    num = list(meta["numeric_features"])
    cat = list(meta["categorical_features"])
    num_pipe = None
    cat_pipe = None
    for name, trans, _cols in prep.transformers_:
        if name == "num":
            num_pipe = trans
        elif name == "cat":
            cat_pipe = trans
    if num_pipe is None or cat_pipe is None:
        raise ValueError("ColumnTransformer missing num or cat branch")

    n_imp = num_pipe.named_steps["imputer"]
    n_sca = num_pipe.named_steps["scaler"]
    c_imp = cat_pipe.named_steps["imputer"]
    ohe = cat_pipe.named_steps["onehot"]

    num_med = [float(x) for x in n_imp.statistics_]
    cat_fill = [str(x) for x in c_imp.statistics_]

    onehot_categories: dict[str, list[str]] = {}
    for i, col in enumerate(cat):
        onehot_categories[col] = [str(x) for x in ohe.categories_[i]]

    return _json_safe(
        {
            "schema_version": 1,
            "categorical_missing_sentinel": CAT_ONNX_MISSING,
            "numeric_columns": num,
            "categorical_columns": cat,
            "onnx_raw_input_column_order": num + cat,
            "numeric_imputer_strategy": "median",
            "numeric_imputer_fill_per_column": dict(zip(num, num_med)),
            "numeric_standard_scaler_mean_per_column": dict(zip(num, [float(x) for x in n_sca.mean_])),
            "numeric_standard_scaler_scale_per_column": dict(zip(num, [float(x) for x in n_sca.scale_])),
            "categorical_imputer_strategy": "most_frequent",
            "categorical_imputer_missing_token": CAT_ONNX_MISSING,
            "categorical_imputer_fill_per_column": dict(zip(cat, cat_fill)),
            "onehot_handle_unknown": "ignore",
            "onehot_categories_per_column": onehot_categories,
            "transformed_feature_names": [str(x) for x in prep.get_feature_names_out()],
            "n_transformed_features": len(prep.get_feature_names_out()),
            "implementation_notes": (
                "Trained with preprocess_onnx: OneHotEncoder without max_categories; production joblib uses "
                "max_categories=35 with infrequent bucketing. Counts and weights differ from default export."
            ),
        }
    )


def write_net_preprocessing_spec(prep: ColumnTransformer, meta: dict[str, Any], path: Path) -> Path:
    spec = build_net_preprocessing_spec(prep, meta)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(spec, f, indent=2, default=str, allow_nan=False)
    return path
