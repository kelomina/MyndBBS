#!/bin/bash
set -e

# ============================================================
# MyndBBS - 数据库恢复脚本
# 功能: 从指定的备份文件恢复数据库
# ============================================================

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}==============================================${NC}"
echo -e "${CYAN}  MyndBBS 数据库恢复工具${NC}"
echo -e "${CYAN}==============================================${NC}"
echo ""

# 配置
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-myndbbs-postgres}"
DB_USER="${DB_USER:-myndbbs}"
DB_NAME="${DB_NAME:-myndbbs}"

# 检查参数
if [ $# -ne 1 ]; then
    echo -e "${RED}用法: ./restore-db.sh <备份文件路径>${NC}"
    echo ""
    echo -e "${YELLOW}可用备份:${NC}"

    if [ -d "$BACKUP_DIR" ]; then
        ls -1 "$BACKUP_DIR" | grep "\.sql$" | sort -r | while read -r FILE; do
            echo -e "${GREEN}  - $FILE${NC}"
        done
    fi

    echo ""
    echo -e "${YELLOW}示例: ./restore-db.sh backups/myndbbs_backup_20260519_120000.sql${NC}"
    exit 1
fi

BACKUP_FILE="$1"

# 验证备份文件
if [ ! -s "$BACKUP_FILE" ]; then
    echo -e "${RED}[!] 备份文件不存在或为空: $BACKUP_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}[✓]${NC} 使用备份文件: $BACKUP_FILE"
echo ""

# 警告
echo -e "${RED}警告: 此操作将覆盖现有数据库!${NC}"
read -p "确定要继续吗? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}操作已取消${NC}"
    exit 0
fi

# 检查容器状态
echo -e "${YELLOW}[1/2]${NC} 检查数据库容器状态..."

if ! docker ps --format "{{.Names}}" | grep -q "^${POSTGRES_CONTAINER}$"; then
    echo -e "${RED}[!]${NC} 未找到 ${POSTGRES_CONTAINER} 容器"
    exit 1
fi

# 检查容器是否健康
MAX_WAIT=10
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

echo -e "${GREEN}[✓]${NC} 数据库容器正常"

# 恢复数据库
echo ""
echo -e "${YELLOW}[2/2]${NC} 从备份恢复数据库..."

if docker exec -i "$POSTGRES_CONTAINER" psql -U "$DB_USER" "$DB_NAME" < "$BACKUP_FILE"; then
    echo -e "${GREEN}[✓]${NC} 数据库恢复成功!"
else
    echo -e "${RED}[!]${NC} 恢复失败"
    exit 1
fi

echo ""
echo -e "${CYAN}==============================================${NC}"
echo -e "${GREEN}[✓]${NC} 数据库恢复完成!"
echo -e "${CYAN}==============================================${NC}"
echo ""
