#!/usr/bin/env bash
set -euo pipefail

ROOT=${1:?release root required}
ARCHIVE=${2:?frontend artifact required}
VERSION=${3:?release version required}
PORT=${4:?candidate host port required}
CONF=${5:?host vhost path required}
CONTAINER=${6:?openresty container required}
NETWORK=${7:-myndbbs_default}
IMAGE=${8:?fixed frontend runtime image required}
PUBLIC_URL=${9:-}
RELEASE="$ROOT/releases/$VERSION"
STATE="$ROOT/hot-state-frontend.json"
FRONT_ACTIVE=$(dirname "$CONF")/myndbbs-frontend-active-upstream.inc
if [ "$PORT" = "auto" ]; then
  ACTIVE_PORT=$(sed -nE 's/^[[:space:]]*server[[:space:]]+127\.0\.0\.1:([0-9]+);[[:space:]]*$/\1/p' "$FRONT_ACTIVE" 2>/dev/null | head -n 1 || true)
  PORT=''
  for CANDIDATE_PORT in 3311 3312; do
    [ "$CANDIDATE_PORT" = "$ACTIVE_PORT" ] && continue
    if docker ps --format '{{.Ports}}' | grep -Eq "127\\.0\\.0\\.1:${CANDIDATE_PORT}->"; then continue; fi
    PORT=$CANDIDATE_PORT
    break
  done
  [ -n "$PORT" ] || { echo 'no free frontend candidate port' >&2; exit 2; }
fi
if ! printf '%s' "$PORT" | grep -Eq '^[0-9]+$' || [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
  echo 'invalid frontend candidate port' >&2
  exit 2
fi
if [[ ! "$VERSION" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$ ]]; then
  echo 'invalid frontend release version' >&2
  exit 2
fi
if [ ! -f "$ARCHIVE" ] || [ -L "$ARCHIVE" ]; then
  echo 'frontend artifact file is required' >&2
  exit 2
fi
ARCHIVE=$(readlink -f -- "$ARCHIVE")
ARCHIVE_DIR=$(dirname -- "$ARCHIVE")
ARCHIVE_FILE=$(basename -- "$ARCHIVE")
CHECKSUM_FILE="$ARCHIVE.sha256"
if [ ! -f "$CHECKSUM_FILE" ] || [ -L "$CHECKSUM_FILE" ]; then
  echo 'frontend artifact checksum is required' >&2
  exit 2
fi
CHECKSUM_RECORD=$(awk 'NF == 2 { count++; if (count == 1) print $1 "\t" $2 } END { if (count != 1) exit 1 }' "$CHECKSUM_FILE") || { echo 'invalid frontend artifact checksum file' >&2; exit 2; }
CHECKSUM_HASH=${CHECKSUM_RECORD%%$'\t'*}
CHECKSUM_NAME=${CHECKSUM_RECORD#*$'\t'}
if ! printf '%s' "$CHECKSUM_HASH" | grep -Eq '^[a-fA-F0-9]{64}$' || [ "$CHECKSUM_NAME" != "$ARCHIVE_FILE" ]; then
  echo 'frontend artifact checksum file does not name the artifact' >&2
  exit 2
fi
if ! (cd "$ARCHIVE_DIR" && sha256sum --strict --check "$(basename -- "$CHECKSUM_FILE")"); then
  echo 'frontend artifact checksum mismatch' >&2
  exit 1
fi
mkdir -p "$ROOT/releases" "$ROOT/hot-backups"
if [ -e "$RELEASE" ]; then echo "release already exists: $RELEASE" >&2; exit 2; fi
mkdir -p "$RELEASE"
if tar -tzf "$ARCHIVE" | awk '/(^|\/)\.\.($|\/)|^\// { bad=1; print; } END { exit bad }'; then
  tar -xzf "$ARCHIVE" -C "$RELEASE" --no-same-owner --no-same-permissions
else
  echo 'frontend artifact contains an unsafe archive member' >&2
  rm -rf "$RELEASE"
  exit 1
fi
if find "$RELEASE" -type l -print -quit | grep -q .; then
  echo 'frontend artifact must not contain symlinks' >&2
  rm -rf "$RELEASE"
  exit 1
fi
SERVER_PATH=$(python3 - "$RELEASE" "$VERSION" <<'PY'
from hashlib import sha256
import json
from pathlib import Path
import sys

root = Path(sys.argv[1])
version = sys.argv[2]
manifest = json.loads((root / 'manifest.json').read_text())
server_name = manifest.get('server')
if manifest.get('version') != version or not isinstance(server_name, str) or not server_name or '\\' in server_name or ':' in server_name or any(part in ('', '.', '..') for part in server_name.split('/')): raise SystemExit('invalid frontend manifest')
server = (root / server_name).resolve()
if root.resolve() not in server.parents: raise SystemExit('frontend server escapes release')
if not server.is_file() or sha256(server.read_bytes()).hexdigest() != manifest.get('sha256'): raise SystemExit('frontend manifest sha256 mismatch')
print(server.relative_to(root).as_posix())
PY
)

SAFE_VERSION=$(printf '%s' "$VERSION" | tr -c 'A-Za-z0-9_.-' '_')
NAME="myndbbs-frontend-hot-$SAFE_VERSION"
PREVIOUS='null'
STATE_EXISTS=0
if [ -f "$STATE" ]; then PREVIOUS=$(cat "$STATE"); STATE_EXISTS=1; fi
CONF_BACKUP=''
ACTIVE_BACKUP=''
FRONT_EXISTS=0
ACTIVE_UPDATED=0
CANDIDATE_COMMITTED=0
cleanup() {
  status=$?
  if [ "$CANDIDATE_COMMITTED" = "0" ]; then
    rm -f "$FRONT_ACTIVE.next" "$STATE.next"
    if [ "$ACTIVE_UPDATED" = "1" ]; then
      if [ -n "$CONF_BACKUP" ] && [ -f "$CONF_BACKUP" ]; then cp -p "$CONF_BACKUP" "$CONF" || true; fi
      if [ "$FRONT_EXISTS" = "1" ] && [ -n "$ACTIVE_BACKUP" ] && [ -f "$ACTIVE_BACKUP" ]; then cp -p "$ACTIVE_BACKUP" "$FRONT_ACTIVE" || true; else rm -f "$FRONT_ACTIVE"; fi
      sudo -n docker exec "$CONTAINER" /usr/local/openresty/bin/openresty -t >/dev/null 2>&1 || true
      sudo -n docker exec "$CONTAINER" /usr/local/openresty/bin/openresty -s reload >/dev/null 2>&1 || true
    fi
    docker rm -f "$NAME" >/dev/null 2>&1 || true
    if [ "$STATE_EXISTS" = "1" ]; then printf '%s\n' "$PREVIOUS" > "$STATE"; else rm -f "$STATE"; fi
    rm -rf "$RELEASE"
  fi
  exit "$status"
}
trap cleanup EXIT
docker pull "$IMAGE"
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" --network "$NETWORK" -p "127.0.0.1:$PORT:3100" \
  -e API_URL=http://myndbbs-backend:3001 -e NODE_ENV=production -e COOKIE_SECURE=true \
  -e HOSTNAME=0.0.0.0 -e PORT=3100 -w /app -v "$RELEASE:/app:ro" "$IMAGE" node "/app/$SERVER_PATH" > /tmp/myndbbs-frontend-hot-container

for _ in $(seq 1 60); do
  if curl -fsS --max-time 2 "http://127.0.0.1:$PORT/" >/dev/null; then break; fi
  sleep 2
done
curl -fsS --max-time 5 "http://127.0.0.1:$PORT/" >/dev/null
STAMP=$(date +%Y%m%d-%H%M%S)
CONF_BACKUP="$ROOT/hot-backups/$(basename "$CONF").$STAMP"
cp -p "$CONF" "$CONF_BACKUP"
ACTIVE_BACKUP="$ROOT/hot-backups/$(basename "$FRONT_ACTIVE").$STAMP"
if [ -e "$FRONT_ACTIVE" ] || [ -L "$FRONT_ACTIVE" ]; then
  FRONT_EXISTS=1
  cp -p "$FRONT_ACTIVE" "$ACTIVE_BACKUP"
fi
if [ -n "$PUBLIC_URL" ]; then
  curl -fsS --max-time 15 "$PUBLIC_URL/" >/dev/null
  curl -fsS --max-time 15 "$PUBLIC_URL/api/health" >/dev/null
fi
printf 'server 127.0.0.1:%s;\n' "$PORT" > "$FRONT_ACTIVE.next"
mv -f "$FRONT_ACTIVE.next" "$FRONT_ACTIVE"
ACTIVE_UPDATED=1
if ! sudo -n docker exec "$CONTAINER" /usr/local/openresty/bin/openresty -t; then
  exit 1
fi
if ! sudo -n docker exec "$CONTAINER" /usr/local/openresty/bin/openresty -s reload; then
  exit 1
fi
if [ -n "$PUBLIC_URL" ]; then
  curl -fsS --max-time 15 "$PUBLIC_URL/" >/dev/null
  curl -fsS --max-time 15 "$PUBLIC_URL/api/health" >/dev/null
fi
printf '{"version":"%s","container":"%s","port":%s,"previous":%s,"artifactSha256":"%s"}\n' "$VERSION" "$NAME" "$PORT" "$PREVIOUS" "$CHECKSUM_HASH" > "$STATE.next"
mv -f "$STATE.next" "$STATE"
CANDIDATE_COMMITTED=1
echo "frontend-hot-release=$VERSION port=$PORT container=$NAME"
