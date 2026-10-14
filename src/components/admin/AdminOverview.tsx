import { useEffect, useState } from 'react';
import type { PostSummary } from '@/types/domain';
import { adminRequest, errorMessage } from '@/lib/admin-api';
import { formatNumber, formatDate } from '@/lib/format';
import type { AdminView } from './AdminShell';
import type { ModerationItem } from './ModerationManager';

interface Stats { publishedPosts: number; draftPosts: number; comments: number; pendingComments: number; pendingGuestbook: number; guestbook: number }
interface Props { userName: string; onNavigate: (view: AdminView) => void }

export default function AdminOverview({ userName, onNavigate }: Props) {
  const [data, setData] = useState<{ stats: Stats; posts: PostSummary[]; queue: ModerationItem[] } | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    Promise.all([
      adminRequest<Stats>('/api/admin/stats', { signal: controller.signal }),
      adminRequest<{ items: PostSummary[] }>('/api/admin/posts?status=all&pageSize=5&order=updated', { signal: controller.signal }),
      adminRequest<{ items: ModerationItem[] }>('/api/admin/comments?status=pending', { signal: controller.signal })
    ]).then(([stats, posts, queue]) => setData({ stats, posts: posts.items, queue: queue.items }))
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(errorMessage(reason)); });
    return () => controller.abort();
  }, [retry]);
  if (error) return <div role="alert" className="admin-notice">{error}<button type="button" className="btn" onClick={() => setRetry((value) => value + 1)}>重试</button></div>;
  if (!data) return <div role="status" className="admin-empty">正在查看花园近况…</div>;
  const metrics = [
    { label: '已发布文章', value: data.stats.publishedPosts, note: '已向读者开放' },
    { label: '写作中', value: data.stats.draftPosts, note: '等待继续的草稿' },
    { label: '待审核互动', value: data.stats.pendingComments + data.stats.pendingGuestbook, note: '等待审核的评论与留言总数' },
    { label: '读者互动', value: data.stats.comments + data.stats.guestbook, note: '评论与留言累计，包含待审和隐藏' }
  ];
  return <>
    <section aria-label="站点概况" className="admin-metrics">{metrics.map((metric) => <div className="admin-metric" key={metric.label}><p className="admin-metric-label">{metric.label}</p><p className="admin-metric-value">{formatNumber(metric.value)}</p><p className="admin-metric-note">{metric.note}</p></div>)}</section>
    <div className="admin-overview-grid">
      <section className="admin-panel">
        <div className="admin-welcome"><h2>{userName}，欢迎回来。</h2><p>一篇新的记录，或是一篇未完成的草稿。今天从这里开始。</p><a href="/admin/editor" className="btn btn-primary mt-4">开始写作 ↗</a></div>
        <div className="admin-panel-heading"><h2>最近编辑</h2><button type="button" className="text-xs text-accent" onClick={() => onNavigate('posts')}>全部文章 →</button></div>
        {data.posts.length ? data.posts.map((post) => <a key={post.id} href={`/admin/editor?id=${post.id}`} className="admin-feed-item block"><div className="admin-feed-meta"><span className="admin-status" data-status={post.status}>{post.status === 'published' ? '已发布' : '草稿'}</span><span>{formatDate(post.updatedAt)}</span><span>{formatNumber(post.wordCount)} 字</span></div><p>{post.title}</p></a>) : <div className="admin-empty">还没有文章，写下第一篇吧。</div>}
      </section>
      <section className="admin-panel">
        <div className="admin-panel-heading"><h2>等待你照看的互动</h2><button type="button" className="text-xs text-accent" onClick={() => onNavigate('moderation')}>去审核 →</button></div>
        {data.queue.length ? data.queue.slice(0, 5).map((item) => <div className="admin-feed-item" key={`${item.type}-${item.id}`}><div className="admin-feed-meta"><span>{item.userName}</span><span>{item.type === 'comment' ? '文章评论' : '留言'}</span></div><p className="line-clamp-3">{item.content}</p><p className="admin-table-subtitle">{item.title}</p></div>) : <div className="admin-empty"><p>暂时没有待审核内容。</p><span>花园很安静，正适合写作。</span></div>}
      </section>
    </div>
  </>;
}
