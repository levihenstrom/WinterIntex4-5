"""
ONNX-oriented preprocessing variant for the social pipeline (parallel to ``preprocess.py``).

**Why this exists:** skl2onnx rejects categorical ``SimpleImputer(strategy='most_frequent')`` with
the default ``missing_values=np.nan`` on string columns. Using an explicit **string sentinel**
(``CAT_ONNX_MISSING``) makes the imputer ONNX-convertible.

**Second change vs production ``preprocess.py``:** ``OneHotEncoder`` is created **without**
``max_categories=35``. skl2onnx does not implement sklearn's infrequent-category bucketing used
when ``max_categories`` is set. Dropping it changes the transformed column count vs the
production joblib pipeline — this path is **not** numerically identical to shipped models.

Use only for the **parallel** full-graph ONNX export / .NET prep spec, not for replacing the
default training export without retraining.
"""

from __future__ import annotations

from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

# Must match ``apply_categorical_onnx_sentinel`` in ``feature_engineering``.
CAT_ONNX_MISSING = "__MISSING__"


def build_preprocess_onnx(numeric_features: list[str], categorical_features: list[str]) -> ColumnTransformer:
    num_pipe = Pipeline(
        [
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )
    cat_pipe = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(strategy="most_frequent", missing_values=CAT_ONNX_MISSING),
            ),
            (
                "onehot",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
            ),
        ]
    )
    return ColumnTransformer(
        transformers=[
            ("num", num_pipe, numeric_features),
            ("cat", cat_pipe, categorical_features),
        ]
    )
