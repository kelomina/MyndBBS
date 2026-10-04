#!/usr/bin/env bash
# Kept as an explicit fail-closed tombstone for old automation. No extraction,
# state writes, Docker invocation, approval, or activation is permitted here.
set -euo pipefail
printf '%s\n' 'Direct plugin installation is disabled for MyndBBS plugin platform v2.' >&2
printf '%s\n' 'Package with scripts/package-plugin-release.mjs; upload tar.gz + binary .sig + .sha256 through Admin / Plugins.' >&2
printf '%s\n' 'A SUPER_ADMIN with sudo must approve the exact version/digest and activate via the supervisor control plane.' >&2
exit 64
