import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { listCategories, listPublishedSummaries, listTags } from '@/server/db/content';

export const prerender = false;

const STATIC_PATHS = ['/', '/post', '/archive', '/tags', '/categories', '/guestbook', '/about', '/search', '/toolbox', '/social'];

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export const GET: APIRoute = async ({ site, url }) => {
  const db = env.DB;
  const [posts, tags, categories] = await Promise.all([
    listPublishedSummaries(db, 500),
    listTags(db),
    listCategories(db)
  ]);

  const base = (site?.toString() ?? url.origin).replace(/\/$/, '');

  const entries: Array<{ loc: string; lastmod?: string }> = [];
  for (const path of STATIC_PATHS) {
    entries.push({ loc: `${base}${path}` });
  }
  for (const post of posts) {
    entries.push({
      loc: `${base}/post/${post.slug}`,
      lastmod: new Date(post.updatedAt ?? post.publishedAt ?? post.createdAt).toISOString()
    });
  }
  for (const tag of tags) {
    entries.push({ loc: `${base}/tags?tag=${encodeURIComponent(tag.slug)}` });
  }
  for (const category of categories) {
    entries.push({ loc: `${base}/categories?category=${encodeURIComponent(category.slug)}` });
  }

  const body = entries
    .map(({ loc, lastmod }) =>
      [`  <url>`, `    <loc>${escapeXml(loc)}</loc>`, lastmod ? `    <lastmod>${lastmod}</lastmod>` : '', `  </url>`]
        .filter(Boolean)
        .join('\n')
    )
    .join('\n');

  const xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', body, '</urlset>'].join('\n');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800'
    }
  });
};
