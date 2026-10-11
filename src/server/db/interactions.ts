import type { D1Database } from '@cloudflare/workers-types';
import type { CommentItem, GuestbookItem, ModerationStatus } from '@/types/domain';
import { execute, queryAll, queryOne } from './client';

interface CommentRow {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string;
  content: string;
  status: ModerationStatus;
  created_at: string;
  user_name: string;
  user_avatar: string;
  post_title?: string;
  post_slug?: string;
}

interface GuestbookRow {
  id: string;
  user_id: string;
  parent_id: string;
  name: string;
  website: string;
  avatar_url: string;
  content: string;
  status: ModerationStatus;
  created_at: string;
}

function mapComment(row: CommentRow): CommentItem {
  return {
    id: row.id,
    postId: row.post_id,
    userId: row.user_id,
    parentId: row.parent_id,
    content: row.content,
    status: row.status,
    userName: row.user_name || '访客',
    userAvatar: row.user_avatar,
    createdAt: row.created_at
  };
}

function mapGuestbook(row: GuestbookRow): GuestbookItem {
  return {
    id: row.id,
    userId: row.user_id,
    parentId: row.parent_id,
    name: row.name || '访客',
    website: row.website,
    avatarUrl: row.avatar_url,
    content: row.content,
    status: row.status,
    createdAt: row.created_at
  };
}

function buildTree<T extends { id: string; parentId: string; replies?: T[] }>(items: T[]): T[] {
  const map = new Map(items.map((item) => [item.id, { ...item, replies: [] as T[] }]));
  const roots: T[] = [];
  map.forEach((item) => {
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId)?.replies?.push(item);
    } else {
      roots.push(item);
    }
  });
  return roots;
}

export async function listComments(db: D1Database, postId: string, status: ModerationStatus = 'approved'): Promise<CommentItem[]> {
  const rows = await queryAll<CommentRow>(
    db,
    `SELECT c.id, c.post_id, c.user_id, c.parent_id, c.content, c.status, c.created_at,
            COALESCE(u.display_name, u.username, '访客') AS user_name,
            COALESCE(u.avatar_url, '') AS user_avatar
     FROM comments c
     LEFT JOIN users u ON u.id = c.user_id
     WHERE c.post_id = ? AND c.status = ? AND c.deleted_at IS NULL
     ORDER BY c.created_at ASC`,
    [postId, status]
  );
  return buildTree(rows.map(mapComment));
}

export async function getCommentById(db: D1Database, id: string): Promise<CommentItem | null> {
  const row = await queryOne<CommentRow>(
    db,
    `SELECT c.id, c.post_id, c.user_id, c.parent_id, c.content, c.status, c.created_at,
            COALESCE(u.display_name, u.username, '访客') AS user_name,
            COALESCE(u.avatar_url, '') AS user_avatar
     FROM comments c LEFT JOIN users u ON u.id = c.user_id
     WHERE c.id = ? AND c.deleted_at IS NULL LIMIT 1`,
    [id]
  );
  return row ? mapComment(row) : null;
}

export async function createComment(db: D1Database, input: { id: string; postId: string; userId: string; parentId: string; content: string; status: ModerationStatus }): Promise<void> {
  await execute(
    db,
    `INSERT INTO comments (id, post_id, user_id, parent_id, content, status, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [input.id, input.postId, input.userId, input.parentId, input.content, input.status, input.userId, input.userId]
  );
}

export async function listGuestbook(db: D1Database, status: ModerationStatus = 'approved'): Promise<GuestbookItem[]> {
  const rows = await queryAll<GuestbookRow>(
    db,
    `SELECT id, user_id, parent_id, name, website, avatar_url, content, status, created_at
     FROM guestbook
     WHERE status = ? AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [status]
  );
  return buildTree(rows.map(mapGuestbook));
}

export async function getGuestbookById(db: D1Database, id: string): Promise<GuestbookItem | null> {
  const row = await queryOne<GuestbookRow>(
    db,
    `SELECT id, user_id, parent_id, name, website, avatar_url, content, status, created_at
     FROM guestbook WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [id]
  );
  return row ? mapGuestbook(row) : null;
}

export async function createGuestbook(db: D1Database, input: { id: string; userId: string; parentId: string; name: string; email: string; website: string; avatarUrl: string; content: string; status: ModerationStatus }): Promise<void> {
  await execute(
    db,
    `INSERT INTO guestbook (id, user_id, parent_id, name, email, website, avatar_url, content, status, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [input.id, input.userId, input.parentId, input.name, input.email, input.website, input.avatarUrl, input.content, input.status, input.userId, input.userId]
  );
}

export async function listRecentComments(db: D1Database, limit = 5): Promise<CommentRow[]> {
  return queryAll<CommentRow>(
    db,
    `SELECT c.id, c.post_id, c.user_id, c.parent_id, c.content, c.status, c.created_at,
            COALESCE(u.display_name, u.username, '访客') AS user_name,
            COALESCE(u.avatar_url, '') AS user_avatar,
            p.title AS post_title, p.slug AS post_slug
     FROM comments c
     JOIN posts p ON p.id = c.post_id AND p.status = 'published' AND p.deleted_at IS NULL
     LEFT JOIN users u ON u.id = c.user_id
     WHERE c.status = 'approved' AND c.deleted_at IS NULL
     ORDER BY c.created_at DESC LIMIT ?`,
    [limit]
  ).then((rows) => rows.map((row) => ({ ...row, post_title: row.post_title ?? '', post_slug: row.post_slug ?? '' })));
}

export async function listModerationQueue(db: D1Database, status: ModerationStatus | 'all' = 'pending'): Promise<Array<{ type: 'comment' | 'guestbook'; id: string; title: string; content: string; userName: string; createdAt: string; status: ModerationStatus }>> {
  const [comments, guestbook] = await Promise.all([
    queryAll<{ id: string; title: string; content: string; user_name: string; created_at: string; status: ModerationStatus }>(
      db,
      `SELECT c.id, p.title, c.content, COALESCE(u.display_name, u.username, '访客') AS user_name, c.created_at, c.status
       FROM comments c JOIN posts p ON p.id = c.post_id LEFT JOIN users u ON u.id = c.user_id
       WHERE c.deleted_at IS NULL ${status === 'all' ? '' : 'AND c.status = ?'}
       ORDER BY c.created_at DESC LIMIT 100`,
      status === 'all' ? [] : [status]
    ),
    queryAll<{ id: string; title: string; content: string; user_name: string; created_at: string; status: ModerationStatus }>(
      db,
      `SELECT id, '留言板' AS title, content, name AS user_name, created_at, status
       FROM guestbook
       WHERE deleted_at IS NULL ${status === 'all' ? '' : 'AND status = ?'}
       ORDER BY created_at DESC LIMIT 100`,
      status === 'all' ? [] : [status]
    )
  ]);
  return [
    ...comments.map((row) => ({ type: 'comment' as const, id: row.id, title: row.title, content: row.content, userName: row.user_name, createdAt: row.created_at, status: row.status })),
    ...guestbook.map((row) => ({ type: 'guestbook' as const, id: row.id, title: row.title, content: row.content, userName: row.user_name, createdAt: row.created_at, status: row.status }))
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateModerationStatus(db: D1Database, type: 'comment' | 'guestbook', id: string, status: ModerationStatus, operatorId: string): Promise<void> {
  const table = type === 'comment' ? 'comments' : 'guestbook';
  await execute(db, `UPDATE ${table} SET status = ?, updated_at = datetime('now'), updated_by = ? WHERE id = ? AND deleted_at IS NULL`, [status, operatorId, id]);
}
