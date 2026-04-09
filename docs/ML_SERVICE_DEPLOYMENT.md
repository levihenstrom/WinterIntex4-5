# Deploying the social ML FastAPI service (`ml_service`)

The **social ML inference** app is a **FastAPI** service under `ml_service/`. It loads trained artifacts once at startup and exposes:

- `GET /health` — liveness and whether models loaded
- `POST /social/recommend` — ranked post recommendations (used by the .NET backend proxy)
- `GET /social/options` — goals, weights, feature lists (optional)
- `POST /social/predict` — single-configuration predictions (optional)

The **frontend** and **contract** stay on the **Intex.API** proxy; in Azure you point the .NET app at this service’s base URL (for example `MlInferenceService__BaseUrl`).

## What the container includes

The production image (see `ml_service/Dockerfile`) copies:

1. **`ml_service/`** — FastAPI app
2. **`ml-pipelines/ml_pipeline_social_media_engagement/`** — import path for `SocialRecommenderSession` (prepended at runtime)
3. **`backend/Intex.API/App_Data/ml/social/`** — joblibs, manifest, metadata (default `SOCIAL_ARTIFACT_DIR=/app/artifacts/social`)
4. **`data/lighthouse_csv_v7/social_media_posts.csv`** — candidate grid / training CSV (default `SOCIAL_POSTS_CSV=/app/data/social_media_posts.csv`)

You can override artifact and CSV paths with environment variables and mount volumes instead of baking files into the image.

## Environment variables

| Variable | Purpose | Default (image) |
|----------|---------|-----------------|
| `SOCIAL_ARTIFACT_DIR` | Directory with social joblibs + JSON manifest/metadata | `/app/artifacts/social` |
| `SOCIAL_POSTS_CSV` | Path to `social_media_posts.csv` | `/app/data/social_media_posts.csv` |
| `PORT` | HTTP listen port (uvicorn) | `8000` if unset |
| `ML_SERVICE_API_KEY` | If set, `POST /social/recommend` requires the shared secret in the header below | unset = no check |
| `ML_SERVICE_API_KEY_HEADER` | Header name for the API key | `X-ML-Service-Key` |

`GET /health`, `GET /social/options`, and `POST /social/predict` are **not** gated by `ML_SERVICE_API_KEY` (only `POST /social/recommend`).

## Run locally (uvicorn, no Docker)

From the **WinterIntex4-5** repository root:

```bash
cd /path/to/WinterIntex4-5
python3 -m venv .venv-mlsvc && source .venv-mlsvc/bin/activate
pip install -r ml_service/requirements.txt
pip install -r ml-pipelines/requirements.txt
uvicorn ml_service.main:app --reload --host 0.0.0.0 --port 8001
```

Optional API key for local testing:

```bash
export ML_SERVICE_API_KEY=dev-shared-secret
uvicorn ml_service.main:app --host 0.0.0.0 --port 8001
```

## Build the Docker image

From **WinterIntex4-5** (same directory as `backend/`, `ml_service/`, `ml-pipelines/`):

```bash
cd /path/to/WinterIntex4-5
docker build -f ml_service/Dockerfile -t intex-social-ml:latest .
```

## Run the container locally

Without API key:

```bash
docker run --rm -p 8000:8000 intex-social-ml:latest
```

With API key:

```bash
docker run --rm -p 8000:8000 \
  -e ML_SERVICE_API_KEY=your-secret \
  -e ML_SERVICE_API_KEY_HEADER=X-ML-Service-Key \
  intex-social-ml:latest
```

Custom port (host 8080 → container 8000):

```bash
docker run --rm -p 8080:8000 intex-social-ml:latest
```

Mount fresh artifacts instead of image copies:

```bash
docker run --rm -p 8000:8000 \
  -v /path/to/social:/app/artifacts/social:ro \
  -v /path/to/social_media_posts.csv:/app/data/social_media_posts.csv:ro \
  -e SOCIAL_ARTIFACT_DIR=/app/artifacts/social \
  -e SOCIAL_POSTS_CSV=/app/data/social_media_posts.csv \
  intex-social-ml:latest
```

## .NET backend: base URL and optional API key

After deployment, set the inference base URL to the **HTTPS (or internal) origin** of this service **without a trailing path**, for example:

- `https://your-ml-app.azurewebsites.net`
- `https://your-ml-app.<region>.azurecontainerapps.io`

Use the same value for **`MlInferenceService__BaseUrl`** (or your appsettings key) so the existing proxy calls `{BaseUrl}/social/recommend`, `{BaseUrl}/health`, etc.

If you enable **`ML_SERVICE_API_KEY`** on the Python service, configure the .NET HTTP client to send that header on **`POST /social/recommend`** requests (header name = `ML_SERVICE_API_KEY_HEADER`, default `X-ML-Service-Key`). Keep the key in **Azure Key Vault** or **app settings** (never commit secrets).

## Azure hosting options (neutral)

- **Azure App Service (Linux)** can run a **custom container**; the platform often sets **`PORT`** — the image’s startup command respects `PORT` with default `8000`.
- **Azure Container Apps** runs containerized HTTP workloads with ingress, scaling, and optional internal-only endpoints — suitable for service-to-service calls from App Service or another VNet-linked backend.

Choose based on your team’s ops model; the service itself only needs a reachable HTTP port and the environment variables above.

## Quick verification

```bash
curl -s http://127.0.0.1:8000/health
curl -s -X POST http://127.0.0.1:8000/social/recommend \
  -H "Content-Type: application/json" \
  -H "X-ML-Service-Key: your-secret" \
  -d '{"goal":"donations","fixed_inputs":{"content_topic":"Reintegration"},"top_k":2}'
```

If `ML_SERVICE_API_KEY` is set, omitting the header or sending a wrong value returns **401** with `{"detail":"Invalid or missing ML service API key."}`.

More examples: `ml_service/README.md`.
