#!/usr/bin/env bash
set -euo pipefail

ROOT=${1:-/opt/myndbbs}
COMPOSE=${2:-$ROOT/docker-compose.hot-update.yml}
PLUGIN_DIR=${PLUGIN_DIR:-$ROOT/plugins}
mkdir -p "$ROOT/releases" "$PLUGIN_DIR"
if [ ! -f "$PLUGIN_DIR/allowlist.json" ]; then
  printf '{"plugins":[]}\n' > "$PLUGIN_DIR/allowlist.json"
fi
cat > "$COMPOSE" <<YAML
services:
  backend:
    environment:
      PLUGIN_ALLOWLIST_FILE: /app/plugin-releases/allowlist.json
      PLUGIN_GATEWAY_DNS_PREFIX: http://myndbbs-plugin-
    volumes:
      - $PLUGIN_DIR:/app/plugin-releases:ro
YAML
chmod 0644 "$COMPOSE" "$PLUGIN_DIR/allowlist.json"
echo "hot-update-base-ready=$ROOT"
