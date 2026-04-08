# Resident Reintegration Readiness Scorer

**Business goal:** Estimate each resident’s **likelihood of successful reintegration** within the next 60 days (defined below) and summarize **factors associated with** recovery trajectories — **not causal** effects.

## Data (verified in repo)

Tables under `WinterIntex4-5/data/lighthouse_csv_v7/`:

| Table | Role |
|-------|------|
| `residents.csv` | Demographics, admission, **initial** risk, case category, `reintegration_status`, `date_closed` |
| `process_recordings.csv` | Session dates, duration, progress/concerns, emotional states |
| `home_visitations.csv` | Visit dates, outcomes, family cooperation |
| `education_records.csv` | Monthly attendance / progress |
| `health_wellbeing_records.csv` | Monthly health scores |
| `incident_reports.csv` | Incident dates, severity |
| `intervention_plans.csv` | Plan status, target dates |

Run profiling in `reintegration_readiness.ipynb` (row counts, missingness, date ranges).

## Leakage prevention (time-aware)

- **Observation time `T`:** synthetic snapshots along each resident’s stay (every 30 days after enrollment, until completion or data cutoff).
- **Features:** only events with **event date \< T** (strict). Rolling lookback: last **365** days before `T` (configurable in `config.py`).
- **Excluded from X:** current `reintegration_status`, `case_status`, `current_risk_level`, narrative fields — only **admission-time** statics + historical aggregates.

## Target

**`reintegration_success_next_60_days`**

- **1** if the resident’s reintegration is **`Completed`** and the **completion date** falls in **(T, T + 60 days]**.
- **0** otherwise.

**Completion date:** `residents.date_closed` when status is `Completed`; if `Completed` but `date_closed` is missing, **`created_at`** is used as a fallback (documented limitation).

## Modeling

- **Train/test split:** **time-ordered** on `observation_date` (earlier snapshots train, later holdout) — **no random shuffle** of rows.
- **Models compared:** logistic regression (class-weighted), random forest, gradient boosting (sample-weighted), and optionally **balanced random forest** if `imbalanced-learn` is installed (`pip install imbalanced-learn`).
- **Model selection:** composite holdout score  
  `0.45×ROC-AUC + 0.40×PR-AUC + 0.10×precision@top10% + 0.05×recall@top10%`  
  so ranking reflects **discrimination and triage value**, not raw accuracy.

## Why precision/recall were 0 at threshold 0.5 (and why that is expected)

With a **~1.5% positive rate** on snapshots, predicted probabilities are **rarely above 0.5** even when the model ranks well. On the **holdout** slice, there may be **very few** positives. Then **precision, recall, and F1 at 0.5** can all be **0** while **ROC-AUC** and **PR-AUC** still show useful ranking.

**Threshold tuning** is **not** done on the holdout. It uses **time-series out-of-fold** predictions on the **training** set only (`TimeSeriesSplit` on `observation_date`), then searches thresholds (e.g. maximize F1 under a **recall ≥ 0.6** constraint on OOF if possible; otherwise maximize F1). The **selected threshold** is stored in `serialized_models/reintegration_readiness_metadata.json` as `selected_threshold`.

**Holdout metrics** are reported **twice** in metadata: at **0.5** and at the **tuned** threshold. ROC-AUC and PR-AUC are **threshold-free** (same for both rows).

## Probability calibration

The pipeline optionally fits **`CalibratedClassifierCV`** (sigmoid / Platt) with **time-series CV** on the training set. It is **saved only if** it improves **Brier score** on the holdout **and** does **not** drop **ROC-AUC** by more than **0.05** vs the uncalibrated model (otherwise calibration is skipped and the uncalibrated pipeline is kept).

- **Brier score** and a **calibration curve** (reliability diagram) are saved under `outputs/`.
- If calibration is skipped, the calibration plot still reflects **uncalibrated** holdout probabilities (diagnostic).

## Readiness score and bands

- **`reintegration_readiness_score`** = estimated **P(success in next 60 days)** from the selected classifier (after optional calibration if kept).
- **Readiness bands** (product-facing; defined in `config.py` as `READINESS_BANDS`):

| Score range | Band |
|-------------|------|
| 0.00 – 0.20 | High Risk / Needs Intensive Support |
| 0.20 – 0.50 | Needs Support |
| 0.50 – 0.75 | Progressing |
| 0.75 – 1.00 | Ready for Review |

- **`decision_threshold`** and **`predicted_positive_at_threshold`** use the **OOF-tuned** threshold for operational triage (e.g. flagging cases for review). The **band** is a **separate** interpretation of the **score** for prioritization.

## How the web app should use this

- Use the **score** for **ranking and prioritization** (queues, workload).
- Use **`readiness_band`** and short **factor bullets** for **conversation prompts**, not as automated eligibility.
- Do **not** treat the score as a **final decision** on reintegration outcomes or case closure.

## Operational use — prioritizing residents

After training (`run_all`), you can score **all active residents** on their **most recent** time-aware snapshot (same feature engineering as training; **no** retraining):

```bash
python3 -m ml_pipeline_reintegration_readiness_scorer.score_all_current_residents
# optional: pass a different top-K (default 10)
python3 -m ml_pipeline_reintegration_readiness_scorer.score_all_current_residents 10
```

**Who is included:** `case_status == Active` and `reintegration_status != Completed` (see `score_all_current_residents._active_resident_ids`). Each resident contributes **one** row: the snapshot with the **latest** `observation_date` before the global data cutoff — **no future data** in features.

### Why absolute scores are often tiny (and everyone looked “High Risk” on the old band)

The model outputs **P(success in the next 60 days)** — a **rare event** on snapshots. Calibrated probabilities for **active** residents often sit **near zero** in absolute terms, so **fixed** probability bands (`READINESS_BANDS` in `config.py`) can label **everyone** in the lowest band even though **relative** differences still matter for triage.

**This does not invalidate the model for operations:** ROC-style **ranking** still separates who is relatively more or less likely to succeed soon. For staff workflows, **prefer**:

- **`support_priority_rank`** — 1 = lowest raw score in the **current active cohort** (highest need for attention).
- **`readiness_percentile_among_current_residents`** — where this resident sits **within today’s active list** (higher = higher raw score than peers).
- **`support_priority_group`** / **`operational_band`** — **quartiles by rank** among current residents (e.g. “Top Priority” → “Needs Immediate Review”), **not** fixed probability cutoffs.

**Raw `reintegration_readiness_score`** is still reported for transparency; interpret it as a **relative near-term readiness signal** in a rare-event setting, **not** a literal “chance” for scheduling guarantees.

### Priority rule (unchanged core)

`support_priority_rank = 1` = **lowest** raw score among scored actives. Ties break on `resident_id`.

**Quartile groups** (by `rank / n`): ≤25% → **Top Priority**; ≤50% → **High Priority**; ≤75% → **Moderate Priority**; else **Lower Priority**. **Operational bands** map to staff-facing labels (e.g. Top Priority → “Needs Immediate Review”). Exact mapping is in `outputs/current_resident_scoring_metadata.json`.

### Alternate prediction horizons (90d / 120d)

The **deployed** serialized model is trained on **`reintegration_success_next_60_days`**. `config.SUCCESS_HORIZON_DAYS_ALTERNATIVES` lists candidate horizons for **future retraining experiments** only — do not change the label column without retraining and a new export.

**Outputs** (under `outputs/`):

| File | Purpose |
|------|---------|
| `current_resident_scoring_metadata.json` | Interpretation notes, quartile rules, **score compression diagnostics** |
| `current_resident_scores.csv` / `.json` | Full scored list: raw score, percentile, groups, operational band, explanations |
| `top_10_priority_residents.csv` / `.json` | Lowest-score residents (default K=10) |
| `current_resident_scores_dashboard.json` | Frontend-friendly: short factors, percentile, operational band |

The **top 10** list is a **starting point** for staff workflow (callbacks, case reviews), not a replacement for judgment. Use **rank, percentile, and operational band** for day-to-day triage; use raw probability bands as **secondary** context when spread is wide enough to be meaningful.

## How to run

From `WinterIntex4-5/ml-pipelines`:

```bash
python3 -m pip install -r requirements.txt
# optional: pip install imbalanced-learn   # enables balanced_random_forest in model comparison
python3 -m ml_pipeline_reintegration_readiness_scorer.run_all
python3 -m ml_pipeline_reintegration_readiness_scorer.inference_example
python3 -m ml_pipeline_reintegration_readiness_scorer.score_all_current_residents
```

## Artifacts

| Output | Location |
|--------|----------|
| Trained pipeline | `serialized_models/reintegration_readiness_pipeline.joblib` |
| Metadata (metrics, threshold, bands, notes) | `serialized_models/reintegration_readiness_metadata.json` |
| Train medians for inference | `serialized_models/train_reference_medians.json` |
| Train std devs (numeric, for explanation scaling) | `serialized_models/train_reference_stds.json` |
| Explanatory logistic coefficients (copy for deployment) | `serialized_models/explanation_logistic_coefficients.csv` |
| Logistic coefficients (training output) | `outputs/explanatory_logistic_coefficients.csv` |
| Final model feature importance (aggregated) | `outputs/final_model_feature_importance.csv` |
| OOF threshold search grid | `outputs/threshold_search_oof.csv` |
| ROC / PR / calibration plots | `outputs/holdout_roc_curve.png`, `holdout_pr_curve.png`, `holdout_calibration_curve.png` |
| Current-resident batch scores & top-K priority | `outputs/current_resident_scores.*`, `outputs/top_*_priority_residents.*`, `current_resident_scores_dashboard.json` (after `score_all_current_residents`) |
| **Backend JSON (stable schema for .NET)** | `backend/Intex.API/App_Data/ml/reintegration/current_resident_scores.json`, `top_10_priority_residents.json`, `current_resident_scores_dashboard.json` (written automatically when scoring runs with `PYTHONPATH` including `ml-pipelines`) |
| Sample API I/O | `sample_readiness_input.json`, `sample_readiness_output.json` |

See `ml_backend_export/README.md` for path constants and field names.

## Local explanations (how direction is computed)

- **Readiness score** comes from the **predictive** model (e.g. random forest).
- **Which factors to mention** is driven by **predictive** feature importance × **absolute explanatory logistic coefficient** × **how far** the resident’s value is from the training median (numeric) or the effect of their category vs reference (categorical).
- **Positive vs risk lists** use **only** the **explanatory logistic** coefficient sign on preprocessed features (same pipeline structure as training):
  - **Numeric:** `coef > 0` ⇒ higher values associate with **stronger** readiness; `coef < 0` ⇒ higher values associate with **weaker** readiness. Compare the resident to the **training median** to decide if the **local** effect helps or hurts (e.g. negative `coef` and **below** median ⇒ stronger readiness).
  - **Categorical (one-hot):** the coefficient is **vs the reference category**; positive ⇒ that level is associated with stronger readiness than the reference, negative ⇒ weaker.

Each feature appears in **at most one** list. Wording avoids vague “review relative to typical patterns” for numeric features. Associations are historical, not causal.

## Inference output shape (JSON)

```json
{
  "reintegration_readiness_score": 0.15,
  "decision_threshold": 0.13,
  "readiness_band": "High Risk / Needs Intensive Support",
  "predicted_positive_at_threshold": false,
  "top_positive_factors": [
    "hv total visits: above typical for similar residents and associated with stronger readiness"
  ],
  "top_risk_factors": [
    "edu progress trend: below typical for similar residents and associated with weaker readiness"
  ],
  "note": "Directions follow the explanatory logistic model … Decision support only."
}
```

Run `python3 -m ml_pipeline_reintegration_readiness_scorer.explanation_validation` to sanity-check the sign rules.

## Ethics

Readiness scores **must not** replace clinical judgment or case management. Use for **prioritization and discussion only**.

## Module map

- `config.py` — horizons, split, paths, readiness bands  
- `data_prep.py` — load & parse dates  
- `feature_engineering.py` — snapshots + aggregates before `T`  
- `preprocess.py` — numeric + one-hot  
- `train_explanatory.py` — logistic coefficients  
- `train_predictive.py` — time split + model comparison  
- `model_finalize.py` — OOF threshold tuning, optional calibration  
- `evaluate.py` — metrics, confusion matrix, Brier, top-k triage  
- `plotting.py` — ROC/PR/calibration plots  
- `inference_explain.py` — bands + local explanations (logistic direction + RF importance)  
- `explanation_validation.py` — sign-rule checks for explanations  
- `export_artifacts.py` — train, save, samples, metadata  
- `inference_example.py` — score sample with full payload  
- `score_all_current_residents.py` — batch score active residents (latest snapshot), priority export  
- `operational_interpretation.py` — cohort percentile, quartile groups, compression diagnostics  
- `run_all.py` — CLI + summary  
