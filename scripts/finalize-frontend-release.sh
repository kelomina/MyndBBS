#!/usr/bin/env bash
set -euo pipefail

ROOT=${1:?release root required}
STATE="$ROOT/hot-state-frontend.json"
if [ ! -f "$STATE" ]; then
  echo 'frontend release state is missing' >&2
  exit 2
fi

PREVIOUS=$(python3 - "$STATE" <<'PY'
import json
from pathlib import Path
import sys
state = json.loads(Path(sys.argv[1]).read_text())
previous = state.get('previous')
print(previous.get('container', '') if isinstance(previous, dict) else '')
PY
)
if [ -n "$PREVIOUS" ]; then
  docker rm -f "$PREVIOUS" >/dev/null 2>&1 || true
fi
python3 - "$STATE" <<'PY'
import json
from pathlib import Path
import sys
path = Path(sys.argv[1])
state = json.loads(path.read_text())
state['previous'] = None
path.write_text(json.dumps(state, separators=(',', ':')) + '\n')
PY
echo 'frontend-hot-finalize=ok'
