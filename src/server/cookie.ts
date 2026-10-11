import { SESSION_COOKIE_DEV, SESSION_COOKIE_PROD, SESSION_DAYS } from '@/lib/constants';

export function sessionCookie(env: Env): { name: string; options: { httpOnly: true; secure: boolean; sameSite: 'Strict'; path: string; maxAge: number } } {
  const production = env.ENVIRONMENT === 'production';
  return {
    name: production ? SESSION_COOKIE_PROD : SESSION_COOKIE_DEV,
    options: {
      httpOnly: true,
      secure: production,
      sameSite: 'Strict',
      path: '/',
      maxAge: SESSION_DAYS * 24 * 60 * 60
    }
  };
}
import { OAUTH_STATE_COOKIE_DEV, OAUTH_STATE_COOKIE_PROD, OAUTH_STATE_MINUTES } from '@/lib/constants';

export function oauthStateCookie(env: Env): { name: string; options: { httpOnly: true; secure: boolean; sameSite: 'Lax'; path: string; maxAge: number } } {
  const production = env.ENVIRONMENT === 'production';
  return {
    name: production ? OAUTH_STATE_COOKIE_PROD : OAUTH_STATE_COOKIE_DEV,
    options: {
      httpOnly: true,
      secure: production,
      sameSite: 'Lax',
      path: '/',
      maxAge: OAUTH_STATE_MINUTES * 60
    }
  };
}
