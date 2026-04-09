# ML Pipeline — Social Media Engagement Analyzer

**Business question:** Which **content types**, **posting times**, **platforms**, and **post characteristics** are **associated with** stronger **donor engagement** and **donation conversion** signals on social posts?

**Important:** This pipeline is **explanatory-first** (Ridge / logistic associations) plus **predictive** holdout models (Ridge, random forest, gradient boosting). Language should stay **non-causal** (“associated with,” “predictive of in this sample”).

## Data source (verified schema)

- **File:** `WinterIntex4-5/data/lighthouse_csv_v7/social_media_posts.csv`
- **Grain:** one row per post (~812 rows in the bundled extract).
- **Actual columns** include: `platform`, `created_at`, `day_of_week`, `post_hour`, `post_type`, `media_type`, `caption`, `hashtags`, `num_hashtags`, `mentions_count`, `has_call_to_action`, `call_to_action_type`, `content_topic`, `sentiment_tone`, `caption_length`, `features_resident_story`, `campaign_name`, `is_boosted`, `boost_budget_php`, `follower_count_at_post`, `engagement_rate`, `click_throughs`, `profile_visits`, `donation_referrals`, `estimated_donation_value_php`, plus downstream metrics (`impressions`, `likes`, …) and sparse YouTube fields.

## Leakage prevention (main models)

**Predictors** are limited to information plausibly known **at or before posting** (plus follower count at post time). **Excluded from X** when modeling `engagement_rate` / referrals / donation value:

`impressions`, `reach`, `likes`, `comments`, `shares`, `saves`, `click_throughs`, `profile_visits`, `video_views`, `watch_time_seconds`, `avg_view_duration_seconds`, `subscriber_count_at_post`, `forwards`.

**Optional:** In the notebook you can build a **separate, clearly labeled** “post-performance” analysis that uses likes/clicks *only* as a secondary lens—not for the main strategy model.

**Sparse raw fields:** `campaign_name` is ~71% missing; we use **`campaign_present`** instead. `boost_budget_php` is mostly missing when not boosted—we **zero-fill** for non-boosted posts and add **`boost_budget_missing`**.

## Engineered features

- `month`, `is_weekend`, `time_of_day_bucket`, `caption_length_bucket`, `hashtag_density`, `campaign_present`, `boosted_with_budget`, `log_follower_count`, `platform_post_type` (platform × post_type string), CTA type with `__none__` for missing.

## Modeling tasks

| Task | Target | Explanatory | Predictive (holdout) |
|------|--------|-------------|----------------------|
| Engagement | `engagement_rate` | Ridge → CSV | Ridge, RF, GB regressor |
| Conversion count | `donation_referrals` | Ridge | Ridge, RF, GB regressor |
| Conversion binary | `referrals_positive` (`donation_referrals >= 5`) | Logistic | Logistic, RF, GB classifier |
| High referrals | `referrals_high` (≥ median referrals) | — | Classifiers |
| Donation value | `log1p(estimated_donation_value_php)` | Ridge | Same regressors |
| Referrals count (predictive) | `log1p(donation_referrals)` | Ridge | Ridge, RF, GB regressor (inverted with `expm1`) |

**Split:** 80% train / 20% test, `random_state=42` (stratified for classifiers).

## How to run

From `WinterIntex4-5/ml-pipelines`:

```bash
python3 -m pip install -r requirements.txt
python3 -m ml_pipeline_social_media_engagement.run_all
python3 -m ml_pipeline_social_media_engagement.inference_example
```

Open **`social_media_engagement.ipynb`** (set working directory to `ml_pipeline` or repo root per the first code cell).

## Artifacts

| Output | Location |
|--------|----------|
| Charts | `outputs/` (`missingness_top20.png`, `median_engagement_by_platform.png`, …) |
| Explanatory coefficients | `outputs/explanatory_ridge_*.csv`, `explanatory_logistic_any_referral.csv` |
| Serialized pipelines | `serialized_models/*.joblib` |
| Metrics + feature lists | `serialized_models/social_media_engagement_metadata.json` |
| Sample API I/O | `sample_payload_input.json`, `sample_prediction_output.json` |
| Post planner recommendations | `outputs/sample_recommendations_*.csv/.json` |
| **Backend / service bundle** | `backend/Intex.API/App_Data/ml/social/` — after `run_all`, refresh from repo root: `python3 refresh_ml_artifacts.py --social-only`, or from `ml_pipeline`: `PYTHONPATH=. python3 -m ml_backend_export.run_all_backend_exports --social-only`. See `ml_backend_export/README.md`. |

### ONNX (parallel export; joblib remains primary)

- **Active runtime today:** FastAPI + `recommend_posts` still load **`.joblib`** full sklearn Pipelines (preprocessing + model). **`.onnx` files are optional** artifacts for a future in-process **.NET ONNX Runtime** path.
- **Estimator-only ONNX (default refresh):** `PYTHONPATH=. python3 -m ml_pipeline_social_media_engagement.export_onnx` writes `*_pipeline.onnx` plus `social_onnx_export_metadata.json` (default: `serialized_models/`). The normal social refresh runs the same export into `App_Data/ml/social/` after copying joblibs. Each graph is the **final estimator** with one **float32** tensor `X` shaped `[batch, 102]` = output of the **production** joblib `prep.transform(...)`.
- **Full-graph ONNX (optional, retrains):** `PYTHONPATH=. python3 -m ml_pipeline_social_media_engagement.full_pipeline_onnx_export --output-dir …/social` retrains with `preprocess_onnx` (categorical sentinel `__MISSING__` + **no** `max_categories` on `OneHotEncoder` so skl2onnx accepts the graph) and writes `*_pipeline_full.onnx`, `social_net_preprocessing_spec.json`, and `social_onnx_full_pipeline_metadata.json`. **Not the same weights** as production joblib. To run during `refresh_ml_artifacts.py`, set **`INTEX_SOCIAL_FULL_PIPELINE_ONNX=1`** (slow).
- **ONNX Runtime CPU caveat:** Full-graph models often **fail to load** on stock `onnxruntime` CPU (`Imputer` / ML ops). Conversion is still useful for inspection, custom runtimes, or **.NET** if kernels exist; otherwise implement prep using `social_net_preprocessing_spec.json` and keep using **estimator-only** `.onnx` + 102-d vectors.
- **Referral classifier (estimator-only path):** joblib uses `CalibratedClassifierCV`; estimator ONNX uses fold-0 inner GB (**uncalibrated**). Full-graph ONNX classifier is also **uncalibrated**.
- **Manifest:** `social_recommender_manifest.json` gains `onnx_*` fields; optional `onnx_full_pipeline` when the env flag is used. Joblib consumers unchanged.

## Web app integration (ideas)

- **Planning dashboard:** show predicted **engagement_rate**, **P(any referral)**, and optional **expected referrals** / **donation value** for a draft post (platform, type, hour, topic, CTA, boost fields).
- **Timing:** surface **median engagement by hour bucket / platform** from EDA and model-derived associations.
- **Content strategy:** tables of **strongest platforms / post types / topics** from grouped summaries + coefficient direction (with uncertainty / small-*n* caveat).
- **Post Planner recommendation engine:** call `recommend_next_post(goal, fixed_inputs, top_k)` to suggest next-post configurations based on:
  - `goal="donations"`: prioritizes referral probability + referral count
  - `goal="awareness"`: prioritizes engagement rate
  - `goal="mixed"`: balances both
  - Candidates vary **platform**, **post_type**, **media_type**, **post hour**, **CTA**, **CTA type**, **resident story**, **content topic** (or lock any via `fixed_inputs`, e.g. `media_type="Video"`)

## Why `predicted_p_any_referral` can look very high (and what we did about it)

**Causes (no bug required):**

1. **Uncalibrated classifiers** — Random forests and gradient boosting often output `predict_proba` values pushed toward 0 or 1 even when ranking (AUC) is good. That is a known **calibration** issue, not necessarily leakage.

2. **Target definition matters** — A target like “>0 referrals” can be too easy and inflate confidence. This pipeline now uses a stronger conversion label (`donation_referrals >= 3`) for `predicted_p_any_referral`.

3. **Recommendation grid = favorable synthetic rows** — `recommend_posts.py` explores combinations that include **CTA on**, **resident story on**, **evening** hours, etc. Those settings **co-occur with positives in training** more often, so the model assigns a **high** \(P(\text{referral})\). That is **distribution shift**: you are scoring “idealized” drafts, not a random post from history.

4. **Single random train/test split** — Reported ROC-AUC on one holdout can look strong on ~800 rows; **probabilities** should still be interpreted cautiously.

**Fix without collecting new data (implemented):**

- The exported **`any_referral_classifier_pipeline.joblib`** is wrapped in **`CalibratedClassifierCV`** (Platt **sigmoid** scaling, stratified folds). See `any_referral_probability_calibration` in `social_media_engagement_metadata.json`. This **pulls extreme probabilities toward more realistic levels** while preserving ranking reasonably well.
- Referrals-count ranking now trains on `log1p(donation_referrals)` and inverts with `expm1`; outputs are clipped to `[0, q95]` (see `referrals_count_postprocess` in metadata) to avoid unstable outlier-driven suggestions.
- Recommendation/display probability now uses a conservative upper guardrail (`P_ANY_REFERRAL_DISPLAY_MAX`, default `0.95`) to prevent synthetic-grid scenarios from surfacing implausible 99% confidence values.

**Optional toggles:** set `CALIBRATE_ANY_REFERRAL_CLASSIFIER = False` in `config.py` to compare raw vs calibrated behavior.

**Still worth doing later (needs process, not only rows):** time-based validation, reporting **Brier score** / reliability curves, and constraining the recommender to **observed** (platform, type, media) tuples from history.

## Ethics

Forecasts and associations **do not** prove that changing copy or timing **causes** more donations. Brand, external events, and algorithm changes confound results. Keep **human oversight** for all public messaging.

## Module map

- `config.py` — paths, split, Ridge grid  
- `data_prep.py` — load CSV, profile helper  
- `feature_engineering.py` — leakage-safe `build_modeling_frame`  
- `preprocess.py` — `ColumnTransformer`  
- `train_explanatory.py` — Ridge + logistic coefficients → CSV  
- `train_predictive.py` — holdout comparisons  
- `evaluate.py` — RMSE / MAE / R² and classification metrics  
- `export_artifacts.py` — train all, save joblibs + JSON + charts  
- `inference_example.py` — score sample payload  
- `recommend_posts.py` — candidate generation + ranking for post planning  
- `run_all.py` — CLI entry  

---

### Latest run summary (example on bundled CSV)

After `run_all`, see `social_media_engagement_metadata.json` for exact metrics. One run on **812** posts showed:

- **Engagement (gradient boosting):** holdout **R² ≈ 0.76**, **RMSE ≈ 0.025** on `engagement_rate`.  
- **Referral count (Ridge):** **R² ≈ 0.31**, **RMSE ≈ 27** referrals (counts are noisy).  
- **Any referral (gradient boosting):** holdout **ROC-AUC ≈ 0.91**, **F1 ≈ 0.87** (validate on fresh data—random split can be optimistic).  
- **Donation value (Ridge on log1p):** **R² ≈ 0.60** on log scale.

**Strategic insights** (read coefficients + grouped plots; not causal):

- Compare **platform** and **post_type** partial patterns in `outputs/explanatory_ridge_engagement_rate.csv`.  
- **Resident stories** (`features_resident_story`) and **CTA** fields appear in both engagement and referral models—direction from Ridge/logistic tables.  
- **Boost / budget** fields: check `boosted_with_budget` and `boost_budget_php` associations; sparse spend data limits strong conclusions.

**Limitations:** Single org, historical window, **platform algorithms** change; **estimated_donation_value_php** may be modeled / noisy; small cells for rare categories; random train/test (not strict time-based—optional improvement).
