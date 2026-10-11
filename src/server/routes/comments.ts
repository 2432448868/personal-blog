import { Hono } from 'hono';
import { fail, ok } from '@/lib/api';
import { getPostBySlug } from '@/server/db/content';
import { listComments } from '@/server/db/interactions';
import { InteractionError, submitComment } from '@/server/services/interactions';
import { notify } from '@/server/services/notifications';
import type { AppBindings } from '@/server/types';
import type { CommentItem } from '@/types/domain';

const comments = new Hono<AppBindings>();

function countComments(items: CommentItem[]): number {
  return items.reduce((total, item) => total + 1 + countComments(item.replies ?? []), 0);
}

comments.get('/posts/:slug/comments', async (c) => {
  const post = await getPostBySlug(c.env.DB, c.req.param('slug'), false);
  if (!post || post.status !== 'published') {
    return c.json(fail('POST_NOT_FOUND', '文章不存在或未发布'), 404);
  }
  const items = await listComments(c.env.DB, post.id);
  return c.json(ok({ items, total: countComments(items) }));
});

comments.post('/posts/:slug/comments', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json(fail('UNAUTHORIZED', '请先登录后再评论'), 401);
  }
  const body = await c.req
    .json<{ content?: string; parentId?: string }>()
    .catch(() => ({}) as { content?: string; parentId?: string });
  try {
    const result = await submitComment(c.env.DB, user, c.req.param('slug'), {
      content: body.content ?? '',
      parentId: body.parentId
    });
    if (result.comment.status === 'approved') {
      notify(c.env, c, {
        subject: `新评论：${result.postTitle}`,
        lines: [`评论人：${user.displayName || user.username}`, '', result.comment.content, '', `文章：${result.postSlug}`]
      });
    }
    return c.json(ok(result.comment), 201);
  } catch (error) {
    if (error instanceof InteractionError) {
      return c.json(fail('COMMENT_INVALID', error.message), error.status as 400);
    }
    throw error;
  }
});

export default comments;
