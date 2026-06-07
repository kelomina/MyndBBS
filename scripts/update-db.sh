#!/bin/bash
set -e

# ============================================================
# MyndBBS - 数据库更新脚本 (Linux 环境)
# 功能: 备份数据库 -> 应用迁移 -> 验证
# ============================================================

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}==============================================${NC}"
echo -e "${CYAN}  MyndBBS 数据库更新工具${NC}"
echo -e "${CYAN}==============================================${NC}"
echo ""

# 配置
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/${DB_NAME:-myndbbs}_backup_${TIMESTAMP}.sql"
DOCKER_COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-myndbbs-postgres}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-myndbbs-backend}"
DB_USER="${DB_USER:-myndbbs}"
DB_NAME="${DB_NAME:-myndbbs}"

# 创建备份目录
mkdir -p "$BACKUP_DIR"
echo -e "${GREEN}[✓]${NC} 备份目录: $BACKUP_DIR"

# 步骤 1: 检查数据库容器状态
echo ""
echo -e "${YELLOW}[1/4]${NC} 检查数据库容器状态..."

if ! docker ps --format "{{.Names}}" | grep -q "^${POSTGRES_CONTAINER}$"; then
    echo -e "${RED}[!]${NC} ${POSTGRES_CONTAINER} 容器未运行"
    if [ -f "$DOCKER_COMPOSE_FILE" ]; then
        echo -e "${YELLOW}    尝试启动容器...${NC}"
        cd "$PROJECT_ROOT"
        docker compose up -d postgres
        sleep 5
    else
        echo -e "${RED}[!]${NC} 找不到 $DOCKER_COMPOSE_FILE"
        exit 1
    fi
fi

# 等待容器健康
MAX_WAIT=30
WAIT_COUNT=0
HEALTHY=false
while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$POSTGRES_CONTAINER" 2>/dev/null || echo "unhealthy")
    if [ "$STATUS" = "healthy" ]; then
        HEALTHY=true
        break
    fi
    echo -e "${YELLOW}    等待数据库健康检查... ($((WAIT_COUNT+1))/$MAX_WAIT)${NC}"
    sleep 2
    WAIT_COUNT=$((WAIT_COUNT+1))
done

if [ "$HEALTHY" = false ]; then
    echo -e "${RED}[!]${NC} 数据库容器未处于健康状态"
    exit 1
fi

echo -e "${GREEN}[✓]${NC} 数据库容器运行正常"

# 步骤 2: 备份数据库
echo ""
echo -e "${YELLOW}[2/4]${NC} 备份数据库..."

if docker exec -i "$POSTGRES_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE"; then
    echo -e "${GREEN}[✓]${NC} 数据库已备份到: $BACKUP_FILE"
else
    echo -e "${RED}[!]${NC} 备份失败"
    exit 1
fi

# 验证备份文件
if [ ! -s "$BACKUP_FILE" ]; then
    echo -e "${RED}[!]${NC} 备份文件为空"
    exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo -e "${GREEN}    备份大小: ${BACKUP_SIZE}${NC}"

# 步骤 3: 应用 Prisma 迁移
echo ""
echo -e "${YELLOW}[3/4]${NC} 应用数据库迁移..."

cd "$PROJECT_ROOT"

# 检查后端容器是否运行
if docker ps --format "{{.Names}}" | grep -q "^${BACKEND_CONTAINER}$"; then
    echo -e "${YELLOW}    使用后端容器执行迁移...${NC}"
    
    if docker exec -i "$BACKEND_CONTAINER" /app/node_modules/.bin/prisma migrate deploy; then
        echo -e "${GREEN}[✓]${NC} 数据库迁移完成"
    else
        echo -e "${RED}[!]${NC} 迁移失败"
        echo ""
        read -p "是否要从备份恢复? (y/N) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${YELLOW}    正在从备份恢复...${NC}"
            docker exec -i "$POSTGRES_CONTAINER" psql -U "$DB_USER" "$DB_NAME" < "$BACKUP_FILE"
            echo -e "${GREEN}[✓]${NC} 已从备份恢复数据库"
        fi
        exit 1
    fi
else
    echo -e "${YELLOW}[!]${NC} 后端容器未运行"
    echo -e "${YELLOW}    请确保后端容器已启动后重新运行此脚本${NC}"
    exit 1
fi

# 步骤 4: 完成
echo ""
echo -e "${CYAN}==============================================${NC}"
echo -e "${GREEN}[✓]${NC} 数据库更新完成!"
echo -e "${CYAN}==============================================${NC}"
echo ""
echo -e "${YELLOW}备份文件保留在: $BACKUP_FILE${NC}"
echo ""
echo -e "${YELLOW}如需从备份恢复，请使用:${NC}"
echo -e "${GREEN}  docker exec -i $POSTGRES_CONTAINER psql -U $DB_USER $DB_NAME < $BACKUP_FILE${NC}"
echo ""
