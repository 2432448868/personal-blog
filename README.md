# 个人博客（Personal Blog）

基于 Astro + Hono + Cloudflare Workers 的个人博客：内容浏览、Markdown 写作、GitHub 登录、评论/留言审核、R2 封面、主题/繁简/全屏/打印、SEO。

## 技术栈

| 层 | 选型 |
|----|------|
| 框架 | Astro 7（`output: server`）+ `@astrojs/cloudflare` |
| 交互 | React 19 Islands + Tailwind 4 |
| 后端 | Hono 4（挂在 `/api/*`） |
| 数据 | Cloudflare D1（SQLite）+ R2（对象存储） |
| 校验 | Zod 4 |
| 运行 | 单仓、单 Worker |

## 目录结构

```
src/
  pages/        页面路由 + rss/sitemap 动态输出 + api 桥接
  layouts/      BaseLayout / AdminLayout
  components/   Header/Footer/ArticleCard/评论/留言/搜索/后台等
  server/
    routes/     Hono 路由（health/posts/comments/guestbook/auth/admin/media）
    services/   业务编排（auth/content/interactions/posts/notifications）
    db/         SQL 访问（auth/content/interactions/settings/client）
    middleware/ 会话 + CSRF
  lib/          常量、API 封装、Markdown、格式化、slug
  types/        领域与 API 类型
migrations/     0001_init / 0002_seed + rollback/
scripts/        smoke.mjs（端到端冒烟）
docs/requirements/personal-blog/  需求流水线文档 00~09
```

## 本地开发

```powershell
cd C:\Users\wkl\Desktop\codex_work_space\personal-blog
npm install
npm run db:local:migrate    # 建表
npm run db:local:seed       # 灌种子数据
npm run dev                 # http://localhost:4321
```

另开一个终端跑冒烟：

```powershell
npm run smoke
```

### 本地登录

本地通过 `POST /api/auth/dev-login` 创建管理员会话（仅 `ENVIRONMENT=development && AUTH_DEV_MODE=true` 时可用）。
页面入口：`/admin/login`。

## 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 本地开发 |
| `npm run check` | `astro check`（类型/语法） |
| `npm run build` | check + 生产构建 |
| `npm run preview` | 预览构建产物 |
| `npm run lint` | ESLint |
| `npm run smoke` | 端到端冒烟（需先起 dev） |
| `npm run db:local:migrate` | 本地 D1 迁移 |
| `npm run db:local:seed` | 本地灌种子 |
| `npm run deploy` | build + `wrangler deploy`（产出用） |

## 环境变量 / 绑定

`wrangler.jsonc` 已配置本地绑定：

| 名称 | 类型 | 说明 |
|------|------|------|
| `DB` | D1 | 数据库绑定 |
| `BUCKET` | R2 | 资源桶 |
| `SITE_URL` | var | 站点地址，用于 OAuth 回调与来源校验 |
| `ENVIRONMENT` | var | `development` / `production` |
| `AUTH_DEV_MODE` | var | 本地开发登录开关，**生产必须 `false`** |

生产密钥（用 `wrangler secret put`）：

```
GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET / GITHUB_ADMIN_USERNAME
RESEND_API_KEY / NOTIFY_EMAIL   # 可选，缺省则静默降级
```

## 生产部署（摘要）

```bash
wrangler d1 create personal-blog-db          # 拿 database_id，替换 wrangler.jsonc
wrangler r2 bucket create personal-blog-assets
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put GITHUB_ADMIN_USERNAME
wrangler d1 migrations apply personal-blog-db --remote
npm ci && npm run build
wrangler deploy
```

完整清单见 `docs/requirements/personal-blog/09-release-checklist.md`。

## 文档索引

| 文件 | 内容 |
|------|------|
| `01-requirements-analysis.md` | 需求分析 |
| `02-codebase-analysis.md` | 代码库分析 |
| `03-tech-solution.md` | 技术方案 |
| `04-solution-review.md` | 方案评审 + 复评 |
| `05-implementation-log.md` | 实现日志 |
| `06-code-review.md` | 代码审查 |
| `07-self-test-checklist.md` | 自测清单 |
| `08-frontend-integration.md` | 接口联调文档 |
| `09-release-checklist.md` | 发布上线清单 |

## 说明

- 本仓库按要求**未提交、未推送**任何 Git 记录。
- 娱乐/工具箱当前为导航占位，未实现具体内容模型。
