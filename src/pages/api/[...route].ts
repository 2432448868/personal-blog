import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createApp } from '@/server/app';

export const prerender = false;

const app = createApp();

/**
 * 前端统一以 /api/* 访问，Hono 内部路由不带前缀，
 * 因此在这里剥离 /api 前缀后再交给 Hono 处理。
 * 请求体先整体读入，避免 Hono 未消费 body（如 401 直接返回）时
 * 遗留未读流，污染 dev server → miniflare 的连接。
 */
export const ALL: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const stripped = url.pathname.replace(/^\/api(?=\/|$)/, '');
  url.pathname = stripped === '' ? '/' : stripped;

  const init: RequestInit = { method: request.method, headers: request.headers };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }
  const rewritten = new Request(url, init);
  return app.fetch(rewritten, env, locals.cfContext);
};
