#!/usr/bin/env bash
set -euo pipefail

CONF=${1:?host vhost path required}
CONTAINER=${2:?openresty container required}
ACTIVE_DIR=${3:-$(dirname "$CONF")}
FRONT_ACTIVE=${FRONT_ACTIVE:-$ACTIVE_DIR/myndbbs-frontend-active-upstream.inc}
BACK_ACTIVE=${BACK_ACTIVE:-$ACTIVE_DIR/myndbbs-backend-active-upstream.inc}
BACKUP_DIR=${BACKUP_DIR:-$(dirname "$CONF")/hot-update-backups}
mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
cp -p "$CONF" "$BACKUP_DIR/$(basename "$CONF").$STAMP"

restore_path() {
  local backup="$1"
  local target="$2"
  local existed="$3"
  if [ "$existed" = "1" ]; then
    cp -p "$backup" "$target"
  else
    rm -f "$target"
  fi
}

FRONT_EXISTS=0
BACK_EXISTS=0
if [ -e "$FRONT_ACTIVE" ] || [ -L "$FRONT_ACTIVE" ]; then
  FRONT_EXISTS=1
  cp -p "$FRONT_ACTIVE" "$BACKUP_DIR/$(basename "$FRONT_ACTIVE").$STAMP"
fi
if [ -e "$BACK_ACTIVE" ] || [ -L "$BACK_ACTIVE" ]; then
  BACK_EXISTS=1
  cp -p "$BACK_ACTIVE" "$BACKUP_DIR/$(basename "$BACK_ACTIVE").$STAMP"
fi

COMMITTED=0
rollback_openresty() {
  if [ "$COMMITTED" = "1" ]; then return; fi
  cp -p "$BACKUP_DIR/$(basename "$CONF").$STAMP" "$CONF" 2>/dev/null || true
  restore_path "$BACKUP_DIR/$(basename "$FRONT_ACTIVE").$STAMP" "$FRONT_ACTIVE" "$FRONT_EXISTS"
  restore_path "$BACKUP_DIR/$(basename "$BACK_ACTIVE").$STAMP" "$BACK_ACTIVE" "$BACK_EXISTS"
  sudo -n docker exec "$CONTAINER" /usr/local/openresty/bin/openresty -t >/dev/null 2>&1 || true
  sudo -n docker exec "$CONTAINER" /usr/local/openresty/bin/openresty -s reload >/dev/null 2>&1 || true
}
trap rollback_openresty EXIT

python3 - "$CONF" <<'PY'
from pathlib import Path
import re
import sys

conf = Path(sys.argv[1])
text = conf.read_text()
for name, include in (
    ('myndbbs_frontend', '/usr/local/openresty/nginx/conf/conf.d/myndbbs-frontend-active-upstream.inc'),
    ('myndbbs_backend', '/usr/local/openresty/nginx/conf/conf.d/myndbbs-backend-active-upstream.inc'),
):
    pattern = rf'upstream {name}\s*\{{.*?\}}'
    replacement = f'upstream {name} {{\n    include {include};\n}}'
    text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'missing upstream block: {name}')
conf.with_suffix(conf.suffix + '.next').write_text(text)
PY
mv -f "$CONF.next" "$CONF"
if [ ! -e "$FRONT_ACTIVE" ] && [ ! -L "$FRONT_ACTIVE" ]; then
  printf 'server 127.0.0.1:3100;\n' > "$FRONT_ACTIVE.next"
  mv -f "$FRONT_ACTIVE.next" "$FRONT_ACTIVE"
fi
if [ ! -e "$BACK_ACTIVE" ] && [ ! -L "$BACK_ACTIVE" ]; then
  printf 'server 127.0.0.1:3001;\n' > "$BACK_ACTIVE.next"
  mv -f "$BACK_ACTIVE.next" "$BACK_ACTIVE"
fi
if ! sudo -n docker exec "$CONTAINER" /usr/local/openresty/bin/openresty -t; then
  exit 1
fi
if ! sudo -n docker exec "$CONTAINER" /usr/local/openresty/bin/openresty -s reload; then
  exit 1
fi
COMMITTED=1
echo "openresty-hot-update-ready=$STAMP"
