# 🗄️ 数据库迁移指南 - Docker 版本

## 📋 本次更新涉及的数据库变更

### 迁移文件

- **文件**: `sql/migrations/0005_fix_account_id_type.sql`
- **目的**: 修复账户 ID 类型（UUID → TEXT）
- **影响**: 支持非 UUID 格式的账户 ID

### 变更内容

```sql
-- 主要变更：
1. accounts.id: UUID → TEXT
2. api_keys.id: UUID → TEXT
3. 所有关联表的外键字段: UUID → TEXT
4. 重建外键约束
5. 重建视图
```

---

## 🚀 Docker 版本迁移步骤

### 方式一：自动迁移（推荐）

Docker 容器启动时会自动运行迁移脚本。

#### 1. 备份数据库（重要！）

```bash
# 进入项目目录
cd /path/to/claude-relay-service

# 备份数据库
docker-compose exec postgres pg_dump -U postgres claude_relay > backup_$(date +%Y%m%d_%H%M%S).sql

# 或者备份整个数据目录
docker-compose exec postgres pg_dumpall -U postgres > backup_all_$(date +%Y%m%d_%H%M%S).sql
```

#### 2. 拉取最新镜像

```bash
# 拉取最新代码和镜像
git pull origin main
docker-compose pull
```

#### 3. 重启服务

```bash
# 停止服务
docker-compose down

# 启动服务（会自动运行迁移）
docker-compose up -d

# 查看日志确认迁移成功
docker-compose logs -f app
```

**查找迁移日志**：

```bash
# 查看迁移相关日志
docker-compose logs app | grep -i migration
docker-compose logs app | grep "0005_fix_account_id_type"

# 应该看到：
# ✅ Migration applied: 0005_fix_account_id_type.sql
```

---

### 方式二：手动运行迁移

如果自动迁移失败或需要手动控制：

#### 1. 进入容器

```bash
# 进入应用容器
docker-compose exec app bash

# 或者直接运行迁移命令
docker-compose exec app node scripts/pg-migrate.js
```

#### 2. 运行迁移脚本

```bash
# 在容器内执行
node scripts/pg-migrate.js

# 查看可用的迁移
node scripts/pg-migrate.js --list

# 干运行（查看将要执行的 SQL）
node scripts/pg-migrate.js --dry-run
```

#### 3. 验证迁移

```bash
# 检查迁移记录
docker-compose exec postgres psql -U postgres -d claude_relay -c "SELECT * FROM schema_migrations ORDER BY applied_at DESC;"

# 应该看到：
#              name              |         applied_at
# -------------------------------+----------------------------
#  0005_fix_account_id_type.sql | 2025-10-05 02:20:00.123456
#  0004_enhanced_cost_tracking.sql | ...
```

---

### 方式三：直接执行 SQL（高级）

如果需要直接在数据库中执行：

#### 1. 连接到数据库

```bash
# 方式 1: 使用 psql
docker-compose exec postgres psql -U postgres -d claude_relay

# 方式 2: 使用外部工具（如 DBeaver, pgAdmin）
# Host: localhost
# Port: 5432 (或 docker-compose.yml 中配置的端口)
# Database: claude_relay
# User: postgres
# Password: (你的密码)
```

#### 2. 执行迁移 SQL

```bash
# 在容器内执行
docker-compose exec postgres psql -U postgres -d claude_relay -f /app/sql/migrations/0005_fix_account_id_type.sql

# 或者从宿主机执行
docker-compose exec -T postgres psql -U postgres -d claude_relay < sql/migrations/0005_fix_account_id_type.sql
```

---

## ✅ 验证迁移成功

### 1. 检查表结构

```bash
# 进入数据库
docker-compose exec postgres psql -U postgres -d claude_relay

# 检查 accounts 表
\d accounts

# 应该看到：
# id | text | not null
# (而不是 uuid)
```

```sql
-- 或者使用 SQL 查询
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'accounts'
  AND column_name = 'id';

-- 结果应该是：
-- column_name | data_type | is_nullable
-- ------------+-----------+-------------
-- id          | text      | NO
```

### 2. 检查迁移记录

```sql
SELECT * FROM schema_migrations
WHERE name = '0005_fix_account_id_type.sql';

-- 应该返回一条记录
```

### 3. 测试应用功能

```bash
# 查看应用日志
docker-compose logs -f app

# 发起测试请求
curl -X POST http://localhost:3000/api/v1/messages \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-3-5-haiku-20241022","messages":[{"role":"user","content":"Hello"}]}'

# 检查统计数据
# 访问: http://localhost:3000/admin-next/analytics
```

---

## 🔄 回滚迁移（如果需要）

### 1. 恢复备份

```bash
# 停止服务
docker-compose down

# 恢复数据库
docker-compose up -d postgres
docker-compose exec -T postgres psql -U postgres -d claude_relay < backup_20251005_020000.sql

# 或者恢复整个数据库
docker-compose exec -T postgres psql -U postgres < backup_all_20251005_020000.sql
```

### 2. 使用旧版本镜像

```bash
# 修改 docker-compose.yml
# image: let5see/claude-relay-service:v1.1.174

# 或者直接指定
docker-compose down
docker pull let5see/claude-relay-service:v1.1.174
docker run -d --name claude-relay let5see/claude-relay-service:v1.1.174
```

---

## 📊 迁移检查清单

在迁移前后，确认以下项目：

### 迁移前

- [ ] ✅ 已备份数据库
- [ ] ✅ 已记录当前版本号
- [ ] ✅ 已停止应用服务
- [ ] ✅ 已通知用户（如果是生产环境）

### 迁移后

- [ ] ✅ 迁移脚本执行成功
- [ ] ✅ 表结构正确（id 字段为 TEXT）
- [ ] ✅ 数据完整性检查
- [ ] ✅ 应用启动成功
- [ ] ✅ 功能测试通过
- [ ] ✅ 统计数据准确

---

## 🔧 常见问题

### 问题 1: 迁移脚本未自动运行

**原因**: 可能是环境变量配置问题

**解决**:

```bash
# 检查环境变量
docker-compose exec app env | grep POSTGRES

# 确认 PostgreSQL 配置
# POSTGRES_ENABLED=true
# POSTGRES_HOST=postgres
# POSTGRES_PORT=5432
# POSTGRES_DB=claude_relay
# POSTGRES_USER=postgres
# POSTGRES_PASSWORD=your_password

# 手动运行迁移
docker-compose exec app node scripts/pg-migrate.js
```

### 问题 2: 迁移失败 - 外键约束错误

**原因**: 可能有不一致的数据

**解决**:

```sql
-- 检查不一致的数据
SELECT ur.id, ur.account_id
FROM usage_records ur
LEFT JOIN accounts a ON ur.account_id = a.id
WHERE a.id IS NULL
LIMIT 10;

-- 清理不一致的数据（谨慎！）
DELETE FROM usage_records
WHERE account_id NOT IN (SELECT id FROM accounts);

-- 然后重新运行迁移
```

### 问题 3: 迁移后数据丢失

**原因**: 可能是回滚了事务

**解决**:

```bash
# 恢复备份
docker-compose exec -T postgres psql -U postgres -d claude_relay < backup_20251005_020000.sql

# 检查迁移日志
docker-compose logs app | grep -A 20 "Migration failed"

# 修复问题后重新迁移
```

### 问题 4: 容器启动失败

**原因**: 可能是数据库连接问题

**解决**:

```bash
# 检查数据库是否启动
docker-compose ps postgres

# 检查数据库日志
docker-compose logs postgres

# 测试数据库连接
docker-compose exec postgres psql -U postgres -d claude_relay -c "SELECT 1;"

# 如果连接失败，重启数据库
docker-compose restart postgres
```

---

## 📝 生产环境迁移建议

### 1. 维护窗口

```bash
# 1. 提前通知用户
# 2. 选择低峰时段（如凌晨 2-4 点）
# 3. 预计停机时间：10-15 分钟
```

### 2. 迁移步骤

```bash
# 1. 备份数据库（重要！）
docker-compose exec postgres pg_dump -U postgres claude_relay > backup_production_$(date +%Y%m%d_%H%M%S).sql

# 2. 停止服务
docker-compose down

# 3. 拉取最新版本
git pull origin main
docker-compose pull

# 4. 启动服务（自动迁移）
docker-compose up -d

# 5. 监控日志
docker-compose logs -f app

# 6. 验证功能
# - 测试 API 请求
# - 检查统计数据
# - 验证数据完整性

# 7. 如果失败，立即回滚
docker-compose down
docker-compose exec -T postgres psql -U postgres -d claude_relay < backup_production_20251005_020000.sql
docker pull let5see/claude-relay-service:v1.1.174
docker-compose up -d
```

### 3. 监控指标

```bash
# 监控以下指标：
- 数据库连接数
- 查询响应时间
- 错误日志
- API 请求成功率
- Token 统计准确性
```

---

## 🎯 本次迁移总结

### 变更内容

- ✅ 账户 ID 类型：UUID → TEXT
- ✅ API Key ID 类型：UUID → TEXT
- ✅ 支持非 UUID 格式的 ID
- ✅ 重建外键约束
- ✅ 重建相关视图

### 影响范围

- ✅ 兼容现有数据
- ✅ 不影响功能
- ✅ 向后兼容
- ✅ 无需修改应用代码

### 风险评估

- **风险等级**: 🟡 中等
- **数据丢失风险**: 🟢 低（有备份）
- **停机时间**: 🟢 < 5 分钟
- **回滚难度**: 🟢 简单（恢复备份）

---

## 📚 相关文档

- [迁移脚本](../../sql/migrations/0005_fix_account_id_type.sql)
- [迁移工具](../../scripts/pg-migrate.js)
- [发布指南](../../RELEASE_GUIDE.md)
- [Docker 部署指南](./DOCKER_MIGRATION.md)

---

**准备好了吗？**

按照上述步骤，你可以安全地将 Docker 版本升级到最新版本，数据库迁移会自动完成！

如有问题，请先恢复备份，然后查看日志排查问题。🚀
