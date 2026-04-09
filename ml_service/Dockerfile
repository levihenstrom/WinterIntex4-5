# Build from repository root (WinterIntex4-5):
#   docker build -f ml_service/Dockerfile -t intex-ml-service .
#
# Runtime needs: ml_service package, ml-pipelines/ml_pipeline_social_media_engagement,
# App_Data social artifacts, and social_media_posts.csv (see ENV below).

FROM python:3.12-slim-bookworm

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

COPY ml_service/requirements.txt /tmp/ml_service-requirements.txt
RUN pip install --no-cache-dir -r /tmp/ml_service-requirements.txt \
    && rm /tmp/ml_service-requirements.txt

COPY ml_service /app/ml_service
COPY ml-pipelines/ml_pipeline_social_media_engagement /app/ml-pipelines/ml_pipeline_social_media_engagement
COPY backend/Intex.API/App_Data/ml/social /app/artifacts/social
COPY data/lighthouse_csv_v7/social_media_posts.csv /app/data/social_media_posts.csv

ENV SOCIAL_ARTIFACT_DIR=/app/artifacts/social \
    SOCIAL_POSTS_CSV=/app/data/social_media_posts.csv

EXPOSE 8000

# Azure and many hosts set PORT; default 8000. Backend appsettings use :8001 — map with -p 8001:8000 for local.
CMD ["sh", "-c", "exec uvicorn ml_service.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
