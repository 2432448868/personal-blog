import { Hono } from 'hono';
import { fail, ok } from '@/lib/api';
import { listGuestbook } from '@/server/db/interactions';
import { InteractionError, submitGuestbook } from '@/server/services/interactions';
import { notify } from '@/server/services/notifications';
import type { AppBindings } from '@/server/types';
import type { GuestbookItem } from '@/types/domain';

const guestbook = new Hono<AppBindings>();

function countItems(items: GuestbookItem[]): number {
  return items.reduce((total, item) => total + 1 + countItems(item.replies ?? []), 0);
}

guestbook.get('/guestbook', async (c) => {
  const items = await listGuestbook(c.env.DB);
  return c.json(ok({ items, total: countItems(items) }));
});

guestbook.post('/guestbook', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json(fail('UNAUTHORIZED', '请先登录后再留言'), 401);
  }
  const body = await c.req
    .json<{ content?: string; parentId?: string; name?: string; email?: string; website?: string; avatarUrl?: string }>()
    .catch(() => ({}) as { content?: string; parentId?: string; name?: string; email?: string; website?: string; avatarUrl?: string });
  try {
    const item = await submitGuestbook(c.env.DB, user, {
      content: body.content ?? '',
      parentId: body.parentId,
      name: body.name,
      email: body.email,
      website: body.website,
      avatarUrl: body.avatarUrl
    });
    if (item.status === 'approved') {
      notify(c.env, c, {
        subject: '新留言',
        lines: [`留言人：${item.name}`, '', item.content, '', `站点：${item.website || '未填写'}`]
      });
    }
    return c.json(ok(item), 201);
  } catch (error) {
    if (error instanceof InteractionError) {
      return c.json(fail('GUESTBOOK_INVALID', error.message), error.status as 400);
    }
    throw error;
  }
});

export default guestbook;
