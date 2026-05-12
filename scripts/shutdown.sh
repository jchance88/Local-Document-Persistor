#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

docker compose down

echo "Legal reference server stopped."
echo "OpenSearch data volume was preserved. To delete indexed data too, run: docker compose down -v"
