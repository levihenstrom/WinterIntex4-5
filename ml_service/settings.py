"""Environment-backed paths and optional service-to-service auth (defaults match repo layout)."""

from __future__ import annotations

import os
from pathlib import Path


def _repo_root() -> Path:
    # ml_service/ -> WinterIntex4-5/ (or /app in the container layout)
    return Path(__file__).resolve().parent.parent


REPO_ROOT = _repo_root()

DEFAULT_SOCIAL_ARTIFACT_DIR = REPO_ROOT / "backend" / "Intex.API" / "App_Data" / "ml" / "social"
DEFAULT_SOCIAL_POSTS_CSV = REPO_ROOT / "data" / "lighthouse_csv_v7" / "social_media_posts.csv"

# Uvicorn / Azure read this; documented for Docker CMD. Not read here.
DEFAULT_PORT = 8000


def social_artifact_dir() -> Path:
    """Bundled social ML artifacts (joblib + manifest). Override with ``SOCIAL_ARTIFACT_DIR``."""
    raw = os.environ.get("SOCIAL_ARTIFACT_DIR", "").strip()
    if raw:
        return Path(raw).expanduser().resolve()
    return DEFAULT_SOCIAL_ARTIFACT_DIR.resolve()


def social_posts_csv() -> Path:
    """Training CSV for candidate grids. Override with ``SOCIAL_POSTS_CSV``."""
    raw = os.environ.get("SOCIAL_POSTS_CSV", "").strip()
    if raw:
        return Path(raw).expanduser().resolve()
    return DEFAULT_SOCIAL_POSTS_CSV.resolve()


def ml_service_api_key() -> str | None:
    """
    When set, ``POST /social/recommend`` requires this value in the configured header.
    Empty / unset = no key check (local dev default).
    """
    v = os.environ.get("ML_SERVICE_API_KEY", "").strip()
    return v if v else None


def ml_service_api_key_header_name() -> str:
    """Header name for :func:`ml_service_api_key`. Default ``X-ML-Service-Key``."""
    h = os.environ.get("ML_SERVICE_API_KEY_HEADER", "X-ML-Service-Key").strip()
    return h if h else "X-ML-Service-Key"
