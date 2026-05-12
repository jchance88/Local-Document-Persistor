#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  cp .env.example .env
fi

set -a
. ./.env
set +a

echo "Starting OpenSearch..."
docker compose up -d opensearch

echo "Waiting for OpenSearch to become healthy..."
until [ "$(docker inspect --format='{{.State.Health.Status}}' "$(docker compose ps -q opensearch)" 2>/dev/null || true)" = "healthy" ]; do
  sleep 3
done

echo "Starting GraphQL API..."
docker compose up --build -d api

echo "Legal reference server deployment requested."
echo "GraphQL endpoint: http://localhost:${PORT:-4000}/graphql"
