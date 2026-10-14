import type { D1Database } from '@cloudflare/workers-types';
import type { SiteProfile } from '@/types/domain';
import { safeJsonParse } from '@/lib/format';
import { queryAll, queryOne } from './client';

const DEFAULT_PROFILE: SiteProfile = {
  name: 'Kale的数字花园',
  bio: '记录技术、阅读和生活的个人博客。',
  avatar: 'https://github.com/KellonWww.png?size=280',
  motto: '把日子码成可检索的形状。',
  announcement: '',
  about: '',
  icp: '',
  startedAt: new Date().toISOString().slice(0, 10),
  socialLinks: []
};

export async function getSiteSettings(db: D1Database): Promise<Record<string, string>> {
  const rows = await queryAll<{ key: string; value: string }>(db, 'SELECT key, value FROM site_settings WHERE deleted_at IS NULL');
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function getSiteProfile(db: D1Database): Promise<SiteProfile> {
  const settings = await getSiteSettings(db);
  const socialLinks = safeJsonParse<SiteProfile['socialLinks']>(settings['site.social_links'] ?? '[]', []);
  return {
    ...DEFAULT_PROFILE,
    // 兼容旧种子站名，不写数据库；后台设置的其它自定义站名仍保留。
    name: !settings['profile.name'] || ['牢大的数字花园', '我的个人博客'].includes(settings['profile.name'])
      ? DEFAULT_PROFILE.name : settings['profile.name'],
    bio: settings['profile.bio'] ?? DEFAULT_PROFILE.bio,
    avatar: !settings['profile.avatar'] || settings['profile.avatar'] === '/avatar.svg'
      ? DEFAULT_PROFILE.avatar : settings['profile.avatar'],
    motto: settings['profile.motto'] ?? DEFAULT_PROFILE.motto,
    announcement: settings['site.announcement'] ?? '',
    about: settings['site.about'] ?? '',
    icp: settings['site.icp'] ?? '',
    startedAt: settings['site.started_at'] ?? DEFAULT_PROFILE.startedAt,
    socialLinks
  };
}

export async function upsertSetting(db: D1Database, key: string, value: string, operatorId: string): Promise<void> {
  await db.prepare(
    `INSERT INTO site_settings (key, value, description, updated_at, updated_by)
     VALUES (?, ?, '', datetime('now'), ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now'), updated_by = excluded.updated_by`
  ).bind(key, value, operatorId).run();
}

export async function settingExists(db: D1Database, key: string): Promise<boolean> {
  const row = await queryOne<{ key: string }>(db, 'SELECT key FROM site_settings WHERE key = ? LIMIT 1', [key]);
  return Boolean(row);
}
