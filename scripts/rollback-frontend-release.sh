#!/usr/bin/env bash
set -euo pipefail

ROOT=${1:?release root required}
CONF=${2:?host vhost path required}
CONTAINER=${3:?openresty container required}
STATE="$ROOT/hot-state-frontend.json"
ACTIVE=$(dirname "$CONF")/myndbbs-frontend-active-upstream.inc
if [ ! -f "$STATE" ]; then
  printf 'server 127.0.0.1:3100;\n' > "$ACTIVE.next"
  mv -f "$ACTIVE.next" "$ACTIVE"
  sudo -n docker exec "$CONTAINER" /usr/local/openresty/bin/openresty -t
  sudo -n docker exec "$CONTAINER" /usr/local/openresty/bin/openresty -s reload
  exit 0
fi
python3 - "$STATE" "$ACTIVE" <<'PY'
import json
from pathlib import Path
import sys
state = json.loads(Path(sys.argv[1]).read_text())
previous = state.get('previous')
port = 3100 if not previous else int(previous.get('port', 3100))
Path(sys.argv[2] + '.next').write_text(f'server 127.0.0.1:{port};\n')
PY
mv -f "$ACTIVE.next" "$ACTIVE"
sudo -n docker exec "$CONTAINER" /usr/local/openresty/bin/openresty -t
sudo -n docker exec "$CONTAINER" /usr/local/openresty/bin/openresty -s reload
CURRENT=$(python3 - "$STATE" <<'PY'
import json
from pathlib import Path
import sys
state = json.loads(Path(sys.argv[1]).read_text())
print(state.get('container', ''))
PY
)
if [ -n "$CURRENT" ]; then docker rm -f "$CURRENT" >/dev/null 2>&1 || true; fi
python3 - "$STATE" <<'PY'
import json
from pathlib import Path
import sys
state = json.loads(Path(sys.argv[1]).read_text())
previous = state.get('previous')
Path(sys.argv[1]).write_text(json.dumps(previous) + '\n' if previous else '')
PY
echo 'frontend-hot-rollback=ok'
