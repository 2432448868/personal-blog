import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { listPublishedSummaries } from '@/server/db/content';
import { getSiteProfile } from '@/server/db/settings';

export const prerender = false;

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
  const [posts, profile] = await Promise.all([listPublishedSummaries(db, 50), getSiteProfile(db)]);
  const base = (site?.toString() ?? url.origin).replace(/\/$/, '');
  const items = posts
    .map((post) => {
      const link = `${base}/post/${post.slug}`;
      const date = new Date(post.publishedAt ?? post.createdAt).toUTCString();
      return [
        '<item>',
        `<title>${escapeXml(post.title)}</title>`,
        `<link>${escapeXml(link)}</link>`,
        `<guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `<pubDate>${date}</pubDate>`,
        `<description>${escapeXml(post.summary || post.title)}</description>`,
        '</item>'
      ].join('');
    })
    .join('');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '<channel>',
    `<title>${escapeXml(profile.name)}</title>`,
    `<link>${escapeXml(base)}</link>`,
    `<description>${escapeXml(profile.bio)}</description>`,
    `<language>zh-CN</language>`,
    `<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    items,
    '</channel>',
    '</rss>'
  ].join('');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800'
    }
  });
};
