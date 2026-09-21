#!/usr/bin/env bash
set -euo pipefail

ROOT=${1:?release root required}
CONF=${2:?host vhost path required}
CONTAINER=${3:?openresty container required}
STATE="$ROOT/hot-state-frontend.json"
ACTIVE=$(dirname "$CONF")/myndbbs-frontend-active-upstream.inc
ACTIVE_BACKUP=''
ACTIVE_EXISTED=0
ACTIVE_SWITCHED=0
COMMITTED=0
PRESERVE_ACTIVE_BACKUP=0

prepare_active_backup() {
  ACTIVE_BACKUP=$(mktemp "${ACTIVE}.rollback.XXXXXX")
  if [ -e "$ACTIVE" ]; then
    ACTIVE_EXISTED=1
    cp -p -- "$ACTIVE" "$ACTIVE_BACKUP"
  fi
}

activate_prepared_upstream() {
  prepare_active_backup
  mv -f "$ACTIVE.next" "$ACTIVE"
  ACTIVE_SWITCHED=1
}

cleanup() {
  status=$?
  trap - EXIT
  set +e
  if [ "$status" -ne 0 ] && [ "$COMMITTED" -eq 0 ] && [ "$ACTIVE_SWITCHED" -eq 1 ]; then
    restored=0
    if [ "$ACTIVE_EXISTED" -eq 1 ] && [ -n "$ACTIVE_BACKUP" ]; then
      if mv -f "$ACTIVE_BACKUP" "$ACTIVE"; then
        ACTIVE_BACKUP=''
        restored=1
      else
        PRESERVE_ACTIVE_BACKUP=1
        printf 'failed to restore frontend active upstream; backup retained at %s\n' "$ACTIVE_BACKUP" >&2
      fi
    elif rm -f "$ACTIVE"; then
      restored=1
    fi
    if [ "$restored" -eq 1 ]; then
      sudo -n docker exec "$CONTAINER" /usr/local/openresty/bin/openresty -t >/dev/null 2>&1 || true
      sudo -n docker exec "$CONTAINER" /usr/local/openresty/bin/openresty -s reload >/dev/null 2>&1 || true
    fi
  fi
  rm -f "$ACTIVE.next" "$STATE.next"
  if [ -n "$ACTIVE_BACKUP" ] && [ "$PRESERVE_ACTIVE_BACKUP" -eq 0 ]; then
    rm -f "$ACTIVE_BACKUP"
  fi
  exit "$status"
}
trap cleanup EXIT
if [ ! -f "$STATE" ] || [ ! -s "$STATE" ]; then
  rm -f "$STATE"
  printf 'server 127.0.0.1:3100;\n' > "$ACTIVE.next"
  activate_prepared_upstream
  sudo -n docker exec "$CONTAINER" /usr/local/openresty/bin/openresty -t
  sudo -n docker exec "$CONTAINER" /usr/local/openresty/bin/openresty -s reload
  COMMITTED=1
  exit 0
fi
PLAN=$(python3 - "$STATE" "$ACTIVE.next" "$STATE.next" <<'PY'
import json
from pathlib import Path
import re
import sys

VERSION_PATTERN = re.compile(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,127}\Z')
CONTAINER_PATTERN = re.compile(r'myndbbs-frontend-hot-[A-Za-z0-9][A-Za-z0-9_.-]{0,127}\Z')
SHA256_PATTERN = re.compile(r'[0-9a-fA-F]{64}\Z')

def reject_constant(value):
    raise ValueError(f'invalid JSON constant: {value}')

def validate_state(state, depth=0):
    if type(state) is not dict or depth > 32:
        raise ValueError('state must be an object')
    version = state.get('version')
    container = state.get('container')
    port = state.get('port')
    artifact_sha256 = state.get('artifactSha256')
    if type(version) is not str or not VERSION_PATTERN.fullmatch(version):
        raise ValueError('invalid version')
    if (
        type(container) is not str
        or not CONTAINER_PATTERN.fullmatch(container)
        or container != f'myndbbs-frontend-hot-{version}'
    ):
        raise ValueError('invalid container')
    if type(port) is not int or not 1 <= port <= 65535:
        raise ValueError('invalid port')
    if type(artifact_sha256) is not str or not SHA256_PATTERN.fullmatch(artifact_sha256):
        raise ValueError('invalid artifact sha256')
    if 'previous' not in state:
        raise ValueError('missing previous state')
    previous = state['previous']
    if previous is not None:
        validate_state(previous, depth + 1)

state_path = Path(sys.argv[1])
state_next = Path(sys.argv[3])
state = json.loads(state_path.read_text(), parse_constant=reject_constant)
validate_state(state)
previous = state['previous']
port = 3100 if previous is None else previous['port']
Path(sys.argv[2]).write_text(f'server 127.0.0.1:{port};\n')
state_next.unlink(missing_ok=True)
if previous is None:
    action = 'delete'
else:
    state_next.write_text(json.dumps(previous, separators=(',', ':'), allow_nan=False) + '\n')
    action = 'replace'
print(f"{state['container']}\t{action}")
PY
)
CURRENT=${PLAN%%$'\t'*}
STATE_ACTION=${PLAN#*$'\t'}
case "$STATE_ACTION" in
  delete|replace) ;;
  *) echo 'invalid frontend rollback plan' >&2; exit 1 ;;
esac
activate_prepared_upstream
sudo -n docker exec "$CONTAINER" /usr/local/openresty/bin/openresty -t
sudo -n docker exec "$CONTAINER" /usr/local/openresty/bin/openresty -s reload
if [ "$STATE_ACTION" = "replace" ]; then
  mv -f "$STATE.next" "$STATE"
else
  rm -f "$STATE"
fi
COMMITTED=1
docker rm -f "$CURRENT" >/dev/null 2>&1 || true
echo 'frontend-hot-rollback=ok'
