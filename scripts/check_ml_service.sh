#!/usr/bin/env bash
# Quick checks: show Container App image in Azure; optionally curl live /health.
set -euo pipefail

RESOURCE_GROUP="appsvc_windows_centralus"
CONTAINER_APP_NAME="intex-ml-service"

if ! command -v az >/dev/null 2>&1; then
  echo "error: az (Azure CLI) not found" >&2
  exit 1
fi

echo "==> Container App image (Azure)"
az containerapp show \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.template.containers[0].image" \
  -o tsv

if [[ -n "${ML_SERVICE_BASE_URL:-}" ]]; then
  if ! command -v curl >/dev/null 2>&1; then
    echo "error: ML_SERVICE_BASE_URL is set but curl not found" >&2
    exit 1
  fi
  base="${ML_SERVICE_BASE_URL%/}"
  echo "==> GET ${base}/health"
  curl -sfS "${base}/health"
  echo ""
else
  echo "Tip: export ML_SERVICE_BASE_URL='https://<your-app>.<region>.azurecontainerapps.io' to hit /health from here."
fi
