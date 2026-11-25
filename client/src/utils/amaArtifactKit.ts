/**
 * AMA design system for artifacts ("AMA kit").
 *
 * - `amaKitSource` is injected into every React (react-ts) artifact sandbox as
 *   `/components/ama.tsx`, so the model can `import { Page, Kpi, BarChart, … }
 *   from '/components/ama'` and get on-brand, theme-aware charts and layouts.
 * - `buildAmaIndexHtml` is the sandbox `/public/index.html` (Tailwind config with
 *   `ama-*` color tokens bound to CSS variables, brand font, light/dark class).
 * - `injectAmaHtmlBase` adds the same tokens + helper classes to `text/html`
 *   artifacts without touching the stored artifact content.
 *
 * The prompt that teaches the model this API lives in
 * `packages/api/src/prompts/artifacts/amaDesign.ts` — keep both in sync.
 *
 * NOTE: the kit source is a String.raw template: it must not contain backticks
 * or dollar-brace sequences.
 */

export const AMA_COLORS = {
  light: {
    bg: '#F5F7F6',
    surface: '#EEF2F0',
    card: '#FFFFFF',
    border: '#E1E7E4',
    grid: '#EBF0ED',
    text: '#1C2A28',
    heading: '#00504D',
    muted: '#6B7270',
    primary: '#00504D',
    accent: '#8AB351',
    positive: '#1A9A6A',
    negative: '#C2483D',
    warning: '#B97D12',
    series: ['#00504D', '#1DAA75', '#8AB351', '#80C5A0', '#B6D7A8', '#004418'],
  },
  dark: {
    bg: '#0D1413',
    surface: '#131D1C',
    card: '#162120',
    border: '#24312E',
    grid: '#1E2A28',
    text: '#E4EDEA',
    heading: '#E4EDEA',
    muted: '#93A29F',
    primary: '#1DAA75',
    accent: '#8AB351',
    positive: '#38C28B',
    negative: '#E2685D',
    warning: '#E0A63A',
    series: ['#1DAA75', '#8AB351', '#80C5A0', '#B6D7A8', '#4A9E99', '#2F7D5B'],
  },
} as const;

type ThemeTokens = (typeof AMA_COLORS)['light'] | (typeof AMA_COLORS)['dark'];

const cssVars = (t: ThemeTokens) =>
  [
    `--ama-bg:${t.bg}`,
    `--ama-surface:${t.surface}`,
    `--ama-card:${t.card}`,
    `--ama-border:${t.border}`,
    `--ama-grid:${t.grid}`,
    `--ama-text:${t.text}`,
    `--ama-heading:${t.heading}`,
    `--ama-muted:${t.muted}`,
    `--ama-primary:${t.primary}`,
    `--ama-accent:${t.accent}`,
    `--ama-positive:${t.positive}`,
    `--ama-negative:${t.negative}`,
    `--ama-warning:${t.warning}`,
    ...t.series.map((c, i) => `--ama-series-${i + 1}:${c}`),
  ].join(';');

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Nunito+Sans:opsz,wght@6..12,300..800&display=swap';

const FONT_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="${FONT_HREF}" rel="stylesheet">`;

const FONT_STACK = `'Nunito Sans','Museo Sans','Helvetica Neue',Helvetica,Arial,sans-serif`;

/** Shared CSS: tokens for both themes + base element styles (low specificity). */
export const AMA_BASE_CSS = [
  `:root{${cssVars(AMA_COLORS.light)};color-scheme:light}`,
  `html.dark{${cssVars(AMA_COLORS.dark)};color-scheme:dark}`,
  `:root,:root body{background:var(--ama-bg);color:var(--ama-text);font-family:${FONT_STACK};-webkit-font-smoothing:antialiased;margin:0}`,
  `:where(h1,h2,h3,h4){color:var(--ama-heading);letter-spacing:-.01em}`,
  `::-webkit-scrollbar{height:.5rem;width:.5rem}::-webkit-scrollbar-thumb{background-color:var(--ama-border);border-radius:9999px}::-webkit-scrollbar-track{background:transparent}`,
  `*{scrollbar-width:thin;scrollbar-color:var(--ama-border) transparent}`,
].join('\n');

/** `ama-*` color tokens (theme-aware CSS variables + fixed brand colors). */
const TOKEN_VALUES: Record<string, string> = {
  bg: 'var(--ama-bg)',
  surface: 'var(--ama-surface)',
  card: 'var(--ama-card)',
  border: 'var(--ama-border)',
  grid: 'var(--ama-grid)',
  text: 'var(--ama-text)',
  heading: 'var(--ama-heading)',
  muted: 'var(--ama-muted)',
  primary: 'var(--ama-primary)',
  accent: 'var(--ama-accent)',
  positive: 'var(--ama-positive)',
  negative: 'var(--ama-negative)',
  warning: 'var(--ama-warning)',
  green: '#00504D',
  mid: '#1DAA75',
  olive: '#8AB351',
  light: '#80C5A0',
  pale: '#B6D7A8',
  forest: '#004418',
  gray: '#727574',
};

/**
 * Plain-CSS equivalents of the `bg-ama-*`, `text-ama-*`, `border-ama-*`,
 * `ring-ama-*` and `hover:` Tailwind classes, so they work even when the
 * sandbox ignores our Tailwind config.
 */
const AMA_UTILITY_CSS = Object.entries(TOKEN_VALUES)
  .map(
    ([n, v]) =>
      `.bg-ama-${n}{background-color:${v}}.text-ama-${n}{color:${v}}.border-ama-${n}{border-color:${v}}.ring-ama-${n}{--tw-ring-color:${v}}.hover\\:bg-ama-${n}:hover{background-color:${v}}.hover\\:text-ama-${n}:hover{color:${v}}`,
  )
  .join('\n');

/** Helper classes for plain-HTML artifacts. */
const AMA_HTML_CLASSES = [
  `.ama-page{max-width:72rem;margin:0 auto;padding:28px 24px 32px}`,
  `.ama-eyebrow{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ama-accent);margin-bottom:8px}`,
  `.ama-eyebrow::before{content:"";width:24px;height:2px;border-radius:2px;background:var(--ama-accent)}`,
  `.ama-title{font-size:28px;font-weight:800;color:var(--ama-heading);margin:0;line-height:1.15}`,
  `.ama-subtitle{color:var(--ama-muted);margin:6px 0 0;font-size:15px}`,
  `.ama-header{border-bottom:1px solid var(--ama-border);padding-bottom:20px;margin-bottom:24px}`,
  `.ama-grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}`,
  `.ama-card{background:var(--ama-card);border:1px solid var(--ama-border);border-radius:14px;padding:18px 20px;box-shadow:0 1px 2px rgba(0,0,0,.04)}`,
  `.ama-card h3{font-size:14px;font-weight:700;color:var(--ama-text);margin:0 0 12px}`,
  `.ama-kpi-label{font-size:12px;font-weight:600;color:var(--ama-muted);text-transform:uppercase;letter-spacing:.04em}`,
  `.ama-kpi-value{font-size:30px;font-weight:800;color:var(--ama-heading);font-variant-numeric:tabular-nums;margin-top:6px;line-height:1.1}`,
  `.ama-pos{color:var(--ama-positive)}.ama-neg{color:var(--ama-negative)}.ama-muted{color:var(--ama-muted)}`,
  `.ama-table{width:100%;border-collapse:collapse;font-size:13px}`,
  `.ama-table th{text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--ama-muted);padding:10px 12px;border-bottom:1px solid var(--ama-border)}`,
  `.ama-table td{padding:10px 12px;border-bottom:1px solid var(--ama-grid)}`,
  `.ama-table td.num,.ama-table th.num{text-align:right;font-variant-numeric:tabular-nums}`,
  `.ama-table tbody tr:hover{background:var(--ama-surface)}`,
  `.ama-badge{display:inline-flex;align-items:center;border-radius:9999px;padding:2px 10px;font-size:12px;font-weight:600;background:var(--ama-surface);color:var(--ama-text)}`,
  `.ama-footer{margin-top:28px;padding-top:14px;border-top:1px solid var(--ama-border);font-size:12px;color:var(--ama-muted)}`,
].join('\n');

const themeScript = (isDark: boolean) =>
  `<script>document.documentElement.classList.${isDark ? 'add' : 'remove'}('dark');</script>`;

/** `window.AMA` for HTML artifacts that draw charts (e.g. Chart.js from cdnjs). */
const amaWindowScript = (isDark: boolean) => {
  const t = isDark ? AMA_COLORS.dark : AMA_COLORS.light;
  const payload = JSON.stringify({ dark: isDark, colors: t, series: t.series, font: FONT_STACK });
  return `<script>window.AMA=${payload};window.AMA.fmt={number:function(v,d){return new Intl.NumberFormat('es-CL',{maximumFractionDigits:d||0}).format(v)},percent:function(v,d){return new Intl.NumberFormat('es-CL',{style:'percent',maximumFractionDigits:d==null?1:d}).format(v)},clp:function(v){return new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(v)}};</script>`;
};

/**
 * Prepends the AMA tokens/base styles to an HTML artifact (right after `<head>`,
 * so the artifact's own CSS still wins) and syncs the LibreChat light/dark theme.
 */
export function injectAmaHtmlBase(html: string, isDark: boolean): string {
  if (!html) {
    return html;
  }
  const block = `${themeScript(isDark)}${FONT_LINK}<style id="ama-ds">${AMA_BASE_CSS}\n${AMA_HTML_CLASSES}</style>${amaWindowScript(isDark)}`;
  const headOpen = /<head(\s[^>]*)?>/i;
  if (headOpen.test(html)) {
    return html.replace(headOpen, (m) => `${m}${block}`);
  }
  const htmlOpen = /<html(\s[^>]*)?>/i;
  if (htmlOpen.test(html)) {
    return html.replace(htmlOpen, (m) => `${m}<head>${block}</head>`);
  }
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${block}</head><body>${html}</body></html>`;
}

const TAILWIND_CONFIG = `tailwind.config=${JSON.stringify({
  darkMode: 'class',
  theme: { extend: { colors: { ama: TOKEN_VALUES } } },
})}`;

/** `/public/index.html` for the react-ts artifact sandbox. */
export function buildAmaIndexHtml(isDark: boolean): string {
  return `<!DOCTYPE html>
<html lang="es" class="${isDark ? 'dark' : ''}">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AMA</title>
    ${FONT_LINK}
    <script src="https://cdn.tailwindcss.com/3.4.17"></script>
    <script>${TAILWIND_CONFIG}</script>
    <style>${AMA_BASE_CSS}\n${AMA_UTILITY_CSS}</style>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
}

/**
 * Runs when the kit module loads inside the sandbox: syncs the LibreChat
 * light/dark theme and injects tokens, `ama-*` utilities and the brand font.
 * Does not rely on the sandbox `index.html`, which Sandpack may not use.
 */
const kitSetup = (isDark: boolean) => `
const AMA_DARK = ${isDark};
(function amaSetup() {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', AMA_DARK);
  let style = document.getElementById('ama-ds');
  if (!style) {
    style = document.createElement('style');
    style.id = 'ama-ds';
    document.head.appendChild(style);
  }
  style.textContent = ${JSON.stringify(`${AMA_BASE_CSS}
${AMA_UTILITY_CSS}
.ama-root{font-family:${FONT_STACK}}`)};
  if (!document.getElementById('ama-font')) {
    const font = document.createElement('link');
    font.id = 'ama-font';
    font.rel = 'stylesheet';
    font.href = ${JSON.stringify(FONT_HREF)};
    document.head.appendChild(font);
  }
})();
`;

/** React component library served at `/components/ama.tsx`, for the given theme. */
export function buildAmaKitSource(isDark: boolean): string {
  return amaKitSource.replace('/*__AMA_SETUP__*/', () => kitSetup(isDark));
}

const amaKitSource = String.raw`
import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart as RBarChart,
  Bar,
  LineChart as RLineChart,
  Line,
  AreaChart as RAreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
  ReferenceLine,
} from 'recharts';

/*__AMA_SETUP__*/

/* ───────────────────────── tokens & theme ───────────────────────── */

export const brand = {
  green: '#00504D',
  mid: '#1DAA75',
  olive: '#8AB351',
  light: '#80C5A0',
  pale: '#B6D7A8',
  forest: '#004418',
  gray: '#727574',
};

const THEMES: any = ${JSON.stringify(AMA_COLORS)};

const readDark = () =>
  typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : AMA_DARK;

/** Current AMA theme tokens (re-renders if the light/dark class changes). */
export function useAmaTheme() {
  const [dark, setDark] = useState(readDark());
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(readDark()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return useMemo(() => ({ ...(dark ? THEMES.dark : THEMES.light), dark }), [dark]);
}

/* ───────────────────────── formatting (es-CL) ───────────────────────── */

const nf = (opts: any) => new Intl.NumberFormat('es-CL', opts);

export const fmt: any = {
  number: (v: number, d = 0) => nf({ maximumFractionDigits: d }).format(v),
  decimal: (v: number, d = 1) => nf({ minimumFractionDigits: d, maximumFractionDigits: d }).format(v),
  /** v is a ratio: 0.253 → "25,3 %" */
  percent: (v: number, d = 1) => nf({ style: 'percent', maximumFractionDigits: d }).format(v),
  clp: (v: number) => nf({ style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v),
  usd: (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v),
  compact: (v: number) => nf({ notation: 'compact', maximumFractionDigits: 1 }).format(v),
  date: (v: any, opts?: any) =>
    new Date(v).toLocaleDateString('es-CL', opts || { day: '2-digit', month: 'short', year: 'numeric' }),
  month: (v: any) => new Date(v).toLocaleDateString('es-CL', { month: 'short', year: '2-digit' }),
};

const toFormatter = (f: any) => {
  if (typeof f === 'function') return f;
  if ((f === 'date' || f === 'month') && fmt[f]) return (v: any) => (v == null || v === '' ? '' : fmt[f](v));
  if (typeof f === 'string' && fmt[f]) return (v: any) => (typeof v === 'number' ? fmt[f](v) : v);
  return (v: any) => (typeof v === 'number' ? fmt.number(v) : v);
};

const cx = (...c: any[]) => c.filter(Boolean).join(' ');

/* ───────────────────────── layout ───────────────────────── */

export function Page({ title, subtitle, eyebrow, source, updated, actions, wide = false, children }: any) {
  return (
    <div className="ama-root min-h-screen bg-ama-bg text-ama-text antialiased">
      <div className={cx('mx-auto px-5 py-6 sm:px-8 sm:py-8', wide ? 'max-w-7xl' : 'max-w-6xl')}>
        {(title || subtitle || eyebrow || actions) && (
          <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-ama-border pb-5">
            <div className="min-w-0">
              {eyebrow && (
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ama-accent">
                  <span className="h-0.5 w-6 rounded bg-ama-accent" />
                  {eyebrow}
                </div>
              )}
              {title && (
                <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-ama-heading sm:text-3xl">
                  {title}
                </h1>
              )}
              {subtitle && <p className="mt-1.5 max-w-3xl text-sm text-ama-muted sm:text-base">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </header>
        )}
        <main className="space-y-6">{children}</main>
        {(source || updated) && (
          <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-ama-border pt-4 text-xs text-ama-muted">
            <span>{source ? 'Fuente: ' + source : ''}</span>
            <span className="flex items-center gap-2">
              {updated}
              <span className="font-bold tracking-wide text-ama-primary">AMA</span>
            </span>
          </footer>
        )}
      </div>
    </div>
  );
}

const GRID_COLS: any = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-4',
  5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
};

export function Grid({ cols = 3, children, className = '' }: any) {
  return <div className={cx('grid gap-4', GRID_COLS[cols] || GRID_COLS[3], className)}>{children}</div>;
}

export function Section({ title, subtitle, action, children }: any) {
  return (
    <section className="space-y-3">
      {(title || action) && (
        <div className="flex items-end justify-between gap-3">
          <div>
            {title && <h2 className="text-lg font-bold text-ama-heading">{title}</h2>}
            {subtitle && <p className="text-sm text-ama-muted">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Card({ title, subtitle, action, footer, children, className = '', padded = true, span }: any) {
  const spanCls = span === 2 ? 'sm:col-span-2' : span === 3 ? 'sm:col-span-2 lg:col-span-3' : span === 'full' ? 'col-span-full' : '';
  return (
    <section className={cx('rounded-2xl border border-ama-border bg-ama-card shadow-sm', spanCls, className)}>
      {(title || subtitle || action) && (
        <div className="flex items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-bold text-ama-text">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-ama-muted">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={padded ? 'px-5 pb-5 pt-4' : 'pt-2'}>{children}</div>
      {footer && <div className="border-t border-ama-border px-5 py-3 text-xs text-ama-muted">{footer}</div>}
    </section>
  );
}

const TONES: any = {
  neutral: 'bg-ama-surface text-ama-text',
  brand: 'bg-ama-primary text-white',
  positive: 'bg-ama-surface text-ama-positive',
  negative: 'bg-ama-surface text-ama-negative',
  warning: 'bg-ama-surface text-ama-warning',
  accent: 'bg-ama-surface text-ama-accent',
};

export function Badge({ tone = 'neutral', children }: any) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', TONES[tone] || TONES.neutral)}>
      {children}
    </span>
  );
}

export function Callout({ tone = 'brand', title, children }: any) {
  const bar: any = { brand: 'bg-ama-primary', positive: 'bg-ama-positive', negative: 'bg-ama-negative', warning: 'bg-ama-warning', accent: 'bg-ama-accent' };
  return (
    <div className="flex gap-3 rounded-xl border border-ama-border bg-ama-card p-4">
      <span className={cx('w-1 shrink-0 rounded-full', bar[tone] || bar.brand)} />
      <div className="min-w-0 text-sm">
        {title && <div className="mb-1 font-bold text-ama-text">{title}</div>}
        <div className="text-ama-muted">{children}</div>
      </div>
    </div>
  );
}

/* ───────────────────────── KPI ───────────────────────── */

export function Delta({ value, format = 'percent', invert = false, label }: any) {
  if (value == null || isNaN(value)) return null;
  const good = invert ? value < 0 : value > 0;
  const flat = value === 0;
  const f = toFormatter(format);
  return (
    <span className={cx('inline-flex items-center gap-1 text-xs font-semibold', flat ? 'text-ama-muted' : good ? 'text-ama-positive' : 'text-ama-negative')}>
      <span>{flat ? '■' : value > 0 ? '▲' : '▼'}</span>
      <span className="tabular-nums">{f(Math.abs(value))}</span>
      {label && <span className="font-normal text-ama-muted">{label}</span>}
    </span>
  );
}

export function Kpi({ label, value, format, delta, deltaFormat = 'percent', deltaLabel, invert, hint, spark, accent = false }: any) {
  const t = useAmaTheme();
  const f = toFormatter(format);
  const sparkData = Array.isArray(spark) ? spark.map((v: any, i: number) => ({ i, v })) : null;
  return (
    <div className={cx('relative overflow-hidden rounded-2xl border border-ama-border bg-ama-card p-4 shadow-sm', accent && 'ring-1 ring-ama-accent')}>
      <div className="text-xs font-semibold uppercase tracking-wide text-ama-muted">{label}</div>
      <div className="mt-1.5 text-2xl font-extrabold tabular-nums leading-tight text-ama-heading sm:text-3xl">
        {typeof value === 'number' ? f(value) : value}
      </div>
      <div className="mt-1.5 flex min-h-[1rem] flex-wrap items-center gap-x-2 gap-y-1">
        <Delta value={delta} format={deltaFormat} invert={invert} label={deltaLabel} />
        {hint && <span className="text-xs text-ama-muted">{hint}</span>}
      </div>
      {sparkData && (
        <div className="mt-2 h-10">
          <ResponsiveContainer width="100%" height="100%">
            <RAreaChart data={sparkData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={'spark-' + String(label).replace(/\W/g, '')} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={t.primary} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={t.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={t.primary} strokeWidth={2} fill={'url(#spark-' + String(label).replace(/\W/g, '') + ')'} isAnimationActive={false} />
            </RAreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── chart helpers ───────────────────────── */

const normSeries = (series: any, y: any, t: any) => {
  let list: any[] = [];
  if (Array.isArray(series) && series.length) list = series;
  else if (Array.isArray(y)) list = y.map((k: string) => ({ key: k }));
  else if (y) list = [{ key: y }];
  return list.map((s: any, i: number) => {
    const o = typeof s === 'string' ? { key: s } : s;
    return { ...o, label: o.label || o.name || o.key, color: o.color || t.series[i % t.series.length] };
  });
};

const truncate = (s: any, n: number) => {
  const str = String(s == null ? '' : s);
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
};

function CategoryTick({ x, y, payload, t, maxChars, anchor = 'end', dy = 4, xf }: any) {
  const raw = payload && payload.value != null ? payload.value : '';
  const full = String(xf ? xf(raw) : raw);
  return (
    <text x={x} y={y} dy={dy} textAnchor={anchor} fill={t.muted} fontSize={12}>
      <title>{full}</title>
      {truncate(full, maxChars)}
    </text>
  );
}

function TooltipBox({ active, payload, label, t, formatter, labelFormatter, extra }: any) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0] && payload[0].payload;
  return (
    <div
      style={{
        background: t.card,
        border: '1px solid ' + t.border,
        borderRadius: 10,
        padding: '10px 12px',
        boxShadow: '0 8px 24px rgba(0,0,0,' + (t.dark ? '0.45' : '0.12') + ')',
        fontSize: 12,
        color: t.text,
        minWidth: 160,
        maxWidth: 280,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{labelFormatter ? labelFormatter(label, row) : label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey + p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginTop: 2 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: t.muted }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color || (p.payload && p.payload.fill) }} />
            {p.name}
          </span>
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{formatter(p.value)}</span>
        </div>
      ))}
      {extra && row && <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid ' + t.border, color: t.muted }}>{extra(row)}</div>}
    </div>
  );
}

export function ChartLegend({ items }: any) {
  return (
    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ama-muted">
      {items.map((s: any) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

const axisProps = (t: any) => ({
  axisLine: false,
  tickLine: false,
  tick: { fill: t.muted, fontSize: 12 },
});

/* ───────────────────────── BarChart ───────────────────────── */

/**
 * <BarChart data={rows} x="cliente" y="pallets" />                       single series
 * <BarChart data={rows} x="mes" series={[{key:'a',label:'2024'},{key:'b',label:'2025'}]} />
 * Props: horizontal (auto for long/many labels), stacked, sort ('desc'|'asc'),
 * highlight (index | label | array → others muted), showValues, format, height,
 * reference ({value,label}), tooltipExtra (row => ReactNode), limit, xFormat.
 */
export function BarChart({
  data = [],
  x = 'name',
  y,
  series,
  horizontal,
  stacked = false,
  sort,
  highlight,
  showValues,
  format,
  height,
  reference,
  tooltipExtra,
  limit,
  legend,
  xFormat,
}: any) {
  const t = useAmaTheme();
  const f = toFormatter(format);
  const s = normSeries(series, y, t);
  let rows = Array.isArray(data) ? data.slice() : [];
  if (sort && s[0]) {
    const k = s[0].key;
    rows.sort((a: any, b: any) => (sort === 'asc' ? a[k] - b[k] : b[k] - a[k]));
  }
  if (limit) rows = rows.slice(0, limit);
  const maxLabel = rows.reduce((m: number, r: any) => Math.max(m, String(r[x] == null ? '' : r[x]).length), 0);
  const isH = horizontal != null ? horizontal : s.length === 1 && (rows.length > 7 || maxLabel > 12);
  const single = s.length === 1;
  const values = showValues != null ? showValues : single && (isH || rows.length <= 12);
  const hl = highlight == null ? null : [].concat(highlight);
  const isHl = (r: any, i: number) => !hl || hl.some((h: any) => h === i || h === r[x]);
  const muted = t.dark ? '#34463F' : '#D3E3DA';
  const xf = xFormat ? toFormatter(xFormat) : null;
  const h = height || (isH ? Math.max(180, rows.length * (s.length > 1 ? 44 : 34) + 36) : 300);
  const labelChars = isH ? Math.min(28, Math.max(6, maxLabel)) : rows.length > 8 ? 10 : 16;
  const yWidth = isH ? Math.min(220, Math.max(64, labelChars * 7.2 + 14)) : undefined;
  const showLegend = legend != null ? legend : s.length > 1;

  return (
    <div>
      {showLegend && <ChartLegend items={s} />}
      <ResponsiveContainer width="100%" height={h}>
        <RBarChart
          data={rows}
          layout={isH ? 'vertical' : 'horizontal'}
          margin={{ top: values && !isH ? 20 : 4, right: values && isH ? 56 : 12, bottom: 4, left: isH ? 0 : -8 }}
          barCategoryGap={isH ? '22%' : '28%'}
        >
          <CartesianGrid stroke={t.grid} vertical={isH} horizontal={!isH} />
          {isH ? (
            <>
              <XAxis type="number" {...axisProps(t)} tickFormatter={(v: any) => (format ? f(v) : fmt.compact(v))} />
              <YAxis
                type="category"
                dataKey={x}
                width={yWidth}
                interval={0}
                {...axisProps(t)}
                tick={(p: any) => <CategoryTick {...p} t={t} maxChars={labelChars} xf={xf} />}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={x}
                interval={rows.length > 14 ? 'preserveStartEnd' : 0}
                {...axisProps(t)}
                tick={(p: any) => <CategoryTick {...p} t={t} maxChars={labelChars} anchor="middle" dy={14} xf={xf} />}
              />
              <YAxis {...axisProps(t)} width={56} tickFormatter={(v: any) => (format ? f(v) : fmt.compact(v))} />
            </>
          )}
          <Tooltip
            cursor={{ fill: t.surface, opacity: 0.7 }}
            content={<TooltipBox t={t} formatter={f} extra={tooltipExtra} labelFormatter={xf || undefined} />}
          />
          {reference && (
            <ReferenceLine
              {...(isH ? { x: reference.value } : { y: reference.value })}
              stroke={t.accent}
              strokeDasharray="4 4"
              label={{ value: reference.label, fill: t.muted, fontSize: 11, position: isH ? 'top' : 'right' }}
            />
          )}
          {s.map((ser: any, si: number) => (
            <Bar
              key={ser.key}
              dataKey={ser.key}
              name={ser.label}
              fill={ser.color}
              stackId={stacked ? 'a' : undefined}
              maxBarSize={isH ? 26 : 44}
              radius={stacked && si < s.length - 1 ? 0 : isH ? [0, 5, 5, 0] : [5, 5, 0, 0]}
              isAnimationActive={false}
            >
              {single && hl && rows.map((r: any, i: number) => <Cell key={i} fill={isHl(r, i) ? ser.color : muted} />)}
              {values && (!stacked || si === s.length - 1) && (
                <LabelList
                  dataKey={ser.key}
                  position={isH ? 'right' : 'top'}
                  formatter={(v: any) => f(v)}
                  style={{ fill: t.muted, fontSize: 11, fontWeight: 600 }}
                />
              )}
            </Bar>
          ))}
        </RBarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ───────────────────────── LineChart / AreaChart ───────────────────────── */

export function LineChart({ data = [], x = 'name', y, series, format, xFormat, height = 300, area = false, reference, tooltipExtra, legend, dots }: any) {
  const t = useAmaTheme();
  const f = toFormatter(format);
  const xf = xFormat ? toFormatter(xFormat) : null;
  const s = normSeries(series, y, t);
  const showDots = dots != null ? dots : data.length <= 16;
  const Chart: any = area ? RAreaChart : RLineChart;
  const showLegend = legend != null ? legend : s.length > 1;
  return (
    <div>
      {showLegend && <ChartLegend items={s} />}
      <ResponsiveContainer width="100%" height={height}>
        <Chart data={data} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
          {area && (
            <defs>
              {s.map((ser: any) => (
                <linearGradient key={ser.key} id={'ama-area-' + ser.key} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ser.color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={ser.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
          )}
          <CartesianGrid stroke={t.grid} vertical={false} />
          <XAxis dataKey={x} {...axisProps(t)} tickFormatter={xf || undefined} minTickGap={16} dy={6} />
          <YAxis {...axisProps(t)} width={56} tickFormatter={(v: any) => (format ? f(v) : fmt.compact(v))} />
          <Tooltip
            cursor={{ stroke: t.border, strokeWidth: 1 }}
            content={<TooltipBox t={t} formatter={f} extra={tooltipExtra} labelFormatter={xf || undefined} />}
          />
          {reference && (
            <ReferenceLine y={reference.value} stroke={t.accent} strokeDasharray="4 4" label={{ value: reference.label, fill: t.muted, fontSize: 11, position: 'insideTopRight' }} />
          )}
          {s.map((ser: any) =>
            area ? (
              <Area
                key={ser.key}
                type="monotone"
                dataKey={ser.key}
                name={ser.label}
                stroke={ser.color}
                strokeWidth={2.5}
                fill={'url(#ama-area-' + ser.key + ')'}
                dot={showDots ? { r: 3, fill: ser.color, strokeWidth: 0 } : false}
                activeDot={{ r: 5, stroke: t.card, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ) : (
              <Line
                key={ser.key}
                type="monotone"
                dataKey={ser.key}
                name={ser.label}
                stroke={ser.color}
                strokeWidth={2.5}
                dot={showDots ? { r: 3, fill: ser.color, strokeWidth: 0 } : false}
                activeDot={{ r: 5, stroke: t.card, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ),
          )}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}

export function AreaChart(props: any) {
  return <LineChart {...props} area />;
}

/* ───────────────────────── DonutChart ───────────────────────── */

/** <DonutChart data={[{name:'A', value: 10}, …]} centerLabel="Total" /> — max ~6 slices, rest grouped as "Otros". */
export function DonutChart({ data = [], name = 'name', value = 'value', format, height = 240, centerLabel = 'Total', maxSlices = 6 }: any) {
  const t = useAmaTheme();
  const f = toFormatter(format);
  let rows = data.map((d: any) => ({ name: d[name], value: Number(d[value]) || 0 })).sort((a: any, b: any) => b.value - a.value);
  if (rows.length > maxSlices) {
    const rest = rows.slice(maxSlices - 1).reduce((s: number, r: any) => s + r.value, 0);
    rows = rows.slice(0, maxSlices - 1).concat([{ name: 'Otros', value: rest }]);
  }
  const total = rows.reduce((s: number, r: any) => s + r.value, 0) || 1;
  const colors = rows.map((r: any, i: number) => (r.name === 'Otros' ? (t.dark ? '#3A4A47' : '#C9D3CF') : t.series[i % t.series.length]));
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative w-full sm:w-1/2" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={1.5} stroke={t.card} strokeWidth={2} isAnimationActive={false}>
              {rows.map((r: any, i: number) => <Cell key={i} fill={colors[i]} />)}
            </Pie>
            <Tooltip content={<TooltipBox t={t} formatter={(v: any) => f(v) + ' · ' + fmt.percent(v / total)} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-ama-muted">{centerLabel}</span>
          <span className="text-xl font-extrabold tabular-nums text-ama-heading">{f(total)}</span>
        </div>
      </div>
      <ul className="w-full space-y-2 text-sm sm:w-1/2">
        {rows.map((r: any, i: number) => (
          <li key={i} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: colors[i] }} />
              <span className="truncate text-ama-text" title={r.name}>{r.name}</span>
            </span>
            <span className="shrink-0 tabular-nums text-ama-muted">
              <span className="font-semibold text-ama-text">{f(r.value)}</span> · {fmt.percent(r.value / total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────────────────────── DataTable ───────────────────────── */

/**
 * columns: [{ key, label, format?, align?, bar?: true (inline bar vs column max), render?: (row) => node }]
 * Sortable by clicking headers. maxRows shows a "ver todo" toggle.
 */
export function DataTable({ columns, rows = [], maxRows, rank = false, dense = false, defaultSort }: any) {
  const cols = columns || (rows[0] ? Object.keys(rows[0]).map((k) => ({ key: k, label: k })) : []);
  const [sort, setSort] = useState<any>(defaultSort || null);
  const [all, setAll] = useState(false);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return rows.slice().sort((a: any, b: any) => {
      const va = a[sort.key];
      const vb = b[sort.key];
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va == null ? '' : va).localeCompare(String(vb == null ? '' : vb), 'es') * dir;
    });
  }, [rows, sort]);
  const maxes = useMemo(() => {
    const m: any = {};
    cols.forEach((c: any) => {
      if (c.bar) m[c.key] = Math.max(1, ...rows.map((r: any) => Number(r[c.key]) || 0));
    });
    return m;
  }, [rows, cols]);
  const visible = maxRows && !all ? sorted.slice(0, maxRows) : sorted;
  const isNum = (c: any) => c.align === 'right' || (c.align == null && rows.length > 0 && typeof rows[0][c.key] === 'number');
  const py = dense ? 'py-1.5' : 'py-2.5';
  const toggle = (k: string) =>
    setSort((s: any) => (!s || s.key !== k ? { key: k, dir: 'desc' } : s.dir === 'desc' ? { key: k, dir: 'asc' } : null));
  return (
    <div className="overflow-hidden rounded-xl border border-ama-border">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-ama-surface">
            <tr>
              {rank && <th className="w-10 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-ama-muted">#</th>}
              {cols.map((c: any) => (
                <th
                  key={c.key}
                  onClick={() => toggle(c.key)}
                  className={cx('cursor-pointer select-none whitespace-nowrap px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-ama-muted hover:text-ama-text', isNum(c) ? 'text-right' : 'text-left')}
                >
                  {c.label || c.key}
                  <span className="ml-1 opacity-60">{sort && sort.key === c.key ? (sort.dir === 'asc' ? '↑' : '↓') : ''}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r: any, i: number) => (
              <tr key={i} className="border-t border-ama-border bg-ama-card hover:bg-ama-surface">
                {rank && <td className={cx('px-3 text-xs font-semibold text-ama-muted tabular-nums', py)}>{i + 1}</td>}
                {cols.map((c: any) => {
                  const v = r[c.key];
                  const f = toFormatter(c.format);
                  const content = c.render ? c.render(r) : typeof v === 'number' ? f(v) : v;
                  return (
                    <td key={c.key} className={cx('px-3 align-middle', py, isNum(c) ? 'text-right tabular-nums' : 'text-left')}>
                      {c.bar ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="min-w-[3.5rem] font-semibold text-ama-text">{content}</span>
                          <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-ama-surface sm:block">
                            <span className="block h-full rounded-full bg-ama-primary" style={{ width: Math.max(2, ((Number(v) || 0) / maxes[c.key]) * 100) + '%' }} />
                          </span>
                        </div>
                      ) : (
                        <span className={isNum(c) ? 'font-semibold text-ama-text' : 'text-ama-text'}>{content}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {maxRows && rows.length > maxRows && (
        <button onClick={() => setAll(!all)} className="w-full border-t border-ama-border bg-ama-card py-2 text-xs font-semibold text-ama-primary hover:bg-ama-surface">
          {all ? 'Ver menos' : 'Ver las ' + rows.length + ' filas'}
        </button>
      )}
    </div>
  );
}

/* ───────────────────────── Tabs (simple) ───────────────────────── */

export function Tabs({ tabs = [], children }: any) {
  const [active, setActive] = useState(0);
  const items = React.Children.toArray(children);
  return (
    <div>
      <div className="mb-4 inline-flex rounded-xl border border-ama-border bg-ama-surface p-1">
        {tabs.map((label: string, i: number) => (
          <button
            key={label}
            onClick={() => setActive(i)}
            className={cx('rounded-lg px-3 py-1.5 text-sm font-semibold transition', i === active ? 'bg-ama-card text-ama-heading shadow-sm' : 'text-ama-muted hover:text-ama-text')}
          >
            {label}
          </button>
        ))}
      </div>
      {items[active]}
    </div>
  );
}
`;
