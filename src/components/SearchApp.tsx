import { useEffect, useMemo, useState } from 'react';

interface SearchItem {
  id: string;
  title: string;
  slug: string;
  summary: string;
  publishedAt: string | null;
  wordCount: number;
  tags: string[];
  categories: string[];
}

export default function SearchApp() {
  const [items, setItems] = useState<SearchItem[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/search-index', { headers: { Accept: 'application/json' } })
      .then((response) => response.json() as Promise<{ data: { items: SearchItem[] } }>)
      .then((payload) => {
        if (active) {
          setItems(payload.data?.items ?? []);
        }
      })
      .catch(() => {
        if (active) {
          setError('搜索索引加载失败，请刷新重试');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const results = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return items.slice(0, 12);
    }
    const terms = keyword.split(/\s+/).filter(Boolean);
    return items.filter((item) => {
      const haystack = [item.title, item.summary, item.tags.join(' '), item.categories.join(' ')].join(' ').toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [items, query]);

  return (
    <div className="space-y-6">
      <div className="border border-line bg-paper p-4">
        <input
          className="field"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="输入标题、标签或摘要关键词…"
          autoComplete="off"
          autoFocus
        />
        <p className="mt-2 text-xs text-muted">
          {loading ? '正在加载索引…' : `共 ${items.length} 篇文章索引，命中 ${results.length} 条`}
          {query ? '（按空格分隔可多关键词匹配）' : '（默认展示最新文章）'}
        </p>
      </div>

      {error && <p className="text-sm text-accent">{error}</p>}

      {results.length === 0 && !loading ? (
        <p className="py-10 text-center text-sm text-muted">没有匹配的文章，换个关键词试试。</p>
      ) : (
        <ul className="space-y-3">
          {results.map((item) => (
            <li key={item.id} className="border-b border-line py-4">
              <a href={`/post/${item.slug}`} className="text-base font-semibold transition-colors hover:text-accent">{item.title}</a>
              <p className="mt-1 line-clamp-2 text-sm text-muted">{item.summary || '（暂无摘要）'}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
                {item.categories.map((category) => <span key={category} className="chip">{category}</span>)}
                {item.tags.slice(0, 4).map((tag) => <span key={tag}>#{tag}</span>)}
                <span className="ml-auto">{item.publishedAt?.slice(0, 10) ?? '未发布'}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
