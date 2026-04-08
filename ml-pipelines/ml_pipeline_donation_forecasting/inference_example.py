"""
Score one donor feature row with saved amount + allocation pipelines.

From ``ml-pipelines``::

    python3 -m ml_pipeline_donation_forecasting.inference_example
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from . import config


def main() -> None:
    meta_path = config.SERIALIZED_DIR / "donation_forecasting_metadata.json"
    if not meta_path.is_file():
        print("Run export_artifacts first.", file=sys.stderr)
        sys.exit(1)
    with open(meta_path, encoding="utf-8") as f:
        meta = json.load(f)
    num = meta["numeric_features"]
    cat = meta["categorical_features"]

    with open(config.SERIALIZED_DIR / "sample_payload_input.json", encoding="utf-8") as f:
        payload = json.load(f)
    row = pd.DataFrame([payload["features"]])
    for c in num + cat:
        if c not in row.columns:
            row[c] = np.nan

    amt = joblib.load(config.SERIALIZED_DIR / "donation_amount_pipeline.joblib")
    alloc = joblib.load(config.SERIALIZED_DIR / "donation_allocation_pipeline.joblib")
    X = row[num + cat]
    pl = float(np.expm1(np.clip(amt.predict(X)[0], 0, 25)))
    av = np.clip(alloc.predict(X)[0], 0, None)
    n_p = int(meta.get("allocation_n_program", 0))
    if not n_p:
        prog_cols = [c for c in meta.get("allocation_outputs", []) if str(c).startswith("y_alloc_")]
        n_p = len(prog_cols)
    if n_p:
        av[:n_p] = av[:n_p] / max(av[:n_p].sum(), 1e-9)
    if n_p < len(av):
        av[n_p:] = av[n_p:] / max(av[n_p:].sum(), 1e-9)

    print(json.dumps({"predicted_next_donation_php": round(pl, 2), "raw_allocation_vector": av.tolist()}, indent=2))


if __name__ == "__main__":
    main()
