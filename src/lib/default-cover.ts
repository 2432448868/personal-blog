/**
 * 默认封面：内联 SVG，颜色全部走主题令牌，6 套主题自动适配。
 * 构图 = 庭园地平线 + 土坡 + 一枚朱印（印面取文章标题首字）。
 * Astro 与 React 共用这一份字符串，改图只改这里。
 */

const SEAL_DOT = '<circle r="4.8" fill="var(--paper-soft)"/>';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** 印面文字：标题首字；拿不到可读字符时退回一个圆点。 */
function sealMark(title?: string | null): string {
  const first = Array.from((title ?? '').trim())[0] ?? '';
  if (!/^[\p{L}\p{N}]$/u.test(first)) {
    return SEAL_DOT;
  }
  return `<text x="0" y="0" dy="0.36em" text-anchor="middle" font-size="31" font-weight="600" fill="var(--paper-soft)" style="font-family: var(--font-sans, sans-serif)">${escapeXml(first)}</text>`;
}

/** 生成默认封面 SVG。必须内联进 DOM 才能吃到主题色令牌，不要改成 <img src>。 */
export function defaultCoverSvg(title?: string | null): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" preserveAspectRatio="xMidYMid slice" role="presentation" aria-hidden="true" focusable="false" style="display:block;width:100%;height:100%">',
    '<rect width="1200" height="675" fill="var(--paper-soft)"/>',
    '<path d="M356 520A250 205 0 0 1 806 520Z" fill="var(--ink)" fill-opacity="0.075"/>',
    '<path d="M356 520A250 205 0 0 1 806 520" fill="none" stroke="var(--ink)" stroke-opacity="0.34" stroke-width="1.6"/>',
    '<line x1="150" y1="520" x2="1050" y2="520" stroke="var(--ink)" stroke-opacity="0.24" stroke-width="1.2"/>',
    '<line x1="150" y1="574" x2="1050" y2="574" stroke="var(--ink)" stroke-opacity="0.1"/>',
    `<g transform="translate(857 197)"><rect x="-26" y="-26" width="52" height="52" rx="2" fill="var(--accent)"/>${sealMark(title)}</g>`,
    '</svg>'
  ].join('');
}