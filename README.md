# 时迹 Web App

“时迹”是一个移动端优先的个人时间核算工具，使用 Next.js 16、Better Auth 与 PostgreSQL 开发。

## 已实现

- 创建不限数量的任务，点击任务开始、停止或切换计时；
- 今日记录、日/月/年统计、分类与事项构成；
- 月历和 00:00—24:00 单日时间轴；
- 邮箱注册、邮箱验证、登录、找回密码、退出和账号注销；
- 同一账号在电脑与手机间自动同步；
- 浏览器离线副本及 JSON 导入、导出；
- 用户数据按账号隔离，注销账号时由数据库级联删除。

## 本地开发

要求 Node.js 20.9 或更高版本，以及 PostgreSQL 14 或更高版本。

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run dev
```

开发环境未配置 SMTP 时，验证和重置链接会打印到服务端控制台。生产环境必须配置完整 SMTP 参数。

## 环境变量

复制 [.env.example](./.env.example) 后填写：

- `DATABASE_URL`：腾讯云 PostgreSQL 连接串；
- `BETTER_AUTH_SECRET`：至少 32 字节的随机密钥；
- `BETTER_AUTH_URL`：正式 HTTPS 地址，例如 `https://time.example.com`；
- `BETTER_AUTH_TRUSTED_ORIGINS`：允许访问认证接口的完整来源；
- `SMTP_*`：腾讯云邮件推送或其他 SMTP 服务参数；
- `NEXT_PUBLIC_OPERATOR_NAME`、`NEXT_PUBLIC_SUPPORT_EMAIL`：协议展示的真实运营主体和联系邮箱。

完整上线步骤见 [DEPLOYMENT.md](./DEPLOYMENT.md)，同步设计见 [SYNC.md](./SYNC.md)，上线核对项见 [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md)。

## 检查与生产运行

```bash
npm run lint
npm run build
npm start
```

这是带认证和 API 的 Node.js 应用，不能再以纯静态 `out/` 目录部署。生产环境应由进程管理器常驻运行，并由 Nginx 反向代理及终止 HTTPS。

## 数据与隐私

- PostgreSQL 是跨设备数据的权威副本；每个浏览器保留当前账号的本地副本，短暂断网时仍能计时；
- 密码由 Better Auth 进行单向哈希，应用不保存明文密码；
- 邮箱、任务、时间记录和备注会上传到服务端；数据库管理员仍具备读取数据的能力；
- JSON 导出是用户可自行保存的独立备份；
- `/privacy/` 与 `/terms/` 是上线初稿，正式发布前需要由真实运营主体和法律专业人员复核。
