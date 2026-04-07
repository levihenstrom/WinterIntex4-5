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
