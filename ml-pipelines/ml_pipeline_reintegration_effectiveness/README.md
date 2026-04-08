# Reintegration & recovery ML pipeline

**Business question:** Which factors are **most associated** with **successful reintegration** (`reintegration_status = Completed`), and how can staff **prioritize** residents who may need more support?

This is **decision support**, not automated case decisions. Do not remove care or close cases based solely on model output.

## Predictive vs explanatory

| Goal | Approach | Interpretation |
|------|------------|----------------|
| **Explanatory** | Logistic regression on scaled features | Coefficients / odds ratios = **associations** given other included variables — **not causal** (no RCT; confounding possible). |
| **Predictive** | Logistic, decision tree, random forest, histogram gradient boosting; RF tuned when selected | **ROC-AUC**, precision/recall/F1 on holdout — good ranking **does not** prove what caused recovery. |

## Target definition

- **Binary `y = 1`** if `residents.reintegration_status == 'Completed'`.
- **Otherwise `y = 0`** — includes *In Progress*, *On Hold*, *Not Started*, and many **Active** cases still in care (**censored**, not “failure”).
- **Limitation:** The model learns patterns in a cross-sectional extract; it does **not** predict “will complete within the next N months” unless you add time-to-event data.

## Leakage control

- **Observation date** = latest dated activity across counseling, visits, education, health, incidents, interventions.
- **Feature window:** `(obs − gap − lookback, obs − gap]` with defaults **gap = 30 days**, **lookback = 365 days** (`config.py`).
- **Excluded from inputs:** `current_risk_level`, `case_status`, `reintegration_status`, `reintegration_type`, narrative text fields, and any post-outcome-only fields.
- **Intervention plan `status`** is a **snapshot** in the CSV; associations are **descriptive**, not proof that completing a plan *caused* reintegration.

## Repository layout

| File | Role |
|------|------|
| `config.py` | Paths, random seed, window lengths |
| `data_prep.py` | Load CSVs, parse dates, global observation date |
| `feature_engineering.py` | Resident-level features + label |
| `preprocess.py` | Shared `ColumnTransformer` (impute + scale / one-hot) |
| `train_explanatory.py` | Logistic pipeline; writes `outputs/explanatory_logistic_coefficients.csv` |
| `train_predictive.py` | Model comparison + optional RF `GridSearchCV` |
| `evaluate.py` | Metrics, confusion matrix, tree importances |
| `export_artifacts.py` | `joblib` + JSON metadata + sample API payloads |
| `inference_example.py` | Load pipeline and score `sample_payload_input.json` |
| `run_all.py` | One-command train + export |
| `reintegration_effectiveness.ipynb` | Full lifecycle narrative + EDA figures |

**Outputs**

- `outputs/` — CSV coefficients, importances, figures (`fig_*.png`) from the notebook.
- `serialized_models/` — `reintegration_predictive_pipeline.joblib`, `reintegration_model_metadata.json`, `sample_payload_input.json`, `sample_prediction_output.json`.

## How to run

From **`WinterIntex4-5/ml-pipelines`** (same as other pipelines):

```bash
cd WinterIntex4-5/ml-pipelines
python3 -m ml_pipeline_reintegration_effectiveness.run_all
python3 -m ml_pipeline_reintegration_effectiveness.inference_example
```

On macOS, use `python3` if the `python` command is not found.

Or open `reintegration_effectiveness.ipynb` with Jupyter (cwd: `ml-pipelines/` or repo root).

Dependencies: see `../requirements.txt` (pandas, numpy, scikit-learn, matplotlib, seaborn, joblib, jupyter).

## Web app integration (Ch. 17)

- **Eve / caseload:** readiness score + “needs support” flag from `risk_of_regression` (tune threshold for **recall** if missing struggling residents is costly).
- **Resident drawer:** top factors from explanatory coefficients (associational language only).
- **Leadership:** aggregate trends of drivers — use cohort-level coefficient/importance summaries, not individual blame.

## Feature selection (domain + model)

- **Domain:** Dropped endogenous / leaky fields; kept intake + longitudinal service aggregates in the prediction window.
- **Model-based:** `outputs/predictive_feature_importances.csv` after training; consider `SelectFromModel` in a future iteration for pruning.

## Data sources used

`residents`, `process_recordings`, `home_visitations`, `education_records`, `health_wellbeing_records`, `intervention_plans`, `incident_reports`, `safehouses`.

There is **no** separate `case_conferences.csv`; `intervention_plans.case_conference_date` exists but is not required for the current feature set.

## Ethics & privacy

- Use **internal codes** in API examples; avoid exporting narrative notes.
- Log **decisions by staff**, not raw session text, in production audit trails.
