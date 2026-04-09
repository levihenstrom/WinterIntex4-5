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
import os
from pathlib import Path
from typing import Any

from ml_pipeline_social_media_engagement import config as sm_config
from ml_pipeline_social_media_engagement.export_onnx import (
    ONNX_FILENAMES,
    SIDECAR_NAME,
    export_social_pipelines_to_onnx,
)
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

    onnx_export_info: dict[str, Any] = {"attempted": False}
    try:
        onnx_summary = export_social_pipelines_to_onnx(joblib_dir=dst, onnx_dir=dst)
        onnx_export_info = {
            "attempted": True,
            "ok": True,
            "sidecar": SIDECAR_NAME,
            "n_transformed_features": onnx_summary.get("n_transformed_features"),
        }
        manifest["onnx_models"] = {
            k: ONNX_FILENAMES[k]
            for k, mv in onnx_summary.get("models", {}).items()
            if isinstance(mv, dict) and mv.get("onnx_bytes")
        }
        manifest["preferred_runtime"] = "joblib"
        manifest["onnx_sidecar_path"] = SIDECAR_NAME
        manifest["onnx_export_schema_version"] = onnx_summary.get("onnx_export_schema_version", 1)
        manifest["onnx_input_layout"] = onnx_summary.get("onnx_input_layout", {})
        manifest["onnx_estimator_only_note"] = (onnx_summary.get("full_pipeline_onnx_blocker") or "")[:400]
        manifest["onnx_classifier_note"] = (onnx_summary.get("classifier_calibration_note") or "")[:400]
    except Exception as exc:  # noqa: BLE001 — missing deps, partial joblibs, or conversion failure
        onnx_export_info = {
            "attempted": True,
            "ok": False,
            "error": str(exc),
        }

    full_onnx_info: dict[str, Any] = {"attempted": False}
    env_full = os.environ.get("INTEX_SOCIAL_FULL_PIPELINE_ONNX", "").strip().lower()
    if env_full in ("1", "true", "yes"):
        try:
            from ml_pipeline_social_media_engagement.full_pipeline_onnx_export import (
                FULL_ONNX_FILENAMES,
                META_FULL,
                export_full_pipeline_onnx_artifacts,
            )

            full_summary = export_full_pipeline_onnx_artifacts(dst)
            full_onnx_info = {
                "attempted": True,
                "ok": True,
                "metadata_path": META_FULL,
            }
            ort_ok = [
                v.get("onnxruntime_cpu_session")
                for v in full_summary.get("models", {}).values()
                if isinstance(v, dict) and "onnx_bytes" in v
            ]
            manifest["onnx_full_pipeline"] = {
                "enabled": True,
                "skl2onnx_full_graph_exported": bool(full_summary.get("skl2onnx_full_pipeline_conversion")),
                "onnx_models_full": {
                    k: FULL_ONNX_FILENAMES[k]
                    for k, mv in full_summary.get("models", {}).items()
                    if isinstance(mv, dict) and mv.get("onnx_bytes")
                },
                "metadata_path": META_FULL,
                "net_preprocessing_spec_path": "social_net_preprocessing_spec.json",
                "onnxruntime_cpu_all_sessions_ok": bool(ort_ok) and all(ort_ok),
                "production_joblib_differences": full_summary.get("production_joblib_differences", []),
            }
        except Exception as exc:  # noqa: BLE001
            full_onnx_info = {"attempted": True, "ok": False, "error": str(exc)}
            manifest["onnx_full_pipeline"] = {
                "enabled": True,
                "ok": False,
                "error": str(exc),
            }

    man_path = dst / "social_recommender_manifest.json"
    write_json_atomic(man_path, manifest)

    return {
        "backend_dir": dst,
        "manifest_path": man_path,
        "copied": copied,
        "missing": missing,
        "onnx_export": onnx_export_info,
        "full_pipeline_onnx": full_onnx_info,
    }
