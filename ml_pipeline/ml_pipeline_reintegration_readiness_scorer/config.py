"""Paths and defaults for reintegration readiness scorer (time-aware, leakage-safe)."""

from __future__ import annotations

from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parent
ML_PIPELINE_DIR = PACKAGE_DIR.parent
REPO_ROOT = ML_PIPELINE_DIR.parent

DEFAULT_DATA_DIR = REPO_ROOT / "data" / "lighthouse_csv_v7"
OUTPUTS_DIR = PACKAGE_DIR / "outputs"
SERIALIZED_DIR = PACKAGE_DIR / "serialized_models"

RANDOM_STATE = 42
# Label: completion within this horizon after observation time T (trained model target)
SUCCESS_HORIZON_DAYS = 60
# Optional alternate horizons for future retraining experiments only — current serialized model uses SUCCESS_HORIZON_DAYS.
# TODO: retrain separate pipelines if deploying 90d/120d labels; do not change TARGET_COL without retraining.
SUCCESS_HORIZON_DAYS_ALTERNATIVES: tuple[int, ...] = (90, 120)
# New snapshot every N days along each resident timeline
SNAPSHOT_INTERVAL_DAYS = 30
# Minimum days after enrollment before first snapshot
MIN_DAYS_AFTER_ENROLL = 7
# Feature lookback from T (events with date in (T - lookback, T))
FEATURE_LOOKBACK_DAYS = 365

TARGET_COL = "reintegration_success_next_60_days"
COMPLETED_STATUS = "Completed"

# Train = earliest observation dates; test = latest (time-based)
TRAIN_FRACTION = 0.75

# Product readiness bands (P(success in next 60 days)); inclusive lower bound
READINESS_BANDS: list[tuple[float, float, str]] = [
    (0.0, 0.20, "High Risk / Needs Intensive Support"),
    (0.20, 0.50, "Needs Support"),
    (0.50, 0.75, "Progressing"),
    (0.75, 1.0001, "Ready for Review"),
]

# Default probability threshold for reporting (rare events: tuned threshold is in metadata)
DEFAULT_PROBA_THRESHOLD = 0.5
