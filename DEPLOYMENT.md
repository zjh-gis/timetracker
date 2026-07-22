# 腾讯云轻量应用服务器部署说明

目标结构：用户浏览器 → HTTPS/Nginx → Next.js Node 服务 → 本机 MySQL 8；认证邮件由 SMTP 服务发出。

服务器已有 MySQL 8 和 `hotel_guide` 数据库。本项目只新增 `timetracker` 数据库及专用账号，不卸载、不重装 MySQL，也不修改 `hotel_guide`。MySQL 继续只监听 `127.0.0.1:3306`。

## 1. 创建独立数据库和账号

使用服务器当前正确的 socket 登录：

```bash
sudo mysql --protocol=SOCKET --socket=/run/mysqld/mysqld.sock
```

在 MySQL 中执行下列语句，并把两个示例密码替换为不同的强随机密码：

```sql
CREATE DATABASE `timetracker`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE USER 'timetracker_migrate'@'127.0.0.1' IDENTIFIED BY '替换为迁移账号强密码';
CREATE USER 'timetracker_app'@'127.0.0.1' IDENTIFIED BY '替换为应用账号强密码';

GRANT ALL PRIVILEGES ON `timetracker`.* TO 'timetracker_migrate'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON `timetracker`.* TO 'timetracker_app'@'127.0.0.1';
```

无需执行 `FLUSH PRIVILEGES`。不要给应用账号全局权限，也不要开放公网 3306。如果密码含 `@`、`:`、`/`、`#`、`%` 等字符，写入连接 URL 前必须进行 URL 编码。

## 2. 代码目录和运行账号

建议代码放在 `/opt/timetracker/app`，由独立的 `timetracker` Linux 用户运行。生产运行变量放入 `/etc/timetracker.env`，权限设为 `600`；迁移账号连接串单独放在 `/etc/timetracker-migrate.env`，仅在迁移时加载。不要把环境文件、数据库密码或 SMTP 密码提交到 Git。

`/etc/timetracker.env` 至少包含：

```dotenv
NODE_ENV=production
DATABASE_URL=mysql://timetracker_app:URL编码后的密码@127.0.0.1:3306/timetracker
DATABASE_SSL=false
DATABASE_POOL_MAX=10
BETTER_AUTH_SECRET=使用 openssl rand -base64 32 生成
BETTER_AUTH_URL=https://你的正式域名
BETTER_AUTH_TRUSTED_ORIGINS=https://你的正式域名
SMTP_HOST=你的SMTP主机
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=你的SMTP用户名
SMTP_PASSWORD=你的SMTP密码
SMTP_FROM="时迹 <noreply@你的发信域名>"
NEXT_PUBLIC_OPERATOR_NAME=真实运营主体
NEXT_PUBLIC_SUPPORT_EMAIL=客服邮箱
```

`/etc/timetracker-migrate.env` 只包含：

```dotenv
MIGRATION_DATABASE_URL=mysql://timetracker_migrate:URL编码后的密码@127.0.0.1:3306/timetracker
DATABASE_SSL=false
```

`NEXT_PUBLIC_*` 会在构建时进入页面，修改后必须重新构建。

## 3. 首次发布和后续更新

首次发布前确认已创建轻量服务器快照。安装依赖并执行迁移：

```bash
cd /opt/timetracker/app
npm ci
sudo -u timetracker bash -lc 'set -a; source /etc/timetracker.env; source /etc/timetracker-migrate.env; set +a; cd /opt/timetracker/app; npm run db:migrate'
sudo -u timetracker bash -lc 'set -a; source /etc/timetracker.env; set +a; cd /opt/timetracker/app; npm run build'
sudo systemctl restart timetracker
```

MySQL DDL 会隐式提交，迁移不是整体事务。迁移 SQL 使用 `IF NOT EXISTS`，失败后应先检查错误和当前表结构，再修正并重试；不要启动依赖新结构的新版本。

后续发布建议顺序：备份 `timetracker` → 拉取代码 → `npm ci` → 迁移 → 构建 → 重启 → 验收。

## 4. systemd 示例

```ini
[Unit]
Description=Timetracker web service
After=network.target mysql.service

[Service]
Type=simple
User=timetracker
WorkingDirectory=/opt/timetracker/app
EnvironmentFile=/etc/timetracker.env
ExecStart=/usr/bin/npm start -- --hostname 127.0.0.1 --port 3000
Restart=always
RestartSec=5
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

## 5. Nginx 示例

```nginx
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=120r/m;

server {
    listen 443 ssl http2;
    server_name time.example.com;
    client_max_body_size 2m;

    location /api/auth/ {
        limit_req zone=auth_limit burst=20 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        limit_req zone=api_limit burst=60 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

另建 80 端口站点并永久重定向到 HTTPS。证书路径、TLS 参数和域名按服务器现状填写。

## 6. 备份与验收

只备份本项目数据库，不要把 `hotel_guide` 混入时迹的迁移流程：

```bash
mysqldump --single-transaction --routines --triggers timetracker > timetracker-YYYYMMDD.sql
```

备份文件应加密并复制到腾讯云 COS 或其他服务器外存储，定期在隔离环境验证恢复。

上线后用两个不同浏览器完成：注册、验证邮件、登录、创建任务、开始/停止计时、跨设备同步、冲突处理、找回密码、JSON 导出和账号注销。随后检查数据库级联删除、Nginx/应用错误日志、备份任务和磁盘告警。
