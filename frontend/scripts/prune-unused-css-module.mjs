#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';

const [cssArgument, sourceArgument, mode] = process.argv.slice(2);
if (!cssArgument || !sourceArgument) {
  console.error('Usage: node scripts/prune-unused-css-module.mjs <module.css> <source.tsx> [--write]');
  process.exit(1);
}

const cssPath = path.resolve(cssArgument);
const sourcePath = path.resolve(sourceArgument);
const css = fs.readFileSync(cssPath, 'utf8');
const source = fs.readFileSync(sourcePath, 'utf8');
const usedClasses = new Set();
const referencePattern = /\bstyles\.([A-Za-z_][A-Za-z0-9_]*)\b/g;
let referenceMatch;
while ((referenceMatch = referencePattern.exec(source)) !== null) {
  usedClasses.add(referenceMatch[1]);
}

const root = postcss.parse(css, { from: cssPath });
const removedSelectors = [];
const classPattern = /\.([A-Za-z_][A-Za-z0-9_-]*)/g;

root.walkRules((rule) => {
  if (rule.parent?.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return;

  const retained = rule.selectors.filter((selector) => {
    const classes = [];
    let classMatch;
    while ((classMatch = classPattern.exec(selector)) !== null) classes.push(classMatch[1]);
    classPattern.lastIndex = 0;
    if (!classes.length || classes.some((className) => usedClasses.has(className))) return true;
    removedSelectors.push(selector);
    return false;
  });

  if (!retained.length) rule.remove();
  else if (retained.length !== rule.selectors.length) rule.selectors = retained;
});

root.walkAtRules((atRule) => {
  if (atRule.nodes && atRule.nodes.length === 0) atRule.remove();
});

console.log(`Referenced classes: ${usedClasses.size}`);
console.log(`Unused selectors: ${removedSelectors.length}`);
for (const selector of removedSelectors) console.log(`  ${selector}`);

if (mode === '--write') {
  fs.writeFileSync(cssPath, root.toString(), 'utf8');
  console.log(`Updated ${cssPath}`);
}
