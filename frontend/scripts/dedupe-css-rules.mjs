#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';

const [cssArgument, mode] = process.argv.slice(2);
if (!cssArgument) {
  console.error('Usage: node scripts/dedupe-css-rules.mjs <file.css> [--write]');
  process.exit(1);
}

const cssPath = path.resolve(cssArgument);
const root = postcss.parse(fs.readFileSync(cssPath, 'utf8'), { from: cssPath });
const rulesBySignature = new Map();

function atRuleContext(node) {
  const context = [];
  let parent = node.parent;
  while (parent && parent.type !== 'root') {
    if (parent.type === 'atrule') context.unshift(`@${parent.name} ${parent.params}`);
    parent = parent.parent;
  }
  return context.join('|');
}

root.walkRules((rule) => {
  if (rule.parent?.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return;
  const declarations = rule.nodes
    .filter((node) => node.type === 'decl')
    .map((node) => `${node.prop}:${node.value}${node.important ? '!important' : ''}`)
    .join(';');
  const signature = `${atRuleContext(rule)}|${rule.selector}|${declarations}`;
  const matches = rulesBySignature.get(signature) || [];
  matches.push(rule);
  rulesBySignature.set(signature, matches);
});

const duplicates = [];
for (const rules of rulesBySignature.values()) {
  if (rules.length < 2) continue;
  for (const rule of rules.slice(0, -1)) duplicates.push(rule);
}

console.log(`Exact duplicate rules: ${duplicates.length}`);
for (const rule of duplicates) console.log(`  ${rule.selector} (${atRuleContext(rule) || 'root'})`);

if (mode === '--write') {
  for (const rule of duplicates) rule.remove();
  root.walkAtRules((atRule) => {
    if (atRule.nodes && atRule.nodes.length === 0) atRule.remove();
  });
  fs.writeFileSync(cssPath, root.toString(), 'utf8');
  console.log(`Updated ${cssPath}`);
}
