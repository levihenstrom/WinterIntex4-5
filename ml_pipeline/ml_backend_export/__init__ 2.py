"""Phase-1 exports for Intex.API ``App_Data/ml`` (paths + writers)."""

from .paths import (
    BACKEND_ML_ROOT,
    DONORS_BACKEND_DIR,
    REINTEGRATION_BACKEND_DIR,
    SOCIAL_BACKEND_DIR,
    ensure_backend_ml_dirs,
)

__all__ = [
    "BACKEND_ML_ROOT",
    "DONORS_BACKEND_DIR",
    "REINTEGRATION_BACKEND_DIR",
    "SOCIAL_BACKEND_DIR",
    "ensure_backend_ml_dirs",
]
