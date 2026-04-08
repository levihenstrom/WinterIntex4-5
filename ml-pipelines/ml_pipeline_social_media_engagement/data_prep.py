"""Load and lightly clean social_media_posts from CSV."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from . import config


def load_social_media_posts(csv_path: Path | None = None) -> pd.DataFrame:
    path = csv_path or config.DEFAULT_SOCIAL_CSV
    if not path.is_file():
        raise FileNotFoundError(f"Social media CSV not found: {path}")
    df = pd.read_csv(path)
    if "created_at" in df.columns:
        df["created_at"] = pd.to_datetime(df["created_at"], errors="coerce")
    return df


def profile_raw_frame(df: pd.DataFrame) -> dict:
    """Summary for notebooks / logging."""
    miss = df.isna().mean().sort_values(ascending=False)
    return {
        "n_rows": len(df),
        "n_columns": len(df.columns),
        "columns": list(df.columns),
        "dtypes": {c: str(df[c].dtype) for c in df.columns},
        "missing_fraction_by_column": miss.to_dict(),
    }
