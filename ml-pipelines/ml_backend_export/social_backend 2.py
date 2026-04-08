"""
Copy social recommender serialized assets into ``App_Data/ml/social/`` and write
``social_recommender_manifest.json`` for a future inference service.

Preprocessing lives **inside** each sklearn ``Pipeline`` joblib (ColumnTransformer + model).
There is no separate preprocessor file.

Manifest omits machine-specific absolute paths; model filenames are relative to the
manifest directory. Training CSV location is given as a path relative to repo root.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ml_pipeline_social_media_engagement import config as sm_config
from ml_pipeline_social_media_engagement.recommend_posts import GOAL_WEIGHTS

from .io_utils import copy_file_atomic, write_json_atomic
from .paths import SOCIAL_BACKEND_DIR, SOCIAL_POSTS_CSV_REPO_RELATIVE, ensure_backend_ml_dirs

_ARTIFACT_NAMES = [
    "engagement_rate_pipeline.joblib",
    "any_referral_classifier_pipeline.joblib",
    "donation_referrals_count_pipeline.joblib",
    "donation_value_log1p_pipeline.joblib",
    "social_media_engagement_metadata.json",
    "sample_payload_input.json",
    "sample_prediction_output.json",
]

# Documented fallbacks aligned with ``recommend_posts._candidate_grid`` (for request validation docs).
_CANDIDATE_FALLBACKS: dict[str, list[Any]] = {
    "platform": ["Instagram", "Facebook", "TikTok", "Twitter", "YouTube", "LinkedIn", "WhatsApp"],
    "post_type": ["ImpactStory", "FundraisingAppeal", "EducationalContent", "Campaign", "ThankYou"],
    "media_type": ["Photo", "Video", "Reel", "Carousel", "Text"],
    "post_hour": [9, 12, 15, 18, 20],
    "has_call_to_action": [0.0, 1.0],
    "call_to_action_type": ["DonateNow", "LearnMore", "SignUp", "ShareStory"],
    "features_resident_story": [0.0, 1.0],
    "content_topic": ["Education", "Reintegration", "AwarenessRaising", "DonorImpact", "Health"],
}


def package_social_backend_artifacts(
    *,
    serialized_dir: Path | None = None,
    backend_dir: Path | None = None,
) -> dict[str, Any]:
    ensure_backend_ml_dirs()
    src = serialized_dir or sm_config.SERIALIZED_DIR
    dst = backend_dir or SOCIAL_BACKEND_DIR
    dst.mkdir(parents=True, exist_ok=True)

    copied: list[str] = []
    missing: list[str] = []
    for name in _ARTIFACT_NAMES:
        sp = src / name
        if sp.is_file():
            copy_file_atomic(sp, dst / name)
            copied.append(name)
        else:
            missing.append(name)

    goal_path = dst / "recommendation_goal_weights.json"
    write_json_atomic(goal_path, GOAL_WEIGHTS)

    meta_path = dst / "social_media_engagement_metadata.json"
    meta: dict[str, Any] = {}
    if meta_path.is_file():
        with open(meta_path, encoding="utf-8") as f:
            meta = json.load(f)

    # Deployment-safe manifest: no absolute local paths; filenames are relative to this folder.
    manifest: dict[str, Any] = {
        "schema_version": 2,
        "package": "ml_pipeline_social_media_engagement",
        "preprocessing_note": (
            "Each .joblib file is a sklearn Pipeline whose first step is ColumnTransformer "
            "(impute/scale/one-hot). Load metadata JSON for numeric_features + categorical_features; "
            "align column order before predict."
        ),
        "paths_relative_to_manifest_directory": True,
        "training_social_posts_csv_repo_relative": SOCIAL_POSTS_CSV_REPO_RELATIVE,
        "models": {
            "engagement_rate": "engagement_rate_pipeline.joblib",
            "p_any_referral": "any_referral_classifier_pipeline.joblib",
            "donation_referrals_count": "donation_referrals_count_pipeline.joblib",
            "donation_value_log1p": "donation_value_log1p_pipeline.joblib",
        },
        "metadata_path": "social_media_engagement_metadata.json",
        "sample_payload_path": "sample_payload_input.json",
        "recommendation_goal_weights_path": "recommendation_goal_weights.json",
        "supported_goals": sorted(GOAL_WEIGHTS.keys()),
        "feature_lists_from_metadata": {
            "numeric_features": meta.get("numeric_features", []),
            "categorical_features": meta.get("categorical_features", []),
        },
        "candidate_dimension_fallbacks_for_validation": _CANDIDATE_FALLBACKS,
        "copied_artifacts": sorted(copied),
        "missing_source_artifacts": sorted(missing),
    }

    man_path = dst / "social_recommender_manifest.json"
    write_json_atomic(man_path, manifest)

    return {
        "backend_dir": dst,
        "manifest_path": man_path,
        "copied": copied,
        "missing": missing,
    }
