# 1. 使用官方 Python 轻量镜像
FROM python:3.15-slim

# 2. 设置工作目录
WORKDIR /app

# 3. 设置环境变量：不生成 .pyc，且实时输出日志
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# 4. 安装基础系统依赖 (防止某些库编译失败)
RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*

# 5. 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 6. 复制项目所有代码；统一成可读权限（宿主机上个别文件是 600，非 root 用户会读不到）
COPY . .
RUN chmod -R a+rX /app

# 7. 以非 root 用户运行（应用不写本地文件；gunicorn 心跳文件放内存盘）
RUN useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin everfly
USER everfly

# 8. 暴露 Flask 端口
EXPOSE 5000

# 9. 启动命令 (使用 Gunicorn 生产服务器)
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "--worker-tmp-dir", "/dev/shm", "app:app"]
