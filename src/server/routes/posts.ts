import { Hono } from 'hono';
import { fail, ok } from '@/lib/api';
import { listArchive, listCategories, listPosts, listSearchIndex, listTags } from '@/server/db/content';
import { getPublishedPost } from '@/server/services/content';
import type { AppBindings } from '@/server/types';

const posts = new Hono<AppBindings>();

function toInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

posts.get('/posts', async (c) => {
  const query = c.req.query();
  const result = await listPosts(c.env.DB, {
    page: toInt(query.page, 1),
    pageSize: toInt(query.pageSize, 10),
    category: query.category,
    tag: query.tag,
    year: query.year,
    month: query.month,
    status: 'published'
  });
  return c.json(ok({ items: result.items, page: result.page, pageSize: result.pageSize, total: result.total, totalPages: result.totalPages }));
});

posts.get('/posts/:slug', async (c) => {
  const post = await getPublishedPost(c.env.DB, c.req.param('slug'), false);
  if (!post) {
    return c.json(fail('POST_NOT_FOUND', '文章不存在或未发布'), 404);
  }
  return c.json(ok(post));
});

posts.get('/tags', async (c) => c.json(ok({ items: await listTags(c.env.DB) })));

posts.get('/categories', async (c) => c.json(ok({ items: await listCategories(c.env.DB) })));

posts.get('/archive', async (c) => c.json(ok({ items: await listArchive(c.env.DB) })));

posts.get('/search-index', async (c) => {
  const items = await listSearchIndex(c.env.DB);
  return c.json(ok({ items, generatedAt: new Date().toISOString() }));
});

export default posts;
