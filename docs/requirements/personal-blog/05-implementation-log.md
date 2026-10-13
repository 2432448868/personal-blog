# 编码实现日志：个人博客网站

## 元数据
- 需求编号：PERSONAL-BLOG-001
- 实现时间：2026-10-11
- 范围：本地开发 + 本地验证，不含任何 Git 提交/推送
- 技术栈：Astro 7.3.8(`output: server`) + `@astrojs/cloudflare` 14.3.4 + React 19 Islands + Tailwind 4 + Hono 4 + D1 + R2 + Zod 4
- 结论：本地编码完成；`astro check` 0 错误；`npm run build` 通过；冒烟 40/40 通过；6 套主题与默认封面已 CDP 实测

## 1. 交付物清单

| 层 | 位置 | 说明 |
|----|------|------|
| 页面 | `src/pages/**` | 首页 / 文章列表 / 详情 / 归档 / 标签 / 分类 / 留言 / 关于 / 搜索 / 404 / 后台 |
| 动态输出 | `src/pages/rss.xml.ts`、`src/pages/sitemap.xml.ts` | RSS 与动态 sitemap（含文章/标签/分类） |
| API 桥 | `src/pages/api/[...route].ts` | 剥离 `/api` 前缀后交给 Hono |
| API | `src/server/routes/**` | health / posts / comments / guestbook / auth / admin / media |
| 服务层 | `src/server/services/**` | auth / content / interactions / posts / notifications |
| 数据层 | `src/server/db/**` | auth / content / interactions / settings / client |
| 组件 | `src/components/**` | Header / Footer / ArticleCard / PostCover / 主题 / 阅读工具 / 评论 / 留言 / 搜索 / 登录 / 后台 Dashboard / 编辑器 |
| 迁移 | `migrations/0001_init.sql`、`migrations/0002_seed.sql` | 建表 + 种子；`migrations/rollback/**` 配套回滚 |
| 冒烟 | `scripts/smoke.mjs` | 40 项端到端检查 |

## 2. 关键实现点

- 单仓单 Worker；页面层 → Hono → 服务层 → D1/R2，组件不直连数据库。
- 鉴权双通道：生产 GitHub OAuth PKCE（`state` 一次性 + `code_verifier`），本地 `POST /api/auth/dev-login` 仅在 `ENVIRONMENT=development && AUTH_DEV_MODE=true` 开放，生产返回 404。
- Cookie：生产 `__Host-blog_session`（`Secure+HttpOnly+SameSite=Strict`），本地非 `__Host-` 前缀兼容 HTTP。
- 写接口统一 Session + Origin/Referer + `X-CSRF-Token` 三重校验，失败 403。
- 评论/留言：普通用户 `pending` 审核，管理员直接 `approved`；列表只返回已通过。
- 逻辑删除贯穿所有列表查询；分页上限 50；关联装配用 `IN` 批量，避免 N+1。
- Markdown：先 `escapeHtml` 再 `marked` 解析，杜绝脚本注入。
- R2 上传：校验大小（≤5MB）、MIME（JPG/PNG/WebP/GIF）、扩展名，随机 key `uploads/YYYY-MM-DD/<uuid>.<ext>`；`GET /api/media/*` 回读。
- 邮件：Resend 可选，缺少 `RESEND_API_KEY`/`NOTIFY_EMAIL` 时静默降级，不阻塞业务。
- 字体：正文与标题统一使用自托管 `975Maru SC`（`public/fonts/975maru/`，609 个 unicode-range 分片），回退链保留 PingFang SC / Noto Sans SC / 微软雅黑；代码块保留等宽字体。
- 主题：`ThemeSwitcher` 提供日间 3 套（宣纸/苔痕/靛青）+ 夜间 3 套（墨夜/松烟/星野），用 `[data-theme]` token 驱动；选择写入 `localStorage.blog-theme`，无偏好时跟随系统；切换同步 `data-theme`、`.dark`、`theme-color`，保留 `startViewTransition` 圆形揭示，尊重 `prefers-reduced-motion`。
- 默认封面：文章未填 `cover_image` 时自动渲染内联 SVG 默认封面（`src/lib/default-cover.ts` 生成「庭园地平线 + 土坡 + 朱印首字」，`src/components/PostCover.astro` 统一渲染），列表缩略图 / 详情页头图 / 后台编辑器预览三处共用；SVG 颜色全走主题令牌，随 6 套主题自动变色，无需上传即有封面。
- 设计系统：全站遵循 `DESIGN.md`「庭园索引（纸 + 墨 + 朱笔批注）」——暖纸底 `#f5f2ec`/深墨夜 `#131418`、发丝线分隔 + 留白、方角按钮/chip（`border-radius: 3px`）、等宽数字索引；列表一律用行（`rule-row` / `article-row`），不再堆「圆角白卡 + 同一软阴影」。
- 动效：只保留三类——`main` 内容入场（`content-enter` 轻上移淡入）、主题切换圆形揭示（`startViewTransition` + `clip-path`）、按压/展开即时反馈；缓动统一 `--ease-out`，无回弹/overshoot；`prefers-reduced-motion` 下全部关闭。

## 3. 实现期发现并修复的缺陷

| # | 现象 | 根因 | 修复 |
|---|------|------|------|
| 1 | `/api/auth/dev-login` 返回 500 | `upsertUser` 用 `ON CONFLICT(github_id)`，但 `github_id` 只是**部分唯一索引**，SQLite 不认 | 改为「先 SELECT，命中 UPDATE 否则 INSERT」，不动表结构 |
| 2 | 401 后紧接着的 POST 报 `fetch failed` | Hono 未消费请求体（401 直接返回），残留未读流污染 dev→miniflare 连接 | 桥接层先把请求体读为 `ArrayBuffer` 再构造 `Request` |
| 3 | 缺少 CSRF 头也能写成功 | `csrfMiddleware` 挂在 `/api/*`，但桥接层已剥离 `/api` 前缀，规则永不匹配 | 改为 `app.use('*', csrfMiddleware)` |
| 4 | 上传成功后 `GET /api/media/*` 返回 404 | media 路由按 `/api/media/` 取 key，同样受前缀剥离影响 | key 计算兼容 `/media/` 前缀 |
| 5 | 顶栏主题按钮点击无反应，SSR 正常但 hydration 抛 TypeError: _jsxDEV is not a function | ThemeToggle/ReadingTools 依赖 lucide-react，Vite 预构建产物 node_modules/.vite/deps/lucide-react.js 404，客户端 hydration 失败 | 新增内置 src/components/Icons.tsx（Moon/Sun/Languages/Maximize2/Minimize2/Printer），移除 lucide-react 运行时依赖 |
| 6 | 全站「AI 味」重、缺设计感 | 生成式默认堆叠：全大写大字距英文 eyebrow、每区块同一圆角白卡 + 同一软阴影、彩色发光阴影、彩色侧边条、CTA 焊 `→`、回弹缓动 | 立 `DESIGN.md` 为设计契约，全站重写为发丝线 + 留白 + 数字索引，去 eyebrow / 装饰箭头 / 彩色辉光 |
| 7 | 暗色模式次要文字对比度不足 | 旧 `--muted #99a2b0` 叠深底低于 WCAG AA | 暗色 `--muted` 提为 `#a29c92`（在 `#131418` 上约 6.9:1） |
| 8 | 后台 / 登录 / 留言残留旧卡片样式 | `rounded-lg border-dashed`、`bg-raised`、`font-serif` 等旧 token 残留 | 统一到新 token（`rounded-[3px]`、`bg-paper-soft`、去冗余 `font-serif`） |
| 9 | 首次加载已存非默认主题时 `theme-color` 仍为默认暖纸色 | 首屏内联脚本执行早于全局样式解析，`getComputedStyle` 读不到 `--surface` | 首屏脚本改为主题 → surface 映射，挂载后再从计算样式同步 |

## 4. 构建与验证结果

| 项 | 命令 | 结果 |
|----|------|------|
| 类型/语法检查 | `npm run check` | 66 文件，0 errors / 0 warnings / 0 hints |
| 生产构建 | `npm run build` | 通过（含 check）；仅 1 条 chunk >500kB 提示，非阻塞 |
| 端到端冒烟 | `npm run smoke` | 40 / 40 通过 |
| UI 复评（CDP 真实浏览器） | 6 套主题/字体/动效实测 | 3 日间 + 3 夜间均正确解析 token 和 `theme-color`，点击切换与刷新保持生效，字体解析为 `975Maru SC`，`main` 入场动画存在，0 运行时异常 |
| 默认封面复验（CDP） | 首页/列表/详情/后台预览 × 6 套主题 | 首页 4 篇、列表 4 篇、详情 1 篇均渲染默认封面，后台预览固定 16/9 盒正确；6 套主题配色随令牌，375px 不挤压标题，0 运行时异常 |
| UI 设计审查 | `node .../avoid-ai-design/scripts/detect.mjs src` | 0 P0 / 0 P1；仅 1 条 P2（`font-mono` 用于对齐数字读数，设计有意保留） |

> 已知非阻塞项：`astro build` 提示存在 >500kB 的分块（编辑器/后台依赖所致）；后续可按需拆分。

## 5. 未完成 / 待人工确认

- 生产 OAuth / D1 / R2 / Resend 真实密钥未配置（本地只用模拟），故生产登录与真实邮件只文档化未实测。
- `wrangler.jsonc` 的 `database_id` 仍为占位，部署前必须替换。
- 娱乐 / 工具箱仅保留导航落点，未实现具体内容模型（需求未给出数据模型）。
- 未提交 Git、未推送：符合“先不推送代码”的要求。

## 6. 语雀文档批量导入（2026-10-11）

### 6.1 实现

| 项 | 说明 |
|----|------|
| 导入脚本 | `scripts/import-yuque.mjs`：解析 `.yuque-manifest.json`；标题取首个 H1 > manifest title > 文件名；slug 唯一化；HTML 清洗（`<img>`→Markdown 图、`<a>`→链接、其余标签剥离，代码围栏原样） |
| 图片处理 | 相对引用解析到各目录 `assets/`，sharp 转 webp（最长边 1600 / q82），落 `public/yuque-assets/<sha1[0:10]>/` |
| SQL 产物 | `tmp/yuque-sql/00-taxonomy.sql` + `01~08-posts.sql`；`INSERT … ON CONFLICT(id) DO UPDATE`，分类/标签关联表先 DELETE 再 INSERT |
| Markdown 渲染 | 重写 `src/lib/markdown.ts`：仅对 marked 的 raw HTML token 转义、放行 `<br>`，修掉代码块二次转义（`List<String>` 被渲染成 `List&lt;String&gt;`） |

### 6.2 导入结果

| 指标 | 值 |
|------|----|
| 文章 | 157 篇（`yq_*`）；远程 `posts` 合计 161（含 4 篇种子） |
| 分类 / 标签 | 新增 6 分类、16 标签（远程累计 10 / 21） |
| 图片 | 826 个文件、22.18 MB（815 webp + 10 svg + 1 gif），原图 88.1 MB |
| 缺失图片引用 | 74 处（语雀早期扁平 `assets/image-*.png`，原件不存在，已丢弃为空引用） |
| 空文档 | 6 篇正文几乎为空（ES / RabbitMQ / Seata / Spring系列 / dockerFile / vue），已导入但内容单薄 |

### 6.3 验证

| 项 | 命令 | 结果 |
|----|------|------|
| 类型/语法检查 | `npm run check` | 69 文件，0 errors / 0 warnings / 0 hints |
| 生产构建 | `npm run build` | 通过 |
| 本地 D1 导入 | `wrangler d1 execute --local` × 9 | 全部 success |
| 本地页面 | `/post`、`/post/<slug>` | 200，图片与代码块渲染正常 |
| 远程 D1 导入 | `wrangler d1 execute --remote` × 9 | 全部 success |
| 生产部署 | `wrangler deploy` | 795 个资源上传；版本 `cf40cba2-dd55-41a2-80ac-ee93d617e43a` |
| 线上冒烟 | `/post`、详情页、`/yuque-assets/*.webp` | 200 / 200 / 200 `image/webp` |

### 6.4 备注

- 13 篇 JavaSE 原文 H1 均为「JAVAOOP」，slug 落为 `javaoop`…`javaoop-13`，可读性差；如需可改为按路径生成。
- `RabbitMQ` ×3、`Servlet` ×2 同名，已自动加 `-2` / `-3` 后缀。
- 本轮改动（`scripts/import-yuque.mjs`、`src/lib/markdown.ts`、`.gitignore`、`public/yuque-assets/`、`src/components/admin/PostEditor.tsx`）尚未提交 Git。
## 7. 归档页 500 修复（2026-10-12）

| 项 | 说明 |
|----|------|
| 现象 | 线上 `/archive` 返回 500「该网页无法正常运作」，本地同路径同样 500 |
| 根因 | `decoratePosts → loadTaxonomy / loadCommentCounts` 把全部文章 id 拼进一条 `IN (?, …)`；157+ 个绑定参数超过 D1「单条语句最多 100 个绑定参数」上限。`/post` 分页每页 10 条，所以一直正常 |
| 修复 | `src/server/db/content.ts` 新增 `chunk()` 与 `PARAM_CHUNK_SIZE = 90`，两处批量查询改为按 90 一批循环执行后合并结果；`getRelatedPosts` 的 tagIds 加 `.slice(0, PARAM_CHUNK_SIZE - 4)` 兜底 |
| 验证 | `npm run check` 69 文件 0/0/0；本地 `/archive` 500 → 200（161 篇）；部署版本 `4e1804e5-b6e5-4c42-a121-dd1e464f0680`；线上 `/archive` `/search` `/tags` `/categories` 全部 200，归档页渲染 161 条、覆盖 2022–2026 |

补充说明：同类隐患已排查完毕，仓库内 `placeholders()` 仅剩这 3 处调用，全部受 90 上限保护。

## 8. Mermaid 流程图自动渲染（2026-10-12）

| 项 | 说明 |
|----|------|
| 能力 | 文章正文中的 ` ```mermaid ` 代码块自动替换为内联 SVG；无 Mermaid 的页面不下载运行时 |
| 实现 | `src/lib/mermaid-client.ts` 动态加载 `/vendor/mermaid/mermaid.esm.min.mjs`，`MermaidEnhancer.astro` 在文章页/关于页挂载；跟随 6 套主题令牌重绘；失败时回退显示原始代码块 |
| 兼容处理 | 渲染前自动给含括号、HTML 换行、`{}` 的流程图标签加引号；注释掉 ER 图中不受支持的流程图式 note 行，避免单张图失败拖垮整篇 |
| 资源同步 | `scripts/sync-mermaid.mjs` 在 `predev` / `prebuild` 把 Mermaid browser ESM + chunks 同步到 `public/vendor/mermaid`（15.70 MB，207 文件，已 gitignore）；构建产物已复核包含 `dist/client/vendor/mermaid` |
| 阅读工具 | `ReadingTools.tsx` 繁简转换跳过 `SVG`，避免转换后破坏图形文本 |
| 验证 | `npm run check` 73 文件 0/0/0；`npm run build` 通过；本地 D1 中 21 篇含 Mermaid 文档、117 个代码块逐个 CDP 渲染，SVG 数量与代码块数量一致，0 运行时异常；切夜间主题后重绘成功 |
| 已知非阻塞项 | `npm run smoke` 中图片上传接口仍为 500（本地未配置 R2 `BUCKET` 绑定；用户已明确暂不做图片上传），与 Mermaid 无关 |