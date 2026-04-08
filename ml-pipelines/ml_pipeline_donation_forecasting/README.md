# Donation forecasting & allocation preferences

**Business goals**

1. **Forecast** the **next monetary gift (PHP)** for donors with repeat giving history.  
2. **Predict allocation mix** across **program areas** and **safehouses** for that next gift.  
3. Combine: `predicted_amount × predicted_share` for planning views (Adam dashboard / segmentation).

**Predictive vs explanatory**

- **Explanatory:** **Ridge** regression on **log1p(amount)** (handles correlated features) — coefficients are **associations** on scaled/one-hot features, **not causal**.  
- **Predictive:** **Ridge**, **time-series–tuned random forest** (`RandomizedSearchCV` + `TimeSeriesSplit` on the train slice), and **gradient boosting** (trained on **log** scale, holdout metrics in **PHP**).  
- **Allocation:** **Multi-output random forest** on **program-area shares only** by default (fewer dimensions on small *n*); shares renormalized to sum to 1.

## Target definition

- Rows are built only for supporters with **≥ 2 Monetary** donations with positive `amount`.  
- For the *k*-th gift (*k* ≥ 1), **features** use **only** gifts before that date; **targets** are the *k*-th gift’s **amount** and its **allocation shares** (from `donation_allocations`, shares normalized within each donation).  
- **Time-based split:** rows sorted by `target_donation_date`; first **75%** train, last **25%** test (no random shuffle — reduces future leakage).

## Data used

- `donations.csv`, `donation_allocations.csv`, `supporters.csv`  
- **Campaigns** are not a separate table; `campaign_name` on donations is used.  
- **No future rows** for the target donation enter feature aggregates.

## How to run

From `WinterIntex4-5/ml-pipelines`:

```bash
python3 -m pip install -r requirements.txt
python3 -m ml_pipeline_donation_forecasting.run_all
python3 -m ml_pipeline_donation_forecasting.inference_example
```

Open `donation_forecasting.ipynb` (cwd: `ml-pipelines/` or repo root).

## Artifacts

| Output | Location |
|--------|----------|
| Amount model | `serialized_models/donation_amount_pipeline.joblib` |
| Allocation model | `serialized_models/donation_allocation_pipeline.joblib` |
| Metadata + metrics | `serialized_models/donation_forecasting_metadata.json` |
| Sample API I/O | `sample_payload_input.json`, `sample_prediction_output.json` |
| Ridge coefficients | `outputs/explanatory_ridge_coefficients_log_amount.csv` |

## Web app (React / Adam)

- **Donor list:** show `predicted_next_donation_php` and tier (high/medium/low by percentile on historical errors or by fixed thresholds).  
- **Funding view:** use `combined_predicted_funding_test_rows` from metadata — **program-area** predicted shares × amount (safehouse view omitted when training program-only).  
- **Transparency:** show top Ridge coefficients / importances with “association, not proven impact” copy.

## Implementation summary (after running on repo data)

1. **Targets:** `y_amount` = next gift PHP; `y_alloc_*` program shares (optional `y_sh_*` if `ALLOCATION_PREDICT_PROGRAM_ONLY` is off in `config.py`).  
2. **Key features:** compact prior-amount stats (drops redundant min/sum/max vs mean/last/roll3/trend), recency, recurring flag, channel/campaign diversity, **mean past program allocation shares**, supporter region/type/channel, calendar month/quarter of target gift.  
3. **Best amount model (example run):** **Tuned random forest** vs Ridge/GB on holdout RMSE; metadata includes `random_forest_time_series_cv` (CV RMSE on log scale). **R² can stay negative** on small, noisy holdouts — treat as **prototype**.  
4. **Explanatory:** read `outputs/explanatory_ridge_coefficients_log_amount.csv` for direction of association on log scale.  
5. **Funding:** `donation_forecasting_metadata.json` includes `combined_predicted_funding_test_rows` aggregating test predictions.  
6. **Limitations:** few repeat donors (~177 rows), **heavy skew** in gifts, **non-stationarity** over time, allocation rows don’t always sum to donation amount in raw data (we normalize shares **within** allocations per donation).

## Ethics

Forecasts must not replace relationship-based fundraising; protect PII (`email`, `phone`, names excluded from modeling frame by default in `feature_engineering` / supporter column selection).
