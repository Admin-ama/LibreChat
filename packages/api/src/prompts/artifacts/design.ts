import dedent from 'dedent';

/**
 * AMA design system rules for artifacts. The React kit it documents is injected
 * into the sandbox by the client (`client/src/utils/amaArtifactKit.ts`); keep
 * the component API below in sync with that file.
 */
export const amaDesignPrompt = dedent`

# AMA design system (MANDATORY for every visual artifact)
Artifacts are seen by AMA Time staff and must look like a polished AMA product, never like a default template.
The preview automatically follows the user's light/dark theme, so NEVER hardcode text or background colors (no \`text-gray-*\`, \`bg-white\`, \`text-black\`, \`bg-blue-500\`, \`#333\`, etc.) and never use blue or off-brand colors.

## React artifacts ("application/vnd.react") — the default for charts, dashboards, KPIs, data tables and data reports
Build them with the AMA kit, which already provides theme, brand palette, typography, es-CL number formatting and chart styling:

\`import { Page, Grid, Section, Card, Kpi, BarChart, LineChart, AreaChart, DonutChart, DataTable, Tabs, Badge, Callout, Delta, fmt, brand, useAmaTheme } from '/components/ama';\`

- \`<Page title subtitle eyebrow source updated wide>\` — always the root. eyebrow = short area label (e.g. "Logística"); source = data origin (e.g. "Metabase · bodega").
- \`<Grid cols={2|3|4}>\`, \`<Section title subtitle>\`, \`<Card title subtitle footer span={2|3|'full'}>\` — layout.
- \`<Kpi label value format delta deltaLabel invert hint spark={[numbers]} />\` — delta is a ratio (0.12 = +12 %); invert when lower is better.
- \`<BarChart data x="cliente" y="pallets" />\` or \`series={[{key:'a', label:'2024'}, {key:'b', label:'2025'}]}\`. Options: sort="desc", limit, highlight (index/label/array; the rest are muted), stacked, horizontal (automatic for many or long labels), showValues, reference={{value, label}}, tooltipExtra={(row) => text}, xFormat="month"|"date" for date categories, height.
- \`<LineChart data x y|series format xFormat area reference />\`, \`<AreaChart …/>\` — time series.
- \`<DonutChart data name="name" value="value" centerLabel />\` — shares of a whole only (≤6 slices; the rest become "Otros").
- \`<DataTable columns={[{key, label, format, bar:true, render}]} rows rank maxRows={10} />\` — sortable; \`bar\` draws an inline bar.
- \`<Callout tone="brand|positive|negative|warning" title>\` for the key insight; \`<Badge tone>\`; \`<Tabs tabs={['A','B']}>{panelA}{panelB}</Tabs>\`.
- \`format\` (Kpi, charts, columns): 'number' | 'decimal' | 'percent' (ratio) | 'clp' | 'usd' | 'compact' | (v) => string. Use \`fmt.number(v)\`, \`fmt.percent(r)\`, \`fmt.clp(v)\`, \`fmt.date(d)\`, \`fmt.month(d)\` for any number or date shown in text.
- Tailwind color tokens if you need extra markup: \`bg-ama-bg\`, \`bg-ama-card\`, \`bg-ama-surface\`, \`text-ama-text\`, \`text-ama-heading\`, \`text-ama-muted\`, \`text-ama-primary\`, \`text-ama-accent\`, \`text-ama-positive\`, \`text-ama-negative\`, \`border-ama-border\`.
- Only import recharts directly for a chart type the kit lacks; then take every color from \`useAmaTheme()\` (\`t.series\`, \`t.grid\`, \`t.muted\`, \`t.text\`, \`t.card\`).

Composition of a data artifact:
1. \`<Page>\` with a specific title, a one-line subtitle (metric, period, filter) and \`source\`.
2. A \`<Grid cols={3|4}>\` of 2–4 \`<Kpi>\` that answer the question at a glance (total, leader, share, change).
3. The main chart inside a \`<Card title subtitle>\`; one idea per chart. Ranking → horizontal BarChart sorted desc; trend → LineChart/AreaChart; share → DonutChart; comparison of periods → BarChart with 2 series.
4. Optionally a \`<DataTable>\` with the detail and/or a \`<Callout>\` with the main insight. Do not repeat the chat explanation inside the artifact.
All visible text in Spanish. Never invent data: use only values obtained from tools or provided by the user.

Example:
\`\`\`
import { Page, Grid, Card, Kpi, BarChart, DataTable, fmt } from '/components/ama';

const data = [
  { cliente: 'PROSUD S.A.', pallets: 2152, despachos: 254 },
  { cliente: 'Blue Express S.A.', pallets: 933, despachos: 53 },
  { cliente: 'Comercial Santa Macarena', pallets: 656, despachos: 47 },
];
const total = data.reduce((s, d) => s + d.pallets, 0);

export default function App() {
  return (
    <Page eyebrow="Logística" title="Volumen de despacho por cliente" subtitle="Pallets despachados, top 3" source="Metabase · bodega">
      <Grid cols={3}>
        <Kpi label="Pallets totales" value={total} />
        <Kpi label="Cliente líder" value="PROSUD S.A." hint={fmt.percent(2152 / total) + ' del total'} />
        <Kpi label="Despachos" value={354} />
      </Grid>
      <Card title="Pallets por cliente" subtitle="Ordenado de mayor a menor">
        <BarChart data={data} x="cliente" y="pallets" sort="desc" highlight={0} tooltipExtra={(r) => fmt.number(r.despachos) + ' despachos'} />
      </Card>
      <DataTable rank columns={[{ key: 'cliente', label: 'Cliente' }, { key: 'pallets', label: 'Pallets', bar: true }, { key: 'despachos', label: 'Despachos' }]} rows={data} />
    </Page>
  );
}
\`\`\`

## HTML artifacts ("text/html")
The AMA base is injected automatically: CSS variables \`--ama-bg\`, \`--ama-card\`, \`--ama-surface\`, \`--ama-border\`, \`--ama-grid\`, \`--ama-text\`, \`--ama-heading\`, \`--ama-muted\`, \`--ama-primary\`, \`--ama-accent\`, \`--ama-positive\`, \`--ama-negative\`, \`--ama-series-1\`…\`--ama-series-6\`; classes \`.ama-page\`, \`.ama-header\`, \`.ama-eyebrow\`, \`.ama-title\`, \`.ama-subtitle\`, \`.ama-grid\`, \`.ama-card\`, \`.ama-kpi-label\`, \`.ama-kpi-value\`, \`.ama-table\` (\`td.num\` for numbers), \`.ama-badge\`, \`.ama-pos\`, \`.ama-neg\`, \`.ama-muted\`, \`.ama-footer\`; and \`window.AMA\` (\`AMA.series\`, \`AMA.colors\`, \`AMA.font\`, \`AMA.fmt.number/percent/clp\`) for chart libraries from cdnjs. Use only these colors (via \`var(--ama-…)\`), do not set a font-family or body background of your own. Prefer React + the AMA kit whenever the artifact shows data.

## Brand palette (for SVG or anything outside the kit)
Primary #00504D (dominant), #1DAA75, accent #8AB351; secondary #80C5A0, #B6D7A8, #004418; neutral text #727574. No blue, no default library palettes.
`;
