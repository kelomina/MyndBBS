#!/usr/bin/env bash
set -euo pipefail
CONF=${1:?path to rendered OpenResty config required}
CONTAINER=${2:-}
if [ -n "$CONTAINER" ]; then
  sudo -n docker exec "$CONTAINER" /usr/local/openresty/bin/openresty -t -c "$CONF"
else
  openresty -t -c "$CONF"
fi
echo "openresty-config-valid=$CONF"
