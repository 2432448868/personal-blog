type MermaidModule = typeof import('mermaid');

type MermaidApi = MermaidModule['default'];

type ThemeVariables = Record<string, string | boolean>;

/** @cloudflare/workers-types 的 HTMLRewriter Element 会改写全局 Element.append，这里只依赖 querySelectorAll。 */
type MermaidRoot = Pick<Document, 'querySelectorAll'>;

const MERMAID_CODE_SELECTOR = 'pre > code.language-mermaid, pre > code.lang-mermaid';

let mermaidPromise: Promise<MermaidApi> | null = null;
let renderSeq = 0;
let themeObserverStarted = false;

function loadMermaid(): Promise<MermaidApi> {
  if (!mermaidPromise) {
    const assetUrl = new URL('/vendor/mermaid/mermaid.esm.min.mjs', window.location.origin).href;
    mermaidPromise = import(/* @vite-ignore */ assetUrl)
      .then((module) => module.default as MermaidApi)
      .catch((error) => { mermaidPromise = null; throw error; });
  }
  return mermaidPromise;
}

function cssVar(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  const value = styles.getPropertyValue(name).trim();
  return value || fallback;
}

/** 把站点主题令牌映射成 mermaid 变量，双主题共用一套映射。 */
export function readThemeVariables(): ThemeVariables {
  const styles = getComputedStyle(document.documentElement);
  const ink = cssVar(styles, '--ink', '#1c1b19');
  const paper = cssVar(styles, '--paper', '#fffdf9');
  const paperSoft = cssVar(styles, '--paper-soft', '#efeae1');
  const surface = cssVar(styles, '--surface', '#f5f2ec');
  const line = cssVar(styles, '--line', '#ddd6cb');
  const lineStrong = cssVar(styles, '--line-strong', '#c2b8a7');
  const muted = cssVar(styles, '--muted', '#6b6760');
  const accent = cssVar(styles, '--accent', '#b1472a');
  const accentSoft = cssVar(styles, '--accent-soft', '#f6e7df');

  return {
    darkMode: document.documentElement.classList.contains('dark'),
    background: paper,
    primaryColor: paperSoft,
    primaryTextColor: ink,
    primaryBorderColor: lineStrong,
    secondaryColor: accentSoft,
    secondaryTextColor: ink,
    secondaryBorderColor: accent,
    tertiaryColor: surface,
    tertiaryTextColor: ink,
    tertiaryBorderColor: line,
    lineColor: muted,
    textColor: ink,
    nodeTextColor: ink,
    titleColor: ink,
    edgeLabelBackground: paper,
    clusterBkg: surface,
    clusterBorder: line,
    noteBkgColor: accentSoft,
    noteTextColor: ink,
    noteBorderColor: lineStrong,
    fontFamily: cssVar(styles, '--font-sans', 'sans-serif'),
    fontSize: '14px'
  };
}

function buildFigure(pre: HTMLElement): HTMLElement {
  const figure = document.createElement('figure');
  figure.className = 'mermaid-figure';
  figure.dataset.mermaid = '';

  const canvas = document.createElement('div');
  canvas.className = 'mermaid-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '流程图');

  pre.replaceWith(figure);
  pre.hidden = true;
  figure.appendChild(pre);
  figure.appendChild(canvas);
  return figure;
}

function collectFigures(root: MermaidRoot): HTMLElement[] {
  root.querySelectorAll<HTMLElement>(MERMAID_CODE_SELECTOR).forEach((code) => {
    const pre = code.parentElement;
    if (!pre || pre.closest('figure[data-mermaid]')) {
      return;
    }
    buildFigure(pre);
  });

  const figures: HTMLElement[] = [];
  root.querySelectorAll<HTMLElement>('figure[data-mermaid]').forEach((figure) => figures.push(figure));
  return figures;
}

function normalizeMermaidSource(source: string): string {
  let normalized = source.replace(/<br\s*\/?>/gi, '<br/>');

  // ER 图的 |、{ 是基数符号，套用流程图改写会把 ||--|{ 改坏，所以 ER 图单独处理。
  const isErDiagram = /^\s*erDiagram\b/m.test(normalized);
  const isFlowchart = /^\s*(?:flowchart|graph)\b/m.test(normalized);

  if (isFlowchart) {
    // 流程图管道标签里的括号、箭头和空格需要引号，否则 Mermaid 解析器会把它们当成语法。
    normalized = normalized.replace(/\|([^|\n]+)\|/g, (match, rawLabel: string) => {
      const label = rawLabel.trim();
      if (!label || label.startsWith('"')) {
        return match;
      }
      return `|"${label.replace(/"/g, '\\"')}"|`;
    });

    // Yuque 导出的节点标签可能带 {}、括号或 HTML 换行，统一用引号包起来。
    normalized = normalized.replace(/([\p{L}\p{N}_-]+)\[([^\]\n]+)\]/gu, (match, id: string, rawLabel: string) => {
      const label = rawLabel.trim();
      if (label.startsWith('"') || label.startsWith('(') || label.startsWith('[')) {
        return match;
      }
      if (!/[{}()]|<\/?br\/?>/i.test(label)) {
        return match;
      }
      return `${id}["${label.replace(/"/g, '\\"')}"]`;
    });
  } else if (isErDiagram) {
    // ER 图不支持流程图式的 note 节点，直接注释掉，避免整张图渲染失败。
    normalized = normalized.replace(/^\s*[\p{L}\p{N}_-]+\["[^"\n]*"\]\s*-->\s*[\p{L}\p{N}_-]+\s*$/gmu, (line) => `%% ${line.trim()}`);
  }
  return normalized;
}

function sourceOf(figure: HTMLElement): string {
  return figure.querySelector('pre code')?.textContent ?? '';
}

async function renderFigure(mermaid: MermaidApi, figure: HTMLElement): Promise<void> {
  const source = normalizeMermaidSource(sourceOf(figure).trim());
  const canvas = figure.querySelector<HTMLElement>('.mermaid-canvas');
  if (!source || !canvas) {
    return;
  }

  const id = `mermaid-diagram-${(renderSeq += 1)}`;
  const sourceBlock = figure.querySelector('pre');
  if (sourceBlock) {
    sourceBlock.hidden = true;
  }
  figure.classList.add('is-pending');
  figure.classList.remove('is-error');

  try {
    const { svg } = await mermaid.render(id, source, canvas);
    canvas.innerHTML = svg;
    const svgElement = canvas.querySelector('svg');
    if (svgElement) {
      svgElement.removeAttribute('height');
      svgElement.setAttribute('width', '100%');
      svgElement.style.maxWidth = '100%';
    }
    figure.classList.remove('is-pending');
    figure.classList.add('is-ready');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    figure.dataset.mermaidError = message.slice(0, 500);
    console.error('[mermaid] render failed', { id, message });
    canvas.innerHTML = '';
    document.getElementById(`d${id}`)?.remove();
    if (sourceBlock) {
      sourceBlock.hidden = false;
    }
    figure.classList.remove('is-pending', 'is-ready');
    figure.classList.add('is-error');
  }
}

/**
 * 把渲染结果里的 ```mermaid 代码块替换成 SVG。
 * 幂等：重复调用只重绘已包裹的图，不会嵌套。
 */
async function renderMermaid(root: MermaidRoot): Promise<void> {
  const figures = collectFigures(root);
  if (figures.length === 0) {
    return;
  }

  let mermaid: MermaidApi;
  try {
    mermaid = await loadMermaid();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[mermaid] load failed', { message });
    figures.forEach((figure) => {
      figure.dataset.mermaidError = message.slice(0, 500);
      figure.classList.remove('is-pending', 'is-ready');
      figure.classList.add('is-error');
      const sourceBlock = figure.querySelector('pre');
      if (sourceBlock) sourceBlock.hidden = false;
    });
    return;
  }

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    themeVariables: readThemeVariables(),
    flowchart: { useMaxWidth: true, htmlLabels: true },
    sequence: { useMaxWidth: true },
    gantt: { useMaxWidth: true }
  });

  for (const figure of figures) {
    await renderFigure(mermaid, figure);
  }
}

// Mermaid initialize/render 使用共享状态；串行处理首屏及主题切换，避免并发污染。
let renderQueue: Promise<void> = Promise.resolve();
export function enhanceMermaid(root: MermaidRoot = document): Promise<void> {
  const next = renderQueue.then(() => renderMermaid(root));
  renderQueue = next.catch(() => undefined);
  return next;
}

/** 主题切换时按新令牌重绘，只挂一次监听。 */
export function observeThemeChanges(): void {
  if (themeObserverStarted) {
    return;
  }
  themeObserverStarted = true;
  const observer = new MutationObserver(() => {
    void enhanceMermaid(document);
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}