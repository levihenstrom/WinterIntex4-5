# ML inference service (FastAPI)

The browser and SPA call **only** the .NET API. For social post recommendations, the API proxies to a **Python FastAPI** service using typed `HttpClient` configuration.

## Configuration (`MlInferenceService`)

| Key | Required | Description |
|-----|----------|-------------|
| `BaseUrl` | For social recommendations | Absolute URL of the FastAPI app root (e.g. `https://ml.internal:8001`). Empty = social proxy disabled (503). |
| `TimeoutSeconds` | Yes (has default) | Per-request timeout (1–300). Applied to `HttpClient.Timeout`. |
| `ApiKey` | No | If non-empty, sent on every ML HTTP request for optional service-to-service auth. |
| `ApiKeyHeaderName` | When `ApiKey` is set | Header name (default `X-ML-Service-Key`). |

Override via environment variables, e.g. `MlInferenceService__BaseUrl`, `MlInferenceService__ApiKey`.

## Local development

- Run FastAPI from the repo root (e.g. `uvicorn ml_service.main:app --reload --port 8001`).
- `appsettings.json` defaults `BaseUrl` to `http://127.0.0.1:8001`. In **Development**, if `BaseUrl` is still blank after all config sources, it is filled with that same default via `PostConfigure` (covers empty user secrets / env).
- **Production:** `appsettings.Production.json` does **not** override `MlInferenceService`; set `MlInferenceService__BaseUrl` on the host to your real FastAPI URL, or to an empty string to disable live social ML without changing files.
- Call `POST /api/ml/social/recommend` on the .NET API (staff-authenticated); the response is camelCase DTOs, not raw Python JSON.

## FastAPI changes

No FastAPI change is required for optional API keys until you add verification on the Python side; the .NET host only **sends** the header when configured.
