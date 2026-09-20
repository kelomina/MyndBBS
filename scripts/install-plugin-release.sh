#!/usr/bin/env bash
set -euo pipefail

ROOT=${1:?plugin root required}
ARCHIVE=${2:?plugin artifact required}
PLUGIN_ID=${3:?plugin id required}
VERSION=${4:?plugin version required}
RUNTIME_IMAGE=${5:?plugin runtime image required}
NETWORK=${6:-myndbbs_default}
ADMIN_TOKEN=${7:?plugin admin token required}
PLUGIN_DIR="$ROOT/$PLUGIN_ID"
RELEASE="$PLUGIN_DIR/releases/$VERSION"
STATE="$PLUGIN_DIR/state.json"
if ! printf '%s' "$PLUGIN_ID" | grep -Eq '^[a-z0-9][a-z0-9-]{1,62}$'; then echo 'invalid plugin id' >&2; exit 2; fi
if ! printf '%s' "$VERSION" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$'; then echo 'invalid plugin version' >&2; exit 2; fi
if [ ! -f "$ARCHIVE" ] || [ -L "$ARCHIVE" ]; then echo 'plugin artifact file is required' >&2; exit 2; fi
ARCHIVE=$(readlink -f -- "$ARCHIVE")
ARCHIVE_DIR=$(dirname -- "$ARCHIVE")
ARCHIVE_FILE=$(basename -- "$ARCHIVE")
CHECKSUM_FILE="$ARCHIVE.sha256"
if [ ! -f "$CHECKSUM_FILE" ] || [ -L "$CHECKSUM_FILE" ]; then echo 'plugin artifact checksum is required' >&2; exit 2; fi
CHECKSUM_RECORD=$(awk 'NF == 2 { count++; if (count == 1) print $1 "\t" $2 } END { if (count != 1) exit 1 }' "$CHECKSUM_FILE") || { echo 'invalid plugin artifact checksum file' >&2; exit 2; }
CHECKSUM_HASH=${CHECKSUM_RECORD%%$'\t'*}
CHECKSUM_NAME=${CHECKSUM_RECORD#*$'\t'}
if ! printf '%s' "$CHECKSUM_HASH" | grep -Eq '^[a-fA-F0-9]{64}$' || [ "$CHECKSUM_NAME" != "$ARCHIVE_FILE" ]; then
  echo 'plugin artifact checksum file does not name the artifact' >&2
  exit 2
fi
if ! (cd "$ARCHIVE_DIR" && sha256sum --strict --check "$(basename -- "$CHECKSUM_FILE")"); then echo 'plugin artifact checksum mismatch' >&2; exit 1; fi
python3 - "$ROOT/allowlist.json" "$PLUGIN_ID" <<'PY'
import json
from pathlib import Path
import sys
allowlist = json.loads(Path(sys.argv[1]).read_text())
if sys.argv[2] not in allowlist.get('plugins', []): raise SystemExit('plugin is not in the reviewed allow-list')
PY
mkdir -p "$PLUGIN_DIR/releases" "$ROOT/hot-backups"
if [ -e "$RELEASE" ]; then echo "release already exists: $RELEASE" >&2; exit 2; fi
mkdir -p "$RELEASE"
if tar -tzf "$ARCHIVE" | awk '/(^|\/)\.\.($|\/)|^\// { bad=1; print; } END { exit bad }'; then
  tar -xzf "$ARCHIVE" -C "$RELEASE" --no-same-owner --no-same-permissions
else
  echo 'plugin artifact contains an unsafe archive member' >&2
  rm -rf "$RELEASE"
  exit 1
fi
if find "$RELEASE" -type l -print -quit | grep -q .; then
  echo 'plugin artifact must not contain symlinks' >&2
  rm -rf "$RELEASE"
  exit 1
fi
python3 - "$RELEASE" "$PLUGIN_ID" "$VERSION" <<'PY'
from hashlib import sha256
import json
from pathlib import Path
import sys

root = Path(sys.argv[1])
plugin_id = sys.argv[2]
version = sys.argv[3]
manifest_path = root / 'manifest.json'
if not manifest_path.is_file(): raise SystemExit('plugin manifest is missing')
manifest = json.loads(manifest_path.read_text())
if manifest.get('id') != plugin_id or manifest.get('version') != version or manifest.get('apiVersion') != 1: raise SystemExit('invalid plugin manifest identity')
entry = manifest.get('entry')
if not isinstance(entry, str) or '\\' in entry or ':' in entry or any(part in ('', '.', '..') for part in entry.split('/')): raise SystemExit('invalid plugin entry')
entry_path = (root / entry).resolve()
if root.resolve() not in entry_path.parents: raise SystemExit('plugin entry escapes release')
if not entry_path.is_file(): raise SystemExit('plugin entry is missing')
if sha256(entry_path.read_bytes()).hexdigest() != manifest.get('sha256'): raise SystemExit('plugin sha256 mismatch')
PY

CURRENT="$PLUGIN_DIR/current"
OLD_TARGET=''
if [ -L "$CURRENT" ]; then OLD_TARGET=$(readlink "$CURRENT"); fi
if [ -e "$CURRENT" ] && [ ! -L "$CURRENT" ]; then echo 'plugin current must be a symlink' >&2; exit 2; fi
NAME="myndbbs-plugin-$PLUGIN_ID"
OLD_STATE=''
if [ -f "$STATE" ]; then OLD_STATE=$(cat "$STATE"); fi
SAFE_VERSION=$(printf '%s' "$VERSION" | tr -c 'A-Za-z0-9_.-' '_')
CANDIDATE="${NAME}-candidate-${SAFE_VERSION}"
OLD_CONTAINER="${NAME}-previous-${SAFE_VERSION}-$$"
OLD_EXISTS=0
OLD_RUNNING=0
if docker inspect "$NAME" >/dev/null 2>&1; then
  OLD_EXISTS=1
  if [ "$(docker inspect -f '{{.State.Running}}' "$NAME" 2>/dev/null)" = 'true' ]; then OLD_RUNNING=1; fi
fi
ARTIFACT_SHA="$CHECKSUM_HASH"
ROLLBACK_NEEDED=1
CURRENT_UPDATED=0
OLD_RENAMED=0
CANDIDATE_RENAMED=0
cleanup() {
  status=$?
  if [ "$ROLLBACK_NEEDED" = "1" ]; then
    if [ "$CANDIDATE_RENAMED" = "1" ]; then docker rm -f "$NAME" >/dev/null 2>&1 || true; else docker rm -f "$CANDIDATE" >/dev/null 2>&1 || true; fi
    if [ "$OLD_RENAMED" = "1" ]; then
      docker rename "$OLD_CONTAINER" "$NAME" >/dev/null 2>&1 || true
      if [ "$OLD_RUNNING" = "1" ]; then docker start "$NAME" >/dev/null 2>&1 || true; fi
    fi
    if [ "$CURRENT_UPDATED" = "1" ]; then
      if [ -n "$OLD_TARGET" ]; then ln -sfn "$OLD_TARGET" "$CURRENT.next" && mv -Tf "$CURRENT.next" "$CURRENT"; else rm -f "$CURRENT" "$CURRENT.next"; fi
    fi
    if [ -n "$OLD_STATE" ]; then printf '%s\n' "$OLD_STATE" > "$STATE"; else rm -f "$STATE"; fi
    rm -rf "$RELEASE"
  fi
  exit "$status"
}
trap cleanup EXIT
docker pull "$RUNTIME_IMAGE"
docker rm -f "$CANDIDATE" >/dev/null 2>&1 || true
docker run -d --name "$CANDIDATE" --network "$NETWORK" \
  -e PLUGIN_ROOT=/plugins -e PORT=3500 -e PLUGIN_ADMIN_TOKEN="$ADMIN_TOKEN" \
  -v "$RELEASE:/plugins/current:ro" "$RUNTIME_IMAGE" > /tmp/myndbbs-plugin-container
for _ in $(seq 1 30); do
  if docker exec "$CANDIDATE" node -e "fetch('http://127.0.0.1:3500/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then break; fi
  sleep 2
done
if ! docker exec "$CANDIDATE" node -e "fetch('http://127.0.0.1:3500/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
  exit 1
fi
ln -sfn "releases/$VERSION" "$CURRENT.next"
mv -Tf "$CURRENT.next" "$CURRENT"
CURRENT_UPDATED=1
if [ "$OLD_EXISTS" = "1" ]; then
  docker rename "$NAME" "$OLD_CONTAINER"
  OLD_RENAMED=1
fi
docker rename "$CANDIDATE" "$NAME"
CANDIDATE_RENAMED=1
printf '{"id":"%s","version":"%s","container":"%s","artifactSha256":"%s"}\n' "$PLUGIN_ID" "$VERSION" "$NAME" "$ARTIFACT_SHA" > "$STATE.next"
mv -f "$STATE.next" "$STATE"
ROLLBACK_NEEDED=0
if [ "$OLD_RENAMED" = "1" ]; then docker rm -f "$OLD_CONTAINER" >/dev/null 2>&1 || true; fi
echo "plugin-hot-release=$PLUGIN_ID@$VERSION container=$NAME"
