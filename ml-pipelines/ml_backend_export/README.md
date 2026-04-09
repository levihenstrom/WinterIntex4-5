# Backend ML exports (Phase 1 + Phase 3)

Standardized **nightly-ready** outputs for **Intex.API** under:

`backend/Intex.API/App_Data/ml/`

(resolved from **repository root** = parent of `ml-pipelines/`; override with env `INTEX_REPO_ROOT` if needed.)

| Subfolder | Producer | Intended consumer |
|-----------|----------|-------------------|
| `reintegration/` | `score_all_current_residents` (via `ml_backend_export.reintegration_backend`) | .NET reads JSON for dashboards / queues |
| `donors/` | `ml_backend_export.donors_backend` | .NET reads JSON for churn / outreach |
| `social/` | `ml_backend_export.social_backend` | Python inference service + manifest (`.joblib` primary); **ONNX** estimators + `social_onnx_export_metadata.json` produced in parallel when `skl2onnx` / `onnxruntime` are installed |

## Path config (single source of truth)

`ml_backend_export/paths.py` defines:

- `REPO_ROOT`, `BACKEND_ML_ROOT`
- `REINTEGRATION_BACKEND_DIR`, `DONORS_BACKEND_DIR`, `SOCIAL_BACKEND_DIR`
- `LIGHTHOUSE_DATA_DIR`, `DEFAULT_SOCIAL_POSTS_CSV`, `SOCIAL_POSTS_CSV_REPO_RELATIVE`

`ml_backend_export/io_utils.py` provides **atomic** JSON writes and file copies (safe repeated runs / nightly refresh).

## Refresh all artifacts (recommended)

**From repository root:**

```bash
python3 refresh_ml_artifacts.py
```

**From `ml-pipelines`:**

```bash
cd ml-pipelines
PYTHONPATH=. python3 -m ml_backend_export.run_all_backend_exports
```

**From repository root (no helper script):**

```bash
PYTHONPATH=ml-pipelines python3 -m ml_backend_export.run_all_backend_exports
```

> `PYTHONPATH=. python3 -m ml_backend_export.run_all_backend_exports` only works if the current directory is `ml-pipelines` (so `ml_backend_export` is importable).

### Partial runs

```bash
python3 refresh_ml_artifacts.py --reintegration-only
python3 refresh_ml_artifacts.py --donors-only
python3 refresh_ml_artifacts.py --social-only
```

Reintegration only (same scoring + backend JSON):

```bash
cd ml-pipelines && PYTHONPATH=. python3 -m ml_pipeline_reintegration_readiness_scorer.score_all_current_residents
```

## Files written (for .NET / services)

**Reintegration**

- `current_resident_scores.json`
- `top_10_priority_residents.json`
- `current_resident_scores_dashboard.json`

**Donors**

- `current_donor_scores.json`, `top_at_risk_donors.json`, `high_priority_outreach_donors.json`
- `donor_churn_backend_export_metadata.json`

**Social** (live inference bundle)

- `social_recommender_manifest.json` — **schema_version 2**, deployment-safe (model filenames relative to manifest dir; training CSV = `training_social_posts_csv_repo_relative`)
- `recommendation_goal_weights.json`
- `*_pipeline.joblib` (4), `social_media_engagement_metadata.json`, `sample_payload_input.json`, `sample_prediction_output.json`

## Stable JSON field names

**Reintegration:** `resident_code`, `as_of_date`, `reintegration_readiness_score`, `readiness_percentile_among_current_residents`, `support_priority_rank`, `operational_band`, `top_positive_factors`, `top_risk_factors`, `raw_score_note`; dashboard adds `top_positive_factors_short`, `top_risk_factors_short`.

**Donors:** `supporter_id`, `display_name`, `churn_risk_score`, `outreach_priority_rank`, `risk_band`, `top_drivers`; outreach queue adds `outreach_note`. Queue-local rank in `high_priority_outreach_donors.json` only.

## Donor scores note

**Eligibility:** Only supporters with at least one `donation_type='Monetary'` row with a non-null `amount` appear in donor churn JSON. Non-donor supporter types (e.g. Volunteer) are excluded unless they have such a gift on file.

Heuristic until `donor_churn_pipeline.joblib` is wired; see `donor_churn_backend_export_metadata.json` (`donor_eligibility_rule`).

**Outreach queue:** primary = at-risk and `monetary_sum` ≥ cohort median; fallbacks documented in metadata.

## Social live inference

Load joblibs from the **same directory** as `social_recommender_manifest.json`. The FastAPI service (`ml_service/`) uses `SOCIAL_ARTIFACT_DIR` pointing at this folder.
