#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const frontendRoot = process.cwd();
const isFullMode = process.argv.includes('--full');

const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.scss']);

const colorLiteralRegex = /(?<!&)#(?:[0-9a-fA-F]{3,8})\b|(?:rgb|hsl)a?\s*\(/;
const namedColorLiteralRegex = /(?<![-\w])(?:black|white)(?![-\w])/i;
const colorTokenFiles = new Set([
  'app/styles/colors.global.css',
  'app/styles/main.css',
  'app/styles/landing-global.css',
]);
const inlineStyleRegex = /\bstyle\s*=\s*\{\{/;
const inlineHtmlStyleAttrRegex = /\bstyle\s*=\s*["'`]/;
const cssTextAssignmentRegex = /\.style\.cssText\s*=/;
const styledJsxRegex = /<style\s+jsx/;
const emojiRegex = /[\u{1F300}-\u{1FAFF}]/u;
const uiSymbolRegex = /[✓✔▲▼►▶◀◁←→↑↓⊕…⋯]/u;
const uiSymbolEntityRegex = /&#(?:10003|10004);/;
const fontFamilyLiteralRegex = /\bfont-family\s*:\s*(?!var\(|inherit\b|initial\b|unset\b)/;
const transitionAllRegex = /\btransition\s*:\s*all\b/i;

const violations = [];

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function shouldScanFile(filePath) {
  if (!filePath.startsWith('app/') && !filePath.startsWith('components/')) {
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

  if ((ext === '.css' || ext === '.scss') && transitionAllRegex.test(line)) {
    addViolation(filePath, lineNumber, 'no-transition-all', line);
  }

  if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
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
  const diff = execSync('git diff --unified=0 -- app components', {
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
  console.error('UI CSS rules check failed. Move styles/colors to .css files, use shared font tokens, and remove emoji or symbol UI text.');
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
