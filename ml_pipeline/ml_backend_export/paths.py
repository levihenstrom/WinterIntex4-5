"""
Central paths for ML artifacts consumed by Intex.API under ``App_Data/ml``.

All paths resolve from the **repository root** (parent of ``ml_pipeline/``), unless
``INTEX_REPO_ROOT`` is set (absolute path to the WinterIntex4-5 checkout) for CI or
custom layouts.

Nightly / scheduled jobs should call the export entrypoint with cwd anywhere; resolution
is anchored to these constants, not the process cwd.
"""

from __future__ import annotations

import os
from pathlib import Path


def _repo_root() -> Path:
    env = os.environ.get("INTEX_REPO_ROOT", "").strip()
    if env:
        return Path(env).expanduser().resolve()
    # ml_pipeline/ml_backend_export/paths.py → repo root
    return Path(__file__).resolve().parent.parent.parent


REPO_ROOT: Path = _repo_root()
ML_PIPELINE_ROOT: Path = REPO_ROOT / "ml_pipeline"

# Intex.API content root (stable for .NET + nightly exports)
BACKEND_ML_ROOT: Path = REPO_ROOT / "backend" / "Intex.API" / "App_Data" / "ml"

REINTEGRATION_BACKEND_DIR: Path = BACKEND_ML_ROOT / "reintegration"
DONORS_BACKEND_DIR: Path = BACKEND_ML_ROOT / "donors"
SOCIAL_BACKEND_DIR: Path = BACKEND_ML_ROOT / "social"

# Shared CSV data (donor heuristic, social grid template)
LIGHTHOUSE_DATA_DIR: Path = REPO_ROOT / "data" / "lighthouse_csv_v7"
DEFAULT_SOCIAL_POSTS_CSV: Path = LIGHTHOUSE_DATA_DIR / "social_media_posts.csv"

# Documented in social manifest (posix, relative to REPO_ROOT)
SOCIAL_POSTS_CSV_REPO_RELATIVE: str = "data/lighthouse_csv_v7/social_media_posts.csv"


def ensure_backend_ml_dirs() -> None:
    for d in (REINTEGRATION_BACKEND_DIR, DONORS_BACKEND_DIR, SOCIAL_BACKEND_DIR):
        d.mkdir(parents=True, exist_ok=True)
