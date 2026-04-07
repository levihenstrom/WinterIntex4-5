"""
Load saved pipeline and score sample snapshot with explanations.

From ``ml_pipeline``::

    python3 -m ml_pipeline_reintegration_readiness_scorer.inference_example
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from . import config
from .inference_explain import build_inference_payload


def _coef_path() -> Path:
    p = config.SERIALIZED_DIR / "explanation_logistic_coefficients.csv"
    if p.is_file():
        return p
    return config.OUTPUTS_DIR / "explanatory_logistic_coefficients.csv"


def main() -> None:
    meta_path = config.SERIALIZED_DIR / "reintegration_readiness_metadata.json"
    if not meta_path.is_file():
        print("Run export_artifacts / run_all first.", file=sys.stderr)
        sys.exit(1)
    with open(meta_path, encoding="utf-8") as f:
        meta = json.load(f)
    num = meta["numeric_features"]
    cat = meta["categorical_features"]

    medians_path = config.SERIALIZED_DIR / "train_reference_medians.json"
    stds_path = config.SERIALIZED_DIR / "train_reference_stds.json"
    medians: dict = {}
    stds: dict = {}
    if medians_path.is_file():
        with open(medians_path, encoding="utf-8") as f:
            medians = json.load(f)
    if stds_path.is_file():
        with open(stds_path, encoding="utf-8") as f:
            stds = json.load(f)

    with open(config.SERIALIZED_DIR / "sample_readiness_input.json", encoding="utf-8") as f:
        payload = json.load(f)
    feats = payload["features"]
    row = pd.DataFrame([feats])
    for c in num + cat:
        if c not in row.columns:
            row[c] = np.nan

    pipe = joblib.load(config.SERIALIZED_DIR / "reintegration_readiness_pipeline.joblib")
    X = row[num + cat]
    p = float(pipe.predict_proba(X)[0, 1])
    thr = float(meta.get("selected_threshold", 0.5))

    cp = _coef_path()
    if not cp.is_file():
        print("Missing explanation_logistic_coefficients.csv (run export_artifacts).", file=sys.stderr)
        sys.exit(1)

    out = build_inference_payload(
        p,
        thr,
        pipe,
        X,
        num,
        cat,
        config.TARGET_COL,
        coef_csv_path=cp,
        reference_medians={k: float(v) for k, v in medians.items() if k in num},
        reference_stds={k: float(v) for k, v in stds.items() if k in num},
        train_df=None,
    )
    print(json.dumps(out, indent=2, default=str))


if __name__ == "__main__":
    main()
