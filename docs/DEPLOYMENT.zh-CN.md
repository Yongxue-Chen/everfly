# 部署指南

*[English](DEPLOYMENT.md)*

本文档说明 everfly 如何开发、如何部署。核心思想只有一条：

> **开发目录和生产构建源，是两个不同的目录。**

## 为什么要分开

基于 tag 的部署必须 checkout 那个 tag。如果生产从你写代码的同一个目录构建，那么部署 `v1.1.0` 之后，这个目录就停在了 detached `HEAD` 上 —— 下次你坐下来写代码时，会在毫无察觉的情况下把提交打在一个游离的 HEAD 上，而不是 `main`。

把两者分开就彻底消除了这个冲突：

| 目录 | 角色 | Git 状态 |
| --- | --- | --- |
| 你的 clone，例如 `~/everfly` | 开发 | 始终在 `main` 上 |
| `/opt/everfly` | 生产构建源 | detached 在某个发布 tag 上 |

你永远不需要手动 `cd` 进 `/opt/everfly`。那是 `deploy.sh` 的地盘。

## 参考拓扑

这是参考部署使用的布局。路径可以按需调整，每一项都能通过环境变量覆盖。

| 项目 | 位置 |
| --- | --- |
| 开发 checkout | `/home/ubuntu/everfly`（在 `main` 上） |
| 生产 checkout | `/opt/everfly`（detached 在 tag 上） |
| Compose 文件 | `/opt/1panel/docker/compose/flightlog/docker-compose.yml` |
| 生产 `.env` | `/opt/1panel/docker/compose/flightlog/.env`（权限 `600`，root 所有） |
| Compose 项目名 | `flightlog` |
| 容器名 | `everfly-app` |
| 端口 | 宿主机 `5000` → 容器 `5000` |
| 健康检查 | `http://127.0.0.1:5000/api/health` |

> Compose 项目和它的目录仍然叫 `flightlog`。那是项目改名之前 1Panel 创建的目录；重命名它会导致容器被重建，而收益为零。它只是一个标签 —— 服务名、镜像名和容器名都已经是 `everfly`。

生产 `.env` 放在 **compose 文件旁边、Git 树之外**，这样密钥永远不会待在一个会被部署改写的 checkout 里。

### 建立生产 checkout

在新机器上，一次性操作：

```bash
sudo mkdir -p /opt/everfly
sudo chown "$USER":"$USER" /opt/everfly
git clone https://github.com/Yongxue-Chen/everfly.git /opt/everfly
git -C /opt/everfly checkout --detach v1.0.0
```

把 compose 文件的构建上下文指向它：

```yaml
services:
  everfly-app:
    build:
      context: /opt/everfly    # <- 生产 checkout，不是你的开发目录
      dockerfile: Dockerfile
    image: everfly:local
    container_name: everfly-app
    restart: always
    ports:
      - "5000:5000"
    healthcheck:
      test: ["CMD-SHELL", "python -c \"import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/api/health', timeout=5)\""]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s
    env_file:
      - .env
    networks:
      1panel-network:
      travel-services:
        aliases:
          # 向后兼容别名：everInbox 仍然用改名前的名字解析 everfly。
          # 删掉这一行会静默破坏该集成。
          # 只有在 everInbox 的 FLIGHTLOG_BASE_URL 更新之后才能移除。
          - flightlog-app

networks:
  1panel-network:
    external: true
  travel-services:
    external: true
```

两个网络都是 `external: true` —— 它们与兄弟服务共享，在这个 compose 文件之外创建。其中 `travel-services` 正是 everInbox 访问 everfly 的通道。仓库根目录下的 `docker-compose.example.yml` 则刻意不声明任何网络，好让公开用户能在一台干净的 Docker 主机上直接跑起来；不要把两者统一。

## 日常开发

```bash
cd ~/everfly
git checkout main          # 正常情况下你不需要这条 —— 但万一漂移了，这就是修复方式
git pull
# 编辑、测试、提交
python -m unittest discover -s tests
git push origin main
```

你在这里做的任何事都不会影响生产。没有任何构建上下文指向这个目录，所以一个没提交的实验绝不可能泄漏进已部署的镜像。

## 发布

生产跟随的是 **tag**，不是 `main`。`main` 上的新提交不会影响正在运行的服务；什么时候升级完全由你决定。

```bash
cd ~/everfly
python -m unittest discover -s tests            # 打 tag 前先跑绿
git tag -a v1.1.0 -m "这次发布改了什么"
git push origin v1.1.0

./deploy.sh v1.1.0
```

`deploy.sh` 可以从任何地方运行 —— 无论脚本本身放在哪，它操作的都是 `/opt/everfly`。

### deploy.sh 做了什么

1. 如果生产 checkout 有未提交的改动，直接拒绝运行。
2. 从 origin 执行 `git fetch --tags --force --prune`。
3. 在 `/opt/everfly` 里 checkout 指定 tag（detached）。
4. 执行 `docker compose build` 和 `docker compose up -d`。
5. 轮询容器健康状态，最长等待 `EVERFLY_HEALTH_TIMEOUT` 秒。
6. 失败时：打印最后 40 行日志，并告诉你回滚命令。
7. 成功时：把上一个 ref 记录到 `/opt/everfly/.deploy-last-ref`。

### 回滚

```bash
./deploy.sh --rollback     # 回到上一次部署的版本
./deploy.sh v1.0.0         # 或回到指定 tag
```

### 配置

每个路径都是一个环境变量，默认值就是生产的形状：

| 变量 | 默认值 |
| --- | --- |
| `EVERFLY_SRC_DIR` | `/opt/everfly` |
| `EVERFLY_COMPOSE_FILE` | `/opt/1panel/docker/compose/flightlog/docker-compose.yml` |
| `EVERFLY_COMPOSE_PROJECT` | `flightlog` |
| `EVERFLY_CONTAINER` | `everfly-app` |
| `EVERFLY_HEALTH_URL` | `http://127.0.0.1:5000/api/health` |
| `EVERFLY_HEALTH_TIMEOUT` | `120` |

所以要多开一套环境，只需要覆盖它们：

```bash
EVERFLY_SRC_DIR=/opt/everfly-staging \
EVERFLY_COMPOSE_FILE=/opt/compose/everfly-staging/docker-compose.yml \
EVERFLY_COMPOSE_PROJECT=everfly-staging \
EVERFLY_CONTAINER=everfly-staging-app \
EVERFLY_HEALTH_URL=http://127.0.0.1:5001/api/health \
./deploy.sh v1.1.0
```

## 手动部署

如果不用 `deploy.sh`：

```bash
git -C /opt/everfly fetch --tags --force origin
git -C /opt/everfly checkout --detach v1.1.0
cd /opt/1panel/docker/compose/flightlog
docker compose -p flightlog up -d --build
```

如果 `requirements.txt` 变了，而你想确保不复用镜像层缓存：

```bash
docker compose -p flightlog build --no-cache
docker compose -p flightlog up -d
```

如果只改了 `.env`，不需要重新构建：

```bash
docker compose -p flightlog up -d --force-recreate
```

## 数据库迁移

先备份。永远先备份。

```bash
mysqldump -h <host> -u <user> -p <database> > backup-$(date +%F).sql
```

**全新**数据库直接导入表结构：

```bash
mysql -h <host> -u everfly -p everfly < schema_mysql.sql
```

**已有**数据库绝不能重复导入整份 schema。请在 `migrations/` 下写一个显式的 `ALTER TABLE` 迁移，然后手动执行。

`migrations/20260609_tenant_integrity_constraints.sql` 用于添加租户外键约束。它会先检查孤立记录和跨租户引用，发现问题时会**主动中止**，而不是在不一致的数据上强加约束。如果它中止了，请按它报告的内容清理数据后重新执行。

## 运维

```bash
# 健康检查
curl -i http://127.0.0.1:5000/api/health

# 容器状态
docker ps --filter name=everfly-app

# 日志
docker logs --tail 100 -f everfly-app

# 当前部署的是哪个版本
git -C /opt/everfly describe --tags

# compose 日志
cd /opt/1panel/docker/compose/flightlog && docker compose logs -f --tail=100
```

### 航司 Logo 同步

配置好 ImageKit 并重新构建后：

```bash
docker exec everfly-app python scripts/sync_airline_logos.py
```

同步是幂等的，会跳过已有 `logo_url` 的航司。只有在确实想替换所有 Logo 引用时才使用 `--force`。

### AeroAPI 定时任务

参考部署用 systemd timer 每 10 分钟跑一次 AeroAPI 任务，认证时从运行中的容器里读取 `INTERNAL_SERVICE_TOKEN`：

```ini
# /etc/systemd/system/everfly-aeroapi-jobs.service
[Unit]
Description=Run everfly AeroAPI scheduled jobs
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/bin/bash -lc 'TOKEN="$$(/usr/bin/docker exec everfly-app printenv INTERNAL_SERVICE_TOKEN)" && /usr/bin/curl -fsS -X POST -H "Authorization: Bearer $${TOKEN}" -H "Content-Type: application/json" -d "{\"limit\":10}" http://127.0.0.1:5000/api/internal/aeroapi_jobs/run'
```

## 反向代理

在应用前面终止 TLS，代理到 `http://127.0.0.1:5000`。用 1Panel 的话就是一个网站条目加上它的 Let's Encrypt 集成。当所有请求都走 HTTPS 之后，在 `app.py` 中启用安全 Cookie：

```python
app.config['SESSION_COOKIE_SECURE'] = True
```
