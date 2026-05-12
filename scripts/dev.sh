#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  cp .env.example .env
fi

set -a
. ./.env
set +a

export OPENSEARCH_NODE="http://localhost:9200"
export DOCUMENT_ROOT="./sample-documents"

echo "Starting OpenSearch for local development..."
docker compose up -d opensearch

echo "Waiting for OpenSearch to become healthy..."
until [ "$(docker inspect --format='{{.State.Health.Status}}' "$(docker compose ps -q opensearch)" 2>/dev/null || true)" = "healthy" ]; do
  sleep 3
done

echo "Starting GraphQL API in watch mode..."
node --watch src/index.js
