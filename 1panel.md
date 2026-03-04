# FlightLog 服务 1Panel + Docker 部署及自动更新手册

本文档详细介绍了如何将 GitHub 上的 Python/Flask 项目通过 1Panel 面板部署到 Docker 容器中，并配合 MySQL 数据库实现持久化与自动更新。

---

## 一、 准备工作

### 1. 数据库文件说明
*   **`schema_mysql.sql`**：此文件包含 FlightLog 服务所需的 MySQL 数据表结构定义（如 `users`, `flights` 等表）。
    > 由于数据库环境已准备就绪，此文件仅作为结构参考。请确保你的数据库中已包含这些表结构，以便程序正常读写。

### 2. 项目代码准备
确保你的 GitHub 仓库中包含以下文件（已更新）：
*   `requirements.txt`：包含 `gunicorn` 和 `PyMySQL` 等依赖。
*   `Dockerfile`：用于构建镜像。
*   `.gitignore`：确保不上传敏感配置。

---

## 二、 Docker 镜像配置
项目根目录已包含标准的 `Dockerfile` 文件，配置为使用 `python:3.9-slim` 基础镜像，并安装所有依赖（包含 `gunicorn` 和 `mysqlclient` 支持）。

**无需手动创建**，1Panel 在构建编排时会自动读取该文件。


---

## 三、 在 1Panel 中拉取代码
1.  进入 **1Panel** 面板 -> **[主机] -> [文件]**。
2.  导航到你存放应用的目录（建议：`/opt/1panel/apps/flightlog`）。
3.  点击页面顶部的 **[终端]** 按钮，执行克隆命令：
    `git clone https://github.com/你的用户名/FlightLog.git .`
    *(注意：如果是私有仓库，请先在服务器配置 SSH Key)*

---

## 四、 创建 Docker Compose 编排
1.  进入 1Panel **[容器] -> [编排]**。
2.  点击 **[创建编排]**，选择 **[本地文件]** (或者直接在文件管理中新建 `docker-compose.yml`)。
3.  **名称**：`flightlog`。
4.  **编辑内容**：复制以下配置。请**务必修改环境变量**中的数据库密码。

```yaml
version: '3.8'

services:
  flightlog-app:
    build: 
      context: .
      dockerfile: Dockerfile
    container_name: flightlog-app
    restart: always
    ports:
      - "5000:5000"
    environment:
      # 核心密钥
      - MASTER_SECRET_KEY=你的主密钥
      - FLASK_SECRET_KEY=你的FlaskSession密钥
      - INVITATION_CODE=你的邀请码
      
      # 调试模式 (生产环境设为 false)
      - FLASK_DEBUG=false
      
      # MySQL 数据库配置
      # 1Panel 网络下直接填 MySQL 容器的名（例如 1panel-mysql）
      - MYSQL_HOST=1panel-mysql 
      - MYSQL_PORT=3306
      - MYSQL_USER=flightlog
      - MYSQL_PASSWORD=你的数据库密码
      - MYSQL_DB=flightlog
    networks:
      - 1panel-network

networks:
  1panel-network:
    external: true
```

---

## 五、 反向代理与 SSL (推荐)
为了通过域名安全访问，建议通过 1Panel 的 **[网站] -> [反向代理]** 功能：
1.  创建一个反向代理网站。
2.  **代理地址**：`http://127.0.0.1:5000`。
3.  配置 HTTPS 证书。

---

## 六、 自动更新方案
为了实现代码同步后自动更新容器，在 1Panel **[计划任务]** 中添加一个 Shell 脚本任务：

**任务名称**：更新 FlightLog
**执行周期**：每小时（或自定义）
**脚本内容：**
```bash
#!/bin/bash
# 进入项目目录
cd /opt/1panel/apps/flightlog

# 拉取远程信息
git fetch

# 对比本地与远程分支
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse @{u})

if [ $LOCAL != $REMOTE ]; then
    echo "$(date): 检测到 GitHub 有新代码，正在更新..."
    git pull
    
    # 重新构建镜像并重启容器
    # 注意：如果使用了 docker-compose.yml 文件
    docker-compose up -d --build
    
    echo "$(date): 更新并重启完成。"
else
    echo "$(date): 代码已是最新。"
fi
```

---

## 七、 维护建议
*   **查看日志**：`docker-compose logs -f --tail=100` 或在 1Panel 容器界面查看。
*   **数据库备份**：使用 1Panel 的数据库备份功能，定期备份 `flightlog` 库。
