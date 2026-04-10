"""
Regenerate all backend-local ML artifacts for Intex.API (``App_Data/ml``).

**From repository root (WinterIntex4-5):**

.. code-block:: bash

    python3 refresh_ml_artifacts.py

**From ``ml-pipelines``:**

.. code-block:: bash

    PYTHONPATH=. python3 -m ml_backend_export.run_all_backend_exports

**From repository root without the helper script:**

.. code-block:: bash

    PYTHONPATH=ml-pipelines python3 -m ml_backend_export.run_all_backend_exports

Optional env: ``INTEX_REPO_ROOT`` — absolute path to repo root if the checkout is not
next to ``ml-pipelines`` as usual.

Exit status: **0** on success; **1** if required output files are missing or empty after the run
(for the sections that were executed); **2** for CLI usage errors.

Options::

    --skip-reintegration   Do not run resident scoring (only donors + social)
    --donors-only
    --social-only
    --reintegration-only
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

# Ensure sibling packages (e.g. ``ml_pipeline_social_media_engagement``) resolve whenever this module loads.
_ML_PIPELINES_ROOT = Path(__file__).resolve().parent.parent
if str(_ML_PIPELINES_ROOT) not in sys.path:
    sys.path.insert(0, str(_ML_PIPELINES_ROOT))


def _collect_strings(obj: Any, out: list[str]) -> None:
    if isinstance(obj, dict):
        for v in obj.values():
            _collect_strings(v, out)
    elif isinstance(obj, list):
        for v in obj:
            _collect_strings(v, out)
    elif isinstance(obj, str):
        out.append(obj)


def _warn_if_user_paths(label: str, obj: Any) -> None:
    strings: list[str] = []
    _collect_strings(obj, strings)
    bad = [
        s
        for s in strings
        if s.startswith("/Users/")
        or s.startswith("/home/")
        or (len(s) > 2 and s[1] == ":" and s[2] in "\\/")
    ]
    if bad:
        print(f"  WARNING [{label}]: found {len(bad)} string(s) resembling absolute user paths — review content.")


# Files the full export is expected to produce (JSON and packaged docs). Social .joblib copies
# are optional until training artifacts exist under ml_pipeline_social_media_engagement/serialized_models/.
REQUIRED_BACKEND_ML_FILES: tuple[tuple[str, str], ...] = (
    ("reintegration", "current_resident_scores.json"),
    ("reintegration", "top_10_priority_residents.json"),
    ("reintegration", "current_resident_scores_dashboard.json"),
    ("donors", "current_donor_scores.json"),
    ("donors", "top_at_risk_donors.json"),
    ("donors", "high_priority_outreach_donors.json"),
    ("donors", "donor_churn_backend_export_metadata.json"),
    ("social", "social_recommender_manifest.json"),
    ("social", "recommendation_goal_weights.json"),
    ("social", "social_media_engagement_metadata.json"),
    ("social", "sample_payload_input.json"),
    ("social", "sample_prediction_output.json"),
)


def required_backend_files_for_run(do_re: bool, do_donors: bool, do_social: bool) -> tuple[tuple[str, str], ...]:
    """Subset of ``REQUIRED_BACKEND_ML_FILES`` matching the export sections that ran."""
    out: list[tuple[str, str]] = []
    for sub, name in REQUIRED_BACKEND_ML_FILES:
        if sub == "reintegration" and not do_re:
            continue
        if sub == "donors" and not do_donors:
            continue
        if sub == "social" and not do_social:
            continue
        out.append((sub, name))
    return tuple(out)


def validate_required_backend_artifacts(
    backend_root: Path,
    required: tuple[tuple[str, str], ...] | None = None,
) -> list[str]:
    """Return missing or empty required paths (e.g. ``reintegration/foo.json``)."""
    specs = required if required is not None else REQUIRED_BACKEND_ML_FILES
    missing: list[str] = []
    for sub, name in specs:
        p = backend_root / sub / name
        if not p.is_file():
            missing.append(f"{sub}/{name}")
        elif p.stat().st_size == 0:
            missing.append(f"{sub}/{name} (empty file)")
    return missing


def _print_validation(backend_root: Path) -> None:
    print("\n=== Backend ML artifact validation ===\n")
    areas: list[tuple[str, list[str]]] = [
        (
            "reintegration",
            [
                "current_resident_scores.json",
                "top_10_priority_residents.json",
                "current_resident_scores_dashboard.json",
            ],
        ),
        (
            "donors",
            [
                "current_donor_scores.json",
                "top_at_risk_donors.json",
                "high_priority_outreach_donors.json",
                "donor_churn_backend_export_metadata.json",
            ],
        ),
        (
            "social",
            [
                "social_recommender_manifest.json",
                "recommendation_goal_weights.json",
                "engagement_rate_pipeline.joblib",
                "any_referral_classifier_pipeline.joblib",
                "donation_referrals_count_pipeline.joblib",
                "donation_value_log1p_pipeline.joblib",
                "social_media_engagement_metadata.json",
                "sample_payload_input.json",
                "sample_prediction_output.json",
                "engagement_rate_pipeline.onnx",
                "any_referral_classifier_pipeline.onnx",
                "donation_referrals_count_pipeline.onnx",
                "donation_value_log1p_pipeline.onnx",
                "social_onnx_export_metadata.json",
                "engagement_rate_pipeline_full.onnx",
                "any_referral_classifier_pipeline_full.onnx",
                "donation_referrals_count_pipeline_full.onnx",
                "donation_value_log1p_pipeline_full.onnx",
                "social_net_preprocessing_spec.json",
                "social_onnx_full_pipeline_metadata.json",
            ],
        ),
    ]
    for sub, names in areas:
        d = backend_root / sub
        print(f"[{sub}] {d}")
        present = sorted(p.name for p in d.glob("*") if p.is_file())
        print(f"  files on disk ({len(present)}): {', '.join(present) if present else '(none)'}")
        for n in names:
            p = d / n
            st = "ok" if p.is_file() else "MISSING"
            print(f"  required {n}: {st}")
        for n in names:
            p = d / n
            if not p.is_file() or not n.endswith(".json"):
                continue
            with open(p, encoding="utf-8") as f:
                data = json.load(f)
            if n == "social_recommender_manifest.json":
                print(f"  manifest keys: {sorted(data.keys())}")
                print(f"  manifest models: {list((data.get('models') or {}).keys())}")
                print(f"  paths_relative_to_manifest_directory: {data.get('paths_relative_to_manifest_directory')}")
                if data.get("source_serialized_dir") or data.get("backend_dir"):
                    print("  WARNING: legacy absolute-path manifest keys present — re-run social export.")
                _warn_if_user_paths("social manifest", data)
                continue
            _warn_if_user_paths(n, data)
            if isinstance(data, list):
                print(f"  {n}: {len(data)} records")
                if data:
                    print(f"    first keys: {list(data[0].keys())}")
            elif isinstance(data, dict):
                print(f"  {n}: dict keys {list(data.keys())[:14]}")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Export ML artifacts for Intex.API App_Data/ml")
    ap.add_argument("--skip-reintegration", action="store_true", help="Skip scoring + reintegration JSON")
    ap.add_argument("--donors-only", action="store_true")
    ap.add_argument("--social-only", action="store_true")
    ap.add_argument("--reintegration-only", action="store_true")
    args = ap.parse_args(argv)

    only = sum(bool(x) for x in (args.donors_only, args.social_only, args.reintegration_only))
    if only > 1:
        print("Use at most one of --donors-only, --social-only, --reintegration-only", file=sys.stderr)
        return 2

    from ml_backend_export.paths import BACKEND_ML_ROOT, REPO_ROOT
    from ml_backend_export.donors_backend import write_donor_backend_json
    from ml_backend_export.social_backend import package_social_backend_artifacts

    print(f"REPO_ROOT: {REPO_ROOT}")
    print(f"BACKEND_ML_ROOT: {BACKEND_ML_ROOT}\n")

    do_re = not args.skip_reintegration and not args.donors_only and not args.social_only
    do_donors = not args.reintegration_only and not args.social_only
    do_social = not args.reintegration_only and not args.donors_only

    if args.donors_only:
        do_re, do_donors, do_social = False, True, False
    elif args.social_only:
        do_re, do_donors, do_social = False, False, True
    elif args.reintegration_only:
        do_re, do_donors, do_social = True, False, False

    if do_re:
        from ml_pipeline_reintegration_readiness_scorer.score_all_current_residents import score_all_current_residents

        full_df, _top, _diag = score_all_current_residents(top_k=10)
        print(f"Reintegration: scored {len(full_df)} residents; backend JSON -> {BACKEND_ML_ROOT / 'reintegration'}")

    if do_donors:
        info = write_donor_backend_json()
        print(f"Donors: counts {info['counts']} -> {info['paths']['current_donor_scores'].parent}")

    if do_social:
        sinfo = package_social_backend_artifacts()
        print(f"Social: copied {len(sinfo['copied'])} files; missing source: {sinfo['missing']}")
        print(f"  manifest: {sinfo['manifest_path']}")
        ox = sinfo.get("onnx_export") or {}
        if ox.get("ok"):
            print(
                f"  onnx: exported estimators → {ox.get('sidecar')} "
                f"(n_transformed={ox.get('n_transformed_features')})",
            )
        elif ox.get("attempted") and not ox.get("ok"):
            print(f"  onnx: export failed — {ox.get('error', 'unknown error')}")
        fx = sinfo.get("full_pipeline_onnx") or {}
        if fx.get("ok"):
            print(f"  onnx full pipeline: wrote {fx.get('metadata_path')} (set INTEX_SOCIAL_FULL_PIPELINE_ONNX=1)")
        elif fx.get("attempted") and not fx.get("ok"):
            print(f"  onnx full pipeline: failed — {fx.get('error', 'unknown error')}")

    _print_validation(BACKEND_ML_ROOT)

    required_now = required_backend_files_for_run(do_re, do_donors, do_social)
    missing = validate_required_backend_artifacts(BACKEND_ML_ROOT, required_now)
    print("\n=== Required artifact check ===\n")
    if missing:
        print("FAILED — missing or empty required files:")
        for m in missing:
            print(f"  - {m}")
        return 1
    print(
        f"OK — all {len(required_now)} required JSON / packaged files for this run are present.\n",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
