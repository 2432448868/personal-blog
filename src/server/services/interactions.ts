import type { D1Database } from '@cloudflare/workers-types';
import type { CommentItem, GuestbookItem, ModerationStatus, SessionUser } from '@/types/domain';
import { getPostBySlug } from '@/server/db/content';
import { createComment, createGuestbook, getCommentById, getGuestbookById } from '@/server/db/interactions';

export interface CommentInput {
  content: string;
  parentId?: string;
}

export interface GuestbookInput {
  content: string;
  parentId?: string;
  name?: string;
  email?: string;
  website?: string;
  avatarUrl?: string;
}

const MAX_CONTENT_LENGTH = 2000;

export class InteractionError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = 'InteractionError';
  }
}

function normalizeContent(value: string | undefined): string {
  return (value ?? '').replace(/\r\n/g, '\n').trim();
}

export interface CommentResult {
  comment: CommentItem;
  postTitle: string;
  postSlug: string;
}

export async function submitComment(db: D1Database, user: SessionUser, slug: string, input: CommentInput): Promise<CommentResult> {
  const content = normalizeContent(input.content);
  if (!content) {
    throw new InteractionError('评论内容不能为空');
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    throw new InteractionError(`评论内容不能超过 ${MAX_CONTENT_LENGTH} 字`);
  }
  const post = await getPostBySlug(db, slug, false);
  if (!post || post.status !== 'published') {
    throw new InteractionError('文章不存在或尚未发布', 404);
  }
  let parentId = '';
  if (input.parentId) {
    const parent = await getCommentById(db, input.parentId);
    if (!parent || parent.postId !== post.id || parent.status !== 'approved') {
      throw new InteractionError('回复的评论不存在或未通过审核');
    }
    parentId = parent.id;
  }
  const status: ModerationStatus = user.role === 'admin' ? 'approved' : 'pending';
  const id = crypto.randomUUID();
  await createComment(db, { id, postId: post.id, userId: user.id, parentId, content, status });
  return {
    comment: {
      id,
      postId: post.id,
      userId: user.id,
      parentId,
      content,
      status,
      userName: user.displayName || user.username,
      userAvatar: user.avatarUrl,
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
    },
    postTitle: post.title,
    postSlug: post.slug
  };
}

export async function submitGuestbook(db: D1Database, user: SessionUser, input: GuestbookInput): Promise<GuestbookItem> {
  const content = normalizeContent(input.content);
  if (!content) {
    throw new InteractionError('留言内容不能为空');
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    throw new InteractionError(`留言内容不能超过 ${MAX_CONTENT_LENGTH} 字`);
  }
  let parentId = '';
  if (input.parentId) {
    const parent = await getGuestbookById(db, input.parentId);
    if (!parent || parent.status !== 'approved') {
      throw new InteractionError('回复的留言不存在或未通过审核');
    }
    parentId = parent.id;
  }
  const name = (input.name ?? '').trim().slice(0, 32) || user.displayName || user.username || '访客';
  const website = (input.website ?? '').trim().slice(0, 200);
  if (website && !/^https?:\/\//i.test(website)) {
    throw new InteractionError('网站地址必须以 http:// 或 https:// 开头');
  }
  const avatarUrl = (input.avatarUrl ?? '').trim().slice(0, 500) || user.avatarUrl;
  const email = (input.email ?? '').trim().slice(0, 200);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new InteractionError('邮箱格式不正确');
  }
  const status: ModerationStatus = user.role === 'admin' ? 'approved' : 'pending';
  const id = crypto.randomUUID();
  await createGuestbook(db, { id, userId: user.id, parentId, name, email, website, avatarUrl, content, status });
  return {
    id,
    userId: user.id,
    parentId,
    name,
    website,
    avatarUrl,
    content,
    status,
    createdAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
  };
}
