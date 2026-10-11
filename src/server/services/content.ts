import type { D1Database } from '@cloudflare/workers-types';
import type { PostDetail, PostSummary } from '@/types/domain';
import { getPostBySlug, getRelatedPosts, incrementPostView } from '@/server/db/content';

export async function getPublishedPost(db: D1Database, slug: string, countView = true): Promise<PostDetail | null> {
  const post = await getPostBySlug(db, slug, false);
  if (!post) {
    return null;
  }
  if (countView) {
    await incrementPostView(db, post.id);
    post.viewCount += 1;
  }
  post.relatedPosts = await getRelatedPosts(db, post);
  return post;
}

export function groupByYear<T extends { publishedAt: string | null }>(posts: T[]): Array<{ year: string; posts: T[] }> {
  const groups = new Map<string, T[]>();
  posts.forEach((post) => {
    const year = (post.publishedAt ?? '').slice(0, 4) || '未发布';
    const list = groups.get(year) ?? [];
    list.push(post);
    groups.set(year, list);
  });
  return Array.from(groups.entries()).map(([year, items]) => ({ year, posts: items }));
}

export function excerpt(post: PostSummary, length = 120): string {
  return post.summary || post.title.slice(0, length);
}
