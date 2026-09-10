#!/usr/bin/env bash
set -euo pipefail
CONF=${1:?path to rendered OpenResty config required}
openresty -t -c "$CONF"
echo "openresty-config-valid"
