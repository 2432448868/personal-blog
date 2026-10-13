// Yuque Markdown backup -> personal blog importer.
// Generates idempotent D1 SQL + copies referenced images into public/yuque-assets.
//
// Usage:
//   node scripts/import-yuque.mjs --source "<backup dir>" [--out "<sql dir>"] [--public "<public assets dir>"] [--limit N] [--no-images] [--dry]

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  if (!v || v.startsWith('--')) return true;
  return v;
}

const SOURCE = path.resolve(String(arg('source', '')));
const OUT_DIR = path.resolve(String(arg('out', path.join(PROJECT_ROOT, 'tmp', 'yuque-sql'))));
const PUBLIC_DIR = path.resolve(String(arg('public', path.join(PROJECT_ROOT, 'public', 'yuque-assets'))));
const LIMIT = Number(arg('limit', 0)) || 0;
const DRY = process.argv.includes('--dry');
const NO_IMAGES = process.argv.includes('--no-images');

if (!SOURCE || !fs.existsSync(SOURCE)) {
  console.error('missing --source directory:', SOURCE);
  process.exit(1);
}

const TARGET_PUBLIC_PREFIX = '/yuque-assets';
const IMPORT_USER = 'usr_admin';
const IMPORT_STAMP = "datetime('now')";

// ---------------------------------------------------------------- utilities

function sha1(value, len = 10) {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, len);
}

function sqlStr(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function toSqlDateTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function slugify(value) {
  return (value || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function countWords(value) {
  const chinese = value.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const latin = value.match(/[A-Za-z0-9]+/g)?.length ?? 0;
  return chinese + latin;
}

function stripMarkdown(value) {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^[>#\-*+|].*$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeFileSegment(name) {
  return name.replace(/[\\/:*?"<>|#%\s]+/g, '_');
}

// ---------------------------------------------------------------- markdown cleaning

const TAG_STRIP = [
  'font', 'span', 'div', 'p', 'center', 'u', 'b', 'i', 'strong', 'em', 'sub', 'sup',
  'small', 'mark', 'li', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption',
  'section', 'article', 'header', 'footer', 'nav', 'aside', 'main',
  'details', 'summary', 'blockquote', 'label', 'figure', 'figcaption',
  'iframe', 'video', 'audio', 'source', 'canvas', 'marquee', 'script', 'style'
];

function cleanSegment(segment, resolveImage) {
  let s = segment;
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  s = s.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = (tag.match(/src\s*=\s*["']?([^"'\s>]+)/i) || [])[1];
    const alt = (tag.match(/alt\s*=\s*["']([^"']*)["']/i) || [])[1] || '';
    if (!src) return '';
    const url = resolveImage(src);
    return url ? `![${alt}](${url})` : '';
  });
  s = s.replace(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, text) => {
    const label = text.replace(/<[^>]+>/g, '').trim();
    return label ? `[${label}](${href})` : '';
  });
  s = s.replace(/<br\s*\/?>/gi, '<br>');
  for (const tag of TAG_STRIP) {
    s = s.replace(new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi'), '');
  }
  return s;
}

function cleanMarkdown(content, resolveImage) {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return parts
    .map((part, index) => (index % 2 === 1 ? part : cleanSegment(part, resolveImage)))
    .join('');
}

function rewriteMarkdownImages(segment, resolveImage) {
  return segment.replace(/!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+["'][^"']*["'])?\s*\)/g, (match, alt, rawUrl) => {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(rawUrl) || rawUrl.startsWith('data:')) return match;
    const url = resolveImage(rawUrl);
    return url ? `![${alt}](${url})` : '';
  });
}

// ---------------------------------------------------------------- main

const manifest = JSON.parse(fs.readFileSync(path.join(SOURCE, '.yuque-manifest.json'), 'utf8'));
let docs = Object.entries(manifest.docs).map(([id, meta]) => ({ id, ...meta }));
docs.sort((a, b) => a.path.localeCompare(b.path, 'zh-Hans-CN'));
if (LIMIT > 0) docs = docs.slice(0, LIMIT);

const imageIndex = new Map(); // absolute source path -> { url, dest }
const imageReport = [];

function resolveImageRef(absoluteDocDir, rawRef) {
  if (NO_IMAGES) return null;
  let ref = String(rawRef).trim();
  if (!ref) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(ref)) return ref; // keep external links
  if (ref.startsWith('data:')) return ref;
  if (ref.startsWith('/')) return ref;
  ref = decodeURIComponent(ref.split(/\s+/)[0]);
  const candidate = path.resolve(absoluteDocDir, ref);
  let found = fs.existsSync(candidate) && fs.statSync(candidate).isFile() ? candidate : null;
  if (!found) {
    // fall back: look for the same trailing path under any assets directory
    const marker = ref.indexOf('assets/');
    if (marker !== -1) {
      const tail = ref.slice(marker);
      const hit = globalFiles.find((f) => f.endsWith(path.sep + tail.split('/').join(path.sep)));
      if (hit) found = hit;
    }
  }
  if (!found) {
    imageReport.push({ kind: 'missing', ref, doc: path.relative(SOURCE, absoluteDocDir) });
    return null;
  }
  const existing = imageIndex.get(found);
  if (existing) return existing.url;
  const rel = path.relative(SOURCE, found);
  const ext = path.extname(found).toLowerCase();
  const hashDir = sha1(rel);
  const base = safeFileSegment(path.basename(found, ext));
  const targetExt = ['.png', '.jpg', '.jpeg'].includes(ext) ? '.webp' : ext;
  const destRel = path.join(hashDir, `${base}${targetExt}`);
  const destAbs = path.join(PUBLIC_DIR, destRel);
  const url = `${TARGET_PUBLIC_PREFIX}/${destRel.split(path.sep).join('/')}`;
  imageIndex.set(found, { url, dest: destAbs, src: found, ext, targetExt });
  return url;
}

function walkFiles(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(p, out);
    else out.push(p);
  }
}

const globalFiles = [];
walkFiles(SOURCE, globalFiles);

// ---------------------------------------------------------------- build posts

const CATEGORY_BY_TOP = {
  'Golang': { id: 'cat_yq_golang', name: 'Golang', slug: 'golang', description: 'Go 语言入门与实践', sort: 110 },
  'JavaSE': { id: 'cat_yq_javase', name: 'JavaSE', slug: 'javase', description: 'Java 基础：语法、集合、并发与 JVM', sort: 120 },
  'JavaWeb': { id: 'cat_yq_javaweb', name: 'JavaWeb', slug: 'javaweb', description: 'Web 基础：Servlet、数据库与前端三件套', sort: 130 },
  '框架&中间件': { id: 'cat_yq_framework', name: '框架&中间件', slug: 'framework-middleware', description: 'Spring 生态、MQ、缓存、搜索等中间件', sort: 140 },
  '面试': { id: 'cat_yq_interview', name: '面试', slug: 'interview', description: '面试备战：基础架构、项目复盘与分布式方案', sort: 150 },
  '默认知识库': { id: 'cat_yq_notes', name: '默认知识库', slug: 'default-knowledge-base', description: '日常记录、工具命令与踩坑笔记', sort: 160 }
};

const categoryByKey = new Map();
const tagByKey = new Map();
const categoryRows = [];
const tagRows = [];

function ensureCategory(top) {
  if (!top) return null;
  if (categoryByKey.has(top)) return categoryByKey.get(top);
  const preset = CATEGORY_BY_TOP[top];
  const row = {
    id: preset ? preset.id : `cat_yq_${sha1(top, 8)}`,
    name: top,
    slug: preset ? preset.slug : slugify(top) || sha1(top, 6),
    description: preset ? preset.description : '',
    sort: preset ? preset.sort : 900
  };
  categoryByKey.set(top, row);
  categoryRows.push(row);
  return row;
}

function ensureTag(name) {
  if (!name) return null;
  if (tagByKey.has(name)) return tagByKey.get(name);
  const row = { id: `tag_yq_${sha1(name, 8)}`, name, slug: slugify(name) || sha1(name, 6) };
  tagByKey.set(name, row);
  tagRows.push(row);
  return row;
}

const usedSlugs = new Set(['hello-personal-blog', 'astro-edge-rendering', 'd1-data-boundaries', 'reading-notes-on-paper']);
const posts = [];
const stats = { docs: 0, images: 0, missing: 0, emptyTitle: 0 };

for (const doc of docs) {
  const abs = path.join(SOURCE, doc.path);
  const docDir = path.dirname(abs);
  let raw = fs.readFileSync(abs, 'utf8');
  raw = raw.replace(/^\uFEFF/, '');

  let frontmatterTitle = '';
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (fm) {
    const t = fm[1].match(/^title:\s*"?(.*?)"?\s*$/m);
    if (t) frontmatterTitle = t[1].trim();
    raw = raw.slice(fm[0].length);
  }

  // title: leading H1 wins, else manifest title, else frontmatter
  let title = (doc.title || frontmatterTitle || '').trim();
  const lines = raw.split(/\r?\n/);
  let firstIdx = lines.findIndex((l) => l.trim().length > 0);
  if (firstIdx !== -1 && /^#\s+\S/.test(lines[firstIdx].trim())) {
    const h1 = lines[firstIdx].trim().replace(/^#\s+/, '').trim();
    if (h1) {
      title = h1;
      lines.splice(firstIdx, 1);
      raw = lines.join('\n');
    }
  }
  if (!title) { title = doc.path.split('/').pop().replace(/\.md$/i, ''); stats.emptyTitle++; }

  const resolve = (ref) => resolveImageRef(docDir, ref);
  // rewrite markdown images first (needs the original `![](assets/...)` shape)
  const parts = raw.split(/(```[\s\S]*?```)/g);
  let body = parts
    .map((part, index) => (index % 2 === 1 ? part : rewriteMarkdownImages(part, resolve)))
    .join('');
  body = cleanMarkdown(body, resolve);
  body = body.replace(/\n{4,}/g, '\n\n\n').trim();

  const segments = doc.path.split('/');
  const top = segments[0];
  const second = segments.length >= 3 ? segments[1] : '';
  const category = ensureCategory(top);
  const tag = ensureTag(second);

  let slug = slugify(title) || `yuque-${sha1(doc.id, 8)}`;
  const slugBase = slug;
  let n = 2;
  while (usedSlugs.has(slug)) slug = `${slugBase}-${n++}`;
  usedSlugs.add(slug);

  const summarySource = stripMarkdown(body).replace(/\s+/g, ' ').trim();
  const summary = summarySource.slice(0, 120);

  const publishedAt = toSqlDateTime(doc.updated_at) || '2026-10-11 00:00:00';

  posts.push({
    id: `yq_${doc.id.replace(/[^A-Za-z0-9]+/g, '_')}`,
    title,
    slug,
    summary,
    content: body,
    status: 'published',
    wordCount: countWords(body),
    publishedAt,
    categoryId: category?.id ?? null,
    tagId: tag?.id ?? null,
    sourcePath: doc.path
  });
  stats.docs++;
}

stats.images = imageIndex.size;
stats.missing = imageReport.filter((r) => r.kind === 'missing').length;

// ---------------------------------------------------------------- emit images

if (!DRY && !NO_IMAGES) {
  for (const [, info] of imageIndex) {
    fs.mkdirSync(path.dirname(info.dest), { recursive: true });
    if (info.dest && fs.existsSync(info.dest)) continue;
    const needsConvert = ['.png', '.jpg', '.jpeg'].includes(info.ext);
    if (needsConvert) {
      const sharp = (await import('sharp')).default;
      await sharp(info.src, { failOn: 'none' })
        .rotate()
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(info.dest);
    } else {
      fs.copyFileSync(info.src, info.dest);
    }
  }
}

// ---------------------------------------------------------------- emit sql

if (!DRY) fs.mkdirSync(OUT_DIR, { recursive: true });

const header = `-- Generated by scripts/import-yuque.mjs from ${path.basename(SOURCE)}\n-- Source docs: ${stats.docs} | images: ${stats.images}\n`;

function writeSql(name, statements) {
  if (DRY) return;
  fs.writeFileSync(path.join(OUT_DIR, name), header + statements.join('\n') + '\n', 'utf8');
}

const taxonomy = [];
for (const cat of categoryRows) {
  taxonomy.push(
    `INSERT OR IGNORE INTO categories (id, name, slug, description, parent_id, sort_order, created_at, updated_at, created_by, updated_by, version) VALUES (${sqlStr(cat.id)}, ${sqlStr(cat.name)}, ${sqlStr(cat.slug)}, ${sqlStr(cat.description)}, '', ${cat.sort}, ${IMPORT_STAMP}, ${IMPORT_STAMP}, 'import', 'import', 0);`
  );
}
for (const tag of tagRows) {
  taxonomy.push(
    `INSERT OR IGNORE INTO tags (id, name, slug, created_at, updated_at, created_by, updated_by, version) VALUES (${sqlStr(tag.id)}, ${sqlStr(tag.name)}, ${sqlStr(tag.slug)}, ${IMPORT_STAMP}, ${IMPORT_STAMP}, 'import', 'import', 0);`
  );
}
writeSql('00-taxonomy.sql', taxonomy);

const CHUNK = 20;
let fileIndex = 1;
for (let start = 0; start < posts.length; start += CHUNK) {
  const chunk = posts.slice(start, start + CHUNK);
  const statements = [];
  for (const post of chunk) {
    statements.push(
      `INSERT INTO posts (id, title, slug, summary, content, cover_image, status, author_id, view_count, word_count, published_at, created_at, updated_at, created_by, updated_by, version) VALUES (` +
        `${sqlStr(post.id)}, ${sqlStr(post.title)}, ${sqlStr(post.slug)}, ${sqlStr(post.summary)}, ${sqlStr(post.content)}, '', ` +
        `${sqlStr(post.status)}, ${sqlStr(IMPORT_USER)}, 0, ${post.wordCount}, ${sqlStr(post.publishedAt)}, ${sqlStr(post.publishedAt)}, ${sqlStr(post.publishedAt)}, 'import', 'import', 0) ` +
        `ON CONFLICT(id) DO UPDATE SET title = excluded.title, slug = excluded.slug, summary = excluded.summary, content = excluded.content, ` +
        `status = excluded.status, word_count = excluded.word_count, published_at = excluded.published_at, updated_at = excluded.updated_at, ` +
        `updated_by = 'import', version = version + 1;`
    );
    statements.push(`DELETE FROM post_categories WHERE post_id = ${sqlStr(post.id)};`);
    if (post.categoryId) {
      statements.push(
        `INSERT OR IGNORE INTO post_categories (post_id, category_id, created_by) VALUES (${sqlStr(post.id)}, ${sqlStr(post.categoryId)}, 'import');`
      );
    }
    statements.push(`DELETE FROM post_tags WHERE post_id = ${sqlStr(post.id)};`);
    if (post.tagId) {
      statements.push(
        `INSERT OR IGNORE INTO post_tags (post_id, tag_id, created_by) VALUES (${sqlStr(post.id)}, ${sqlStr(post.tagId)}, 'import');`
      );
    }
  }
  writeSql(`${String(fileIndex).padStart(2, '0')}-posts.sql`, statements);
  fileIndex++;
}

// ---------------------------------------------------------------- report

const report = {
  source: SOURCE,
  docs: stats.docs,
  images: stats.images,
  missingImages: stats.missing,
  usedManifestTitles: stats.emptyTitle,
  categories: categoryRows,
  tags: tagRows,
  sqlDir: OUT_DIR,
  publicDir: PUBLIC_DIR,
  missingImageSamples: imageReport.filter((r) => r.kind === 'missing').slice(0, 40),
  posts: posts.map((p) => ({ path: p.sourcePath, title: p.title, slug: p.slug, words: p.wordCount, publishedAt: p.publishedAt }))
};
if (!DRY) fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2), 'utf8');

console.log(JSON.stringify({
  docs: stats.docs,
  images: stats.images,
  missingImages: stats.missing,
  categories: categoryRows.length,
  tags: tagRows.length,
  sqlDir: OUT_DIR,
  publicDir: PUBLIC_DIR,
  dry: DRY
}, null, 2));