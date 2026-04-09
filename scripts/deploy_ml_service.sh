#!/usr/bin/env bash
# Manual deploy: build linux/amd64 ml_service image, push to ACR, update Azure Container App.
# Run from anywhere; script cds to repo root.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

ACR_LOGIN_SERVER="intexmlacr17550.azurecr.io"
ACR_NAME="intexmlacr17550"
IMAGE_NAME="ml-service"
RESOURCE_GROUP="appsvc_windows_centralus"
CONTAINER_APP_NAME="intex-ml-service"

for cmd in docker az git; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "error: required command not found: $cmd" >&2
    exit 1
  fi
done

for f in ml_service/Dockerfile backend/Intex.API/App_Data/ml/social/social_recommender_manifest.json; do
  if [[ ! -f "$f" ]]; then
    echo "error: missing required file (retrain/export and refresh artifacts first?): $REPO_ROOT/$f" >&2
    exit 1
  fi
done

TAG="$(git rev-parse --short HEAD)"
IMAGE_SHA="${ACR_LOGIN_SERVER}/${IMAGE_NAME}:${TAG}"
IMAGE_LATEST="${ACR_LOGIN_SERVER}/${IMAGE_NAME}:latest"

echo "==> Repo root: $REPO_ROOT"
echo "==> Image tag (git short SHA): $TAG"
echo "==> Will push: $IMAGE_SHA"
echo "==> Will push: $IMAGE_LATEST"

echo "==> ACR login: $ACR_NAME"
az acr login --name "$ACR_NAME"

echo "==> docker buildx build --platform linux/amd64 --push ..."
docker buildx build \
  --platform linux/amd64 \
  --push \
  -f ml_service/Dockerfile \
  -t "${IMAGE_SHA}" \
  -t "${IMAGE_LATEST}" \
  .

echo "==> Updating Container App: $CONTAINER_APP_NAME (resource group: $RESOURCE_GROUP)"
az containerapp update \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --image "${IMAGE_SHA}"

echo ""
echo "=== Success ==="
echo "Deployed image: ${IMAGE_SHA}"
echo "Also tagged in registry as: ${IMAGE_LATEST}"
