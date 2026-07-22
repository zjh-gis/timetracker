# 腾讯云部署说明

目标结构：用户浏览器 → HTTPS/Nginx → Next.js Node 服务 → 腾讯云 PostgreSQL；认证邮件由 SMTP 服务发出。

## 1. 腾讯云资源

1. 创建与云主机同地域、同私有网络的 PostgreSQL 实例；
2. 创建独立数据库和最小权限应用用户，不使用管理员账号作为 `DATABASE_URL`；
3. 数据库安全组只允许应用云主机的私网地址访问 5432；
4. 开启自动备份、备份保留期、监控和容量告警；
5. 在邮件推送服务中完成发信域名验证，创建 SMTP 凭据；
6. 域名解析到云主机，申请证书，并确认 ICP 备案及公安备案等要求是否适用。

## 2. 服务器目录和配置

建议代码放在 `/opt/timetracker/app`，环境变量放在仅服务用户可读的 `/etc/timetracker.env`。不要把 `.env`、数据库密码或 SMTP 密码提交到 Git。

生产环境至少填写：

```dotenv
NODE_ENV=production
DATABASE_URL=postgresql://USER:PASSWORD@PRIVATE_DB_HOST:5432/timetracker
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
SMTP_FROM=时迹 <noreply@你的发信域名>
NEXT_PUBLIC_OPERATOR_NAME=真实运营主体
NEXT_PUBLIC_SUPPORT_EMAIL=客服邮箱
```

`NEXT_PUBLIC_*` 会在构建时进入页面，因此修改后必须重新构建。

## 3. 发布命令

```bash
npm ci
npm run db:migrate
npm run build
sudo systemctl restart timetracker
```

迁移应先在测试数据库验证，再在备份完成后执行。若迁移失败，不要启动引用新结构的版本。

## 4. systemd 示例

```ini
[Unit]
Description=Timetracker web service
After=network.target

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

## 6. 上线后验证

使用两个不同浏览器完成：注册、验证邮件、登录、创建任务、开始/停止计时、跨设备同步、找回密码、JSON 导出和账号注销。随后检查数据库级联删除、Nginx/应用错误日志、备份任务和告警通知。
