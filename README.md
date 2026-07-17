# 时迹 Web App

个人时间核算工具的独立前端项目。项目采用 Next.js 16 App Router 和静态导出，不依赖仓库根目录的服务端、Prisma 或 SQLite。

当前核心流程：不限数量创建具体任务；点击任务开始计时，再次点击停止；点击其他任务可直接切换。刷新页面后运行状态会恢复。

底部导航提供三个主视图：

- 今日：任务面板、今日累计和记录列表；
- 日历：月度时间分布与单日明细；
- 统计：日/月/年汇总、分类或事项构成、趋势图。

## 本地运行

要求 Node.js 20.9 或更高版本。

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:3000`。如需在同一局域网的手机测试，可运行 `npm run dev -- --hostname 0.0.0.0`，再通过电脑的局域网 IP 和端口访问。

## 检查与构建

```bash
npm run lint
npm run build
```

构建完成后，纯静态产物位于 `out/`，可部署到 Vercel、EdgeOne Pages、Cloudflare Pages、Netlify 或任何静态文件服务器。

## 单独部署

在托管平台导入代码仓库时，把项目根目录设置为：

```text
skill-discovery-experiments/02-time-accounting-tool/web-app
```

构建命令为 `npm run build`，静态输出目录为 `out`。Vercel 可直接识别 Next.js；其他静态托管平台按上述输出目录配置。

## 数据与隐私

时间记录保存在当前浏览器的 `localStorage`，不会因为部署网页代码而上传。不同设备不会自动同步；请使用页面底部的 JSON 导出和恢复功能迁移数据。
