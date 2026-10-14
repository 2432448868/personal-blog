import { useEffect, useRef, useState } from 'react';
import type { SessionUser } from '@/types/domain';
import { adminRequest, adminWrite, errorMessage } from '@/lib/admin-api';
import AdminShell, { ADMIN_NAV, type AdminView } from './AdminShell';
import AdminOverview from './AdminOverview';
import PostManager from './PostManager';
import ModerationManager from './ModerationManager';
import SiteSettings from './SiteSettings';

const DESCRIPTIONS: Record<AdminView, string> = {
  overview: '看看花园的近况，继续今天的写作。',
  posts: '让每一篇文章有序生长，从草稿到发布。',
  moderation: '回应读者，照看评论与留言。',
  settings: '维护站点资料，让花园保持自己的样子。'
};

export default function AdminDashboard() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [view, setView] = useState<AdminView>('overview');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const dirtyRef = useRef(false);
  const viewRef = useRef<AdminView>('overview');
  dirtyRef.current = settingsDirty;
  viewRef.current = view;
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    function syncView() {
      const next = new URLSearchParams(window.location.search).get('view');
      const nextView = ADMIN_NAV.find((item) => item.key === next)?.key ?? 'overview';
      if (dirtyRef.current && nextView !== viewRef.current && !window.confirm('站点设置尚未保存，确认离开？')) {
        const url = new URL(window.location.href);
        url.searchParams.set('view', viewRef.current);
        window.history.replaceState(null, '', url);
        return;
      }
      setView(nextView);
    }
    syncView();
    window.addEventListener('popstate', syncView);
    return () => window.removeEventListener('popstate', syncView);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    adminRequest<{ user: SessionUser | null }>('/api/auth/me', { signal: controller.signal }).then(({ user: current }) => {
      if (!current) { window.location.assign('/admin/login'); return; }
      if (current.role !== 'admin') { throw new Error('当前账号没有管理员权限'); }
      setUser(current);
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(errorMessage(reason));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);

  function navigate(next: AdminView) {
    if (next === view) return;
    if (settingsDirty && !window.confirm('站点设置尚未保存，确认离开？')) return;
    setView(next);
    const url = new URL(window.location.href);
    url.searchParams.set('view', next);
    window.history.pushState(null, '', url);
  }

  async function logout() {
    if (settingsDirty && !window.confirm('站点设置尚未保存，确认退出？')) return;
    setLoggingOut(true);
    try {
      await adminRequest('/api/auth/logout', adminWrite(user?.csrfToken ?? '', 'POST'));
      window.location.assign('/admin/login');
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setLoggingOut(false); }
  }

  return (
    <AdminShell active={view} title={ADMIN_NAV.find((item) => item.key === view)?.label ?? '工作台'} description={DESCRIPTIONS[view]} userName={user?.displayName || user?.username} onNavigate={navigate} onLogout={loggingOut ? undefined : logout} actions={<a href="/admin/editor" className="btn btn-primary">＋ 写文章</a>}>
      {error && <div role="alert" className="admin-notice"><span>{error}</span><button type="button" className="btn" onClick={() => setRetry((value) => value + 1)}>重试</button></div>}
      {loading ? <div role="status" className="admin-empty">正在加载管理空间…</div> : user && <>
        {view === 'overview' && <AdminOverview userName={user.displayName || user.username} onNavigate={navigate} />}
        {view === 'posts' && <PostManager token={user.csrfToken} />}
        {view === 'moderation' && <ModerationManager token={user.csrfToken} />}
        {view === 'settings' && <SiteSettings token={user.csrfToken} onDirtyChange={setSettingsDirty} />}
      </>}
    </AdminShell>
  );
}
