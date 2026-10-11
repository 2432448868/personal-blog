import { Hono } from 'hono';
import { fail } from '@/lib/api';
import type { AppBindings } from '@/server/types';

const media = new Hono<AppBindings>();

media.get('/media/*', async (c) => {
  const key = c.req.path.replace(/^\/api\/media\//, '').replace(/^\/media\//, '');
  if (!key || key.includes('..') || key.startsWith('/')) {
    return c.json(fail('NOT_FOUND', '资源不存在'), 404);
  }
  const object = await c.env.BUCKET.get(key);
  if (!object) {
    return c.json(fail('NOT_FOUND', '资源不存在'), 404);
  }
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  return new Response(object.body, { headers });
});

export default media;
