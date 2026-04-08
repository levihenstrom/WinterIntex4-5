# Social ML inference service (Phase 2)

Small **FastAPI** app that serves **live social post recommendations** using the standardized artifacts in:

`WinterIntex4-5/backend/Intex.API/App_Data/ml/social/`

It does **not** retrain models. It loads joblibs and metadata **once** at startup via `SocialRecommenderSession` from `ml_pipeline_social_media_engagement.recommend_posts`.

## Layout

| Path | Role |
|------|------|
| `main.py` | FastAPI app, routes, lifespan |
| `settings.py` | `SOCIAL_ARTIFACT_DIR`, `SOCIAL_POSTS_CSV` (defaults) |
| `artifact_loader.py` | Validates manifest + required files |
| `schemas.py` | Pydantic request/response models |
| `recommender.py` | Input normalization, row → API shape |

## Artifacts used

- `social_recommender_manifest.json` — layout / options documentation
- `recommendation_goal_weights.json` — goal blend weights
- `social_media_engagement_metadata.json` — feature column order
- `engagement_rate_pipeline.joblib`, `any_referral_classifier_pipeline.joblib`, `donation_referrals_count_pipeline.joblib`, `donation_value_log1p_pipeline.joblib`
- `sample_payload_input.json` — default feature template (via pipeline)

**Training CSV** (for candidate grids and medians/modes):  
`WinterIntex4-5/data/lighthouse_csv_v7/social_media_posts.csv`  
Override with `SOCIAL_POSTS_CSV` if needed.

## Configuration

| Variable | Default |
|----------|---------|
| `SOCIAL_ARTIFACT_DIR` | `<repo>/backend/Intex.API/App_Data/ml/social` |
| `SOCIAL_POSTS_CSV` | `<repo>/data/lighthouse_csv_v7/social_media_posts.csv` |

## Install & run

From the **repository root** (`WinterIntex4-5`), so `ml_service` is importable:

```bash
cd /path/to/WinterIntex4-5
python3 -m venv .venv-mlsvc && source .venv-mlsvc/bin/activate
pip install -r ml_service/requirements.txt
pip install -r ml_pipeline/requirements.txt
```

Start the API:

```bash
cd /path/to/WinterIntex4-5
uvicorn ml_service.main:app --reload --port 8001
```

The app prepends `ml_pipeline/` to `sys.path` so `ml_pipeline_social_media_engagement` imports resolve without installing packages.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness + `models_loaded` |
| POST | `/social/recommend` | Ranked recommendations (main) |
| GET | `/social/options` | Goals, weights, candidate fallbacks (booleans as JSON `true`/`false`), feature lists, `artifacts_loaded` — **no filesystem paths** |
| POST | `/social/predict` | Single configuration → predictions (+ optional donation value PHP) |

## Example requests

**Health**

```bash
curl -s http://127.0.0.1:8001/health | python3 -m json.tool
```

**Recommend**

```bash
curl -s -X POST http://127.0.0.1:8001/social/recommend \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "donations",
    "fixed_inputs": {
      "content_topic": "Reintegration",
      "platform": null,
      "post_type": null,
      "media_type": null,
      "has_call_to_action": null,
      "call_to_action_type": null,
      "features_resident_story": null
    },
    "top_k": 3
  }' | python3 -m json.tool
```

(`null` fields can be omitted in JSON.)

**Options**

```bash
curl -s http://127.0.0.1:8001/social/options | python3 -m json.tool
```

**Predict (single row)**

```bash
curl -s -X POST http://127.0.0.1:8001/social/predict \
  -H "Content-Type: application/json" \
  -d '{
    "features": {
      "platform": "Instagram",
      "post_type": "ImpactStory",
      "media_type": "Video",
      "post_hour": 20,
      "content_topic": "Reintegration",
      "has_call_to_action": 1.0,
      "call_to_action_type": "ShareStory",
      "features_resident_story": 1.0
    }
  }' | python3 -m json.tool
```

## What .NET will call later

Typical integration:

- **GET** `/health` before routing traffic  
- **POST** `/social/recommend` with `goal` + optional `fixed_inputs` + `top_k`  
- Optionally **GET** `/social/options` to populate dropdowns / validate inputs  
- Optionally **POST** `/social/predict` for “what-if” on one configuration  

Base URL will be configuration in Intex.API (e.g. `http://localhost:8001` in dev).

## OpenAPI

Interactive docs: `http://127.0.0.1:8001/docs`
