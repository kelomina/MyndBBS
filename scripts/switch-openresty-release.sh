#!/usr/bin/env bash
set -euo pipefail
COLOR=${1:?blue or green required}
TARGET=${2:-/etc/openresty/myndbbs-active-upstream.conf}
case "$COLOR" in
  blue) FRONTEND=myndbbs_frontend_blue; BACKEND=myndbbs_backend_blue ;;
  green) FRONTEND=myndbbs_frontend_green; BACKEND=myndbbs_backend_green ;;
  *) echo 'invalid release color' >&2; exit 2 ;;
esac
TMP="${TARGET}.next"
printf 'set $frontend_upstream %s;\nset $backend_upstream %s;\n' "$FRONTEND" "$BACKEND" > "$TMP"
openresty -t
mv -f "$TMP" "$TARGET"
openresty -t
systemctl reload openresty
echo "active-release=$COLOR"
