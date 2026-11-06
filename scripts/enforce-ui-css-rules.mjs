#!/usr/bin/env node

/*
  Shared UI style rules for BracketWorks, Tournament Central, and @bracketworks/ui.
  Run from an app or package directory:
    node ../../scripts/enforce-ui-css-rules.mjs          # changed lines only
    node ../../scripts/enforce-ui-css-rules.mjs --full   # every tracked file
  Color literals are allowed only in the token files listed below.
*/

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const frontendRoot = process.cwd();
const isFullMode = process.argv.includes('--full');
const scannedDirectories = ['app', 'components', 'lib', 'styles', 'src'];

const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.scss']);

const colorLiteralRegex = /(?<!&)#(?:[0-9a-fA-F]{3,8})\b|(?:rgb|hsl)a?\s*\(/;
const namedColorLiteralRegex = /(?<![-\w])(?:black|white)(?![-\w])/i;
// Paths are relative to the directory the script runs from.
const colorTokenFiles = new Set([
  // packages/ui
  'styles/tokens.css',
  'styles/theme.css',
  'styles/app-theme.css',
  'src/bracketworks-theme.css',
  // bracketworks-web
  'app/styles/main.css',
  'app/styles/landing-global.css',
  // tournament-central-web
  'styles/main.css',
  'lib/printTheme.ts',
]);
const inlineStyleRegex = /\bstyle\s*=\s*\{\{/;
const inlineHtmlStyleAttrRegex = /\bstyle\s*=\s*["'`]/;
const cssTextAssignmentRegex = /\.style\.cssText\s*=/;
const styledJsxRegex = /<style\s+jsx/;
const emojiRegex = /[\u{1F300}-\u{1FAFF}]/u;
const uiSymbolRegex = /[✓✔▲▼►▶◀◁←→↑↓⊕…⋯]/u;
const uiSymbolEntityRegex = /&#(?:10003|10004);/;
const fontFamilyLiteralRegex = /\bfont-family\s*:(?!\s*(?:var\(|inherit\b|initial\b|unset\b))/;
const transitionAllRegex = /\btransition\s*:\s*all\b/i;
// Sizes must come from the shared scales in packages/ui/styles/tokens.css
// (--space-*, --size-*, --font-size-*, --radius-*). Borders, shadows, transforms,
// letter-spacing, and @media breakpoints are exempt.
const hardcodedSizeRegex = /(?:^|[;{\s])(?:font-size|font|padding(?:-[a-z]+)*|margin(?:-[a-z]+)*|gap|row-gap|column-gap|inset(?:-[a-z]+)*|top|right|bottom|left|width|height|min-width|min-height|max-width|max-height|block-size|inline-size|flex-basis|flex|grid-template-[a-z]+|grid-auto-[a-z]+|border(?:-[a-z]+)*-radius)\s*:[^;}]*?(?<![\w#.-])\d*\.?\d+(?:px|rem)\b/;
const atRuleConditionRegex = /^\s*@(?:media|container|supports)\b/;
// docs/ui-standards.md section 1: no gradients, blur, glows, decorative shadows, lifts, or scaling.
const gradientRegex = /\b(?:repeating-)?(?:linear|radial|conic)-gradient\s*\(/;
// Each lookahead starts right after the colon so whitespace cannot be backtracked past it.
const backdropFilterRegex = /\bbackdrop-filter\s*:(?!\s*none\b)/;
const filterEffectRegex = /(?<![-\w])filter\s*:[^;]*\b(?:drop-shadow|blur)\s*\(/;
const textShadowRegex = /\btext-shadow\s*:(?!\s*none\b)/;
// Only overlays get a shadow, and focus rings use the ring tokens.
const boxShadowRegex = /\bbox-shadow\s*:(?!\s*(?:none|inherit|var\(--(?:focus-ring|ring-brand|ring-danger|elevation-2|elevation-modal)\))\s*(?:!important\s*)?(?:[;}]|$))/;
// Lifts are negative translateY in px or a negated space token; centering with -50% is fine.
const hoverLiftRegex = /\btranslateY\(\s*(?:-\s*\d+(?:\.\d+)?px|calc\(\s*var\(--space-[\w-]+\)\s*\*\s*-1\s*\))|\bscale\(\s*1\.\d+/;
// Weights are 400, 600, and 700 only.
const fontWeightRegex = /\bfont-weight\s*:(?!\s*(?:400|600|700|normal|bold|inherit|var\(--font-weight-(?:normal|semibold|bold)\))\s*(?:!important\s*)?(?:[;}]|$))/;
// Icon components take ICON_SIZE from @bracketworks/ui instead of a number.
const hardcodedIconSizeRegex = /<[A-Z][\w.]*\b[^>]*\bsize=\{\d/;
const hardcodedMediaQueryRegex = /\b(?:window\.)?matchMedia\s*\(\s*['"`][^'"`]*(?:min|max)-width\s*:/;

const violations = [];

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function shouldScanFile(filePath) {
  if (!scannedDirectories.some((directory) => filePath.startsWith(`${directory}/`))) {
    return false;
  }
  if (/\.test\.[jt]sx?$/.test(filePath)) {
    return false;
  }

  const ext = path.extname(filePath);
  return allowedExtensions.has(ext);
}

function addViolation(filePath, lineNumber, rule, line) {
  violations.push({
    filePath,
    lineNumber,
    rule,
    line: line.trim(),
  });
}

function checkLine(filePath, lineNumber, line) {
  const ext = path.extname(filePath);
  const codeLine = line.replace(/\/\/.*$/, '');

  if (
    !colorTokenFiles.has(filePath) &&
    (colorLiteralRegex.test(codeLine) ||
      ((ext === '.css' || ext === '.scss') && namedColorLiteralRegex.test(codeLine)))
  ) {
    addViolation(filePath, lineNumber, 'use-shared-color-tokens', line);
  }

  if (emojiRegex.test(line)) {
    addViolation(filePath, lineNumber, 'no-emoji', line);
  }

  if (uiSymbolRegex.test(line) || uiSymbolEntityRegex.test(line)) {
    addViolation(filePath, lineNumber, 'no-symbol-ui-text', line);
  }

  if (
    (ext === '.css' || ext === '.scss') &&
    fontFamilyLiteralRegex.test(line) &&
    !line.includes('--font-family-') &&
    !line.includes('--print-font-family')
  ) {
    addViolation(filePath, lineNumber, 'use-shared-font-tokens', line);
  }

  if (
    (ext === '.css' || ext === '.scss') &&
    !colorTokenFiles.has(filePath) &&
    !atRuleConditionRegex.test(line) &&
    !/^\s*(?:\/\*|\*)/.test(line) &&
    hardcodedSizeRegex.test(line.replace(/\/\*.*?\*\//g, ''))
  ) {
    addViolation(filePath, lineNumber, 'use-shared-size-tokens', line);
  }

  if (!colorTokenFiles.has(filePath) && !/^\s*(?:\/\*|\*|\/\/)/.test(line)) {
    const code = line.replace(/\/\*.*?\*\//g, '');
    if (gradientRegex.test(code)) addViolation(filePath, lineNumber, 'no-gradients', line);
    if (ext === '.css' || ext === '.scss') {
      if (backdropFilterRegex.test(code) || filterEffectRegex.test(code)) addViolation(filePath, lineNumber, 'no-blur-or-glow', line);
      if (textShadowRegex.test(code) || boxShadowRegex.test(code)) addViolation(filePath, lineNumber, 'no-decorative-shadows', line);
      if (hoverLiftRegex.test(code)) addViolation(filePath, lineNumber, 'no-hover-lift-or-scale', line);
      if (fontWeightRegex.test(code)) addViolation(filePath, lineNumber, 'use-standard-font-weights', line);
    }
  }

  if ((ext === '.css' || ext === '.scss') && transitionAllRegex.test(line)) {
    addViolation(filePath, lineNumber, 'no-transition-all', line);
  }

  if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
    if (hardcodedIconSizeRegex.test(codeLine)) {
      addViolation(filePath, lineNumber, 'use-shared-icon-size', line);
    }

    if (inlineStyleRegex.test(codeLine)) {
      addViolation(filePath, lineNumber, 'no-inline-jsx-style', line);
    }

    if (inlineHtmlStyleAttrRegex.test(codeLine)) {
      addViolation(filePath, lineNumber, 'no-inline-html-style-attr', line);
    }

    if (cssTextAssignmentRegex.test(codeLine)) {
      addViolation(filePath, lineNumber, 'no-csstext-assignment', line);
    }

    if (styledJsxRegex.test(codeLine)) {
      addViolation(filePath, lineNumber, 'no-styled-jsx-blocks', line);
    }

    if (hardcodedMediaQueryRegex.test(codeLine)) {
      addViolation(filePath, lineNumber, 'use-shared-responsive-query', line);
    }
  }
}

function scanFullRepo() {
  const entries = execSync('git ls-files', {
    cwd: frontendRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
    .split(/\r?\n/)
    .map((line) => normalizePath(line.trim()))
    .filter(Boolean)
    .filter(shouldScanFile);

  for (const filePath of entries) {
    const absolutePath = path.join(frontendRoot, filePath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }
    const content = fs.readFileSync(absolutePath, 'utf8');
    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      checkLine(filePath, index + 1, lines[index]);
    }
  }
}

function scanChangedLines() {
  const diff = execSync(`git diff --unified=0 --relative -- ${scannedDirectories.join(' ')}`, {
    cwd: frontendRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (!diff.trim()) {
    return;
  }

  const lines = diff.split(/\r?\n/);
  let currentFile = null;
  let currentNewLine = 0;

  for (const line of lines) {
    if (line.startsWith('+++ b/')) {
      currentFile = normalizePath(line.slice('+++ b/'.length));
      continue;
    }

    if (!currentFile || !shouldScanFile(currentFile)) {
      continue;
    }

    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (hunkMatch) {
      currentNewLine = Number(hunkMatch[1]);
      continue;
    }

    if (line.startsWith('+') && !line.startsWith('+++')) {
      const content = line.slice(1);
      checkLine(currentFile, currentNewLine, content);
      currentNewLine += 1;
      continue;
    }

    if (line.startsWith('-') && !line.startsWith('---')) {
      continue;
    }

    if (!line.startsWith('diff --git')) {
      currentNewLine += 1;
    }
  }
}

try {
  if (isFullMode) {
    scanFullRepo();
  } else {
    scanChangedLines();
  }
} catch (error) {
  console.error('Failed to run UI CSS rules check.');
  console.error(String(error));
  process.exit(1);
}

if (violations.length > 0) {
  console.error('UI CSS rules check failed. Use shared style tokens and responsive queries, and remove unsupported inline or symbol UI styling.');
  for (const violation of violations) {
    console.error(
      `${violation.filePath}:${violation.lineNumber} [${violation.rule}] ${violation.line}`
    );
  }
  process.exit(1);
}

console.log(
  isFullMode
    ? 'UI CSS rules check passed for full frontend source scan.'
    : 'UI CSS rules check passed for changed frontend lines.'
);
