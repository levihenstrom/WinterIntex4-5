# App_Data (bundled with publish)

## `ml/`

Files under **`App_Data/ml/**`** are **copied on build and publish** (see `Intex.API.csproj`). They are produced by the Python export pipeline (`refresh_ml_artifacts.py` / `ml_backend_export`).

| Subfolder | Role |
|-----------|------|
| `ml/reintegration/` | Resident readiness JSON for dashboards / queues |
| `ml/donors/` | Donor churn / outreach JSON |
| `ml/social/` | Serialized social recommender pipelines + manifest (and/or pointers for a separate inference service) |

**Runtime layout:** after publish, paths are under the app’s content root, e.g.  
`{ContentRoot}/App_Data/ml/...`  
(same structure as in source). Controllers added later should resolve files from `IWebHostEnvironment.ContentRootPath` + `Path.Combine("App_Data", "ml", ...)`.

Refresh artifacts before release builds so published output stays current.
