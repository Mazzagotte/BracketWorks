/*
  Print palette for standalone exported documents (for example the tournament
  summary opened in a new tab). Those documents do not load the app stylesheet,
  so CSS custom properties are unavailable and colors must be literal here.
  This is the only TypeScript file allowed to hold color literals.
*/

export const PRINT_COLORS = {
  pageBackground: '#f4f4f2',
  sheetBackground: '#ffffff',
  text: '#1b1b1b',
  heading: '#171717',
  accent: '#ff7a00',
  eyebrow: '#a84f00',
  meta: '#565656',
  label: '#666666',
  footer: '#777777',
  rule: '#dddddd',
  tableHeaderBackground: '#191919',
  tableHeaderText: '#ffffff',
} as const;

const c = PRINT_COLORS;

export const TOURNAMENT_SUMMARY_PRINT_CSS = [
  `body{margin:0;background:${c.pageBackground};color:${c.text};font:14px/1.5 Arial,sans-serif}`,
  `.page{max-width:900px;margin:32px auto;background:${c.sheetBackground};padding:42px;box-sizing:border-box}`,
  `h1,h2{margin:0;color:${c.heading}}`,
  'h1{font-size:30px}',
  `h2{font-size:18px;margin-top:32px;border-bottom:2px solid ${c.accent};padding-bottom:6px}`,
  `.eyebrow{color:${c.eyebrow};font-size:11px;font-weight:bold;letter-spacing:.1em;text-transform:uppercase}`,
  `.meta{color:${c.meta};margin:8px 0 0}`,
  '.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:18px}',
  `.fact{border:1px solid ${c.rule};padding:12px}`,
  `.fact b{display:block;font-size:11px;letter-spacing:.08em;color:${c.label}}`,
  'table{width:100%;border-collapse:collapse;margin-top:12px}',
  `th,td{padding:9px;border-bottom:1px solid ${c.rule};text-align:left;vertical-align:top}`,
  `th{background:${c.tableHeaderBackground};color:${c.tableHeaderText};font-size:11px;letter-spacing:.05em;text-transform:uppercase}`,
  `.footer{margin-top:32px;color:${c.footer};font-size:12px}`,
  `@media print{body{background:${c.sheetBackground}}.page{margin:0;max-width:none;padding:0}}`,
].join('');
