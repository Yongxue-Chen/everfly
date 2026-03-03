# FlightLog 服务 1Panel + Docker 部署及自动更新手册

本文档详细介绍了如何将 GitHub 上的 Python/Flask 项目通过 1Panel 面板部署到 Docker 容器中，并实现数据库持久化与自动更新。

---

## 一、 Dockerfile 准备
在你的 GitHub 项目根目录下新建一个名为 `Dockerfile` 的文件，内容如下：

```dockerfile
# 1. 使用官方 Python 轻量镜像
FROM python:3.9-slim

# 2. 设置工作目录
WORKDIR /app

# 3. 设置环境变量：不生成 .pyc，且实时输出日志
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# 4. 安装基础系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*

# 5. 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 6. 复制项目所有代码
COPY . .

# 7. 暴露 Flask 端口
EXPOSE 5000

# 8. 启动命令
CMD ["python", "app.py"]
```

---

## 二、 在 1Panel 中拉取代码
1. 登录 **1Panel** 面板。
2. 进入 **[主机] -> [文件]**。
3. 导航到你存放应用的目录（建议：`/opt/1panel/apps/flightlog`）。
4. 点击页面顶部的 **[终端]** 按钮，执行克隆命令：
   `git clone https://github.com/你的用户名/FlightLog.git .`
   *(注意：如果是私有仓库，请先在服务器配置 SSH Key)*

---

## 三、 创建 Docker Compose 编排
1. 进入 1Panel **[容器] -> [编排]**。
2. 点击 **[创建编排]**，选择 **[本地文件]**。
3. **名称**：`flightlog`。
4. **编辑内容**：复制以下配置。请注意 `volumes` 挂载，这确保了你的 `.db` 文件在容器重建时不会丢失。

```yaml
version: '3.8'
services:
  flightlog-app:
    build: 
      context: .
      dockerfile: Dockerfile
    container_name: flightlog-service
    ports:
      - "5000:5000"
    volumes:
      # 挂载根目录下的用户数据库
      - ./users.db:/app/users.db
      # 挂载整个 instance 文件夹及其内部所有子数据库
      - ./instance:/app/instance
    restart: always
```

---

## 四、 自动更新方案
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
    docker-compose up -d --build
    echo "$(date): 更新并重启完成。"
else
    echo "$(date): 代码已是最新。"
fi
```

---

## 五、 维护建议
* **日志查看**：在 1Panel [容器] 列表点击“日志”即可看到 Flask 的实时运行输出。
* **权限检查**：如果遇到数据库写入失败，请在终端执行 `chmod -R 777 /opt/1panel/apps/flightlog/instance`。
