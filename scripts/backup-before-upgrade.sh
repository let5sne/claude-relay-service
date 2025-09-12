#!/bin/bash
# Claude Relay Service - 升级前完整备份脚本
# 适用于 Docker Compose 生产环境

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/upgrade-${BACKUP_DATE}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo -e "${BLUE}🔄 Claude Relay Service - 升级前备份开始${NC}"
echo -e "${BLUE}=======================================${NC}"
echo -e "时间: $(date)"
echo -e "备份目录: ${BACKUP_DIR}"
echo ""

# 创建备份目录
mkdir -p "${BACKUP_DIR}"

# 1. 检查Docker服务状态
echo -e "${YELLOW}📊 检查服务状态...${NC}"
if ! docker-compose ps | grep -q "Up"; then
    echo -e "${RED}❌ 警告：服务未运行或状态异常${NC}"
    docker-compose ps
    echo ""
fi

# 2. 备份应用数据（使用内置工具）
echo -e "${YELLOW}📦 备份应用数据...${NC}"
echo "执行数据导出（包含加密数据）..."

# 使用内置的增强备份工具
docker-compose exec -T claude-relay node scripts/data-transfer-enhanced.js export \
    --output="/app/data/backup-upgrade-${BACKUP_DATE}.json" \
    --decrypt=false \
    --types=all

# 将备份文件复制到宿主机
if [ -f "./data/backup-upgrade-${BACKUP_DATE}.json" ]; then
    cp "./data/backup-upgrade-${BACKUP_DATE}.json" "${BACKUP_DIR}/"
    echo -e "${GREEN}✅ 应用数据备份完成${NC}"
else
    echo -e "${RED}❌ 应用数据备份失败${NC}"
    exit 1
fi

# 3. 备份Redis数据卷
echo -e "${YELLOW}💾 备份Redis数据卷...${NC}"

# 触发Redis保存
echo "触发Redis BGSAVE..."
docker-compose exec -T redis redis-cli BGSAVE

# 等待保存完成
echo "等待Redis保存完成..."
sleep 5

# 备份Redis数据目录
if [ -d "./redis_data" ]; then
    echo "备份Redis数据文件..."
    tar -czf "${BACKUP_DIR}/redis-data-${BACKUP_DATE}.tar.gz" -C ./redis_data .
    echo -e "${GREEN}✅ Redis数据备份完成${NC}"
else
    echo -e "${RED}❌ Redis数据目录不存在${NC}"
    exit 1
fi

# 4. 备份配置文件和环境变量
echo -e "${YELLOW}⚙️  备份配置文件...${NC}"

# 备份docker-compose.yml
cp docker-compose.yml "${BACKUP_DIR}/docker-compose.yml.bak"

# 备份.env文件（如果存在）
if [ -f ".env" ]; then
    cp .env "${BACKUP_DIR}/.env.bak"
fi

# 备份config目录（如果存在）
if [ -d "./config" ]; then
    cp -r config "${BACKUP_DIR}/config.bak"
fi

echo -e "${GREEN}✅ 配置文件备份完成${NC}"

# 5. 备份日志文件
echo -e "${YELLOW}📝 备份日志文件...${NC}"
if [ -d "./logs" ]; then
    tar -czf "${BACKUP_DIR}/logs-${BACKUP_DATE}.tar.gz" -C ./logs .
    echo -e "${GREEN}✅ 日志文件备份完成${NC}"
else
    echo -e "${YELLOW}⚠️  日志目录不存在，跳过${NC}"
fi

# 6. 导出Docker镜像（可选）
echo -e "${YELLOW}🐳 导出当前Docker镜像...${NC}"
CURRENT_IMAGE=$(docker-compose config | grep "image:" | head -1 | awk '{print $2}')
if [ ! -z "$CURRENT_IMAGE" ]; then
    echo "导出镜像: $CURRENT_IMAGE"
    docker save "$CURRENT_IMAGE" | gzip > "${BACKUP_DIR}/claude-relay-image-${BACKUP_DATE}.tar.gz"
    echo -e "${GREEN}✅ Docker镜像备份完成${NC}"
else
    echo -e "${YELLOW}⚠️  未找到镜像，跳过导出${NC}"
fi

# 7. 记录系统信息
echo -e "${YELLOW}📋 记录系统信息...${NC}"
cat > "${BACKUP_DIR}/system-info.txt" << EOF
# 升级前系统信息
备份时间: $(date)
系统版本: $(uname -a)
Docker版本: $(docker --version)
Docker Compose版本: $(docker-compose --version)

# 服务状态
EOF

docker-compose ps >> "${BACKUP_DIR}/system-info.txt"

echo "" >> "${BACKUP_DIR}/system-info.txt"
echo "# Docker镜像信息" >> "${BACKUP_DIR}/system-info.txt"
docker-compose config >> "${BACKUP_DIR}/system-info.txt"

# 8. 验证备份完整性
echo -e "${YELLOW}🔍 验证备份完整性...${NC}"

# 检查关键备份文件
CRITICAL_FILES=(
    "backup-upgrade-${BACKUP_DATE}.json"
    "redis-data-${BACKUP_DATE}.tar.gz"
    "docker-compose.yml.bak"
    "system-info.txt"
)

BACKUP_VALID=true
for file in "${CRITICAL_FILES[@]}"; do
    if [ ! -f "${BACKUP_DIR}/${file}" ]; then
        echo -e "${RED}❌ 关键文件缺失: ${file}${NC}"
        BACKUP_VALID=false
    else
        echo -e "${GREEN}✅ ${file}${NC}"
    fi
done

# 检查备份文件大小
JSON_BACKUP="${BACKUP_DIR}/backup-upgrade-${BACKUP_DATE}.json"
if [ -f "$JSON_BACKUP" ]; then
    BACKUP_SIZE=$(stat -f%z "$JSON_BACKUP" 2>/dev/null || stat -c%s "$JSON_BACKUP" 2>/dev/null || echo "0")
    if [ "$BACKUP_SIZE" -lt 1000 ]; then
        echo -e "${RED}❌ 应用数据备份文件过小，可能备份失败${NC}"
        BACKUP_VALID=false
    else
        echo -e "${GREEN}✅ 应用数据备份文件大小: ${BACKUP_SIZE} 字节${NC}"
    fi
fi

# 9. 创建恢复脚本
echo -e "${YELLOW}📜 创建恢复脚本...${NC}"
cat > "${BACKUP_DIR}/restore.sh" << 'EOF'
#!/bin/bash
# 恢复脚本 - 在升级失败时使用

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🔄 开始恢复备份...${NC}"

# 停止服务
echo -e "${YELLOW}🛑 停止服务...${NC}"
docker-compose down

# 恢复配置文件
if [ -f "docker-compose.yml.bak" ]; then
    cp docker-compose.yml.bak ../docker-compose.yml
    echo -e "${GREEN}✅ Docker Compose配置已恢复${NC}"
fi

if [ -f ".env.bak" ]; then
    cp .env.bak ../.env
    echo -e "${GREEN}✅ 环境变量配置已恢复${NC}"
fi

if [ -d "config.bak" ]; then
    rm -rf ../config
    cp -r config.bak ../config
    echo -e "${GREEN}✅ 配置目录已恢复${NC}"
fi

# 恢复Redis数据
echo -e "${YELLOW}💾 恢复Redis数据...${NC}"
if [ -f "redis-data-*.tar.gz" ]; then
    rm -rf ../redis_data/*
    tar -xzf redis-data-*.tar.gz -C ../redis_data/
    echo -e "${GREEN}✅ Redis数据已恢复${NC}"
fi

# 恢复应用数据
echo -e "${YELLOW}📦 恢复应用数据...${NC}"
if [ -f "backup-upgrade-*.json" ]; then
    cp backup-upgrade-*.json ../data/
    echo -e "${GREEN}✅ 应用数据备份文件已复制${NC}"
    echo -e "${YELLOW}⚠️  请手动执行数据导入: docker-compose exec claude-relay node scripts/data-transfer-enhanced.js import --input=/app/data/backup-upgrade-*.json${NC}"
fi

echo -e "${GREEN}🎉 恢复完成！请重新启动服务：docker-compose up -d${NC}"
EOF

chmod +x "${BACKUP_DIR}/restore.sh"
echo -e "${GREEN}✅ 恢复脚本已创建${NC}"

# 10. 生成备份报告
echo -e "${YELLOW}📊 生成备份报告...${NC}"
cat > "${BACKUP_DIR}/backup-report.md" << EOF
# 升级前备份报告

## 备份信息
- **备份时间**: $(date)
- **备份目录**: ${BACKUP_DIR}
- **项目目录**: ${PROJECT_ROOT}

## 备份内容
- ✅ 应用数据 (JSON格式，包含加密数据)
- ✅ Redis数据卷 (tar.gz压缩)
- ✅ Docker Compose配置文件
- ✅ 环境变量文件 (.env)
- ✅ 配置目录
- ✅ 日志文件
- ✅ Docker镜像
- ✅ 系统信息记录

## 文件列表
EOF

ls -la "${BACKUP_DIR}" >> "${BACKUP_DIR}/backup-report.md"

echo "" >> "${BACKUP_DIR}/backup-report.md"
echo "## 恢复说明" >> "${BACKUP_DIR}/backup-report.md"
echo "如果升级失败需要回滚，请执行：" >> "${BACKUP_DIR}/backup-report.md"
echo '```bash' >> "${BACKUP_DIR}/backup-report.md"
echo "cd ${BACKUP_DIR}" >> "${BACKUP_DIR}/backup-report.md"
echo "./restore.sh" >> "${BACKUP_DIR}/backup-report.md"
echo '```' >> "${BACKUP_DIR}/backup-report.md"

# 输出最终结果
echo ""
echo -e "${BLUE}=======================================${NC}"
if [ "$BACKUP_VALID" = true ]; then
    echo -e "${GREEN}🎉 升级前备份完成！${NC}"
    echo -e "${GREEN}✅ 所有关键数据已安全备份${NC}"
    echo ""
    echo -e "${YELLOW}📁 备份位置: ${BACKUP_DIR}${NC}"
    echo -e "${YELLOW}📋 备份报告: ${BACKUP_DIR}/backup-report.md${NC}"
    echo -e "${YELLOW}🔄 恢复脚本: ${BACKUP_DIR}/restore.sh${NC}"
    echo ""
    echo -e "${GREEN}现在可以安全地执行升级操作！${NC}"
else
    echo -e "${RED}❌ 备份过程中发现问题，请检查并重新备份${NC}"
    exit 1
fi
echo -e "${BLUE}=======================================${NC}"