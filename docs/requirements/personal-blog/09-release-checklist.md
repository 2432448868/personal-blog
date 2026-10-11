# 发布上线清单：个人博客网站

## 元数据
- 需求编号：PERSONAL-BLOG-001
- 更新时间：2026-10-11
- 适用：Cloudflare Workers + D1 + R2
- 原则：**以下云端命令只作文档，AI 不执行；全部由牢大审核后手工运行**

## 1. 上线前置（人工准备）

| # | 项 | 说明 | 状态 |
|---|----|------|------|
| 1 | Cloudflare 账号 + `wrangler login` | 本地已授权即可 | 待办 |
| 2 | 创建 D1：`wrangler d1 create personal-blog-db` | 拿到 `database_id` | 待办 |
| 3 | 创建 R2：`wrangler r2 bucket create personal-blog-assets` | 生产桶 | 待办 |
| 4 | 替换 `wrangler.jsonc` 的 `database_id` | 把 `REPLACE_WITH_D1_DATABASE_ID` 换成真实 id | 待办 |
| 5 | 生产 `vars` 调整 | `ENVIRONMENT=production`、`AUTH_DEV_MODE=false`、`SITE_URL=https://<你的域名>` | 待办 |
| 6 | GitHub OAuth App | 回调填 `https://<域名>/api/auth/callback`，拿 Client ID/Secret | 待办 |
| 7 | （可选）Resend | 配 `RESEND_API_KEY`、`NOTIFY_EMAIL` | 可选 |

> ⚠️ 生产变量 `AUTH_DEV_MODE` 必须为 `false`，否则开发登录后门会暴露。

## 2. 密钥配置（含敏感信息，务必用 secret）

```bash
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put GITHUB_ADMIN_USERNAME   # 你的 GitHub 用户名，用于判定管理员
# 可选
wrangler secret put RESEND_API_KEY
wrangler secret put NOTIFY_EMAIL
```

## 3. 数据库迁移（生产）

```bash
# 先看将要执行的迁移
wrangler d1 migrations list personal-blog-db --remote
# 执行迁移（建表）
wrangler d1 migrations apply personal-blog-db --remote
# 可选：导入种子/基础内容（确认后再执行）
wrangler d1 execute personal-blog-db --remote --file=./migrations/0002_seed.sql
```

回滚（仅在需要时，执行前人工审核）：

```bash
wrangler d1 execute personal-blog-db --remote --file=./migrations/rollback/0002_seed_rollback.sql
wrangler d1 execute personal-blog-db --remote --file=./migrations/rollback/0001_init_rollback.sql
```

## 4. 构建与部署

```bash
npm ci
npm run build          # 含 astro check，必须 0 错误
wrangler deploy        # 或 npm run deploy
```

## 5. 上线后验证

| # | 用例 | 期望 |
|---|------|------|
| 1 | 打开首页 / 文章详情 | 正常渲染，无 500 |
| 2 | `GET /api/health` | 200，D1/R2 正常 |
| 3 | GitHub 登录 | 跳转→回调→进入 `/admin` |
| 4 | `POST /api/auth/dev-login` | **404**（生产必须关闭） |
| 5 | 新建/发布文章 | 前台立即可见 |
| 6 | 上传封面 | 图片可访问 |
| 7 | 评论/留言 → 后台审核 | 审核前不显示，通过后显示 |
| 8 | `/rss.xml`、`/sitemap.xml` | 200 且内容正确 |
| 9 | 退出登录 | 后台接口 401 |

## 6. 回滚方案

1. 代码回滚：`wrangler versions deploy` 选择上一个版本，或用上一条 Git 记录重新部署。
2. 数据回滚：用 `migrations/rollback/**`（人工审核后执行）。
3. R2：对象按 key 留存，误删可从备份桶恢复。

## 7. 备注

- 当前 `wrangler.jsonc` 的 `database_id` 是占位符，**不改会部署失败**。
- 若后续用到 Astro Session，需要补 `SESSION` KV 绑定；当前未使用，无需创建。
- 本任务按要求**未提交、未推送**任何 Git 记录。
