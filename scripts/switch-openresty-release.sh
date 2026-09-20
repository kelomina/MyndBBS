#!/usr/bin/env bash
set -euo pipefail
COLOR=${1:?blue or green required}
CONF=${2:?host vhost path required}
CONTAINER=${3:?openresty container required}
ACTIVE_DIR=${4:-$(dirname "$CONF")}
BACKUP_DIR=${BACKUP_DIR:-$ACTIVE_DIR/hot-update-backups}
mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
CONF_BACKUP="$BACKUP_DIR/$(basename "$CONF").$STAMP"
FRONT_ACTIVE="$ACTIVE_DIR/myndbbs-frontend-active-upstream.inc"
BACK_ACTIVE="$ACTIVE_DIR/myndbbs-backend-active-upstream.inc"
cp -p "$CONF" "$CONF_BACKUP"
FRONT_EXISTS=0
BACK_EXISTS=0
if [ -e "$FRONT_ACTIVE" ] || [ -L "$FRONT_ACTIVE" ]; then FRONT_EXISTS=1; cp -p "$FRONT_ACTIVE" "$BACKUP_DIR/$(basename "$FRONT_ACTIVE").$STAMP"; fi
if [ -e "$BACK_ACTIVE" ] || [ -L "$BACK_ACTIVE" ]; then BACK_EXISTS=1; cp -p "$BACK_ACTIVE" "$BACKUP_DIR/$(basename "$BACK_ACTIVE").$STAMP"; fi
COMMITTED=0
restore_active() {
  if [ "$COMMITTED" = "1" ]; then return; fi
  cp -p "$CONF_BACKUP" "$CONF" 2>/dev/null || true
  if [ "$FRONT_EXISTS" = "1" ]; then cp -p "$BACKUP_DIR/$(basename "$FRONT_ACTIVE").$STAMP" "$FRONT_ACTIVE"; else rm -f "$FRONT_ACTIVE"; fi
  if [ "$BACK_EXISTS" = "1" ]; then cp -p "$BACKUP_DIR/$(basename "$BACK_ACTIVE").$STAMP" "$BACK_ACTIVE"; else rm -f "$BACK_ACTIVE"; fi
  sudo -n docker exec "$CONTAINER" /usr/local/openresty/bin/openresty -t >/dev/null 2>&1 || true
  sudo -n docker exec "$CONTAINER" /usr/local/openresty/bin/openresty -s reload >/dev/null 2>&1 || true
}
trap restore_active EXIT
case "$COLOR" in
  blue) FRONTEND_PORT=${FRONTEND_BLUE_PORT:-3311}; BACKEND_PORT=${BACKEND_BLUE_PORT:-3301} ;;
  green) FRONTEND_PORT=${FRONTEND_GREEN_PORT:-3312}; BACKEND_PORT=${BACKEND_GREEN_PORT:-3302} ;;
  *) echo 'invalid release color' >&2; exit 2 ;;
esac
printf 'server 127.0.0.1:%s;\n' "$FRONTEND_PORT" > "$FRONT_ACTIVE.next"
printf 'server 127.0.0.1:%s;\n' "$BACKEND_PORT" > "$BACK_ACTIVE.next"
mv -f "$FRONT_ACTIVE.next" "$FRONT_ACTIVE"
mv -f "$BACK_ACTIVE.next" "$BACK_ACTIVE"
sudo -n docker exec "$CONTAINER" /usr/local/openresty/bin/openresty -t
sudo -n docker exec "$CONTAINER" /usr/local/openresty/bin/openresty -s reload
COMMITTED=1
echo "active-release=$COLOR frontend=$FRONTEND_PORT backend=$BACKEND_PORT"
