import { Hono } from 'hono';
import { ok } from '@/lib/api';
import { queryOne } from '@/server/db/client';
import type { AppBindings } from '@/server/types';

const health = new Hono<AppBindings>();

health.get('/health', async (c) => {
  const checks = { database: false, bucket: false };
  let databaseMessage = '';
  try {
    const row = await queryOne<{ ok: number }>(c.env.DB, 'SELECT 1 AS ok');
    checks.database = row?.ok === 1;
  } catch (error) {
    databaseMessage = error instanceof Error ? error.message : '未知错误';
  }
  checks.bucket = Boolean(c.env.BUCKET);
  const status = checks.database ? 'ok' : 'degraded';
  return c.json(
    ok({
      status,
      environment: c.env.ENVIRONMENT,
      checks,
      message: databaseMessage,
      timestamp: new Date().toISOString()
    })
  );
});

export default health;
