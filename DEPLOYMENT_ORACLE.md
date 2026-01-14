# FlightLog 甲骨文云 (Oracle Cloud) 部署指南

本指南详细介绍了将 FlightLog 应用程序部署到甲骨文云基础设施 (OCI) 计算实例 (Ubuntu) 的分步流程。

## 1. 甲骨文云 (OCI) 设置

### 1.1 创建计算实例 (Compute Instance)
1.  登录 **甲骨文云控制台 (Oracle Cloud Console)**。
2.  进入 **Compute (计算)** -> **Instances (实例)** -> **Create Instance (创建实例)**。
3.  **Name (名称)**: 输入 `flightlog-server`。
4.  **Image (镜像)**: 选择 **Canonical Ubuntu** (建议使用 Ubuntu 22.04 或 24.04)。
    *   *注意：对于初学者来说，Ubuntu 比 Oracle Linux 更容易配置。*
5.  **Shape (配置)**: 如果可用，选择 **Ampere** (ARM 架构，通常是永久免费的)，或者选择 **AMD** (x86 架构)。
6.  **Networking (网络)**: 创建一个新的虚拟云网络 (VCN) 或选择现有的。确保勾选 "Assign a public IPv4 address" (分配公网 IPv4 地址)。
7.  **SSH Keys (SSH 密钥)**: **务必保存好您的私钥 (Private Key)!** 您将需要它来登录服务器。
8.  点击 **Create (创建)**。

### 1.2 开放防火墙端口 (安全列表)
1.  在实例详情页面，点击 **Subnet (子网)** 下的链接。
2.  点击 **Security Lists (安全列表)** (通常名为 "Default Security List for...")。
3.  点击 **Add Ingress Rules (添加入站规则)**。
4.  添加一条规则以允许 HTTP 流量：
    *   **Source CIDR (源 CIDR)**: `0.0.0.0/0`
    *   **IP Protocol (IP 协议)**: TCP
    *   **Destination Port Range (目标端口范围)**: `80, 5000` (80 用于 Nginx，5000 用于直接测试)
5.  点击 **Add Ingress Rules**。

---

## 2. 服务器配置

### 2.1 连接到服务器
在您的本地电脑上 (使用 Windows PowerShell 或命令提示符)：
```powershell
ssh -i "你的私钥路径\private.key" ubuntu@<你的服务器公网IP>
```

### 2.2 更新系统并安装依赖
登录成功后，在服务器上执行：
```bash
# 更新系统软件
sudo apt update && sudo apt upgrade -y

# 安装 Python 和 Nginx
sudo apt install python3-pip python3-venv nginx git -y
```

---

## 3. 部署应用程序

### 3.1 上传代码
**方式 A: Git (推荐)**
将你的本地代码推送到 GitHub，然后在服务器上克隆下来：
```bash
git clone https://github.com/你的用户名/flightlog.git
cd flightlog
```

**方式 B: SCP (直接上传)**
如果你没有推送到 GitHub，可以直接从本地电脑上传：
```powershell
# 在本地电脑执行
scp -i "key.key" -r C:\Users\Yongxue\Desktop\FlightLog ubuntu@<IP>:/home/ubuntu/flightlog
```

### 3.2 设置虚拟环境
```bash
cd /home/ubuntu/flightlog

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖包
pip install -r requirements.txt
pip install gunicorn  # 安装生产级服务器
```

---

## 4. 配置 Gunicorn (应用服务器)

创建一个系统服务，让应用在后台自动运行。

```bash
sudo nano /etc/systemd/system/flightlog.service
```

粘贴以下内容：
```ini
[Unit]
Description=Gunicorn instance to serve FlightLog
After=network.target

[Service]
User=ubuntu
Group=www-data
WorkingDirectory=/home/ubuntu/flightlog
Environment="PATH=/home/ubuntu/flightlog/venv/bin"
# ExecStart 启动 Gunicorn
# -w 4: 启动 4 个工作进程
# -b 0.0.0.0:5000: 绑定到 5000 端口
ExecStart=/home/ubuntu/flightlog/venv/bin/gunicorn --workers 4 --bind 0.0.0.0:5000 app:app

[Install]
WantedBy=multi-user.target
```

**启动服务:**
```bash
sudo systemctl start flightlog
sudo systemctl enable flightlog
```

---

## 5. 配置 Ubuntu 防火墙

甲骨文云有外部防火墙 (VCN)，但 Ubuntu 系统内部也有防火墙 (`iptables`/`netfilter`)。Oracle 的 Ubuntu 镜像默认可能会拦截入站流量。

**放行 5000 和 80 端口:**
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 5000 -j ACCEPT
sudo netfilter-persistent save
```
*(或者，如果启用了 ufw，可以使用 `sudo ufw allow 5000`)*

---

## 6. 验证

现在，打开浏览器访问：
`http://<你的服务器IP>:5000`

你应该能看到 FlightLog 的登录页面了！

---

## 7. (可选/进阶) 配置 Nginx (反向代理)

使用 Nginx 可以让你通过标准的 HTTP (80 端口) 访问网站，而不需要在网址后面输 `:5000`。

1.  **创建 Nginx 配置文件**:
    ```bash
    sudo nano /etc/nginx/sites-available/flightlog
    ```

2.  **粘贴配置**:
    ```nginx
    server {
        listen 80;
        server_name <你的服务器IP>; # 如果有域名，填域名

        location / {
            proxy_pass http://127.0.0.1:5000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
    ```

3.  **启用站点**:
    ```bash
    sudo ln -s /etc/nginx/sites-available/flightlog /etc/nginx/sites-enabled
    sudo rm /etc/nginx/sites-enabled/default
    sudo systemctl restart nginx
    ```

现在你可以直接访问 `http://<你的服务器IP>` 了。

---

## 8. 日常维护与更新

当你修改了代码想要更新到服务器上时，请按以下步骤操作：

1.  **提交本地修改**:
    确保你已经在本地电脑上提交并推送了代码：
    ```bash
    git add .
    git commit -m "更新说明"
    git push origin main
    ```

2.  **在服务器上拉取更新**:
    SSH 登录服务器，进入目录并拉取：
    ```bash
    cd /home/ubuntu/flightlog
    git pull origin main
    ```

3.  **重启服务**:
    代码更新后，必须重启 Gunicorn 服务才能生效：
    ```bash
    sudo systemctl restart flightlog
    ```

4.  **如果有什么依赖包更新**:
    如果 `requirements.txt` 有变化：
    ```bash
    source venv/bin/activate
    pip install -r requirements.txt
    ```
