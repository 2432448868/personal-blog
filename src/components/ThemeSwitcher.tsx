import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Check } from '@/components/Icons';

type ThemeMode = 'light' | 'dark';

export interface ThemeDef {
  id: string;
  name: string;
  mode: ThemeMode;
}

const DEFAULT_LIGHT: ThemeDef = { id: 'xuanzhi', name: '宣纸', mode: 'light' };
const DEFAULT_DARK: ThemeDef = { id: 'moye', name: '墨夜', mode: 'dark' };

/** 与 globals.css 里的 [data-theme="..."] 令牌一一对应，改这里记得同步改 CSS。 */
export const THEMES: ThemeDef[] = [
  DEFAULT_LIGHT,
  { id: 'taichen', name: '苔痕', mode: 'light' },
  { id: 'dianqing', name: '靛青', mode: 'light' },
  DEFAULT_DARK,
  { id: 'songyan', name: '松烟', mode: 'dark' },
  { id: 'xingye', name: '星野', mode: 'dark' }
];

const MODES: ThemeMode[] = ['light', 'dark'];
const THEME_LABEL: Record<ThemeMode, string> = { light: '日间', dark: '夜间' };
const STORAGE_KEY = 'blog-theme';

interface ViewTransitionLike {
  finished: Promise<void>;
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => ViewTransitionLike;
};

function themeById(id: string): ThemeDef {
  return THEMES.find((theme) => theme.id === id) ?? DEFAULT_LIGHT;
}

/** 读 html 上的 data-theme（由 BaseLayout 内联脚本预先写好）。 */
function documentThemeId(): string {
  const current = document.documentElement.dataset.theme ?? '';
  return THEMES.some((theme) => theme.id === current) ? current : DEFAULT_LIGHT.id;
}

/** 已存的主题；null 表示跟随系统。兼容旧的 light/dark 两个取值。 */
function storedThemeId(): string | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'light') return DEFAULT_LIGHT.id;
    if (value === 'dark') return DEFAULT_DARK.id;
    if (value && THEMES.some((theme) => theme.id === value)) return value;
  } catch {
    /* 隐私模式下忽略 */
  }
  return null;
}

function syncMetaColor() {
  const root = document.documentElement;
  const meta = document.querySelector('meta[name="theme-color"]');
  const surface = getComputedStyle(root).getPropertyValue('--surface').trim();
  if (meta && surface) meta.setAttribute('content', surface);
}

function applyTheme(theme: ThemeDef, persist = true) {
  const root = document.documentElement;
  root.dataset.theme = theme.id;
  root.classList.toggle('dark', theme.mode === 'dark');
  syncMetaColor();

  if (!persist) return;
  try {
    localStorage.setItem(STORAGE_KEY, theme.id);
  } catch {
    /* 隐私模式下忽略 */
  }
}

export default function ThemeSwitcher() {
  const [current, setCurrent] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrent(documentThemeId());
    syncMetaColor();

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    function followSystem(event: MediaQueryListEvent) {
      if (storedThemeId()) return;
      const next = event.matches ? DEFAULT_DARK : DEFAULT_LIGHT;
      applyTheme(next, false);
      setCurrent(next.id);
    }

    media.addEventListener('change', followSystem);
    return () => media.removeEventListener('change', followSystem);
  }, []);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function select(theme: ThemeDef) {
    setOpen(false);
    if (theme.id === current) return;

    const root = document.documentElement;
    const animated = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const startViewTransition = (document as ViewTransitionDocument).startViewTransition;

    const commit = (withTransition: boolean) => {
      if (withTransition) root.dataset.themeTransition = 'true';
      applyTheme(theme);
      flushSync(() => setCurrent(theme.id));
    };

    if (animated && startViewTransition) {
      const transition = startViewTransition.call(document, () => commit(true));
      void transition.finished.finally(() => {
        delete root.dataset.themeTransition;
      });
      return;
    }

    commit(false);
  }

  const active = current ? themeById(current) : null;

  return (
    <div className="theme-picker" ref={rootRef}>
      <button
        type="button"
        className="btn btn-ghost theme-picker-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={active ? `主题：${active.name}，点开切换` : '选择主题'}
        title="切换主题"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="theme-dots" aria-hidden="true">
          <i className="dot-surface" />
          <i className="dot-ink" />
          <i className="dot-accent" />
        </span>
        {active && <span className="hidden md:inline">{active.name}</span>}
      </button>

      {open && (
        <div className="theme-panel" role="radiogroup" aria-label="选择主题">
          {MODES.map((mode) => (
            <div className="theme-group" key={mode}>
              <p className="theme-group-label">{THEME_LABEL[mode]}</p>
              {THEMES.filter((theme) => theme.mode === mode).map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  role="radio"
                  aria-checked={theme.id === current}
                  className="theme-option"
                  onClick={() => select(theme)}
                >
                  <span className="theme-dots" data-theme={theme.id} aria-hidden="true">
                    <i className="dot-surface" />
                    <i className="dot-ink" />
                    <i className="dot-accent" />
                  </span>
                  <span>{theme.name}</span>
                  {theme.id === current && (
                    <span className="theme-option-check" aria-hidden="true">
                      <Check size={14} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
