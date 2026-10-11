import { useEffect, useMemo, useState } from 'react';
import { marked } from 'marked';
import type { PostDetail, SessionUser } from '@/types/domain';
import { defaultCoverSvg } from '@/lib/default-cover';

interface Props {
  postId: string | null;
}

interface TaxonomyOption {
  id: string;
  name: string;
}

export default function PostEditor({ postId }: Props) {
  const [token, setToken] = useState('');
  const [categories, setCategories] = useState<TaxonomyOption[]>([]);
  const [tags, setTags] = useState<TaxonomyOption[]>([]);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const meResponse = await fetch('/api/auth/me', { headers: { Accept: 'application/json' } });
      const me = (await meResponse.json()) as { data: { user: SessionUser | null } };
      if (!me.data?.user) {
        window.location.href = '/admin/login';
        return;
      }
      setToken(me.data.user.csrfToken);
      const taxResponse = await fetch('/api/admin/taxonomy', { headers: { Accept: 'application/json' } });
      const tax = (await taxResponse.json()) as { data: { categories: TaxonomyOption[]; tags: TaxonomyOption[] } };
      setCategories(tax.data.categories);
      setTags(tax.data.tags);
      if (postId) {
        const detailResponse = await fetch(`/api/admin/posts/${postId}`, { headers: { Accept: 'application/json' } });
        if (detailResponse.ok) {
          const detail = (await detailResponse.json()) as { data: PostDetail };
          setTitle(detail.data.title);
          setSlug(detail.data.slug);
          setSummary(detail.data.summary);
          setContent(detail.data.content);
          setCoverImage(detail.data.coverImage);
          setStatus(detail.data.status);
          setCategoryIds(detail.data.categories.map((item) => item.id));
          setTagIds(detail.data.tags.map((item) => item.id));
        } else {
          setMessage('文章不存在或无权访问');
        }
      }
      setReady(true);
    })().catch(() => setMessage('初始化失败，请刷新页面'));
  }, [postId]);

  const rendered = useMemo(() => {
    try {
      return marked.parse(content) as string;
    } catch {
      return '<p>Markdown 解析失败</p>';
    }
  }, [content]);

  function toggle(list: string[], id: string, setter: (value: string[]) => void) {
    setter(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  async function upload(file: File) {
    if (!token) {
      return;
    }
    setUploading(true);
    setMessage('');
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await fetch('/api/admin/uploads', { method: 'POST', headers: { 'X-CSRF-Token': token }, body: form });
      const payload = (await response.json()) as { message: string; data: { url: string } | null };
      if (!response.ok || !payload.data) {
        setMessage(payload.message || '上传失败');
        return;
      }
      setCoverImage(payload.data.url);
      setMessage('封面上传成功');
    } catch {
      setMessage('上传失败，请稍后重试');
    } finally {
      setUploading(false);
    }
  }

  async function save(nextStatus: 'draft' | 'published') {
    if (!token) {
      return;
    }
    if (!title.trim() || !content.trim()) {
      setMessage('标题和正文不能为空');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const method = postId ? 'PUT' : 'POST';
      const url = postId ? `/api/admin/posts/${postId}` : '/api/admin/posts';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        body: JSON.stringify({ title, slug, summary, content, coverImage, status: nextStatus, categoryIds, tagIds })
      });
      const payload = (await response.json()) as { message: string; data: PostDetail | null };
      if (!response.ok || !payload.data) {
        setMessage(payload.message || '保存失败');
        return;
      }
      setStatus(nextStatus);
      setMessage('保存成功');
      if (!postId) {
        window.location.href = `/admin/editor?id=${payload.data.id}`;
      }
    } catch {
      setMessage('保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  }

  if (!ready) {
    return <p className="text-sm text-muted">正在加载编辑器…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <a href="/admin" className="btn btn-ghost">← 返回后台</a>
        <span className="chip">{status === 'published' ? '已发布' : '草稿'}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={() => setPreview((value) => !value)}>{preview ? '编辑' : '预览'}</button>
          <button type="button" className="btn" onClick={() => save('draft')} disabled={saving}>保存草稿</button>
          <button type="button" className="btn btn-primary" onClick={() => save('published')} disabled={saving}>{saving ? '保存中…' : '发布'}</button>
        </div>
      </div>

      {message && <p className="rounded-[3px] border border-line bg-paper-soft px-3 py-2 text-sm text-accent">{message}</p>}

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          <input className="field text-lg" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="文章标题" maxLength={200} />
          {preview ? (
            <div className="card prose-editorial min-h-[32rem] p-5" dangerouslySetInnerHTML={{ __html: rendered }} />
          ) : (
            <textarea className="field min-h-[32rem] resize-y font-mono text-sm" value={content} onChange={(event) => setContent(event.target.value)} placeholder="使用 Markdown 编写正文…" />
          )}
        </div>

        <aside className="space-y-3">
          <div className="card space-y-3 p-4">
            <label className="block text-xs text-muted">URL 路径（留空自动生成）</label>
            <input className="field" value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="my-first-post" maxLength={80} />

            <label className="block text-xs text-muted">摘要</label>
            <textarea className="field min-h-20 resize-y" value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="列表与 SEO 使用的摘要" maxLength={500} />

            <label className="block text-xs text-muted">封面图 URL（留空则用默认封面）</label>
            <input className="field" value={coverImage} onChange={(event) => setCoverImage(event.target.value)} placeholder="/api/media/..." />
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="text-xs" onChange={(event) => { const file = event.target.files?.[0]; if (file) { void upload(file); } }} />
            {uploading && <p className="text-xs text-muted">上传中…</p>}
            <div className="overflow-hidden rounded-[3px] border border-line bg-paper-soft">
              {coverImage.trim() ? (
                <img src={coverImage} alt="封面预览" className="aspect-[16/9] w-full object-cover" />
              ) : (
                <span className="block aspect-[16/9] w-full" aria-hidden="true" dangerouslySetInnerHTML={{ __html: defaultCoverSvg(title) }} />
              )}
            </div>
          </div>

          <div className="card space-y-2 p-4">
            <p className="text-xs text-muted">分类</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button key={category.id} type="button" onClick={() => toggle(categoryIds, category.id, setCategoryIds)} className={`chip ${categoryIds.includes(category.id) ? 'border-accent text-accent' : ''}`}>
                  {category.name}
                </button>
              ))}
              {categories.length === 0 && <span className="text-xs text-muted">暂无分类</span>}
            </div>
          </div>

          <div className="card space-y-2 p-4">
            <p className="text-xs text-muted">标签</p>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button key={tag.id} type="button" onClick={() => toggle(tagIds, tag.id, setTagIds)} className={`chip ${tagIds.includes(tag.id) ? 'border-accent text-accent' : ''}`}>
                  #{tag.name}
                </button>
              ))}
              {tags.length === 0 && <span className="text-xs text-muted">暂无标签</span>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
