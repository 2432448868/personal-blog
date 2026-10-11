import type { D1Database } from '@cloudflare/workers-types';

export class DatabaseError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export async function queryAll<T>(db: D1Database, sql: string, params: unknown[] = []): Promise<T[]> {
  try {
    const result = await db.prepare(sql).bind(...params).all<T>();
    return result.results ?? [];
  } catch (error) {
    throw new DatabaseError('数据库查询失败', error);
  }
}

export async function queryOne<T>(db: D1Database, sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await queryAll<T>(db, sql, params);
  return rows[0] ?? null;
}

export async function execute(db: D1Database, sql: string, params: unknown[] = []): Promise<void> {
  try {
    await db.prepare(sql).bind(...params).run();
  } catch (error) {
    throw new DatabaseError('数据库写入失败', error);
  }
}

export function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}
