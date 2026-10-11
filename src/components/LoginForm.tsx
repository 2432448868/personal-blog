import { useEffect, useState } from 'react';
import type { SessionUser } from '@/types/domain';

interface Props {
  oauthEnabled: boolean;
  devMode: boolean;
  errorCode: string;
}

export default function LoginForm({ oauthEnabled, devMode, errorCode }: Props) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/auth/me', { headers: { Accept: 'application/json' } })
      .then((response) => response.json() as Promise<{ data: { user: SessionUser | null } }>)
      .then((payload) => setUser(payload.data?.user ?? null))
      .catch(() => undefined)
      .finally(() => setChecking(false));
  }, []);

  const errorText: Record<string, string> = {
    oauth_not_configured: '尚未配置 GitHub OAuth，本地请使用开发登录。',
    oauth_failed: 'GitHub 授权失败，请重试。',
    oauth_denied: '已取消 GitHub 授权。'
  };

  async function devLogin() {
    setPending(true);
    setMessage('');
    try {
      const response = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        setMessage(payload.message ?? '开发登录不可用');
        return;
      }
      window.location.href = '/admin';
    } catch {
      setMessage('网络异常，请稍后重试');
    } finally {
      setPending(false);
    }
  }

  if (checking) {
    return <p className="text-sm text-muted">正在检查登录状态…</p>;
  }

  if (user) {
    return (
      <div className="space-y-3">
        <p className="text-sm">已登录为 <strong>{user.displayName || user.username}</strong>{user.role === 'admin' ? '（管理员）' : ''}</p>
        <a href="/admin" className="btn btn-primary">进入后台</a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {errorCode && errorText[errorCode] && <p className="text-sm text-accent">{errorText[errorCode]}</p>}
      {oauthEnabled ? (
        <a href="/api/auth/login" className="btn btn-primary w-full justify-center">使用 GitHub 登录</a>
      ) : (
        <p className="border-l-2 border-accent-line pl-3 py-1 text-xs text-muted">GitHub OAuth 未配置，生产环境请补充 GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET。</p>
      )}
      {devMode && (
        <button type="button" onClick={devLogin} className="btn w-full justify-center" disabled={pending}>
          {pending ? '登录中…' : '本地开发登录（管理员）'}
        </button>
      )}
      {!devMode && !oauthEnabled && <p className="text-sm text-muted">当前没有可用的登录方式。</p>}
      {message && <p className="text-sm text-accent">{message}</p>}
    </div>
  );
}
