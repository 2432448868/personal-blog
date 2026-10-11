-- Seed data is idempotent. This rollback removes only known seed rows.
DELETE FROM guestbook WHERE id IN ('guest_1');
DELETE FROM comments WHERE id IN ('comment_1','comment_2');
DELETE FROM post_tags WHERE post_id IN ('post_hello','post_astro','post_d1','post_notes');
DELETE FROM post_categories WHERE post_id IN ('post_hello','post_astro','post_d1','post_notes');
DELETE FROM posts WHERE id IN ('post_hello','post_astro','post_d1','post_notes');
DELETE FROM tags WHERE id IN ('tag_astro','tag_cf','tag_ts','tag_reading','tag_life');
DELETE FROM categories WHERE id IN ('cat_tech','cat_frontend','cat_backend','cat_notes');
DELETE FROM site_settings WHERE key IN ('profile.name','profile.bio','profile.avatar','profile.motto','site.announcement','site.about','site.icp','site.social_links','site.started_at');
DELETE FROM users WHERE id = 'usr_admin';
