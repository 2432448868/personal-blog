# 代码审查报告：个人博客网站

## 元数据
- 需求编号：PERSONAL-BLOG-001
- 审查时间：2026-10-11
- 审查范围：`src/**`、`migrations/**`、`scripts/smoke.mjs`
- 审查方式：静态走查 + `astro check` + 构建 + 端到端冒烟
- 结论：通过（0 阻断 / 0 高 / 2 中 / 3 低）；UI 复评后新增 1 项已修复缺陷（#5）

## 1. 分层与规范

| 检查项 | 结论 | 证据 |
|--------|------|------|
| Controller→Service→DB 分层 | ✅ | `routes/**` 只做校验与编排；SQL 集中在 `db/**` |
| 组件不直连数据库 | ✅ | 前端只走 `/api/*` |
| 无全限定类名堆砌 | ✅ | 统一 `import` 短名 + `@/` 别名 |
| 枚举代替魔法值 | ✅ | 状态用 `'draft'/'published'`、`'pending'/'approved'/'hidden'`；cookie 名在 `constants.ts` |
| 参数化查询 | ✅ | 全部 `.bind()`；`IN` 用占位符生成，无字符串拼接用户输入 |

## 2. 安全

| 项 | 结论 | 说明 |
|----|------|------|
| 会话 | ✅ | Token 只存哈希（`sha256Hex`），Cookie `HttpOnly+SameSite=Strict`，生产 `__Host-` + `Secure` |
| CSRF | ✅ | 写操作校验 `X-CSRF-Token` 与会话 `csrf_token` 一致，另校验 Origin/Referer |
| OAuth | ✅ | PKCE(`S256`) + 一次性 `state`（入库且带过期） |
| 开发登录门禁 | ✅ | 仅 `ENVIRONMENT=development && AUTH_DEV_MODE=true`，否则 404 |
| 越权 | ✅ | `/admin/*` 中间件强制 `role === 'admin'`；未登录 401、非管理员 403 |
| XSS | ✅ | 评论/留言纯文本；文章 Markdown 先 `escapeHtml` 再 `marked` |
| 路径穿越 | ✅ | media key 拒绝 `..` 与前导 `/` |
| 上传 | ✅ | 大小 ≤5MB、MIME 白名单、扩展名清洗 |

## 3. 数据与性能

- 逻辑删除：所有列表/详情查询均带 `deleted_at IS NULL`；软删仅置 `deleted_at`。
- 分页：`pageSize` 服务端收敛到 `1..50`，`page` 下限 1，越界不 500。
- N+1：文章列表用 `IN (...)` 批量装配标签/分类与评论数（`loadTaxonomy` / `loadCommentCounts`），无循环查库。
- 索引：`posts(status, published_at)`、`comments(post_id, status, created_at)`、各 `slug` 唯一索引等覆盖主要查询。

## 4. 发现的缺陷（已修复）

| # | 级别 | 问题 | 修复 | 复测 |
|---|------|------|------|------|
| 1 | 高 | `upsertUser` 用 `ON CONFLICT(github_id)` 命中部分唯一索引 → 500 | 改 SELECT→UPDATE/INSERT | ✅ |
| 2 | 中 | 未消费请求体污染连接，401 后下一个 POST 报 `fetch failed` | 桥接层先读 `arrayBuffer` | ✅ |
| 3 | 高 | CSRF 中间件挂 `/api/*`，剥离前缀后永不匹配 → 可绕过 | 改挂 `*` | ✅ |
| 4 | 中 | media 读取路由受前缀剥离影响，上传后 404 | key 计算兼容 `/media/` | ✅ |
| 5 | 高 | `ThemeToggle`/`ReadingTools` 依赖 `lucide-react`，Vite 预构建产物 404 导致 hydration 抛 `TypeError: _jsxDEV is not a function`，主题按钮点击失效 | 新增内置 `src/components/Icons.tsx`，移除 `lucide-react` 运行时依赖 | ✅ |

## 5. 遗留（不阻断本地交付）

| # | 级别 | 问题 | 建议 |
|---|------|------|------|
| 5 | 低 | 文章不存在时 `Astro.redirect('/404')` 返回 200 而非 404 | 后续改为返回 404 状态 |
| 6 | 低 | 构建有 >500kB 分块提示 | 需要时对后台/编辑器做动态 import |
| 7 | 低 | `/_astro/*` 之外的静态资源缓存策略未细分 | 视流量再调 `_headers` |

## 6. 验证证据

- `npm run check`：66 文件，0 errors / 0 warnings / 0 hints。
- `npm run build`：通过。
- `npm run smoke`：40 / 40 通过（含 401/403/CSRF/软删/R2 上传读回/审核）。

## 7. UI 复评（去 AI 味 / 设计感）

| 项 | 结论 | 证据 |
|----|------|------|
| 设计契约 | ✅ | 新增 `DESIGN.md`「庭园索引（纸 + 墨 + 朱笔）」；改页面前必读 |
| 6 套主题 | ✅ | 日间 宣纸/苔痕/靛青 + 夜间 墨夜/松烟/星野；CDP 实测 token、面板、`localStorage`、`theme-color` 与刷新保持均正确 |
| 自动审查 | ✅ | `avoid-ai-design` 扫描：0 P0 / 0 P1；仅 1 条 P2（mono 数字读数，有意保留） |
| 生成式默认 | ✅ 已清除 | 去全大写大字距 eyebrow、去「圆角白卡 + 同一软阴影」、去彩色辉光阴影、去彩色侧边条、去 CTA 装饰 `→` |
| 明暗对比度 | ✅ | 6 套主题：`--ink` ≈ 15:1，`--muted` 5.03~7.42:1，`--accent-ink` on `--accent` 5.43~9.26:1（均 ≥ AA 4.5:1） |
| 动效 | ✅ | 仅保留入场/主题揭示/即时反馈；统一 `--ease-out`，无回弹；`prefers-reduced-motion` 守护 |
| 键盘焦点 | ✅ | 全局 `:focus-visible` 朱笔轮廓（`globals.css`） |
| 真实浏览器 | ✅ | CDP 亮/暗各 9 页共 18 渲染 + 6 套主题专项：字体 `975Maru SC`、`main` 命中 `content-enter`、主题切换写入 `localStorage`、0 运行时/网络异常 |

证据：`~/.agents/evidence/personal-blog/ui-after-20261011/`（亮/暗 18 张 CDP 截图）、`~/.agents/evidence/personal-blog/theme-6-20261011/`（6 套主题截图与 `report.json`）
