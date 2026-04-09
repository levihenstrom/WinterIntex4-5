"""Paths and defaults for social media engagement analyzer."""

from __future__ import annotations

from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parent
ML_PIPELINE_DIR = PACKAGE_DIR.parent
REPO_ROOT = ML_PIPELINE_DIR.parent

DEFAULT_DATA_DIR = REPO_ROOT / "data" / "lighthouse_csv_v7"
DEFAULT_SOCIAL_CSV = DEFAULT_DATA_DIR / "social_media_posts.csv"
OUTPUTS_DIR = PACKAGE_DIR / "outputs"
SERIALIZED_DIR = PACKAGE_DIR / "serialized_models"

RANDOM_STATE = 42
TEST_SIZE = 0.2
RIDGE_ALPHAS = tuple(10 ** (i / 2 - 1) for i in range(0, 13))

# Gradient boosting / forest predict_proba is often overconfident. Calibrate at export (no extra data).
CALIBRATE_ANY_REFERRAL_CLASSIFIER = True
# "sigmoid" = Platt scaling (stable on ~hundreds of rows). "isotonic" can overfit small samples.
CALIBRATION_METHOD: str = "sigmoid"
CALIBRATION_N_SPLITS = 5

# Stronger success target than "any referral > 0": post is considered conversion-successful
# only when donation_referrals reaches this threshold.
REFERRAL_SUCCESS_MIN_COUNT = 5

# Optional guardrail to avoid overconfident display values from synthetic candidate grids.
P_ANY_REFERRAL_DISPLAY_MAX = 0.95

# Referrals-count postprocessing for business-readable outputs.
REFERRALS_COUNT_OUTPUT_CLIP_QUANTILE = 0.95
