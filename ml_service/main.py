"""
Social ML inference API — live post recommendations using App_Data/ml/social artifacts.
"""

from __future__ import annotations

import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from ml_service.artifact_loader import ArtifactError, validate_and_load
from ml_service.recommender import (
    normalize_fixed_inputs,
    normalize_predict_features,
    pipeline_row_to_item,
    public_candidate_fallbacks,
)
from ml_service.schemas import (
    HealthResponse,
    PredictRequest,
    PredictResponse,
    RecommendRequest,
    RecommendResponse,
    SocialOptionsResponse,
)
from ml_service.settings import social_artifact_dir, social_posts_csv


def _ensure_ml_pipeline_on_path() -> Path:
    root = Path(__file__).resolve().parent.parent
    mlp = root / "ml-pipelines"
    if not mlp.is_dir():
        raise RuntimeError(f"ml-pipelines directory not found at {mlp}")
    mlp_s = str(mlp)
    if mlp_s not in sys.path:
        sys.path.insert(0, mlp_s)
    return root


@asynccontextmanager
async def lifespan(app: FastAPI):
    _ensure_ml_pipeline_on_path()
    from ml_pipeline_social_media_engagement.recommend_posts import SocialRecommenderSession

    adir = social_artifact_dir()
    csvp = social_posts_csv()
    try:
        manifest, goal_weights = validate_and_load(adir)
        session = SocialRecommenderSession(adir, csvp, goal_weights=goal_weights)
    except ArtifactError as e:
        raise RuntimeError(f"Artifact validation failed: {e}") from e
    except FileNotFoundError as e:
        raise RuntimeError(str(e)) from e

    app.state.session = session
    app.state.manifest = manifest
    app.state.goal_weights = goal_weights
    yield
    app.state.session = None


app = FastAPI(
    title="Social ML Inference",
    description="Live social post recommendations (trained artifacts under App_Data/ml/social).",
    lifespan=lifespan,
)


@app.exception_handler(ValueError)
async def value_error_handler(_request: Request, exc: ValueError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.get("/health", response_model=HealthResponse)
def health(request: Request) -> HealthResponse:
    ok = getattr(request.app.state, "session", None) is not None
    return HealthResponse(status="ok", service="social-ml-inference", models_loaded=ok)


@app.get("/social/options", response_model=SocialOptionsResponse)
def social_options(request: Request) -> SocialOptionsResponse:
    session = request.app.state.session
    manifest = request.app.state.manifest
    if session is None:
        raise HTTPException(status_code=503, detail="Recommender not initialized")
    meta = session.meta
    raw_fallbacks = manifest.get("candidate_dimension_fallbacks_for_validation") or {}
    fallbacks = public_candidate_fallbacks(raw_fallbacks)
    gw = request.app.state.goal_weights
    return SocialOptionsResponse(
        supported_goals=list(manifest.get("supported_goals") or sorted(gw.keys())),
        goal_weights=gw,
        candidate_dimension_fallbacks=fallbacks,
        numeric_features=list(meta.get("numeric_features", [])),
        categorical_features=list(meta.get("categorical_features", [])),
        artifacts_loaded=True,
    )


@app.post("/social/recommend", response_model=RecommendResponse)
def social_recommend(body: RecommendRequest, request: Request) -> RecommendResponse:
    session = request.app.state.session
    if session is None:
        raise HTTPException(status_code=503, detail="Recommender not initialized")

    raw = body.fixed_inputs.model_dump(exclude_none=True)
    fixed = normalize_fixed_inputs(raw)
    try:
        _df, records = session.recommend_next_post(body.goal, fixed if fixed else None, body.top_k)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    if not records:
        raise HTTPException(
            status_code=422,
            detail="Empty candidate space after applying constraints — relax fixed_inputs.",
        )

    items = [pipeline_row_to_item(r) for r in records]
    return RecommendResponse(goal=body.goal, top_k=body.top_k, recommendations=items)


@app.post("/social/predict", response_model=PredictResponse)
def social_predict(body: PredictRequest, request: Request) -> PredictResponse:
    session = request.app.state.session
    if session is None:
        raise HTTPException(status_code=503, detail="Recommender not initialized")

    feats = normalize_predict_features(body.features)
    try:
        out = session.evaluate_post_configuration(feats)
    except Exception as exc:  # noqa: BLE001 — surface sklearn/pandas errors clearly
        raise HTTPException(status_code=422, detail=f"Prediction failed: {exc}") from exc

    return PredictResponse(**out)


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "social-ml-inference", "docs": "/docs"}
