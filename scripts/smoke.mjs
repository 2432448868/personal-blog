#!/usr/bin/env node
/**
 * personal-blog 本地冒烟脚本
 * 用法：先 `npm run dev`，另开终端执行 `npm run smoke`
 * 可通过 SMOKE_BASE_URL 覆盖默认地址（默认 http://localhost:4321）
 */

const BASE = (process.env.SMOKE_BASE_URL || 'http://localhost:4321').replace(/\/$/, '');

let passed = 0;
let failed = 0;
const failures = [];

function log(name, ok, detail) {
  if (ok) {
    passed += 1;
    console.log(`  \u2713 ${name}`);
  } else {
    failed += 1;
    failures.push(`${name} — ${detail}`);
    console.log(`  \u2717 ${name}  (${detail})`);
  }
}

async function req(path, init = {}) {
  const response = await fetch(`${BASE}${path}`, init);
  const contentType = response.headers.get('content-type') || '';
  let body;
  if (contentType.includes('application/json')) {
    body = await response.json().catch(() => null);
  } else {
    body = await response.text().catch(() => '');
  }
  return { status: response.status, body, headers: response.headers };
}

function cookieFrom(headers) {
  const raw = headers.get('set-cookie');
  if (!raw) return '';
  return raw.split(';')[0];
}

async function main() {
  console.log(`\n[smoke] 目标地址：${BASE}\n`);

  // 1. 健康检查
  try {
    const health = await req('/api/health');
    log('GET /api/health 返回 200', health.status === 200, `status=${health.status}`);
    log('健康检查 status=ok（D1 + R2 绑定正常）', health.body?.data?.status === 'ok', `status=${health.body?.data?.status}`);
  } catch (error) {
    log('GET /api/health', false, String(error));
  }

  // 2. 文章列表
  let firstSlug = '';
  try {
    const posts = await req('/api/posts?pageSize=5');
    const items = posts.body?.data?.items ?? [];
    log('GET /api/posts 返回 200 且有数据', posts.status === 200 && items.length > 0, `status=${posts.status}, items=${items.length}`);
    firstSlug = items[0]?.slug ?? '';
  } catch (error) {
    log('GET /api/posts', false, String(error));
  }

  // 3. 文章详情
  if (firstSlug) {
    const detail = await req(`/api/posts/${firstSlug}`);
    log('GET /api/posts/:slug 返回 200', detail.status === 200, `status=${detail.status}`);
    const missing = await req('/api/posts/__not_exist__');
    log('不存在的文章返回 404', missing.status === 404, `status=${missing.status}`);
  }

  // 4. 分类 / 标签 / 归档
  for (const path of ['/api/tags', '/api/categories', '/api/archive']) {
    const result = await req(path);
    log(`GET ${path} 返回 200`, result.status === 200, `status=${result.status}`);
  }

  // 5. 搜索索引
  const index = await req('/api/search-index');
  log('GET /api/search-index 返回 200', index.status === 200 && Array.isArray(index.body?.data?.items), `status=${index.status}`);

  // 6. 评论列表
  if (firstSlug) {
    const comments = await req(`/api/posts/${firstSlug}/comments`);
    log('GET /api/posts/:slug/comments 返回 200', comments.status === 200, `status=${comments.status}`);
  }

  // 7. 留言板
  const guestbook = await req('/api/guestbook');
  log('GET /api/guestbook 返回 200', guestbook.status === 200, `status=${guestbook.status}`);

  // 8. 未登录访问后台接口 -> 401
  const unauthorized = await req('/api/admin/stats');
  log('未登录访问 /api/admin/stats 返回 401', unauthorized.status === 401, `status=${unauthorized.status}`);

  // 9. 未登录评论 -> 401
  if (firstSlug) {
    const anonComment = await req(`/api/posts/${firstSlug}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '匿名评论（应被拒绝）' })
    });
    log('未登录评论返回 401', anonComment.status === 401, `status=${anonComment.status}`);
  }

  // 10. 开发登录
  let cookie = '';
  let csrf = '';
  let lastCommentId = '';
  const devLogin = await req('/api/auth/dev-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  if (devLogin.status === 200 && devLogin.body?.data?.user) {
    cookie = cookieFrom(devLogin.headers);
    csrf = devLogin.body.data.user.csrfToken ?? '';
    log('POST /api/auth/dev-login 登录成功', Boolean(cookie) && Boolean(csrf), `cookie=${Boolean(cookie)}, csrf=${Boolean(csrf)}`);
  } else {
    log('POST /api/auth/dev-login 登录成功', false, `status=${devLogin.status}（请确认 ENVIRONMENT=development 且 AUTH_DEV_MODE=true）`);
  }

  if (cookie) {
    const authHeaders = { Cookie: cookie, Accept: 'application/json' };

    const me = await req('/api/auth/me', { headers: authHeaders });
    log('登录后 /api/auth/me 返回管理员', me.body?.data?.user?.role === 'admin', `role=${me.body?.data?.user?.role}`);

    const stats = await req('/api/admin/stats', { headers: authHeaders });
    log('登录后访问 /api/admin/stats 返回 200', stats.status === 200, `status=${stats.status}`);

    const taxonomy = await req('/api/admin/taxonomy', { headers: authHeaders });
    log('GET /api/admin/taxonomy 返回 200', taxonomy.status === 200, `status=${taxonomy.status}`);

    // CSRF 缺失 -> 403
    const noCsrf = await req('/api/admin/posts', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'x', content: 'y', status: 'draft' })
    });
    log('缺少 CSRF 头的写操作返回 403', noCsrf.status === 403, `status=${noCsrf.status}`);

    // 带 CSRF 创建草稿
    const writeHeaders = { ...authHeaders, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, Origin: BASE };
    const created = await req('/api/admin/posts', {
      method: 'POST',
      headers: writeHeaders,
      body: JSON.stringify({
        title: `冒烟测试草稿 ${Date.now()}`,
        slug: '',
        summary: '自动化冒烟用例',
        content: '## 冒烟\n这是自动化冒烟测试创建的内容。',
        status: 'draft'
      })
    });
    log('创建草稿文章返回 201', created.status === 201, `status=${created.status}`);

    const newId = created.body?.data?.id;
    if (newId) {
      const updated = await req(`/api/admin/posts/${newId}`, {
        method: 'PUT',
        headers: writeHeaders,
        body: JSON.stringify({ title: '冒烟测试草稿（已更新）', content: '更新后的正文内容', status: 'published' })
      });
      log('更新并发布文章返回 200', updated.status === 200, `status=${updated.status}`);

      const deleted = await req(`/api/admin/posts/${newId}`, { method: 'DELETE', headers: writeHeaders });
      log('软删除测试文章返回 200', deleted.status === 200, `status=${deleted.status}`);
    }

    // 管理员评论审核列表
    const queue = await req('/api/admin/comments?status=pending', { headers: authHeaders });
    log('GET /api/admin/comments 返回 200', queue.status === 200, `status=${queue.status}`);

    // 管理员发评论（直接 approved）
    if (firstSlug) {
      const comment = await req(`/api/posts/${firstSlug}/comments`, {
        method: 'POST',
        headers: writeHeaders,
        body: JSON.stringify({ content: `冒烟测试评论 ${Date.now()}` })
      });
      log('管理员发表评论返回 201 且直接通过', comment.status === 201 && comment.body?.data?.status === 'approved', `status=${comment.status}, moderation=${comment.body?.data?.status}`);
      lastCommentId = comment.body?.data?.id ?? '';
    }

    // 图片上传（R2）并读取
    try {
      const pngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64');
      const form = new FormData();
      form.append('file', new Blob([pngBytes], { type: 'image/png' }), 'pixel.png');
      const upload = await req('/api/admin/uploads', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': csrf, Origin: BASE }, body: form });
      const mediaUrl = upload.body?.data?.url ?? '';
      log('POST /api/admin/uploads 返回 201', upload.status === 201 && Boolean(mediaUrl), `status=${upload.status}`);
      if (mediaUrl) {
        const media = await req(mediaUrl);
        log('GET /api/media/* 返回图片', media.status === 200, `status=${media.status}`);
      }
    } catch (error) {
      log('POST /api/admin/uploads', false, String(error));
    }

    // 留言板（管理员直接通过）
    const guest = await req('/api/guestbook', {
      method: 'POST',
      headers: writeHeaders,
      body: JSON.stringify({ content: `冒烟测试留言 ${Date.now()}` })
    });
    log('POST /api/guestbook 返回 201', guest.status === 201, `status=${guest.status}`);

    // 内容审核：隐藏后恢复
    if (lastCommentId) {
      const hide = await req('/api/admin/comments', {
        method: 'PATCH',
        headers: writeHeaders,
        body: JSON.stringify({ type: 'comment', id: lastCommentId, status: 'hidden' })
      });
      log('PATCH /api/admin/comments 隐藏返回 200', hide.status === 200, `status=${hide.status}`);
      const restore = await req('/api/admin/comments', {
        method: 'PATCH',
        headers: writeHeaders,
        body: JSON.stringify({ type: 'comment', id: lastCommentId, status: 'approved' })
      });
      log('PATCH /api/admin/comments 恢复返回 200', restore.status === 200, `status=${restore.status}`);
    }

    // 退出登录
    const logout = await req('/api/auth/logout', { method: 'POST', headers: writeHeaders });
    log('POST /api/auth/logout 返回 200', logout.status === 200, `status=${logout.status}`);
  }

  // 11. 前台页面可访问
  for (const path of ['/', '/post', '/archive', '/tags', '/categories', '/guestbook', '/about', '/search', '/admin/login', '/rss.xml', '/sitemap.xml']) {
    const page = await req(path, { redirect: 'manual' });
    log(`GET ${path} 返回 200`, page.status === 200, `status=${page.status}`);
  }

  console.log(`\n[smoke] 通过 ${passed} 项，失败 ${failed} 项`);
  if (failures.length) {
    console.log('\n失败明细：');
    for (const item of failures) console.log(`  - ${item}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[smoke] 执行异常', error);
  process.exitCode = 1;
});
