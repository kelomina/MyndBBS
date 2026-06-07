# ============================================================
# MyndBBS - 数据库恢复脚本
# 功能: 从指定的备份文件恢复数据库
# ============================================================
$ErrorActionPreference = "Stop"

# 颜色输出
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

Write-ColorOutput Cyan "=============================================="
Write-ColorOutput Cyan "  MyndBBS 数据库恢复工具"
Write-ColorOutput Cyan "=============================================="
Write-Output ""

# 配置
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackupDir = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { Join-Path $ProjectRoot "data" "backups" }
$PostgresContainer = if ($env:POSTGRES_CONTAINER) { $env:POSTGRES_CONTAINER } else { "myndbbs-postgres" }
$DbUser = if ($env:DB_USER) { $env:DB_USER } else { "myndbbs" }
$DbName = if ($env:DB_NAME) { $env:DB_NAME } else { "myndbbs" }

# 检查参数
if ($args.Count -ne 1) {
    Write-ColorOutput Red "用法: .\restore-db.ps1 <备份文件路径>"
    Write-Output ""
    Write-ColorOutput Yellow "可用备份:"

    if (Test-Path $BackupDir) {
        Get-ChildItem -Path $BackupDir -Filter "*.sql" | Sort-Object LastWriteTime -Descending | ForEach-Object {
            Write-ColorOutput White "  - $($_.Name) (创建于: $($_.LastWriteTime))"
        }
    }
    Write-Output ""
    Write-ColorOutput Yellow "示例: .\restore-db.ps1 ..\data\backups\myndbbs_backup_20260519_120000.sql"
    exit 1
}

$BackupFile = $args[0]

# 验证备份文件
if (-not (Test-Path $BackupFile)) {
    Write-ColorOutput Red "[!] 备份文件不存在: $BackupFile"
    exit 1
}

Write-ColorOutput Green "[✓] 使用备份文件: $BackupFile"
Write-Output ""

# 警告
Write-ColorOutput Red "警告: 此操作将覆盖现有数据库!"
Write-ColorOutput Yellow "确定要继续吗? (Y/N)"
$Confirm = Read-Host
if (-not ($Confirm -eq "Y" -or $Confirm -eq "y")) {
    Write-ColorOutput Yellow "操作已取消"
    exit 0
}

# 检查容器状态
Write-ColorOutput Yellow "[1/2] 检查数据库容器状态..."
$PostgresContainerExists = docker ps -a --filter "name=$PostgresContainer" --format "{{.Names}}" 2>$null
if (-not $PostgresContainerExists) {
    Write-ColorOutput Red "[!] 未找到 $PostgresContainer 容器"
    exit 1
}

# 检查容器是否健康
$IsHealthy = $false
for ($i = 0; $i -lt 5; $i++) {
    $HealthOutput = docker inspect --format='{{.State.Health.Status}}' $PostgresContainer 2>$null
    if ($HealthOutput -eq "healthy") {
        $IsHealthy = $true
        break
    }
    Write-ColorOutput Yellow "    等待数据库健康检查... ($($i+1)/5)"
    Start-Sleep -Seconds 2
}

if (-not $IsHealthy) {
    Write-ColorOutput Red "[!] 数据库容器未处于健康状态"
    exit 1
}

Write-ColorOutput Green "[✓] 数据库容器正常"

# 恢复数据库
Write-Output ""
Write-ColorOutput Yellow "[2/2] 从备份恢复数据库..."
try {
    Get-Content $BackupFile | docker exec -i $PostgresContainer psql -U $DbUser $DbName
    Write-ColorOutput Green "[✓] 数据库恢复成功!"
} catch {
    Write-ColorOutput Red "[!] 恢复失败: $_"
    exit 1
}

Write-Output ""
Write-ColorOutput Cyan "=============================================="
Write-ColorOutput Green "[✓] 数据库恢复完成!"
Write-ColorOutput Cyan "=============================================="
Write-Output ""
