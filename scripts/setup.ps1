# MyndBBS script template setup.
# Creates the default local backup directory used by the database scripts.

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackupDir = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { Join-Path $ProjectRoot "data" "backups" }

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

Write-Host "MyndBBS script templates are ready." -ForegroundColor Green
Write-Host ""
Write-Host "Backup directory:" -ForegroundColor Cyan
Write-Host "  $BackupDir" -ForegroundColor White
Write-Host ""
Write-Host "Database scripts:" -ForegroundColor Cyan
Write-Host "  pnpm db:update-win" -ForegroundColor White
Write-Host "  pnpm db:restore-win <backup-file>" -ForegroundColor White
Write-Host ""
Write-Host "Deployment template:" -ForegroundColor Cyan
Write-Host "  Set DEPLOY_SSH_HOST, DEPLOY_SSH_USER, DEPLOY_DIR and DEPLOY_PUBLIC_URL before running scripts\deploy.sh." -ForegroundColor White
Write-Host ""
Write-Host "See scripts\README.md for details." -ForegroundColor Gray
