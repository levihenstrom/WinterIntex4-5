"""Environment-backed paths (defaults match repo layout)."""

from __future__ import annotations

import os
from pathlib import Path


def _repo_root() -> Path:
    # ml_service/ -> WinterIntex4-5/
    return Path(__file__).resolve().parent.parent


REPO_ROOT = _repo_root()

DEFAULT_SOCIAL_ARTIFACT_DIR = REPO_ROOT / "backend" / "Intex.API" / "App_Data" / "ml" / "social"
DEFAULT_SOCIAL_POSTS_CSV = REPO_ROOT / "data" / "lighthouse_csv_v7" / "social_media_posts.csv"


def social_artifact_dir() -> Path:
    return Path(os.environ.get("SOCIAL_ARTIFACT_DIR", DEFAULT_SOCIAL_ARTIFACT_DIR)).expanduser().resolve()


def social_posts_csv() -> Path:
    return Path(os.environ.get("SOCIAL_POSTS_CSV", DEFAULT_SOCIAL_POSTS_CSV)).expanduser().resolve()
