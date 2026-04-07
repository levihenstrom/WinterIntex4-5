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
| Conversion binary | `referrals_positive` (any referral) | Logistic | Logistic, RF, GB classifier |
| High referrals | `referrals_high` (≥ median referrals) | — | Classifiers |
| Donation value | `log1p(estimated_donation_value_php)` | Ridge | Same regressors |

**Split:** 80% train / 20% test, `random_state=42` (stratified for classifiers).

## How to run

From `WinterIntex4-5/ml_pipeline`:

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

## Web app integration (ideas)

- **Planning dashboard:** show predicted **engagement_rate**, **P(any referral)**, and optional **expected referrals** / **donation value** for a draft post (platform, type, hour, topic, CTA, boost fields).
- **Timing:** surface **median engagement by hour bucket / platform** from EDA and model-derived associations.
- **Content strategy:** tables of **strongest platforms / post types / topics** from grouped summaries + coefficient direction (with uncertainty / small-*n* caveat).

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
