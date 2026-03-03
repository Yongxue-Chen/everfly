FlightLog 服务 1Panel 部署手册
一、 环境准备
服务器安装 1Panel：确保你的服务器已经安装并能正常访问 1Panel 面板。

安装 Git：如果服务器没装 Git，请在终端执行 apt install git -y 或 yum install git -y。

准备代码：确保你的 GitHub 仓库根目录下包含 requirements.txt 和 app.py。

二、 步骤 1：编写 Dockerfile
在你的 GitHub 仓库根目录下新建一个名为 Dockerfile 的文件，内容如下：

Dockerfile
# 使用 Python 3.9 轻量镜像
FROM python:3.9-slim

# 设置工作目录
WORKDIR /app

# 设置环境变量，确保 Python 输出直接打印到日志
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# 安装系统依赖（如 SQLite 编译环境，可选）
RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*

# 复制依赖文件并安装
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制项目所有文件
COPY . .

# 暴露 Flask 默认端口
EXPOSE 5000

# 启动命令
CMD ["python", "app.py"]
三、 步骤 2：在服务器拉取代码
登录 1Panel，进入 [主机] -> [文件]。

建议路径：/opt/1panel/apps/flightlog。

点击页面上的 [终端]，执行：

Bash
git clone https://github.com/你的用户名/你的仓库名.git .
(注意末尾的点，代表克隆到当前目录)

四、 步骤 3：配置 Docker Compose 编排
进入 1Panel [容器] -> [编排] 页面。

点击 [创建编排]，选择 [本地文件]。

名称：flightlog。

编辑内容：复制以下配置。请注意持久化路径的对应关系。

YAML
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
      # 挂载根目录下的 users.db
      - ./users.db:/app/users.db
      # 挂载 instance 文件夹及其内部所有 db 文件
      - ./instance:/app/instance
    restart: always
点击 [确认]。1Panel 会自动开始构建镜像并启动容器。

五、 步骤 4：处理数据库初始化（重要）
如果你的项目在初次启动时需要 schema.sql 初始化数据库：

确保你的宿主机目录下已经手动创建了 instance 文件夹：mkdir -p /opt/1panel/apps/flightlog/instance。

如果启动报错提示找不到数据库文件，可以先在宿主机 touch users.db 创建一个空文件。

六、 步骤 5：后续更新流程
方案 A：手动更新
当你向 GitHub 推送了新代码，想在服务器生效：

进入 1Panel 项目目录的终端，执行：git pull。

回到 1Panel [容器] -> [编排]。

勾选 flightlog，点击 [重建]（Rebuild）。
1Panel 会重新读取 Dockerfile 并打包新代码，但因为有 volumes 挂载，你的 .db 数据会完好无损。

方案 B：自动化更新脚本
你可以设置一个 1Panel [计划任务]，每隔 1 小时自动检查更新：

任务类型：Shell 脚本。

脚本内容：

Bash
cd /opt/1panel/apps/flightlog
# 检查是否有远程更新
git fetch
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse @{u})

if [ $LOCAL != $REMOTE ]; then
    echo "检测到更新，正在同步..."
    git pull
    # 使用 docker-compose 重新构建
    docker-compose up -d --build
    echo "更新完成"
else
    echo "代码已是最新"
fi
七、 常见问题
端口访问不到：请检查服务器防火墙（或云服务器安全组）是否放行了 5000 端口。

查看日志：在 1Panel [容器] 列表，点击容器右侧的 [日志]，可以实时查看 Flask 的运行情况。
