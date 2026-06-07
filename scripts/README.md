# MyndBBS 脚本模板

本目录保存可提交到 GitHub 的脚本模板。它们只描述部署、备份、迁移和恢复流程，不包含真实服务器 IP、域名、SSH 用户、端口或个人电脑路径。

## 文件说明

| 文件名 | 用途 | 平台 |
| --- | --- | --- |
| `deploy.sh` | 构建镜像、上传服务器、远程备份、重启服务、健康检查和回滚 | Linux / macOS / Git Bash |
| `update-db.ps1` | 备份数据库并应用 Prisma 迁移 | Windows |
| `update-db.sh` | 备份数据库并应用 Prisma 迁移 | Linux |
| `restore-db.ps1` | 从 `.sql` 备份文件恢复数据库 | Windows |
| `restore-db.sh` | 从 `.sql` 备份文件恢复数据库 | Linux |
| `setup.ps1` | 创建本地备份目录并打印脚本使用提示 | Windows |

## 部署脚本配置

`deploy.sh` 需要通过环境变量提供真实部署信息。不要把真实值写回脚本本身。

```bash
export DEPLOY_SSH_HOST="your-server-host"
export DEPLOY_SSH_PORT="22"
export DEPLOY_SSH_USER="deploy-user"
export DEPLOY_DIR="/path/to/myndbbs"
export DEPLOY_PUBLIC_URL="https://your-domain.example"

./scripts/deploy.sh deploy
```

可选变量：

```bash
export BACKEND_IMAGE="myndbbs-backend"
export FRONTEND_IMAGE="myndbbs-frontend"
export DEPLOY_TAG="deploy"
export POSTGRES_CONTAINER="myndbbs-postgres"
export DB_USER="myndbbs"
export DB_NAME="myndbbs"
```

常用命令：

```bash
./scripts/deploy.sh build
./scripts/deploy.sh upload
./scripts/deploy.sh deploy
./scripts/deploy.sh rollback
```

## 数据库更新

Windows：

```powershell
pnpm db:update-win
```

Linux：

```bash
pnpm db:update
```

如你的容器名、数据库用户名或数据库名不是默认值，请先设置环境变量：

```bash
export POSTGRES_CONTAINER="your-postgres-container"
export BACKEND_CONTAINER="your-backend-container"
export DB_USER="your-db-user"
export DB_NAME="your-db-name"
export BACKUP_DIR="/path/to/backups"
```

PowerShell 示例：

```powershell
$env:POSTGRES_CONTAINER = "your-postgres-container"
$env:DB_USER = "your-db-user"
$env:DB_NAME = "your-db-name"
$env:BACKUP_DIR = "C:\path\to\backups"
pnpm db:update-win
```

## 数据库恢复

Windows：

```powershell
pnpm db:restore-win .\data\backups\your_backup.sql
```

Linux：

```bash
pnpm db:restore ./backups/your_backup.sql
```

恢复脚本会覆盖当前数据库，执行前会要求二次确认。

## 手动备份和恢复

```bash
docker exec -i "$POSTGRES_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" > backup.sql
docker exec -i "$POSTGRES_CONTAINER" psql -U "$DB_USER" "$DB_NAME" < backup.sql
```
