param([string]$ReportDir)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
if (-not $ReportDir) {
  $ReportDir = Join-Path $Root ('reports/human-verification-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
}
$ReportDir = [System.IO.Path]::GetFullPath($ReportDir)
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
function Invoke-SmokeStep([string]$Name, [string]$Directory, [string]$Command, [string[]]$Arguments) {
  Push-Location -LiteralPath $Directory
  try {
    Write-Host ('--- ' + $Name + ' ---')
    $Log = Join-Path $ReportDir ($Name + '.log')
    ('cwd=' + $Directory + [Environment]::NewLine + $Command + ' ' + ($Arguments -join ' ')) | Set-Content -LiteralPath $Log -Encoding utf8
    & $Command @Arguments 2>&1 | Tee-Object -FilePath $Log -Append
    $Exit = $LASTEXITCODE
    ('exit=' + $Exit) | Add-Content -LiteralPath $Log -Encoding utf8
    if ($Exit -ne 0) { throw ($Name + ' failed with exit ' + $Exit) }
  } finally { Pop-Location }
}
# Targeted local smoke only. This never connects to production, signs a real release,
# changes trust, applies migrations, or claims real Redis/Docker isolation acceptance.
Invoke-SmokeStep 'backend-build' $Root 'pnpm' @('--filter', 'backend', 'build')
Invoke-SmokeStep 'backend-http-plugin' (Join-Path $Root 'packages/backend') 'node' @(
  '--test', 'tests/human-verification.smoke.test.mjs',
  'tests/bundled-human-verification-plugin.test.mjs',
  'tests/plugin-contract-parity.test.mjs', 'tests/plugin-control.test.mjs')
Invoke-SmokeStep 'business-gates' (Join-Path $Root 'packages/backend') 'pnpm' @(
  'exec', 'jest', '--runInBand', '--runTestsByPath', 'tests/HumanVerificationBusinessGates.test.ts',
  'tests/authRoutes.test.ts', 'tests/rateLimit.test.ts')
Invoke-SmokeStep 'frontend-types' $Root 'pnpm' @('--filter', 'frontend', 'exec', 'tsc', '--noEmit')
Invoke-SmokeStep 'frontend-contract' (Join-Path $Root 'packages/frontend') 'node' @(
  '--test', '--test-isolation=none', 'tests/humanVerification.contract.test.mjs',
  'tests/captchaDialog.layout.test.mjs', 'tests/captchaProtection.ui.test.mjs',
  'tests/federalCaptcha.ui.test.mjs', 'tests/rateLimitUnlock.ui.test.mjs')
Write-Host ('PASS: local targeted build/HTTP/plugin/contract smoke. Reports: ' + $ReportDir)
Write-Host 'Not validated here: production, real Redis Lua/persistence, Docker, or full browser user journeys.'
