#!/usr/bin/env bash
set -euo pipefail
SERVICE=${1:-backend}
ROOT=${2:-/opt/myndbbs}
cd "$ROOT"
COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.rolling.yml}
if [ ! -f "$COMPOSE_FILE" ]; then
  echo "rolling compose file is required: $ROOT/$COMPOSE_FILE" >&2
  exit 2
fi
# The regular compose file has fixed container names and host ports; scaling it
# would cause collisions. Require an explicitly reviewed rolling topology.
docker compose -f "$COMPOSE_FILE" config --services | grep -qx "$SERVICE"
docker compose -f "$COMPOSE_FILE" up -d --no-deps --scale "$SERVICE"=2 "$SERVICE"
docker compose -f "$COMPOSE_FILE" up -d --no-deps --scale "$SERVICE"=1 "$SERVICE"
docker compose -f "$COMPOSE_FILE" ps "$SERVICE"
