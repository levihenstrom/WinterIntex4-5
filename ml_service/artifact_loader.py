"""Validate manifest + required files under the standardized social artifact directory."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


REQUIRED_FILES = [
    "social_recommender_manifest.json",
    "recommendation_goal_weights.json",
    "social_media_engagement_metadata.json",
    "engagement_rate_pipeline.joblib",
    "any_referral_classifier_pipeline.joblib",
    "donation_referrals_count_pipeline.joblib",
    "donation_value_log1p_pipeline.joblib",
    "sample_payload_input.json",
]


class ArtifactError(Exception):
    """Missing or invalid artifact layout."""


def load_json(path: Path) -> dict[str, Any]:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def validate_and_load(artifact_dir: Path) -> tuple[dict[str, Any], dict[str, dict[str, float]]]:
    artifact_dir = Path(artifact_dir).resolve()
    if not artifact_dir.is_dir():
        raise ArtifactError(f"SOCIAL_ARTIFACT_DIR is not a directory: {artifact_dir}")

    missing = [name for name in REQUIRED_FILES if not (artifact_dir / name).is_file()]
    if missing:
        raise ArtifactError(f"Missing required files under {artifact_dir}: {missing}")

    manifest = load_json(artifact_dir / "social_recommender_manifest.json")
    weights = load_json(artifact_dir / "recommendation_goal_weights.json")

    for key, fname in (manifest.get("models") or {}).items():
        if isinstance(fname, str) and not Path(fname).is_absolute():
            p = artifact_dir / fname
            if not p.is_file():
                raise ArtifactError(f"Model file for {key} not found: {p}")

    if not isinstance(weights, dict) or not weights:
        raise ArtifactError("recommendation_goal_weights.json must be a non-empty object")

    for goal, w in weights.items():
        if not isinstance(w, dict):
            raise ArtifactError(f"Invalid weight entry for goal {goal!r}")
        for k in ("engagement", "p_any_referral", "referrals_count"):
            if k not in w:
                raise ArtifactError(f"Goal {goal!r} missing weight key {k!r}")

    return manifest, weights  # type: ignore[return-value]
