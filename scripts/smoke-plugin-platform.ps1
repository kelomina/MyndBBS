$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $workspace
function Invoke-PluginCheck([string]$Name, [scriptblock]$Check) {
  Write-Host "
=== $Name ==="
  & $Check
  if ($LASTEXITCODE -ne 0) { throw "$Name failed (exit $LASTEXITCODE)" }
}
try {
  Invoke-PluginCheck 'Plugin YAML/socket configuration' { node ops/plugins/smoke-config.cjs }
  Invoke-PluginCheck 'Backend build + Prisma client' { pnpm --filter backend run build }
  Invoke-PluginCheck 'Plugin contracts/config/events/gateway only' {
    pnpm --filter backend exec jest --runInBand --runTestsByPath tests/PluginManifest.test.ts tests/PluginManager.test.ts tests/PluginGateway.test.ts tests/PluginConfig.test.ts tests/PluginEventCatalog.test.ts tests/PluginEventBridge.test.ts
  }
  Invoke-PluginCheck 'Plugin HTTP API and isolated runtime smoke' {
    node --test packages/backend/tests/plugin-platform-api.smoke.test.js packages/backend/tests/plugin-control.test.mjs packages/backend/tests/plugin-host.test.mjs packages/backend/tests/plugin-supervisor.test.mjs packages/backend/tests/plugin-contract-parity.test.mjs
  }
  Invoke-PluginCheck 'Offline signed package smoke' { node ops/plugins/smoke-package.mjs }
  Invoke-PluginCheck 'Frontend TypeScript' { pnpm --filter frontend exec tsc --noEmit }
  Invoke-PluginCheck 'Rendered plugin admin UI smoke' { node packages/frontend/tests/plugin-platform.smoke.mjs }
  Write-Host '
PASS: targeted plugin platform checks. No live database migration, Docker deployment, or production verification performed.'
} finally { Pop-Location }
