#!/usr/bin/env bash
# Offline provisioning aid only. Never starts containers or activates a plugin.
# Caller must back up production state before intentionally using this on a host.
set -euo pipefail
umask 077
ROOT=${1:?explicit deployment root required; see ops/plugins/README.md}
COMPOSE=${2:-$ROOT/docker-compose.hot-update.yml}
PLUGIN_HOST_DIR=${PLUGIN_HOST_DIR:-$ROOT/plugins}
TRUST_KEYS_FILE=${PLUGIN_TRUST_KEYS_HOST_FILE:-$ROOT/plugin-trust-keys.json}
CONTROL_ENV_FILE=${PLUGIN_CONTROL_ENV_FILE:-$ROOT/secrets/plugin-control.env}
for value in "$ROOT" "$COMPOSE" "$PLUGIN_HOST_DIR" "$TRUST_KEYS_FILE" "$CONTROL_ENV_FILE"; do
  # Restrict generated YAML values and require absolute daemon-host paths.
  if [[ ! "$value" =~ ^/[A-Za-z0-9_./-]+$ ]] || [[ "/$value/" == *'/../'* ]]; then
    printf '%s\n' 'absolute safe Linux paths required' >&2
    exit 2
  fi
done
if [ -e "$COMPOSE" ] || [ -L "$COMPOSE" ]; then
  printf '%s\n' 'existing override preserved; choose a new output path and review the diff' >&2
  exit 2
fi
# Do not create empty trust/secret files, silently trust keys, rewrite allowlists,
# or chmod existing operator data. Missing prerequisites must remain visible.
if [ ! -d "$PLUGIN_HOST_DIR" ] || [ -L "$PLUGIN_HOST_DIR" ] || [ ! -f "$TRUST_KEYS_FILE" ] || [ -L "$TRUST_KEYS_FILE" ] || [ ! -f "$CONTROL_ENV_FILE" ] || [ -L "$CONTROL_ENV_FILE" ]; then
  printf '%s\n' 'prepare the plugin host directory, public trust file, and supervisor-only secret file first' >&2
  exit 2
fi
# This override is for the base docker-compose.yml, NOT the rolling example.
# Single-quoted heredoc preserves Compose interpolation without exposing secrets.
set -o noclobber
{
  printf 'services:\n  backend:\n    volumes:\n      - "%s:/app/plugin-releases:ro"\n' "$PLUGIN_HOST_DIR"
  printf '  plugin-control:\n    profiles: [plugins]\n    env_file:\n      - "%s"\n' "$CONTROL_ENV_FILE"
  printf '    environment:\n      PLUGIN_ROOT: /opt/myndbbs/plugins\n      PLUGIN_DOCKER_ROOT: "%s"\n' "$PLUGIN_HOST_DIR"
  printf '      PLUGIN_DOCKER_TRUST_KEYS_FILE: "%s"\n' "$TRUST_KEYS_FILE"
  cat <<'YAML'
      PLUGIN_TRUST_KEYS_FILE: /opt/myndbbs/plugin-trust-keys.json
      PLUGIN_CONTROL_TOKEN: ${PLUGIN_CONTROL_TOKEN:-}
      PLUGIN_NETWORK: ${PLUGIN_RUNTIME_NETWORK:-myndbbs_plugin_runtime}
      PLUGIN_RUNTIME_IMAGE: ghcr.io/kelomina/myndbbs-plugin-runtime:${PLUGIN_INFRA_IMAGE_TAG:-latest}
    volumes:
YAML
  printf '      - "%s:/opt/myndbbs/plugins"\n' "$PLUGIN_HOST_DIR"
  printf '      - "%s:/opt/myndbbs/plugin-trust-keys.json:ro"\n' "$TRUST_KEYS_FILE"
  cat <<'YAML'
      - /var/run/docker.sock:/var/run/docker.sock
    networks: [default, plugin-runtime]
networks:
  plugin-runtime:
    name: ${PLUGIN_RUNTIME_NETWORK:-myndbbs_plugin_runtime}
    internal: true
YAML
} > "$COMPOSE"
printf '%s\n' 'plugin override generated only; review before use; no service or release was changed'
