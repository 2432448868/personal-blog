import { Hono } from 'hono';
import { fail } from '@/lib/api';
import { DatabaseError } from '@/server/db/client';
import { csrfMiddleware, sessionMiddleware } from '@/server/middleware/auth';
import adminRoutes from '@/server/routes/admin';
import authRoutes from '@/server/routes/auth';
import commentsRoutes from '@/server/routes/comments';
import guestbookRoutes from '@/server/routes/guestbook';
import healthRoutes from '@/server/routes/health';
import mediaRoutes from '@/server/routes/media';
import postsRoutes from '@/server/routes/posts';
import type { AppBindings } from '@/server/types';

export function createApp() {
  const app = new Hono<AppBindings>();

  app.use('*', async (c, next) => {
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'SAMEORIGIN');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  });

  app.use('*', sessionMiddleware);
  app.use('*', csrfMiddleware);

  app.route('/', healthRoutes);
  app.route('/', postsRoutes);
  app.route('/', commentsRoutes);
  app.route('/', guestbookRoutes);
  app.route('/', authRoutes);
  app.route('/', adminRoutes);
  app.route('/', mediaRoutes);

  app.notFound((c) => c.json(fail('NOT_FOUND', '接口不存在'), 404));

  app.onError((error, c) => {
    if (error instanceof DatabaseError) {
      console.error('[api] 数据库错误', error.cause ?? error);
      return c.json(fail('DATABASE_ERROR', '数据库操作失败'), 500);
    }
    console.error('[api] 未捕获异常', error);
    return c.json(fail('INTERNAL_ERROR', '服务器内部错误'), 500);
  });

  return app;
}
