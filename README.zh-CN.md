# everfly

[![CI](https://github.com/Yongxue-Chen/everfly/actions/workflows/ci.yml/badge.svg)](https://github.com/Yongxue-Chen/everfly/actions/workflows/ci.yml)

*[English](README.md)*

everfly 是一个自托管的 Flask Web 应用，用于记录、管理和可视化个人飞行记录。

它把一份航班列表变成值得一看的东西：一张画着你飞过的每条航线的地图、里程碑指标、年度节奏图表，以及这些数字背后的航司、机型、机场和城市的可浏览卡片。

## 功能

- **航班记录** —— 航班号、日期、航司、机型、起降机场与航站楼、计划与实际时间、座位、舱位和备注。
- **基础数据** —— 城市、机场、航司、飞机型号的完整增删改查。
- **自动补全** —— 基于 [`airportsdata`](https://pypi.org/project/airportsdata/) 自动补全机场 ICAO 代码、经纬度、城市和时区。
- **时区感知的时长计算** —— 根据出发地和到达地时区计算计划/实际飞行时长，而不是简单地做钟面减法。
- **统计与可视化** —— 按航司、机型、航线、城市、国家、大洲汇总；航线地图和年度图表。
- **CSV 批量导入** —— 支持城市、机场、航司、机型和航班记录。
- **FlightAware AeroAPI 集成** —— 每个用户保存自己的 API Key，用服务端的 `MASTER_SECRET_KEY` 加密后落库。
- **多租户** —— 所有业务数据存放在同一个 MySQL 库中，按 `user_id` 隔离。注册需要邀请码。

## 技术栈

| 层次 | 选型 |
| --- | --- |
| 后端 | Python、Flask、Gunicorn |
| 数据库 | MySQL（PyMySQL） |
| 前端 | Jinja 模板、原生 JavaScript、Leaflet、Chart.js |
| 容器 | Docker、Docker Compose |
| 可选运维 | 1Panel |

主要文件：

| 路径 | 用途 |
| --- | --- |
| `app.py` | Flask 主程序：路由、API、认证、导入、统计、AeroAPI |
| `database.py` | MySQL 连接封装 |
| `schema_mysql.sql` | 数据库结构的唯一来源 |
| `migrations/` | 需要手动执行的显式 SQL 迁移 |
| `templates/`、`static/` | HTML 模板与前端资源 |
| `Dockerfile` | 生产镜像，由 Gunicorn 启动 |
| `deploy.sh` | 基于 tag 的部署脚本 |

## 快速开始

需要 Python 3.9+ 和一个可访问的 MySQL 8 服务。生产镜像基于 `python:3.9-slim` 构建。

```bash
git clone https://github.com/Yongxue-Chen/everfly.git
cd everfly
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # 然后填写，见下文
```

创建数据库并导入表结构：

```sql
CREATE DATABASE everfly CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'everfly'@'%' IDENTIFIED BY 'change-this-password';
GRANT ALL PRIVILEGES ON everfly.* TO 'everfly'@'%';
FLUSH PRIVILEGES;
```

```bash
mysql -h <mysql-host> -u everfly -p everfly < schema_mysql.sql
```

应用启动时**不会**自动创建业务表。`schema_mysql.sql` 是数据库结构的唯一来源。

然后运行：

```bash
python app.py
```

访问 <http://127.0.0.1:5000>。

除本地开发外，请使用 Gunicorn 而不是 Flask 自带的开发服务器：

```bash
gunicorn -w 4 -b 127.0.0.1:5000 app:app
```

## 配置

全部配置通过环境变量完成。把 `.env.example` 复制为 `.env` 并填写。**永远不要提交真实的 `.env`。**

| 变量 | 必填 | 用途 |
| --- | --- | --- |
| `MASTER_SECRET_KEY` | 是 | 加密用户保存的 FlightAware API Key 的 Fernet 密钥 |
| `FLASK_SECRET_KEY` | 是 | Flask session 签名密钥 |
| `INVITATION_CODE` | 是 | 注册新账号所需的邀请码 |
| `FLASK_DEBUG` | 否 | 生产环境设为 `false` |
| `MYSQL_HOST` / `MYSQL_PORT` / `MYSQL_USER` / `MYSQL_PASSWORD` / `MYSQL_DB` | 是 | 数据库连接 |
| `IMAGEKIT_PRIVATE_KEY` / `IMAGEKIT_URL_ENDPOINT` | 否 | 航司 Logo 存储与 CDN 分发 |
| `INTERNAL_SERVICE_TOKEN` | 否 | 内部服务 API 的 Bearer Token |
| `EVERFLY_INTERNAL_USERNAME` | 否 | 内部 API 创建的航班草稿归属的已有用户名 |

生成两个密钥：

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
python -c "import secrets; print(secrets.token_hex(32))"
```

> **`MASTER_SECRET_KEY` 在各次部署之间必须保持不变。** 它加密着用户的 FlightAware API Key。一旦轮换或丢失，已有密文将无法解密，所有用户都需要重新填写。

没有 ImageKit 航司 Logo 也能工作 —— 未配置、上传失败或免费额度耗尽时，应用会依次回退到原始 URL 和航司代码占位图。`IMAGEKIT_PRIVATE_KEY` 只保存在服务端，绝不会下发到浏览器。

## 部署

`docker-compose.example.yml` 是一个可移植的起点：

```bash
docker compose -f docker-compose.example.yml up -d --build
```

完整的生产部署方案 —— 开发目录与生产 checkout 的分离、基于 tag 的发布、回滚、1Panel、数据库迁移以及日常运维命令 —— 请参见 **[docs/DEPLOYMENT.zh-CN.md](docs/DEPLOYMENT.zh-CN.md)**。

一句话概括：开发在你自己的 clone 的 `main` 分支上进行；生产从**另一个固定在 tag 上的独立 checkout** 构建，由 `deploy.sh` 驱动。

```bash
./deploy.sh v1.1.0     # 部署指定 tag
./deploy.sh --rollback # 回滚到上一次部署的版本
```

## 开发

```bash
source venv/bin/activate
python -m unittest discover -s tests
```

`tests/` 下有 98 个测试，覆盖 API 接口、租户隔离、AeroAPI 调度和前端加固。它们只用标准库的 `unittest`——不需要额外安装测试依赖——也不需要运行中的 MySQL。打 tag 发布前请先跑通。

日常改代码：

```bash
git checkout main
git pull
# ...编辑、提交...
git push origin main
```

你的开发目录应当始终停在 `main` 上。部署不会从这里构建 —— 原因和做法见 [docs/DEPLOYMENT.zh-CN.md](docs/DEPLOYMENT.zh-CN.md)。

## 安全说明

- 生产环境保持 `FLASK_DEBUG=false`。
- 通过反向代理走 HTTPS。如果访问始终是 HTTPS，在 `app.py` 中设置 `app.config['SESSION_COOKIE_SECURE'] = True`。
- 绝不提交 `MASTER_SECRET_KEY`、`FLASK_SECRET_KEY`、数据库密码和邀请码。
- 任何升级或迁移前，先备份 MySQL 数据库。

## 许可证

[PolyForm Noncommercial License 1.0.0](LICENSE)。

你可以出于**任何非商业目的**使用、修改和分发 everfly，包括个人使用和自托管。本许可证不授予商业使用权。注意 PolyForm Noncommercial 属于 *source-available*（源码可见）许可证，并非 OSI 认证的开源许可证。
