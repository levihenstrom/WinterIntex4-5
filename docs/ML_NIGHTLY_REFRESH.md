# ML artifact refresh (local + nightly CI)

## Canonical command

From the **repository root** (same level as `ml-pipelines/` and `refresh_ml_artifacts.py`):

```bash
python3 refresh_ml_artifacts.py
```

This is the **only** supported refresh entrypoint at the repo root. It runs:

1. **Reintegration** — scores residents and writes JSON under `backend/Intex.API/App_Data/ml/reintegration/`
2. **Donors** — builds churn / outreach JSON under `backend/Intex.API/App_Data/ml/donors/`
3. **Social** — copies packaged social recommender assets under `backend/Intex.API/App_Data/ml/social/`

Implementation: `refresh_ml_artifacts.py` prepends `ml-pipelines` to `PYTHONPATH` and calls `ml_backend_export.run_all_backend_exports.main()`.

### Duplicate script

`refresh_ml_artifacts 2.py` was a byte-for-byte duplicate of `refresh_ml_artifacts.py` and **has been removed** to avoid confusion.

### Exit codes

- **0** — export finished and all **required** files for the selected run mode exist and are non-empty.
- **1** — required outputs are missing or empty after export.
- **2** — bad CLI flags (e.g. more than one `--*-only`).

Partial runs (`--donors-only`, `--social-only`, `--reintegration-only`, `--skip-reintegration`) validate only the sections that were executed.

### Dependencies

Install from the pipeline bundle (covers pandas, numpy, scikit-learn, joblib, etc.):

```bash
python -m pip install -r ml-pipelines/requirements.txt
```

The same file includes **`skl2onnx`**, **`onnx`**, and **`onnxruntime`** so the social refresh step can emit **`.onnx`** files alongside `.joblib` under `App_Data/ml/social/`. Live FastAPI inference still uses **joblib**; ONNX is for a future .NET path.

Optional **full-graph** social ONNX (retrains; writes `*_pipeline_full.onnx` + `social_net_preprocessing_spec.json`) is off by default. Enable with **`INTEX_SOCIAL_FULL_PIPELINE_ONNX=1`** when running `refresh_ml_artifacts.py` or `run_all_backend_exports` (expect a slower social step).

The refresh flow does **not** require `ml_service` packages unless you are running the FastAPI inference app separately.

## Nightly GitHub Actions

Workflow file: **[`.github/workflows/nightly-ml-refresh.yml`](../.github/workflows/nightly-ml-refresh.yml)**

- **Schedule:** `cron: "15 6 * * *"` (06:15 UTC daily).
- **Manual run:** GitHub → **Actions** → **Nightly ML artifact refresh** → **Run workflow**.

Steps: checkout → Python 3.12 → `pip install -r ml-pipelines/requirements.txt` → `python3 refresh_ml_artifacts.py` → verify three core files exist → **commit and push** only `backend/Intex.API/App_Data/ml/` when there are diffs (author: `github-actions[bot]`, message includes `[skip ci]`).

### Validated artifacts

The Python export enforces a full checklist of JSON (and related packaged files) for the sections that ran. The workflow additionally checks these exist and are non-empty:

| Area | Path |
|------|------|
| Reintegration | `backend/Intex.API/App_Data/ml/reintegration/current_resident_scores.json` |
| Donors | `backend/Intex.API/App_Data/ml/donors/current_donor_scores.json` |
| Social | `backend/Intex.API/App_Data/ml/social/social_recommender_manifest.json` |

### Caveats

- **Trained reintegration pipeline:** `score_all_current_residents` needs `ml-pipelines/ml_pipeline_reintegration_readiness_scorer/serialized_models/reintegration_readiness_pipeline.joblib` (and related metadata). If that file is missing in the checkout, the refresh step fails before validation.
- **Social `.joblib` files:** Copied from `ml_pipeline_social_media_engagement/serialized_models/` when present; the manifest records `missing_source_artifacts` when upstream files are absent.
- **Branch protection / required reviews:** Pushes from `GITHUB_TOKEN` may be blocked on protected branches; adjust rules or use a PAT with appropriate permissions if needed.
- **Forks:** Scheduled workflows run on the default branch of the repo; `workflow_dispatch` from a fork typically cannot push back to upstream.

## Output locations

All refreshed bundles are written under:

`backend/Intex.API/App_Data/ml/{reintegration,donors,social}/`

See also `backend/Intex.API/App_Data/README.md`.
