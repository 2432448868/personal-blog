import { marked, type RendererObject, type Tokens } from 'marked';
import { escapeHtml } from './format';

/**
 * 原始 HTML 一律转义，只放行换行标签 <br>。
 *
 * 旧实现先对整段 Markdown 做 HTML 转义再交给 marked，代码块里的 `<`、`>`、`&` 会被
 * 二次转义（`List<String>` 显示成 `List&lt;String&gt;`），Java 泛型、XML、SQL 全糊。
 * 改为在 marked 渲染阶段只拦原始 HTML token，代码块交回 marked 自己转义。
 */
function renderRawHtml({ text }: Tokens.HTML | Tokens.Tag): string {
  return escapeHtml(text).replace(/&lt;br\s*\/?&gt;/gi, '<br>');
}

marked.use({
  gfm: true,
  breaks: true,
  renderer: {
    html: renderRawHtml
  } satisfies RendererObject
});

export function renderMarkdown(markdown: string): string {
  return marked.parse(markdown) as string;
}