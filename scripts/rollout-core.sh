#!/usr/bin/env bash
set -euo pipefail
SERVICE=${1:-backend}
ROOT=${2:-/opt/myndbbs}
cd "$ROOT"
docker compose up -d --no-deps --scale "$SERVICE"=2 "$SERVICE"
docker compose up -d --no-deps --scale "$SERVICE"=1 "$SERVICE"
docker compose ps "$SERVICE"
