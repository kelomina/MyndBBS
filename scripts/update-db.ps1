# ============================================================
# MyndBBS - 数据库更新脚本 (Windows 本地开发环境)
# 功能: 备份数据库 -> 应用迁移 -> 验证
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
Write-ColorOutput Cyan "  MyndBBS 数据库更新工具"
Write-ColorOutput Cyan "=============================================="
Write-Output ""

# 配置
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $ProjectRoot "packages" "backend"
$BackupDir = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { Join-Path $ProjectRoot "data" "backups" }
$PostgresContainer = if ($env:POSTGRES_CONTAINER) { $env:POSTGRES_CONTAINER } else { "myndbbs-postgres" }
$DbUser = if ($env:DB_USER) { $env:DB_USER } else { "myndbbs" }
$DbName = if ($env:DB_NAME) { $env:DB_NAME } else { "myndbbs" }
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

# 创建备份目录
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    Write-ColorOutput Green "[✓] 创建备份目录: $BackupDir"
}

# 步骤 1: 检查并启动 Docker 容器 (如果需要)
Write-ColorOutput Yellow "[1/4] 检查数据库容器状态..."
$PostgresContainerExists = docker ps -a --filter "name=$PostgresContainer" --format "{{.Names}}" 2>$null
if (-not $PostgresContainerExists) {
    Write-ColorOutput Red "[!] 未找到 $PostgresContainer 容器"
    Write-ColorOutput Yellow "    尝试启动 Docker Compose..."

    if (Test-Path (Join-Path $ProjectRoot "docker-compose.yml")) {
        Push-Location $ProjectRoot
        docker compose up -d postgres
        Start-Sleep -Seconds 5
        Pop-Location
    } else {
        Write-ColorOutput Red "[!] 找不到 docker-compose.yml"
        exit 1
    }
}

# 检查容器是否健康
$IsHealthy = $false
for ($i = 0; $i -lt 10; $i++) {
    $HealthOutput = docker inspect --format='{{.State.Health.Status}}' $PostgresContainer 2>$null
    if ($HealthOutput -eq "healthy") {
        $IsHealthy = $true
        break
    }
    Write-ColorOutput Yellow "    等待数据库健康检查... ($($i+1)/10)"
    Start-Sleep -Seconds 2
}

if (-not $IsHealthy) {
    Write-ColorOutput Red "[!] 数据库容器未处于健康状态"
    exit 1
}

Write-ColorOutput Green "[✓] 数据库容器运行正常"

# 步骤 2: 备份数据库
Write-Output ""
Write-ColorOutput Yellow "[2/4] 备份数据库..."
$BackupFile = Join-Path $BackupDir "${DbName}_backup_$Timestamp.sql"

try {
    docker exec -i $PostgresContainer pg_dump -U $DbUser $DbName > $BackupFile
    Write-ColorOutput Green "[✓] 数据库已备份到: $BackupFile"
} catch {
    Write-ColorOutput Red "[!] 备份失败: $_"
    exit 1
}

# 验证备份文件
if (-not (Test-Path $BackupFile) -or (Get-Item $BackupFile).Length -eq 0) {
    Write-ColorOutput Red "[!] 备份文件为空或不存在"
    exit 1
}

$BackupSize = [math]::Round((Get-Item $BackupFile).Length / 1KB, 2)
Write-ColorOutput Green "    备份大小: ${BackupSize}KB"

# 步骤 3: 应用 Prisma 迁移
Write-Output ""
Write-ColorOutput Yellow "[3/4] 应用数据库迁移..."

# 检查是否有新迁移
$MigrationDir = Join-Path $BackendDir "prisma" "migrations"
if (-not (Test-Path $MigrationDir)) {
    Write-ColorOutput Red "[!] 找不到迁移目录"
    exit 1
}

Push-Location $BackendDir

try {
    pnpm migrate:deploy
    Write-ColorOutput Green "[✓] 数据库迁移完成"
} catch {
    Write-ColorOutput Red "[!] 迁移失败"
    Write-ColorOutput Yellow "    是否要从备份恢复? (Y/N)"
    $Choice = Read-Host
    if ($Choice -eq "Y" -or $Choice -eq "y") {
        Write-ColorOutput Yellow "    正在从备份恢复..."
        Get-Content $BackupFile | docker exec -i $PostgresContainer psql -U $DbUser $DbName
        Write-ColorOutput Green "[✓] 已从备份恢复数据库"
    }
    Pop-Location
    exit 1
}

Pop-Location

# 步骤 4: 完成
Write-Output ""
Write-ColorOutput Cyan "=============================================="
Write-ColorOutput Green "[✓] 数据库更新完成!"
Write-ColorOutput Cyan "=============================================="
Write-Output ""
Write-ColorOutput Yellow "备份文件保留在: $BackupFile"
Write-Output ""
Write-ColorOutput Yellow "如需从备份恢复，请使用:"
Write-ColorOutput White "  Get-Content $BackupFile | docker exec -i $PostgresContainer psql -U $DbUser $DbName"
Write-Output ""
