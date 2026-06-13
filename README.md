# FlightLog

FlightLog 是一个用于记录、管理和可视化个人飞行记录的 Flask Web 应用。当前前端页面展示的产品名是 `everfly`。

## 项目介绍

这个应用主要提供以下能力：

- 邀请码注册、登录、登出和用户资料管理。
- 多用户数据隔离：业务数据统一存储在 MySQL 中，并通过 `user_id` 区分不同用户。
- 航班记录管理：航班号、日期、航司、机型、起降机场、航站楼、计划/实际时间、座位、舱位、备注等。
- 基础数据管理：城市、机场、航司、飞机型号的增删改查。
- CSV 批量导入：支持导入城市、机场、航司、机型和航班记录。
- 自动补全：基于 `airportsdata` 补全机场 ICAO、经纬度、城市和时区等信息。
- 时区感知的飞行时长计算：根据出发地和到达地时区计算计划/实际飞行时长。
- 统计和可视化：飞行总数、航司、机型、航线、城市、国家、大洲统计，地图航线展示和年度图表。
- FlightAware AeroAPI 集成：用户可以在 Profile 页面保存自己的 API Key，应用会用 `MASTER_SECRET_KEY` 加密后保存。

## 技术栈

- 后端：Python、Flask、Gunicorn
- 数据库：MySQL、PyMySQL
- 前端：Jinja 模板、原生 JavaScript、Leaflet、Chart.js
- 容器：Docker、Docker Compose
- 可选部署管理：1Panel

主要文件：

- `app.py`：Flask 主程序，包含路由、API、认证、导入、统计、AeroAPI 逻辑。
- `database.py`：MySQL 连接封装。
- `schema_mysql.sql`：MySQL 数据表结构。
- `templates/`：HTML 模板。
- `static/`：CSS、JavaScript 和图片资源。
- `Dockerfile`：生产容器镜像构建文件，使用 Gunicorn 启动应用。

## 环境变量

本地运行或 Docker 部署都需要配置以下环境变量。可以从 `.env.example` 复制一份 `.env` 后填写，不要把真实密钥提交到 Git。

```env
MASTER_SECRET_KEY=
FLASK_SECRET_KEY=
INVITATION_CODE=
FLASK_DEBUG=false

MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=flightlog
MYSQL_PASSWORD=
MYSQL_DB=flightlog

# Optional: airline logo import and CDN delivery
IMAGEKIT_PRIVATE_KEY=
IMAGEKIT_URL_ENDPOINT=
```

生成密钥：

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
python -c "import secrets; print(secrets.token_hex(32))"
```

注意：`MASTER_SECRET_KEY` 用于加密用户保存的 FlightAware API Key。部署后必须保持稳定；如果更换，旧的 API Key 密文将无法解密，需要用户重新填写。

航空公司 Logo 可以使用外部公开 URL。配置 ImageKit 后，服务会尝试将 Logo 导入 ImageKit；未配置、导入失败或免费套餐额度耗尽时，会依次回退到原始 URL 和航司代码占位图，不影响其他功能。`IMAGEKIT_PRIVATE_KEY` 只能保存在服务端环境变量中。

## 数据库准备

创建数据库和用户：

```sql
CREATE DATABASE flightlog CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'flightlog'@'%' IDENTIFIED BY 'change-this-password';
GRANT ALL PRIVILEGES ON flightlog.* TO 'flightlog'@'%';
FLUSH PRIVILEGES;
```

导入表结构：

```bash
mysql -h <mysql-host> -u flightlog -p flightlog < schema_mysql.sql
```

当前应用不会在启动时自动创建完整业务表。`schema_mysql.sql` 是数据库结构的来源。

## 本地部署

适用于不使用 Docker、直接在服务器或开发机上运行的情况。

```bash
cd /home/ubuntu/FlightLog
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

编辑 `.env`，确认 MySQL 可访问，并导入 `schema_mysql.sql` 后启动：

```bash
python app.py
```

访问：

```text
http://127.0.0.1:5000
```

生产环境不建议直接使用 `python app.py`，可以使用 Gunicorn：

```bash
gunicorn -w 4 -b 127.0.0.1:5000 app:app
```

如果用 systemd 管理服务，代码更新或环境变量更新后需要重启对应的 `flightlog` 服务。

## Docker 部署

项目自带 `Dockerfile`，镜像会安装依赖并用 Gunicorn 启动应用。

手动构建和运行：

```bash
docker build -t flightlog:local .
docker run -d \
  --name flightlog-app \
  --restart unless-stopped \
  --env-file .env \
  -p 5000:5000 \
  flightlog:local
```

通用 Docker Compose 示例：

```yaml
services:
  flightlog-app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: flightlog-app
    restart: always
    ports:
      - "5000:5000"
    env_file:
      - .env
```

启动或重新构建：

```bash
docker compose up -d --build
```

## 1Panel 部署

这个项目可以通过 1Panel 的 Docker Compose 编排部署。

当前服务器上的实际部署信息：

- 源代码目录：`/home/ubuntu/FlightLog`
- 1Panel Compose 文件：`/opt/1panel/docker/compose/flightlog/docker-compose.yml`
- Compose 项目名：`flightlog`
- 容器名：`flightlog-app`
- 端口映射：宿主机 `5000` -> 容器 `5000`
- 健康检查：`http://127.0.0.1:5000/api/health`

当前 1Panel 编排从本地源码目录构建镜像，核心结构如下。真实密钥和密码应在 1Panel 编排或环境变量中配置，不要写入公开仓库。

```yaml
services:
  flightlog-app:
    build:
      context: /home/ubuntu/FlightLog
      dockerfile: Dockerfile
    container_name: flightlog-app
    restart: always
    ports:
      - "5000:5000"
    environment:
      - MASTER_SECRET_KEY=<fernet-key>
      - FLASK_SECRET_KEY=<session-secret>
      - INVITATION_CODE=<invitation-code>
      - FLASK_DEBUG=false
      - MYSQL_HOST=<mysql-host>
      - MYSQL_PORT=3306
      - MYSQL_USER=flightlog
      - MYSQL_PASSWORD=<mysql-password>
      - MYSQL_DB=flightlog
    networks:
      - 1panel-network

networks:
  1panel-network:
    external: true
```

新建 1Panel 部署时：

1. 把源码放到服务器目录，例如 `/home/ubuntu/FlightLog`。
2. 创建 MySQL 数据库并导入 `schema_mysql.sql`。
3. 在 1Panel 中创建 Docker Compose 编排。
4. 将 `build.context` 指向源码目录。
5. 配置所有必需环境变量。
6. 如果 MySQL 容器在 1Panel 网络中，将服务加入 `1panel-network`。
7. 在 1Panel 中创建反向代理，代理到 `http://127.0.0.1:5000`。
8. 为反向代理启用 HTTPS。

## 源代码更新后如何更新服务

不同变更需要不同更新方式。更新前建议先确认数据库已有备份。

### 只有源代码变更

本地非容器部署：

```bash
cd /home/ubuntu/FlightLog
git pull
sudo systemctl restart flightlog
```

如果不是 systemd 管理，而是手动启动的进程，需要停止旧进程后重新启动。

Docker Compose 或 1Panel Compose 部署：

```bash
cd /opt/1panel/docker/compose/flightlog
git -C /home/ubuntu/FlightLog pull
docker compose up -d --build
```

如果你的 `docker-compose.yml` 就在源码目录中，则进入源码目录执行同样的 `docker compose up -d --build`。

### 依赖文件变更

如果 `requirements.txt` 有变化，本地部署需要重新安装依赖：

```bash
cd /home/ubuntu/FlightLog
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart flightlog
```

Docker 或 1Panel Compose 部署需要重建镜像：

```bash
cd /opt/1panel/docker/compose/flightlog
git -C /home/ubuntu/FlightLog pull
docker compose build --no-cache
docker compose up -d
```

### 环境变量变更

本地部署：

```bash
sudo systemctl restart flightlog
```

Docker 或 1Panel Compose 部署：

```bash
cd /opt/1panel/docker/compose/flightlog
docker compose up -d
```

如果容器没有拿到新的环境变量，可以强制重建容器：

```bash
docker compose up -d --force-recreate
```

### 数据库结构变更

先备份数据库，再执行迁移。

全新数据库可以直接导入：

```bash
mysql -h <mysql-host> -u flightlog -p flightlog < schema_mysql.sql
```

已有数据库不要直接重复导入整份 schema。应根据变更编写明确的 `ALTER TABLE` 迁移语句，再手动执行。

租户关联完整性约束迁移位于 `migrations/20260609_tenant_integrity_constraints.sql`。该脚本会先检查孤立记录和跨用户关联；发现问题时会主动中止，不会继续添加约束。请先备份数据库，再使用 MySQL 客户端执行并根据错误信息清理历史数据。

## 运维命令

健康检查：

```bash
curl -i http://127.0.0.1:5000/api/health
```

查看容器日志：

```bash
docker logs --tail 100 flightlog-app
```

查看 Compose 日志：

```bash
cd /opt/1panel/docker/compose/flightlog
docker compose logs -f --tail=100
```

查看容器状态：

```bash
docker ps --filter name=flightlog-app
```

## 安全和维护建议

- 生产环境保持 `FLASK_DEBUG=false`。
- 生产访问建议走 HTTPS 反向代理。
- 不要把 `MASTER_SECRET_KEY`、`FLASK_SECRET_KEY`、数据库密码、邀请码提交到 Git。
- 当前仓库历史中曾包含敏感信息；如果要公开仓库，需先轮换所有相关密钥，并清理或重建 Git 历史。
- 更新服务前先备份 MySQL 的 `flightlog` 数据库。
- `MASTER_SECRET_KEY` 丢失或更换后，用户保存过的 FlightAware API Key 需要重新录入。
- 如果服务始终通过 HTTPS 访问，可以在 `app.py` 中启用安全 Cookie：

```python
app.config['SESSION_COOKIE_SECURE'] = True
```

### Production Compose and airline logos

Use `docker-compose.example.yml` as a portable starting point and keep real credentials in a deployment-only `.env` outside the Git working tree. ImageKit is optional for core functionality, but enables uploaded and synchronized airline logos.

After configuring `IMAGEKIT_PRIVATE_KEY` and `IMAGEKIT_URL_ENDPOINT`, rebuild the service so the environment is loaded, then synchronize missing airline logos:

```bash
docker exec flightlog-app python scripts/sync_airline_logos.py
```

The synchronization is idempotent and skips airlines that already have a `logo_url`. Use `--force` only when intentionally replacing all logo references.
