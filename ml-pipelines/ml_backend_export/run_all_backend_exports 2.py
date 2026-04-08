"""
Regenerate all backend-local ML artifacts for Intex.API (``App_Data/ml``).

**From repository root (WinterIntex4-5):**

.. code-block:: bash

    python3 refresh_ml_artifacts.py

**From ``ml_pipeline``:**

.. code-block:: bash

    PYTHONPATH=. python3 -m ml_backend_export.run_all_backend_exports

**From repository root without the helper script:**

.. code-block:: bash

    PYTHONPATH=ml_pipeline python3 -m ml_backend_export.run_all_backend_exports

Optional env: ``INTEX_REPO_ROOT`` — absolute path to repo root if the checkout is not
next to ``ml_pipeline`` as usual.

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

    _print_validation(BACKEND_ML_ROOT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
