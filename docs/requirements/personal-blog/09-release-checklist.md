# 发布上线清单：个人博客网站

## 元数据
- 需求编号：PERSONAL-BLOG-001
- 更新时间：2026-10-11
- 适用：Cloudflare Workers + D1 + （R2 待开通）
- 执行方式：牢大本次明确授权由 AI 执行云端命令，原「仅文档化、不执行」约束解除

## 1. 上线前置

| # | 项 | 说明 | 状态 |
|---|----|------|------|
| 1 | Cloudflare 账号 + `wrangler login` | 账号 `2432448868@qq.com` | ✅ 已完成 |
| 2 | 创建 D1 `personal-blog-db` | id `f5fcdd13-3fad-481a-9b43-6715d8f131cd`（APAC） | ✅ 已完成 |
| 3 | 创建 R2 `personal-blog-assets` | 账号未开通 R2，返回 `code 10042` | ⏳ 待人工开通 |
| 4 | 替换 `wrangler.jsonc` 的 `database_id` | 已填真实 id | ✅ 已完成 |
| 5 | 生产 `vars` 调整 | `ENVIRONMENT=production`、`AUTH_DEV_MODE=false`、`SITE_URL=https://personal-blog.stock-backend-wkl.workers.dev` | ✅ 已完成 |
| 6 | GitHub OAuth App | 回调 `https://personal-blog.stock-backend-wkl.workers.dev/api/auth/callback` | ⏳ 待人工创建 |
| 7 | （可选）Resend | 配 `RESEND_API_KEY`、`NOTIFY_EMAIL` | 可选 |

> ⚠️ `AUTH_DEV_MODE=false` 已生效，开发登录后门在生产已关闭。

## 2. 密钥配置（含敏感信息，务必用 secret）

```bash
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put GITHUB_ADMIN_USERNAME   # 2432448868
```

状态：⏳ 未配置。未配置时前台与只读后台正常，GitHub 登录 / 写操作不可用。

## 3. 数据库迁移（生产）

已执行 `wrangler d1 migrations apply personal-blog-db --remote`：`0001_init.sql` ✅、`0002_seed.sql` ✅（含管理员账号与 4 篇示例文章）。

回滚（人工审核后执行）：

```bash
wrangler d1 execute personal-blog-db --remote --file=./migrations/rollback/0002_seed_rollback.sql
wrangler d1 execute personal-blog-db --remote --file=./migrations/rollback/0001_init_rollback.sql
```

## 4. 构建与部署

```bash
npm run build     # 含 astro check：0 errors / 0 warnings / 0 hints
wrangler deploy
```

| 次序 | Version ID | 说明 |
|------|-----------|------|
| 1 | `adf8fc1d-acdc-41db-9623-88623e0e7b64` | 首次上线 |
| 2 | `f6f87cf5-3178-4aa9-bda3-db0974d4751a` | 修正 `site` 域名，修复 RSS/sitemap 链接（当前版本） |

## 5. 上线后验证（实测 2026-10-11）

| # | 用例 | 结果 |
|---|------|------|
| 1 | `/`、`/post`、文章详情、`/archive`、`/tags`、`/categories`、`/guestbook`、`/about`、`/search`、`/toolbox`、`/social` | 全部 200 |
| 2 | `GET /api/health` | 200，`status=ok`，`database=true` |
| 3 | `/rss.xml`、`/sitemap.xml` | 200，链接已指向生产域名 |
| 4 | 字体静态资源 `/fonts/975maru/*.woff2` | 200（`font/woff2`） |
| 5 | `/admin/login` | 200（登录需先配 OAuth 密钥） |
| 6 | `POST /api/auth/dev-login` | 生产已关闭 |

## 6. 回滚方案

1. 代码：`wrangler versions deploy` 选上一版本，或用上一条 Git 记录重新部署。
2. 数据：用 `migrations/rollback/**`（人工审核后执行）。
3. R2：对象按 key 留存，误删可从备份桶恢复。

## 7. 备注

- 仓库：`https://github.com/2432448868/personal-blog`（private），分支 `main`。
- 站点：`https://personal-blog.stock-backend-wkl.workers.dev`。
- `SESSION` KV 已创建并绑定：`personal-blog-session`（id `2ec9cc97e9604113aba70d0b34706690`）。
- R2 未开通期间绑定暂时移除，`health.checks.bucket=false`，整体 `status` 仍为 `ok`；开通后把 `r2_buckets` 加回 `wrangler.jsonc` 并重新部署即可恢复封面上传。
- 大陆直连 `workers.dev` 与 GitHub `22` 端口在本地网络被阻断，验证与推送经本地代理（`127.0.0.1:7897`）完成。