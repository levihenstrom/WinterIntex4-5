"""
Shared sklearn preprocessing: numeric imputation + scaling, categorical imputation + one-hot.
"""

from __future__ import annotations

from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


def build_preprocess(numeric_features: list[str], categorical_features: list[str]) -> ColumnTransformer:
    """
    Build a ColumnTransformer for the engineered feature matrix.

    Expects ``X_model`` with only numeric + categorical columns (no IDs).
    """
    num_pipe = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )
    cat_pipe = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            (
                "onehot",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False, max_categories=25),
            ),
        ]
    )
    return ColumnTransformer(
        transformers=[
            ("num", num_pipe, numeric_features),
            ("cat", cat_pipe, categorical_features),
        ]
    )
