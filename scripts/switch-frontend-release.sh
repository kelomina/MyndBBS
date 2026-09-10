#!/usr/bin/env bash
set -euo pipefail
ROOT=${1:?release root required}
VERSION=${2:?version required}
RELEASE="$ROOT/releases/$VERSION"
CURRENT="$ROOT/current"
test -d "$RELEASE"
test -f "$RELEASE/manifest.json"
ln -sfn "$RELEASE" "$ROOT/.current.next"
mv -Tf "$ROOT/.current.next" "$CURRENT"
echo "frontend-current=$VERSION"
