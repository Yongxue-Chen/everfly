# 部署指南

*[English](DEPLOYMENT.md)*

everfly 是一个 Flask 容器，加上一个由你提供的 MySQL 服务。本文讲的是如何以一种可以放心升级和回滚的方式运行它。

如果你只想先跑起来，仓库根目录的 `docker-compose.example.yml` 是自包含的，不需要任何前置准备：

```bash
cp .env.example .env    # 填写必需的值
docker compose -f docker-compose.example.yml up -d --build
```

本文其余部分讲的是长期运维。

## 核心思想：两个 checkout

> **你写代码的目录，和生产构建用的目录，不应该是同一个目录。**

基于 tag 的部署必须 checkout 那个 tag。如果生产从你写代码的同一个目录构建，那么部署 `v1.1.0` 之后，这个目录就停在了 detached `HEAD` 上 —— 下次你坐下来写代码时，会在毫无察觉的情况下把提交打在一个游离的 HEAD 上，而不是 `main`。

把两者分开就彻底消除了这个冲突：

| 目录 | 角色 | Git 状态 |
| --- | --- | --- |
| 你的 clone，例如 `~/everfly` | 开发 | 始终在 `main` 上 |
| 第二个 checkout，例如 `/opt/everfly` | 生产构建源 | detached 在某个发布 tag 上 |

你永远不需要手动 `cd` 进生产 checkout。那是 `deploy.sh` 的地盘。

### 建立方式

```bash
sudo mkdir -p /opt/everfly
sudo chown "$USER":"$USER" /opt/everfly
git clone https://github.com/Yongxue-Chen/everfly.git /opt/everfly
git -C /opt/everfly checkout --detach v1.0.0
```

然后写一个 compose 文件，把构建上下文指向那个 checkout。**把 compose 文件和它的 `.env` 放在 checkout 之外**，这样密钥就不会待在一个会被部署覆盖的目录里：

```yaml
# /srv/everfly-deploy/docker-compose.yml
services:
  everfly-app:
    build:
      context: /opt/everfly    # 生产 checkout，不是你的开发目录
      dockerfile: Dockerfile
    image: everfly:local
    container_name: everfly-app
    restart: always
    ports:
      - "5000:5000"
    env_file:
      - .env                   # 与本文件同级，权限 600
    healthcheck:
      test: ["CMD-SHELL", "python -c \"import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/api/health', timeout=5)\""]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s
```

如果 everfly 需要访问其他容器、或被其他容器访问，在这里加上共享网络。这属于部署相关的配置 —— 这也正是仓库根目录那个示例 compose 文件刻意不声明任何网络的原因。

## 配置 deploy.sh

`deploy.sh` 的每一项设置都有可用的默认值，所以很可能完全不需要配置。想固定你这台主机的路径，复制示例文件改一下即可。`deploy.env` 不会被 Git 跟踪：

```bash
cp deploy.env.example deploy.env
```

```bash
# deploy.env
EVERFLY_SRC_DIR=/opt/everfly
EVERFLY_COMPOSE_FILE=/srv/everfly-deploy/docker-compose.yml
EVERFLY_COMPOSE_PROJECT=everfly
```

| 变量 | 默认值 |
| --- | --- |
| `EVERFLY_SRC_DIR` | `/opt/everfly` |
| `EVERFLY_COMPOSE_FILE` | `$EVERFLY_SRC_DIR/docker-compose.yml` |
| `EVERFLY_COMPOSE_PROJECT` | `everfly` |
| `EVERFLY_CONTAINER` | `everfly-app` |
| `EVERFLY_HEALTH_URL` | `http://127.0.0.1:5000/api/health` |
| `EVERFLY_HEALTH_TIMEOUT` | `120` |

`deploy.env` 的查找顺序是：`$EVERFLY_DEPLOY_ENV` → 与 `deploy.sh` 同级的 `deploy.env` → `/etc/everfly/deploy.env`。命令行上设置的环境变量始终优先，所以临时覆盖依然有效：

```bash
EVERFLY_HEALTH_TIMEOUT=300 ./deploy.sh v1.1.0
```

要多开一套环境，就是多一个文件的事：

```bash
EVERFLY_DEPLOY_ENV=/etc/everfly/staging.env ./deploy.sh v1.1.0
```

## 日常开发

```bash
cd ~/everfly
git checkout main          # 正常情况下你不需要这条 —— 但万一漂移了，这就是修复方式
git pull
# 编辑、测试、提交
python -m unittest discover -s tests
git push origin main
```

你在这里做的任何事都不会影响生产。没有任何构建上下文指向这个目录，所以一个没提交的实验不可能泄漏进已部署的镜像。

## 发布

生产跟随的是 **tag**，不是 `main`。`main` 上的新提交不会影响正在运行的服务；什么时候升级完全由你决定。

```bash
cd ~/everfly
python -m unittest discover -s tests            # 打 tag 前先跑绿
git tag -a v1.1.0 -m "这次发布改了什么"
git push origin v1.1.0

./deploy.sh v1.1.0
```

`deploy.sh` 可以从任何地方运行 —— 无论脚本本身放在哪，它操作的都是生产 checkout。

### deploy.sh 做了什么

1. 如果生产 checkout 有未提交的改动，直接拒绝运行。
2. 从 origin 执行 `git fetch --tags --force --prune`。
3. 在生产 checkout 里 checkout 指定 tag（detached）。
4. 执行 `docker compose build` 和 `docker compose up -d`。
5. 轮询容器健康状态，最长等待 `EVERFLY_HEALTH_TIMEOUT` 秒。
6. 失败时：打印最后 40 行日志，并告诉你回滚命令。
7. 成功时：把上一个 ref 记录到 `.deploy-last-ref`。

### 回滚

```bash
./deploy.sh --rollback     # 回到上一次部署的版本
./deploy.sh v1.0.0         # 或回到指定 tag
```

回滚之所以可信，是因为 `requirements.txt` 锁定了版本 —— 旧 tag 会用它当初测试过的那套依赖重新构建。

## 手动部署

如果不用 `deploy.sh`：

```bash
git -C /opt/everfly fetch --tags --force origin
git -C /opt/everfly checkout --detach v1.1.0
cd /srv/everfly-deploy
docker compose up -d --build
```

如果 `requirements.txt` 变了，而你想确保不复用镜像层缓存：

```bash
docker compose build --no-cache
docker compose up -d
```

如果只改了 `.env`，不需要重新构建：

```bash
docker compose up -d --force-recreate
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
```

### 航司 Logo 同步

配置好 ImageKit 并重新构建后：

```bash
docker exec everfly-app python scripts/sync_airline_logos.py
```

同步是幂等的，会跳过已有 `logo_url` 的航司。只有在确实想替换所有 Logo 引用时才使用 `--force`。

### AeroAPI 定时任务

everfly 提供一个内部端点用于处理排队中的 AeroAPI 查询。用任意调度方式定时调用它 —— systemd timer、cron，或任何外部调度器 —— 认证使用 `INTERNAL_SERVICE_TOKEN`：

```bash
curl -fsS -X POST \
  -H "Authorization: Bearer $INTERNAL_SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit":10}' \
  http://127.0.0.1:5000/api/internal/aeroapi_jobs/run
```

每 10 分钟一次是个合理的起点。

## 反向代理

在应用前面终止 TLS，代理到 `http://127.0.0.1:5000`。当所有请求都走 HTTPS 之后，在 `app.py` 中启用安全 Cookie：

```python
app.config['SESSION_COOKIE_SECURE'] = True
```
