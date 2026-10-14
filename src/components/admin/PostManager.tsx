import { useEffect, useRef, useState } from 'react';
import type { PostDetail, PostSummary } from '@/types/domain';
import type { Paginated } from '@/types/api';
import { adminRequest, adminWrite, errorMessage } from '@/lib/admin-api';
import { formatDate, formatNumber } from '@/lib/format';

export default function PostManager({ token }: { token: string }) {
  const [result, setResult] = useState<Paginated<PostSummary> | null>(null);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const lock = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const query = new URLSearchParams({ status, page: String(page), pageSize: String(pageSize), search, categoryId, order: 'updated' });
    Promise.all([
      adminRequest<Paginated<PostSummary>>(`/api/admin/posts?${query}`, { signal: controller.signal }),
      adminRequest<{ categories: Array<{ id: string; name: string }> }>('/api/admin/taxonomy', { signal: controller.signal })
    ]).then(([posts, taxonomy]) => {
      if (page > posts.totalPages) { setPage(posts.totalPages); return; }
      setResult(posts);
      setCategories(taxonomy.categories);
    }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(errorMessage(reason)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [status, page, pageSize, search, categoryId, refresh]);

  async function changePost(post: PostSummary, action: 'toggle' | 'delete') {
    if (lock.current) return;
    if (action === 'delete' && !window.confirm(`确认删除《${post.title}》？本版暂无回收站，请谨慎操作。`)) return;
    lock.current = true;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      if (action === 'delete') {
        await adminRequest(`/api/admin/posts/${post.id}`, adminWrite(token, 'DELETE'));
        setMessage('文章已删除');
      } else {
        const detail = await adminRequest<PostDetail>(`/api/admin/posts/${post.id}`);
        const nextStatus = post.status === 'published' ? 'draft' : 'published';
        await adminRequest(`/api/admin/posts/${post.id}`, adminWrite(token, 'PUT', {
          title: detail.title, slug: detail.slug, summary: detail.summary, content: detail.content,
          coverImage: detail.coverImage, status: nextStatus,
          categoryIds: detail.categories.map((item) => item.id), tagIds: detail.tags.map((item) => item.id)
        }));
        setMessage(nextStatus === 'published' ? '文章已发布' : '文章已转为草稿');
      }
      setRefresh((value) => value + 1);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { lock.current = false; setBusy(false); }
  }

  return <>
    {message && <p role="status" className="admin-notice">{message}</p>}
    {error && <div role="alert" className="admin-notice">{error}<button type="button" className="btn" onClick={() => setRefresh((value) => value + 1)}>重新加载</button></div>}
    <section className="admin-panel" aria-busy={loading}>
      <div className="admin-toolbar">
        <form className="admin-search" role="search" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); }}>
          <input className="field" aria-label="搜索文章" placeholder="搜索标题、摘要或路径…" value={searchInput} maxLength={200} onChange={(event) => setSearchInput(event.target.value)} />
          <button className="btn" type="submit">搜索</button>
        </form>
        <select className="field" aria-label="文章状态" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="all">全部状态</option><option value="published">已发布</option><option value="draft">草稿</option></select>
        <select className="field" aria-label="文章分类" value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setPage(1); }}><option value="">全部分类</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        {(search || status !== 'all' || categoryId) && <button type="button" className="btn btn-ghost" onClick={() => { setSearch(''); setSearchInput(''); setStatus('all'); setCategoryId(''); setPage(1); }}>重置</button>}
      </div>
      {loading ? <div role="status" className="admin-empty">正在加载文章…</div> : error ? <div className="admin-empty">文章加载失败或操作未完成，请重试。</div> : result?.items.length ? <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>文章</th><th>状态</th><th>浏览 / 字数</th><th>最近更新</th><th className="text-right">操作</th></tr></thead><tbody>{result.items.map((post) => <tr key={post.id}>
        <td><a className="admin-table-title" href={`/admin/editor?id=${post.id}`}>{post.title}</a><p className="admin-table-subtitle">{post.categories.map((item) => item.name).join(' / ') || '未分类'} · /{post.slug}</p></td>
        <td><span className="admin-status" data-status={post.status}>{post.status === 'published' ? '已发布' : '草稿'}</span></td>
        <td className="tabular-nums whitespace-nowrap">{formatNumber(post.viewCount)} / {formatNumber(post.wordCount)}</td><td className="whitespace-nowrap text-muted">{formatDate(post.updatedAt)}</td>
        <td><div className="admin-row-actions"><a href={`/admin/editor?id=${post.id}`}>编辑</a>{post.status === 'published' && <a href={`/post/${post.slug}`} target="_blank" rel="noreferrer">查看 ↗</a>}<button type="button" disabled={busy} onClick={() => changePost(post, 'toggle')}>{post.status === 'published' ? '下线' : '发布'}</button><button type="button" disabled={busy} onClick={() => changePost(post, 'delete')}>删除</button></div></td>
      </tr>)}</tbody></table></div> : <div className="admin-empty"><p>{search || categoryId || status !== 'all' ? '没有符合筛选条件的文章。' : '还没有文章，开始你的第一篇记录。'}</p><a className="btn" href="/admin/editor">写文章</a></div>}
      <div className="admin-pagination"><span>{result ? `共 ${result.total} 篇文章` : '文章列表'}</span><div><select className="field !w-auto" aria-label="每页文章数" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={10}>10 篇 / 页</option><option value={20}>20 篇 / 页</option><option value={50}>50 篇 / 页</option></select><button type="button" className="btn" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>上一页</button><span>{page} / {result?.totalPages ?? 1}</span><button type="button" className="btn" disabled={loading || !!error || page >= (result?.totalPages ?? 1)} onClick={() => setPage((value) => value + 1)}>下一页</button></div></div>
    </section>
  </>;
}
