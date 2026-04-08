# Build from repository root (parent of ml_service/):
#   docker build -f ml_service/Dockerfile -t intex-ml-service .

FROM python:3.12-slim-bookworm

WORKDIR /app

COPY ml_service/requirements.txt /app/ml_service/requirements.txt
RUN pip install --no-cache-dir -r /app/ml_service/requirements.txt

COPY ml_service /app/ml_service
COPY backend/Intex.API/App_Data/ml/social /app/artifacts/social

# Startup imports ml_pipeline_social_media_engagement and loads social_media_posts.csv.
COPY ml-pipelines/ml_pipeline_social_media_engagement /app/ml-pipelines/ml_pipeline_social_media_engagement
COPY data/lighthouse_csv_v7/social_media_posts.csv /app/data/social_media_posts.csv

ENV SOCIAL_ARTIFACT_DIR=/app/artifacts/social \
    SOCIAL_POSTS_CSV=/app/data/social_media_posts.csv

EXPOSE 8001

CMD ["uvicorn", "ml_service.main:app", "--host", "0.0.0.0", "--port", "8001"]
