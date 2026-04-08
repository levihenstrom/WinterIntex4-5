"""
Load serialized predictive pipeline and score a single resident feature row.

Run from ``ml-pipelines`` directory::

    python3 -m ml_pipeline_reintegration_effectiveness.inference_example
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import pandas as pd

from . import config
from .train_explanatory import split_xy


def load_pipeline(path: Path | None = None):
    path = path or (config.SERIALIZED_DIR / "reintegration_predictive_pipeline.joblib")
    if not path.is_file():
        raise FileNotFoundError(f"Train and export first — missing {path}")
    return joblib.load(path)


def predict_row(pipe, X_row: pd.DataFrame, numeric: list[str], categorical: list[str]) -> float:
    """Return P(Completed) for one aligned feature row."""
    _, xm = split_xy(X_row, numeric, categorical)
    return float(pipe.predict_proba(xm)[:, 1][0])


def main() -> None:
    meta_path = config.SERIALIZED_DIR / "reintegration_model_metadata.json"
    if not meta_path.is_file():
        print("Run export_artifacts first.", file=sys.stderr)
        sys.exit(1)
    with open(meta_path, encoding="utf-8") as f:
        meta = json.load(f)
    numeric = meta["numeric_features"]
    categorical = meta["categorical_features"]

    sample_path = config.SERIALIZED_DIR / "sample_payload_input.json"
    with open(sample_path, encoding="utf-8") as f:
        payload = json.load(f)
    row = pd.DataFrame([payload["features"]])
    # IDs optional for scoring
    for c in ("resident_id", "case_control_no"):
        if c not in row.columns:
            row[c] = 0 if c == "resident_id" else "DEMO"

    pipe = load_pipeline()
    p = predict_row(pipe, row, numeric, categorical)
    print(json.dumps({"reintegration_readiness_score": round(p, 4), "risk_of_regression": round(1 - p, 4)}, indent=2))


if __name__ == "__main__":
    main()
