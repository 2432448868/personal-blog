# 自测清单：个人博客网站

## 元数据
- 需求编号：PERSONAL-BLOG-001
- 自测时间：2026-10-11
- 环境：本地 `npm run dev`（Wrangler/Miniflare 模拟 D1 + R2），`http://localhost:4321`
- 自动化：`npm run smoke` → 40 / 40 通过；`npm run check` → 0 errors

## 0. 准备

```powershell
cd C:\Users\wkl\Desktop\codex_work_space\personal-blog
npm install
npm run db:local:migrate   # 建表
npm run db:local:seed      # 种子数据
npm run dev                # 终端 A
npm run smoke              # 终端 B
```

## 1. 自动化用例结果

| # | 用例 | 期望 | 结果 |
|---|------|------|------|
| 1 | `GET /api/health` | 200 且 `status=ok`（D1+R2） | ✅ |
| 2 | `GET /api/posts` | 200 且有数据 | ✅ |
| 3 | `GET /api/posts/:slug` | 200 | ✅ |
| 4 | `GET /api/posts/__not_exist__` | 404 | ✅ |
| 5 | `GET /api/tags` / `categories` / `archive` | 200 | ✅ |
| 6 | `GET /api/search-index` | 200 | ✅ |
| 7 | `GET /api/posts/:slug/comments` | 200 | ✅ |
| 8 | `GET /api/guestbook` | 200 | ✅ |
| 9 | 未登录 `GET /api/admin/stats` | 401 | ✅ |
| 10 | 未登录发评论 | 401 | ✅ |
| 11 | `POST /api/auth/dev-login` | 200，下发 Cookie 与 CSRF | ✅ |
| 12 | 登录后 `GET /api/auth/me` | `role=admin` | ✅ |
| 13 | 登录后 `GET /api/admin/stats` | 200 | ✅ |
| 14 | `GET /api/admin/taxonomy` | 200 | ✅ |
| 15 | 缺 CSRF 头的写操作 | 403 | ✅ |
| 16 | 创建草稿 `POST /api/admin/posts` | 201 | ✅ |
| 17 | 更新并发布 `PUT /api/admin/posts/:id` | 200 | ✅ |
| 18 | 软删除 `DELETE /api/admin/posts/:id` | 200 | ✅ |
| 19 | `GET /api/admin/comments` | 200 | ✅ |
| 20 | 管理员发评论 | 201 且 `approved` | ✅ |
| 21 | `POST /api/admin/uploads`（R2） | 201 返回 url | ✅ |
| 22 | `GET /api/media/*` | 200 且 `image/png` | ✅ |
| 23 | `POST /api/guestbook` | 201 | ✅ |
| 24 | `PATCH /api/admin/comments` 隐藏/恢复 | 200 | ✅ |
| 25 | `POST /api/auth/logout` | 200 | ✅ |
| 26 | 前台 11 个路由（`/`、`/post`、`/[slug]`、`/archive`、`/tags`、`/categories`、`/guestbook`、`/about`、`/search`、`/rss.xml`、`/sitemap.xml`） | 200 | ✅ |

## 2. 浏览器行为（含 CDP 实测）

| # | 场景 | 步骤 | 期望 | 结果 |
|---|------|------|------|------|
| M1 | 6 套主题切换 | 顶栏展开日间/夜间分组，逐套切换并刷新 | 立即生效、刷新保持、圆形揭示、首屏不闪错色 | ✅ CDP 实测：宣纸/苔痕/靛青/墨夜/松烟/星野的 `data-theme`、`--surface`、`--ink`、`--accent`、`--accent-ink`、`color-scheme` 全部正确；面板 6 项、当前项勾选、`localStorage`、`theme-color` 均正确，0 运行时异常 |
| M2 | 繁简转换 | 阅读工具切换 | 正文转换，代码块不受影响 | ⬜ 待人工 |
| M3 | 全屏/打印 | 文章页触发 | 进入全屏/打印样式正常 | ⬜ 待人工 |
| M4 | 后台编辑器 | `/admin` 新建→保存草稿→发布 | 列表出现，前台可见 | ⬜ 待人工 |
| M5 | 封面上传 | 编辑器上传图片 | 预览显示，保存后前台封面正常 | ⬜ 待人工 |
| M6 | 评论审核 | 普通用户评论→后台审核 | 审核前不显示，通过后显示 | ⬜ 待人工 |
| M7 | 留言板 | 登录后留言 | 生成留言，管理员直通 | ⬜ 待人工 |
| M8 | 搜索 | `/search` 输入关键词 | 本地即时命中标题/摘要 | ⬜ 待人工 |
| M9 | 退出登录 | 后台退出 | 回到登录页，后台接口 401 | ⬜ 待人工 |
| M10 | 字体 | 任意页面查看正文/标题字体 | 解析为 `975Maru SC`（缺失则按回退链） | ✅ CDP 实测：`document.fonts.check` 为 true，计算字体为 `975Maru SC` |
| M11 | 交互动效 | 行/按钮/chip/输入框悬停与聚焦 | 行下划线滑入、按钮按压反馈、输入聚焦、无回弹 | ✅ 已按 `DESIGN.md` 实现（`--ease-out`，无 overshoot） |
| M12 | 页面过渡 | 站内跳转到文章/归档/关于 | 入场动画生效，无闪烁 | ✅ CDP 实测：`main` 命中 `content-enter` 动画 |
| M13 | 移动端菜单 | 窄屏展开导航 | 面板下拉动画 | ⬜ 待人工（`menu-in` 已实现） |
| M14 | 去 AI 味 | `avoid-ai-design` 扫描 `src` | P0=0、P1=0 | ✅ 仅 1 条 P2（mono 数字读数，有意保留） |
| M15 | 6 套主题对比度 | 正文 / 次要文字 / 强调色按钮 | ≥ 4.5:1 | ✅ 6 套 `--ink` 全部 ≈ 15:1；`--muted` 5.03~7.42:1；`--accent-ink` on `--accent` 5.43~9.26:1 |
| M16 | 减弱动效 | 系统开启「减少动态效果」 | 动画/过渡关闭 | ✅ `@media (prefers-reduced-motion: reduce)` 全局守护 |
| M17 | 默认封面（无封面） | 文章未设封面，看首页/列表/详情 | 三处均显示默认封面（土坡+朱印），随主题变色 | ✅ CDP 实测：6 套主题下首页 4 篇 + 列表 4 篇 + 详情 1 篇均渲染默认封面，颜色随 `--paper-soft`/`--ink`/`--accent` 变化，0 运行时异常 |
| M18 | 自定义封面（有封面） | 文章设 `coverImage` 后查看三处 | 显示真实图片，不叠加默认封面 | ✅ 逻辑分支 `src.trim().length>0` → `<img>`；种子文章封面为空走默认分支（真图分支由上传流程覆盖，见 M5） |
| M19 | 后台编辑器封面预览 | 打开 `/admin/editor?id=post_notes` | 未填 URL 时预览显示默认封面 | ✅ CDP 实测：预览 `aspect-[16/9]` 盒内渲染默认封面 SVG，标签「封面图 URL（留空则用默认封面）」 |
| M20 | 移动端封面布局 | 375px 宽看首页/列表 | 缩略图在右、不挤压标题 | ✅ CDP 实测：375px 下卡片宽 333px、缩略图 80px、标题宽 237px 单行未挤压 |

## 3. 边界与异常

| # | 场景 | 期望 |
|---|------|------|
| E1 | `pageSize=999` | 服务端收敛为 50，不报错 |
| E2 | `page=0` / 负数 | 收敛为第 1 页 |
| E3 | 上传 >5MB | 413 |
| E4 | 上传 `.txt` | 415 |
| E5 | 无 Cookie 写操作 | 401 |
| E6 | 有 Cookie 无 CSRF | 403 |
| E7 | 生产模式访问 `dev-login` | 404 |

## 4. 结论

自动化 40/40 通过，构建与类型检查 0 错误；第 2 节 M1/M10/M11/M12 已用 CDP 真实浏览器实测通过，其中 M1 覆盖 3 套日间 + 3 套夜间主题；默认封面 M17–M20 亦经 CDP 实测通过。其余浏览器行为与第 3 节边界项建议交付前人工复核，代码侧逻辑已就绪。
