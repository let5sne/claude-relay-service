# Docker 环境数据库迁移指南

本指南专门针对使用 Docker 版本 PostgreSQL 的环境。

## 前置条件

- ✅ Docker 和 Docker Compose 已安装
- ✅ PostgreSQL 容器正在运行
- ✅ 有数据库访问权限

## 快速开始

### 方式1: 使用自动化脚本（推荐）

```bash
# 1. 确保 PostgreSQL 容器正在运行
docker ps | grep postgres

# 2. 执行迁移脚本
./scripts/migrate_cost_tracking.sh

# 脚本会自动：
# - 检查容器状态
# - 备份数据库
# - 执行迁移
# - 验证结果
```

### 方式2: 手动执行

如果需要自定义配置或脚本执行失败，可以手动执行：

```bash
# 1. 设置环境变量（根据实际情况修改）
export DOCKER_CONTAINER="postgres"
export POSTGRES_DB="claude_relay"
export POSTGRES_USER="postgres"

# 2. 备份数据库
docker exec $DOCKER_CONTAINER pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup_$(date +%Y%m%d_%H%M%S).sql

# 3. 执行迁移
docker exec -i $DOCKER_CONTAINER psql -U $POSTGRES_USER -d $POSTGRES_DB < sql/migrations/0004_enhanced_cost_tracking.sql

# 4. 验证迁移
docker exec $DOCKER_CONTAINER psql -U $POSTGRES_USER -d $POSTGRES_DB -c "\d cost_validation_history"
docker exec $DOCKER_CONTAINER psql -U $POSTGRES_USER -d $POSTGRES_DB -c "\d pricing_inference_history"
```

## 配置说明

### 环境变量

脚本支持以下环境变量配置：

| 变量名               | 默认值         | 说明                |
| -------------------- | -------------- | ------------------- |
| `POSTGRES_CONTAINER` | `postgres`     | PostgreSQL 容器名称 |
| `POSTGRES_DB`        | `claude_relay` | 数据库名称          |
| `POSTGRES_USER`      | `postgres`     | 数据库用户名        |

### 查找容器名称

如果不确定容器名称，可以使用以下命令查找：

```bash
# 列出所有运行中的容器
docker ps

# 查找 PostgreSQL 容器
docker ps | grep postgres

# 或使用 docker-compose
docker-compose ps
```

### 常见容器名称

- `postgres`
- `claude-relay-postgres`
- `claude-relay-service_postgres_1`
- `项目名_postgres_1`

## Docker Compose 配置示例

如果您的项目使用 Docker Compose，确保配置类似：

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14
    container_name: postgres # 容器名称
    environment:
      POSTGRES_DB: claude_relay
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: your_password
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./sql/migrations:/migrations # 挂载迁移文件
    restart: unless-stopped

volumes:
  postgres_data:
```

## 详细步骤

### 步骤1: 检查 Docker 环境

```bash
# 检查 Docker 是否运行
docker --version

# 检查 PostgreSQL 容器状态
docker ps | grep postgres

# 如果容器未运行，启动它
docker-compose up -d postgres
# 或
docker start postgres
```

### 步骤2: 连接测试

```bash
# 测试数据库连接
docker exec -it postgres psql -U postgres -d claude_relay -c "SELECT version();"

# 查看现有表
docker exec -it postgres psql -U postgres -d claude_relay -c "\dt"
```

### 步骤3: 备份数据库

```bash
# 创建备份目录
mkdir -p backups

# 备份数据库
docker exec postgres pg_dump -U postgres claude_relay > backups/backup_$(date +%Y%m%d_%H%M%S).sql

# 验证备份文件
ls -lh backups/
```

### 步骤4: 执行迁移

```bash
# 方式1: 使用脚本
./scripts/migrate_cost_tracking.sh

# 方式2: 直接执行 SQL
docker exec -i postgres psql -U postgres -d claude_relay < sql/migrations/0004_enhanced_cost_tracking.sql
```

### 步骤5: 验证迁移

```bash
# 检查新表
docker exec postgres psql -U postgres -d claude_relay -c "\d cost_validation_history"
docker exec postgres psql -U postgres -d claude_relay -c "\d pricing_inference_history"

# 检查新字段
docker exec postgres psql -U postgres -d claude_relay -c "\d account_cost_profiles"
docker exec postgres psql -U postgres -d claude_relay -c "\d usage_records"

# 检查视图
docker exec postgres psql -U postgres -d claude_relay -c "\d v_account_cost_accuracy"

# 查看所有表
docker exec postgres psql -U postgres -d claude_relay -c "\dt"
```

## 故障排除

### 问题1: 容器未运行

**错误信息**:

```
Error: Docker 容器 'postgres' 未运行
```

**解决方案**:

```bash
# 启动容器
docker-compose up -d postgres

# 或
docker start postgres

# 查看日志
docker logs postgres
```

### 问题2: 权限不足

**错误信息**:

```
permission denied for database
```

**解决方案**:

```bash
# 使用超级用户执行
docker exec -i postgres psql -U postgres -d claude_relay < sql/migrations/0004_enhanced_cost_tracking.sql

# 或授予权限
docker exec postgres psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE claude_relay TO your_user;"
```

### 问题3: 迁移文件找不到

**错误信息**:

```
No such file or directory
```

**解决方案**:

```bash
# 检查文件路径
ls -l sql/migrations/0004_enhanced_cost_tracking.sql

# 使用绝对路径
docker exec -i postgres psql -U postgres -d claude_relay < /path/to/sql/migrations/0004_enhanced_cost_tracking.sql
```

### 问题4: 表已存在

**错误信息**:

```
ERROR: relation "cost_validation_history" already exists
```

**解决方案**:

这说明迁移已经执行过了。如果需要重新执行：

```bash
# 1. 删除已创建的表（谨慎操作！）
docker exec postgres psql -U postgres -d claude_relay -c "DROP TABLE IF EXISTS cost_validation_history CASCADE;"
docker exec postgres psql -U postgres -d claude_relay -c "DROP TABLE IF EXISTS pricing_inference_history CASCADE;"

# 2. 重新执行迁移
docker exec -i postgres psql -U postgres -d claude_relay < sql/migrations/0004_enhanced_cost_tracking.sql
```

### 问题5: 连接超时

**解决方案**:

```bash
# 检查容器网络
docker network ls
docker network inspect bridge

# 重启容器
docker-compose restart postgres

# 检查端口映射
docker port postgres
```

## 回滚操作

如果迁移出现问题，可以回滚到备份：

```bash
# 1. 找到备份文件
ls -lh backups/

# 2. 恢复数据库
docker exec -i postgres psql -U postgres -d claude_relay < backups/backup_20251001_024600.sql

# 3. 验证恢复
docker exec postgres psql -U postgres -d claude_relay -c "\dt"
```

## 高级操作

### 在容器内执行迁移

如果需要在容器内部执行：

```bash
# 1. 进入容器
docker exec -it postgres bash

# 2. 在容器内执行
psql -U postgres -d claude_relay -f /migrations/0004_enhanced_cost_tracking.sql

# 3. 退出容器
exit
```

### 使用 Docker Volume 挂载

```bash
# 1. 挂载迁移文件到容器
docker run -v $(pwd)/sql/migrations:/migrations postgres

# 2. 或在 docker-compose.yml 中配置
volumes:
  - ./sql/migrations:/migrations
```

### 查看迁移日志

```bash
# 执行迁移并保存日志
docker exec -i postgres psql -U postgres -d claude_relay < sql/migrations/0004_enhanced_cost_tracking.sql 2>&1 | tee migration.log

# 查看日志
cat migration.log
```

## 验证清单

执行完迁移后，请检查以下内容：

- [ ] `cost_validation_history` 表已创建
- [ ] `pricing_inference_history` 表已创建
- [ ] `account_cost_profiles` 表新增8个字段
- [ ] `usage_records` 表新增4个字段
- [ ] `v_account_cost_accuracy` 视图已创建
- [ ] `calculate_cost_deviation` 函数已创建
- [ ] 所有索引已创建
- [ ] 数据迁移成功（现有数据未丢失）

### 验证命令

```bash
# 完整验证脚本
cat << 'EOF' > verify_migration.sh
#!/bin/bash
CONTAINER="postgres"
USER="postgres"
DB="claude_relay"

echo "验证迁移结果..."
echo ""

echo "1. 检查 cost_validation_history 表"
docker exec $CONTAINER psql -U $USER -d $DB -c "\d cost_validation_history" > /dev/null 2>&1 && echo "✓" || echo "✗"

echo "2. 检查 pricing_inference_history 表"
docker exec $CONTAINER psql -U $USER -d $DB -c "\d pricing_inference_history" > /dev/null 2>&1 && echo "✓" || echo "✗"

echo "3. 检查 account_cost_profiles 新字段"
docker exec $CONTAINER psql -U $USER -d $DB -c "\d account_cost_profiles" | grep -q "pricing_formula" && echo "✓" || echo "✗"

echo "4. 检查 usage_records 新字段"
docker exec $CONTAINER psql -U $USER -d $DB -c "\d usage_records" | grep -q "calculation_method" && echo "✓" || echo "✗"

echo "5. 检查 v_account_cost_accuracy 视图"
docker exec $CONTAINER psql -U $USER -d $DB -c "\d v_account_cost_accuracy" > /dev/null 2>&1 && echo "✓" || echo "✗"

echo ""
echo "验证完成！"
EOF

chmod +x verify_migration.sh
./verify_migration.sh
```

## 下一步

迁移完成后：

1. **重启应用服务**

   ```bash
   docker-compose restart app
   # 或
   pm2 restart claude-relay-service
   ```

2. **测试新功能**

   ```bash
   # 测试 API 端点
   curl http://localhost:3000/api/admin/accounts/test-account/cost-profile
   ```

3. **查看文档**
   - 阅读 `docs/COST_TRACKING_GUIDE.md` 了解如何使用
   - 参考 `examples/cost_tracking_examples.js` 查看示例

## 监控

迁移后建议监控以下指标：

```bash
# 查看表大小
docker exec postgres psql -U postgres -d claude_relay -c "
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"

# 查看活动连接
docker exec postgres psql -U postgres -d claude_relay -c "SELECT * FROM pg_stat_activity;"

# 查看数据库大小
docker exec postgres psql -U postgres -c "SELECT pg_size_pretty(pg_database_size('claude_relay'));"
```

## 支持

如有问题，请：

1. 查看日志: `docker logs postgres`
2. 检查备份文件是否完整
3. 参考故障排除章节
4. 提交 Issue 并附上错误信息

---

**最后更新**: 2025-10-01  
**适用版本**: PostgreSQL 12+, Docker 20+
