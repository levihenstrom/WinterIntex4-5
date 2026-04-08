"""Paths and defaults for donation forecasting pipeline."""

from __future__ import annotations

from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parent
ML_PIPELINE_DIR = PACKAGE_DIR.parent
REPO_ROOT = ML_PIPELINE_DIR.parent

DEFAULT_DATA_DIR = REPO_ROOT / "data" / "lighthouse_csv_v7"
OUTPUTS_DIR = PACKAGE_DIR / "outputs"
SERIALIZED_DIR = PACKAGE_DIR / "serialized_models"

RANDOM_STATE = 42
# Time-ordered fraction for train (rest = test); no shuffling
TRAIN_FRACTION = 0.75

# Drop overlapping prior-amount columns (min/sum/max vs mean/std/last/roll3/trend).
COMPACT_AMOUNT_FEATURES = True
# Train allocation on program-area shares only (fewer outputs, less overfitting on small n).
ALLOCATION_PREDICT_PROGRAM_ONLY = True

# Inner time-series CV on the training slice (for RF search); capped when n_train is small.
TIME_SERIES_CV_SPLITS = 5
RF_RANDOM_SEARCH_ITER = 20

# RidgeCV grid for linear amount + explanatory models (log1p scale).
RIDGE_ALPHAS = tuple(10 ** (i / 2 - 1) for i in range(0, 13))  # 0.1 .. ~3162
