# ML pipelines (`ml-pipelines/`)

This folder holds **all** Python ML work for WinterIntex: packaged pipelines (`ml_pipeline_*`), standalone studies (`donor_retention/`, `resident_case_progress/`), Silas exploratory pipelines (`pipeline_*`), and **`ml_backend_export/`** for copying artifacts into `backend/Intex.API/App_Data/ml/`.

- **Python path:** set `PYTHONPATH` to this directory (or `cd ml-pipelines` and `PYTHONPATH=.`) so imports like `ml_pipeline_social_media_engagement` resolve. Package names keep the `ml_pipeline_` prefix; only the **folder** name uses `ml-pipelines`.
- **Jupyter notebooks:** the first setup cell in each training notebook walks up from the current working directory until it finds both `ml-pipelines/` and `data/lighthouse_csv_v7/` (repo root), then sets `DATA_DIR` / `sys.path` — no editing of absolute paths is required if you open the notebook from anywhere under the repo.
- **FastAPI live social:** `uvicorn ml_service.main:app` loads `ml_pipeline_social_media_engagement` via `sys.path` → `ml-pipelines/`.
- **Refresh .NET artifacts:** from repo root, `python3 refresh_ml_artifacts.py` (canonical; fails if required outputs are missing). Nightly GitHub Actions and validation details: [`docs/ML_NIGHTLY_REFRESH.md`](../docs/ML_NIGHTLY_REFRESH.md).

See each subfolder’s notebook for the full CRISP-DM / IS 455 narrative (problem → deployment).
