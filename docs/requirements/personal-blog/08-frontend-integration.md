# 前端联调文档：个人博客网站

## 元数据
- 需求编号：PERSONAL-BLOG-001
- 更新时间：2026-10-11
- 本地基址：`http://localhost:4321`
- 统一响应：`{ "code": "OK", "message": "ok", "data": <T> }`；失败 `{ "code": "<ERR>", "message": "<中文>", "data": null }`
- 鉴权：Cookie 会话（本地 `blog_session`，生产 `__Host-blog_session`）；写操作需带 `X-CSRF-Token`

## 1. 约定

- 所有前端请求走 `/api/*`；桥接层会自动去掉 `/api` 前缀交给 Hono。
- `CSRF Token` 来源：登录后 `GET /api/auth/me` 或 `POST /api/auth/dev-login` 返回的 `data.user.csrfToken`。
- 分页：`page`（≥1）、`pageSize`（1..50，默认 10）；响应含 `total`、`totalPages`。
- 时间：ISO 字符串（`YYYY-MM-DD HH:MM:SS`，UTC）。

## 2. 公开接口

| 方法 | 路径 | 入参 | 出参要点 |
|------|------|------|----------|
| GET | `/api/health` | - | `status`、`bindings.db`、`bindings.bucket` |
| GET | `/api/posts` | `page`、`pageSize`、`category`、`tag`、`year`、`month` | `items[]`（含 categories/tags/commentCount）、`total`、`totalPages` |
| GET | `/api/posts/:slug` | - | 文章详情 + `categories` + `tags` + `prev`/`next` |
| GET | `/api/posts/:slug/comments` | - | 已通过评论树（`replies[]`） |
| GET | `/api/guestbook` | - | 已通过留言树 |
| GET | `/api/search-index` | - | `items[]`（title/slug/summary/tags/categories） |
| GET | `/api/tags` | - | 标签 + `postCount` |
| GET | `/api/categories` | - | 分类 + `postCount` |
| GET | `/api/archive` | - | `{ month, count }[]` |

## 3. 登录与鉴权

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | `/api/auth/login` | 无 | 跳 GitHub OAuth；未配置密钥时 302 到 `/admin/login?error=oauth_not_configured` |
| GET | `/api/auth/callback` | 无 | OAuth 回调，成功写会话 Cookie 并跳 `/admin` |
| POST | `/api/auth/dev-login` | 本地 | body `{ username? }`；仅开发环境可用，成功返回 `user`（含 csrfToken） |
| GET | `/api/auth/me` | 可选 | `{ authenticated, user }`；未登录 `user=null` |
| POST | `/api/auth/logout` | 登录 | 销毁会话，清 Cookie |

## 4. 互动接口

| 方法 | 路径 | 鉴权 | body | 返回码 |
|------|------|------|------|--------|
| POST | `/api/posts/:slug/comments` | 登录 | `{ content, parentId? }` | 201（普通用户 `pending`，管理员 `approved`） |
| POST | `/api/guestbook` | 登录 | `{ content, parentId?, name?, email?, website?, avatarUrl? }` | 201 |

## 5. 后台接口（需 `role=admin`）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/posts` | 列表；`status=all/published/draft` |
| GET | `/api/admin/posts/:id` | 详情（含 categoryIds/tagIds） |
| POST | `/api/admin/posts` | 创建；body 见下 |
| PUT | `/api/admin/posts/:id` | 更新 |
| DELETE | `/api/admin/posts/:id` | 软删除 |
| GET | `/api/admin/taxonomy` | 可选分类/标签 |
| GET | `/api/admin/comments` | 审核队列；`status=pending/approved/hidden/all` |
| PATCH | `/api/admin/comments` | `{ type: 'comment'|'guestbook', id, status }` |
| GET | `/api/admin/settings` | 站点配置 |
| PUT | `/api/admin/settings` | 批量更新白名单 key |
| GET | `/api/admin/stats` | 统计 |
| POST | `/api/admin/uploads` | `multipart/form-data`，字段 `file`；返回 `{ key, url }` |
| GET | `/api/media/*` | 读取 R2 对象（公开、长缓存） |

文章 body：

```json
{
  "title": "标题（必填，≤200）",
  "slug": "可选，留空自动生成",
  "summary": "可选，≤500",
  "content": "Markdown 正文（必填）",
  "coverImage": "/api/media/uploads/...",
  "status": "draft | published",
  "categoryIds": ["cat_x"],
  "tagIds": ["tag_x"]
}
```

## 6. 错误码

| code | HTTP | 含义 |
|------|------|------|
| UNAUTHORIZED | 401 | 未登录 |
| FORBIDDEN | 403 | 非管理员 |
| CSRF_INVALID | 403 | CSRF 头缺失或不匹配 |
| ORIGIN_INVALID | 403 | 来源校验失败 |
| VALIDATION_ERROR | 422 | 字段校验失败 |
| FILE_REQUIRED / FILE_TOO_LARGE / FILE_TYPE_INVALID | 400/413/415 | 上传校验 |
| NOT_FOUND | 404 | 资源不存在 |
| DATABASE_ERROR / INTERNAL_ERROR | 500 | 服务端异常 |

## 7. 联调注意

- 写接口必须带 `X-CSRF-Token`，否则 403（不是 401）。
- 上传用 `FormData`，**不要**手动设 `Content-Type`，交给浏览器带 boundary。
- 封面 URL 直接用返回的 `url`（`/api/media/...`），不要拼接 R2 公网域名。
