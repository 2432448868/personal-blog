import { useCallback, useEffect, useState } from 'react';
import type { PostSummary, SessionUser } from '@/types/domain';

interface Stats {
  publishedPosts: number;
  draftPosts: number;
  comments: number;
  pendingComments: number;
  guestbook: number;
}

interface ModerationItem {
  type: 'comment' | 'guestbook';
  id: string;
  title: string;
  content: string;
  userName: string;
  createdAt: string;
  status: string;
}

type Tab = 'posts' | 'moderation' | 'stats';

export default function AdminDashboard() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [queue, setQueue] = useState<ModerationItem[]>([]);
  const [tab, setTab] = useState<Tab>('posts');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const token = user?.csrfToken ?? '';

  const loadAll = useCallback(async () => {
    const meResponse = await fetch('/api/auth/me', { headers: { Accept: 'application/json' } });
    const me = (await meResponse.json()) as { data: { user: SessionUser | null } };
    if (!me.data?.user) {
      window.location.href = '/admin/login';
      return;
    }
    setUser(me.data.user);
    const [statsRes, postsRes, queueRes] = await Promise.all([
      fetch('/api/admin/stats', { headers: { Accept: 'application/json' } }),
      fetch('/api/admin/posts?status=all&pageSize=30', { headers: { Accept: 'application/json' } }),
      fetch('/api/admin/comments?status=pending', { headers: { Accept: 'application/json' } })
    ]);
    const statsPayload = (await statsRes.json()) as { data: Stats };
    const postsPayload = (await postsRes.json()) as { data: { items: PostSummary[] } };
    const queuePayload = (await queueRes.json()) as { data: { items: ModerationItem[] } };
    setStats(statsPayload.data);
    setPosts(postsPayload.data.items);
    setQueue(queuePayload.data.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll().catch(() => setMessage('加载失败，请刷新重试'));
  }, [loadAll]);

  async function mutate(method: string, url: string, body?: unknown) {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (!response.ok) {
      const payload = (await response.json()) as { message?: string };
      setMessage(payload.message ?? '操作失败');
      return false;
    }
    return true;
  }

  async function togglePublish(post: PostSummary) {
    const nextStatus = post.status === 'published' ? 'draft' : 'published';
    const detailResponse = await fetch(`/api/admin/posts/${post.id}`, { headers: { Accept: 'application/json' } });
    const detail = (await detailResponse.json()) as { data: { content: string; summary: string; coverImage: string; title: string; slug: string; categories: Array<{ id: string }>; tags: Array<{ id: string }> } };
    const okResult = await mutate('PUT', `/api/admin/posts/${post.id}`, {
      title: detail.data.title,
      slug: detail.data.slug,
      summary: detail.data.summary,
      content: detail.data.content,
      coverImage: detail.data.coverImage,
      status: nextStatus,
      categoryIds: detail.data.categories.map((item) => item.id),
      tagIds: detail.data.tags.map((item) => item.id)
    });
    if (okResult) {
      setMessage(nextStatus === 'published' ? '已发布' : '已转为草稿');
      await loadAll();
    }
  }

  async function removePost(post: PostSummary) {
    if (!window.confirm(`确认删除《${post.title}》？此操作是逻辑删除。`)) {
      return;
    }
    if (await mutate('DELETE', `/api/admin/posts/${post.id}`)) {
      setMessage('已删除');
      await loadAll();
    }
  }

  async function moderate(item: ModerationItem, status: 'approved' | 'hidden') {
    if (await mutate('PATCH', '/api/admin/comments', { type: item.type, id: item.id, status })) {
      setMessage(status === 'approved' ? '已通过' : '已隐藏');
      await loadAll();
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', headers: { 'X-CSRF-Token': token } });
    window.location.href = '/admin/login';
  }

  if (loading) {
    return <p className="text-sm text-muted">正在加载后台数据…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-[3px] border border-line p-0.5">
          {([['posts', '文章'], ['moderation', '审核'], ['stats', '统计']] as Array<[Tab, string]>).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-[3px] px-3 py-1.5 text-sm transition-colors ${tab === key ? 'bg-accent text-accent-ink' : 'text-muted hover:text-accent'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <a href="/admin/editor" className="btn btn-primary">新建文章</a>
          <button type="button" className="btn" onClick={logout}>退出登录</button>
        </div>
      </div>

      {message && <p className="rounded-[3px] border border-line bg-paper-soft px-3 py-2 text-sm text-accent">{message}</p>}

      {tab === 'stats' && stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {([
            ['已发布', stats.publishedPosts],
            ['草稿', stats.draftPosts],
            ['评论总数', stats.comments],
            ['待审评论', stats.pendingComments],
            ['留言总数', stats.guestbook]
          ] as Array<[string, number]>).map(([label, value]) => (
            <div key={label} className="card p-4">
              <p className="text-xs text-muted">{label}</p>
              <p className="mt-1 font-mono text-xl font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'posts' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-3">标题</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">浏览</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <a href={`/post/${post.slug}`} target="_blank" rel="noreferrer" className="hover:text-accent">{post.title}</a>
                    <span className="ml-2 text-xs text-muted">/{post.slug}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`chip ${post.status === 'published' ? 'border-accent text-accent' : ''}`}>{post.status === 'published' ? '已发布' : '草稿'}</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted">{post.viewCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <a href={`/admin/editor?id=${post.id}`} className="btn btn-ghost">编辑</a>
                      <button type="button" className="btn btn-ghost" onClick={() => togglePublish(post)}>{post.status === 'published' ? '转草稿' : '发布'}</button>
                      <button type="button" className="btn btn-ghost" onClick={() => removePost(post)}>删除</button>
                    </div>
                  </td>
                </tr>
              ))}
              {posts.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-muted">还没有文章，去新建一篇。</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'moderation' && (
        <div className="space-y-3">
          {queue.length === 0 && <p className="card p-6 text-center text-sm text-muted">没有待审核内容。</p>}
          {queue.map((item) => (
            <div key={`${item.type}-${item.id}`} className="card p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="chip">{item.type === 'comment' ? '评论' : '留言'}</span>
                <span className="font-medium text-ink">{item.userName}</span>
                <time>{item.createdAt}</time>
                <span>· {item.title}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">{item.content}</p>
              <div className="mt-3 flex gap-2">
                <button type="button" className="btn btn-primary" onClick={() => moderate(item, 'approved')}>通过</button>
                <button type="button" className="btn" onClick={() => moderate(item, 'hidden')}>隐藏</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
