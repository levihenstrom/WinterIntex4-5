"""
Path and run configuration for the reintegration / recovery pipeline.

Resolve paths from repo layout: .../WinterIntex4-5/ml-pipelines/ml_pipeline_reintegration_effectiveness/config.py
"""

from __future__ import annotations

from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parent
ML_PIPELINE_DIR = PACKAGE_DIR.parent
REPO_ROOT = ML_PIPELINE_DIR.parent

DEFAULT_DATA_DIR = REPO_ROOT / "data" / "lighthouse_csv_v7"
OUTPUTS_DIR = PACKAGE_DIR / "outputs"
SERIALIZED_DIR = PACKAGE_DIR / "serialized_models"

RANDOM_STATE = 42
# Leakage control: features use activity in [window_start, window_end]; window_end = obs_date - GAP_DAYS
GAP_DAYS = 30
LOOKBACK_DAYS = 365
TEST_SIZE = 0.25
CV_SPLITS = 5

# Target: 1 if reintegration_status == Completed (see README for censoring caveats)
TARGET_POSITIVE_LABEL = "Completed"
