-- Local seed data. Idempotent: safe to run repeatedly.
-- AI generated: review before applying to a remote D1 database.

INSERT OR IGNORE INTO users (id, github_id, username, display_name, email, avatar_url, bio, role, created_at, updated_at, created_by, updated_by)
VALUES ('usr_admin', 'local-admin', 'laoda', '牢大', '', '', '把想法、代码和日子都留在这里。', 'admin', '2026-10-01 08:00:00', '2026-10-01 08:00:00', 'seed', 'seed');

INSERT OR IGNORE INTO site_settings (key, value, description) VALUES
('profile.name', '牢大的数字花园', '站点显示名称'),
('profile.bio', '一个写字、折腾代码、偶尔摸鱼的个人博客。', '博主简介'),
('profile.avatar', '/avatar.svg', '头像地址'),
('profile.motto', '把日子码成可检索的形状。', '座右铭'),
('site.announcement', '本地开发版已就绪。可以在后台改资料、发文章、审核评论。', '首页公告'),
('site.about', '这里记录技术实践、阅读笔记和普通生活。文章使用 Markdown 编写，支持深色模式、繁简切换、全屏阅读和本地搜索。', '关于页正文'),
('site.icp', '', 'ICP备案信息'),
('site.social_links', '[{"label":"GitHub","url":"https://github.com/"},{"label":"Email","url":"mailto:hello@example.com"}]', '社交链接 JSON'),
('site.started_at', '2026-10-01', '站点运行起始日期');

INSERT OR IGNORE INTO categories (id, name, slug, description, parent_id, sort_order, created_at, updated_at, created_by, updated_by) VALUES
('cat_tech', '技术', 'tech', '工程实践、架构与踩坑记录', '', 10, '2026-10-01 08:00:00', '2026-10-01 08:00:00', 'seed', 'seed'),
('cat_frontend', '前端', 'frontend', '浏览器、界面与体验', 'cat_tech', 20, '2026-10-01 08:00:00', '2026-10-01 08:00:00', 'seed', 'seed'),
('cat_backend', '后端', 'backend', '服务、数据与可靠性', 'cat_tech', 30, '2026-10-01 08:00:00', '2026-10-01 08:00:00', 'seed', 'seed'),
('cat_notes', '笔记', 'notes', '阅读与日常记录', '', 40, '2026-10-01 08:00:00', '2026-10-01 08:00:00', 'seed', 'seed');

INSERT OR IGNORE INTO tags (id, name, slug, created_at, updated_at, created_by, updated_by) VALUES
('tag_astro', 'Astro', 'astro', '2026-10-01 08:00:00', '2026-10-01 08:00:00', 'seed', 'seed'),
('tag_cf', 'Cloudflare', 'cloudflare', '2026-10-01 08:00:00', '2026-10-01 08:00:00', 'seed', 'seed'),
('tag_ts', 'TypeScript', 'typescript', '2026-10-01 08:00:00', '2026-10-01 08:00:00', 'seed', 'seed'),
('tag_reading', '阅读', 'reading', '2026-10-01 08:00:00', '2026-10-01 08:00:00', 'seed', 'seed'),
('tag_life', '生活', 'life', '2026-10-01 08:00:00', '2026-10-01 08:00:00', 'seed', 'seed');

INSERT OR IGNORE INTO posts (id, title, slug, summary, content, cover_image, status, author_id, view_count, word_count, published_at, created_at, updated_at, created_by, updated_by) VALUES
('post_hello', '开始写一个自己的博客', 'hello-personal-blog', '从今天起，把零散的想法整理成可以被检索、被回看的文字。', '# 为什么写博客

写博客不是给自己加一份作业。它更像一个长期运行的索引：今天解决过的问题、读过的一句话、突然冒出来的念头，都可以有个稳定的落点。

## 这个站点会写什么

- 技术与工程实践
- 阅读和思考
- 生活里的微小记录

## 先定一个小目标

不追求日更，只保证每次写下来的东西，未来还能看懂。', '', 'published', 'usr_admin', 128, 238, '2026-10-01 09:00:00', '2026-10-01 09:00:00', '2026-10-01 09:00:00', 'seed', 'seed'),
('post_astro', 'Astro 与边缘渲染：静态优先的折中方案', 'astro-edge-rendering', '静态优先、按需渲染，兼顾首屏性能和内容实时发布。', '# 静态优先不是口号

博客的核心内容变化不频繁，但管理后台需要即时发布。纯静态构建和实时内容之间存在天然冲突。

## 折中方式

使用 Astro 的静态页面承载固定内容，只让依赖 D1 的页面在边缘按需渲染。互动组件保持 Islands，不把整站变回单页应用。

```ts
const posts = await listPosts({ page: 1, pageSize: 10 });
```

这样既保留 HTML 首屏，又能让文章发布后立即生效。', '', 'published', 'usr_admin', 96, 312, '2026-10-03 10:30:00', '2026-10-03 10:30:00', '2026-10-03 10:30:00', 'seed', 'seed'),
('post_d1', 'D1 数据层的第一版边界', 'd1-data-boundaries', '参数化查询、批量装配关系、逻辑删除和分页上限。', '# 边界比表结构更重要

D1 是 SQLite，语法简单，但不代表可以随手写。第一版先把边界定死：

1. 所有查询参数化。
2. 文章列表批量加载标签和分类，禁止 N+1。
3. 分页最大 50 条。
4. 删除采用逻辑删除，保留审计字段。

## 先跑通，再优化

博客规模不需要一开始就上复杂缓存。先用清楚的查询边界，把数据读写跑稳。', '', 'published', 'usr_admin', 73, 285, '2026-10-05 14:20:00', '2026-10-05 14:20:00', '2026-10-05 14:20:00', 'seed', 'seed'),
('post_notes', '阅读笔记：把问题留在纸面上', 'reading-notes-on-paper', '阅读不是收集答案，而是整理问题的过程。', '# 笔记的作用

读到一个有意思的观点时，先把它改写成问题，再写自己的理解。这样的笔记比摘抄更能留下来。

## 三个简单规则

- 一句自己的话
- 一个具体例子
- 一个还没想清楚的问题

如果只能留一项，留最后那个问题。', '', 'published', 'usr_admin', 54, 176, '2026-10-08 20:10:00', '2026-10-08 20:10:00', '2026-10-08 20:10:00', 'seed', 'seed');

INSERT OR IGNORE INTO post_categories (post_id, category_id, created_at, created_by) VALUES
('post_hello', 'cat_notes', '2026-10-01 09:00:00', 'seed'),
('post_astro', 'cat_frontend', '2026-10-03 10:30:00', 'seed'),
('post_d1', 'cat_backend', '2026-10-05 14:20:00', 'seed'),
('post_notes', 'cat_notes', '2026-10-08 20:10:00', 'seed');

INSERT OR IGNORE INTO post_tags (post_id, tag_id, created_at, created_by) VALUES
('post_hello', 'tag_life', '2026-10-01 09:00:00', 'seed'),
('post_astro', 'tag_astro', '2026-10-03 10:30:00', 'seed'),
('post_astro', 'tag_cf', '2026-10-03 10:30:00', 'seed'),
('post_astro', 'tag_ts', '2026-10-03 10:30:00', 'seed'),
('post_d1', 'tag_cf', '2026-10-05 14:20:00', 'seed'),
('post_d1', 'tag_ts', '2026-10-05 14:20:00', 'seed'),
('post_notes', 'tag_reading', '2026-10-08 20:10:00', 'seed');

INSERT OR IGNORE INTO comments (id, post_id, user_id, parent_id, content, status, created_at, updated_at, created_by, updated_by) VALUES
('comment_1', 'post_hello', 'usr_admin', '', '欢迎来到第一篇文章。评论区会保留审核开关，站点主人可以决定是否公开。', 'approved', '2026-10-02 09:00:00', '2026-10-02 09:00:00', 'seed', 'seed'),
('comment_2', 'post_astro', 'usr_admin', '', '边缘渲染只覆盖需要实时数据的页面，静态页面不会被拖慢。', 'approved', '2026-10-04 11:00:00', '2026-10-04 11:00:00', 'seed', 'seed');

INSERT OR IGNORE INTO guestbook (id, user_id, parent_id, name, email, website, avatar_url, content, status, created_at, updated_at, created_by, updated_by) VALUES
('guest_1', 'usr_admin', '', '牢大', '', '', '', '留言板已经开放。登录后可以留言，管理员可以在后台审核。', 'approved', '2026-10-01 12:00:00', '2026-10-01 12:00:00', 'seed', 'seed');
