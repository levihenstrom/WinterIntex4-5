#!/usr/bin/env python3
"""
End-to-end run: load data → features → train → export artifacts.

Usage (from ``WinterIntex4-5/ml-pipelines``)::

    python3 -m ml_pipeline_reintegration_effectiveness.run_all
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Allow ``python ml_pipeline_reintegration_effectiveness/run_all.py``
_PKG = Path(__file__).resolve().parent
_ML = _PKG.parent
if str(_ML) not in sys.path:
    sys.path.insert(0, str(_ML))

from ml_pipeline_reintegration_effectiveness import config
from ml_pipeline_reintegration_effectiveness.data_prep import prepare_tables
from ml_pipeline_reintegration_effectiveness.export_artifacts import export_full_run
from ml_pipeline_reintegration_effectiveness.feature_engineering import build_feature_matrix


def main() -> None:
    config.OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    config.SERIALIZED_DIR.mkdir(parents=True, exist_ok=True)
    tables, obs = prepare_tables(config.DEFAULT_DATA_DIR)
    X, y, fe_meta = build_feature_matrix(tables, obs)
    info = export_full_run(X, y, fe_meta)
    print(json.dumps(info["test_metrics"], indent=2))
    print("Wrote:", info["pipeline_path"])


if __name__ == "__main__":
    main()
