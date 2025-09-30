#!/bin/bash

# 成本追踪功能数据库迁移脚本
# 适用于 Docker 版本的 PostgreSQL

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MIGRATION_FILE="$PROJECT_ROOT/sql/migrations/0004_enhanced_cost_tracking.sql"

# 从环境变量或默认值获取配置
DOCKER_CONTAINER="${POSTGRES_CONTAINER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-claude_relay}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}成本追踪功能数据库迁移${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查 Docker 容器是否运行
echo -e "${YELLOW}1. 检查 Docker 容器状态...${NC}"
if ! docker ps | grep -q "$DOCKER_CONTAINER"; then
    echo -e "${RED}错误: Docker 容器 '$DOCKER_CONTAINER' 未运行${NC}"
    echo -e "${YELLOW}提示: 请先启动 PostgreSQL 容器${NC}"
    echo -e "${YELLOW}      docker-compose up -d postgres${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker 容器运行正常${NC}"
echo ""

# 检查迁移文件是否存在
echo -e "${YELLOW}2. 检查迁移文件...${NC}"
if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}错误: 迁移文件不存在: $MIGRATION_FILE${NC}"
    exit 1
fi
echo -e "${GREEN}✓ 迁移文件存在${NC}"
echo ""

# 备份数据库
echo -e "${YELLOW}3. 备份数据库...${NC}"
BACKUP_FILE="$PROJECT_ROOT/backup_$(date +%Y%m%d_%H%M%S).sql"
docker exec "$DOCKER_CONTAINER" pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$BACKUP_FILE"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 数据库备份成功: $BACKUP_FILE${NC}"
else
    echo -e "${RED}错误: 数据库备份失败${NC}"
    exit 1
fi
echo ""

# 执行迁移
echo -e "${YELLOW}4. 执行数据库迁移...${NC}"
docker exec -i "$DOCKER_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$MIGRATION_FILE"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 数据库迁移成功${NC}"
else
    echo -e "${RED}错误: 数据库迁移失败${NC}"
    echo -e "${YELLOW}提示: 可以使用备份文件恢复: $BACKUP_FILE${NC}"
    exit 1
fi
echo ""

# 验证迁移
echo -e "${YELLOW}5. 验证迁移结果...${NC}"

# 检查新表是否创建
echo -e "  检查 cost_validation_history 表..."
docker exec "$DOCKER_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\d cost_validation_history" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}  ✓ cost_validation_history 表已创建${NC}"
else
    echo -e "${RED}  ✗ cost_validation_history 表创建失败${NC}"
fi

echo -e "  检查 pricing_inference_history 表..."
docker exec "$DOCKER_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\d pricing_inference_history" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}  ✓ pricing_inference_history 表已创建${NC}"
else
    echo -e "${RED}  ✗ pricing_inference_history 表创建失败${NC}"
fi

# 检查新字段是否添加
echo -e "  检查 account_cost_profiles 新字段..."
docker exec "$DOCKER_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\d account_cost_profiles" | grep -q "pricing_formula"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}  ✓ account_cost_profiles 新字段已添加${NC}"
else
    echo -e "${RED}  ✗ account_cost_profiles 新字段添加失败${NC}"
fi

echo -e "  检查 usage_records 新字段..."
docker exec "$DOCKER_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\d usage_records" | grep -q "calculation_method"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}  ✓ usage_records 新字段已添加${NC}"
else
    echo -e "${RED}  ✗ usage_records 新字段添加失败${NC}"
fi

# 检查视图是否创建
echo -e "  检查 v_account_cost_accuracy 视图..."
docker exec "$DOCKER_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\d v_account_cost_accuracy" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}  ✓ v_account_cost_accuracy 视图已创建${NC}"
else
    echo -e "${RED}  ✗ v_account_cost_accuracy 视图创建失败${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}迁移完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}备份文件位置: $BACKUP_FILE${NC}"
echo -e "${YELLOW}如需回滚，请执行:${NC}"
echo -e "${YELLOW}  docker exec -i $DOCKER_CONTAINER psql -U $POSTGRES_USER -d $POSTGRES_DB < $BACKUP_FILE${NC}"
echo ""
