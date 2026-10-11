import { marked } from 'marked';
import { escapeHtml } from './format';

marked.use({
  gfm: true,
  breaks: true
});

export function renderMarkdown(markdown: string): string {
  const safeMarkdown = escapeHtml(markdown);
  return marked.parse(safeMarkdown) as string;
}
