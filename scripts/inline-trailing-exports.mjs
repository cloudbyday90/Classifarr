/**
 * Converts trailing `export { foo, bar, ... }` blocks to inline `export`
 * declarations for locally-defined functions and constants.
 *
 * Rules:
 * - Only processes files under server/src (not tests)
 * - Skips `export { x } from '...'` (re-export forms)
 * - Skips `export default` lines
 * - For each name in the trailing block, searches for a local declaration
 *   (`async function NAME`, `function NAME`, `const NAME`, `class NAME`)
 *   and prefixes it with `export `
 * - Names that can't be matched locally are left as a reduced trailing block
 * - If all names are matched, the trailing block is removed entirely
 *
 * Safe: only modifies function/const declarations — never rewrites logic.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC_DIR = new URL('../server/src', import.meta.url).pathname
  .replace(/^\/([A-Z]:)/, '$1');

// Files/dirs to skip
const SKIP_PATTERNS = ['__tests__', 'node_modules'];

function shouldSkip(filePath) {
  return SKIP_PATTERNS.some((p) => filePath.replace(/\\/g, '/').includes(p));
}

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (SKIP_PATTERNS.some((p) => entry.name === p)) continue;
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith('.mjs')) files.push(full);
  }
  return files;
}

// Match a trailing export block (non-re-export form).
// Captures the comma-separated names inside.
// Uses a multiline scan from the end of the file.
function findTrailingExportBlock(content) {
  // Match: export {\n  name1,\n  name2,\n  ...\n};
  // Also match single-line: export { a, b, c };
  const blockRe = /\nexport \{([^}]+)\};?\s*$/;
  const match = content.match(blockRe);
  if (!match) return null;

  // Make sure it's not a re-export (from '...')
  const afterBrace = content.slice(content.lastIndexOf(match[0]) + match[0].length);
  if (/from\s+['"]/.test(afterBrace)) return null;
  if (match[0].includes(' from ')) return null;

  const names = match[1]
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);

  return { fullMatch: match[0], names };
}

function addExportToDeclaration(content, name) {
  // Patterns to match (in priority order):
  // 1. export async function NAME  → already exported, skip
  // 2. async function NAME(
  // 3. function NAME(
  // 4. const NAME =
  // 5. class NAME

  const patterns = [
    // Skip if already exported
    new RegExp(`^export (?:async )?function ${escRe(name)}[\\s(]`, 'm'),
    new RegExp(`^export const ${escRe(name)}\\b`, 'm'),
    new RegExp(`^export class ${escRe(name)}\\b`, 'm'),
  ];

  for (const p of patterns) {
    if (p.test(content)) return { content, matched: true }; // already exported
  }

  const replacements = [
    [new RegExp(`^(async function ${escRe(name)}[\\s(])`, 'm'), 'export $1'],
    [new RegExp(`^(function ${escRe(name)}[\\s(])`, 'm'), 'export $1'],
    [new RegExp(`^(const ${escRe(name)}\\s*=)`, 'm'), 'export $1'],
    [new RegExp(`^(class ${escRe(name)}[\\s{])`, 'm'), 'export $1'],
  ];

  for (const [re, replacement] of replacements) {
    if (re.test(content)) {
      return { content: content.replace(re, replacement), matched: true };
    }
  }

  return { content, matched: false };
}

function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let totalFiles = 0;
let totalInlined = 0;

for (const filePath of walk(SRC_DIR)) {
  if (shouldSkip(filePath)) continue;

  const original = readFileSync(filePath, 'utf8');
  const block = findTrailingExportBlock(original);
  if (!block) continue;

  let content = original;
  const unmatched = [];

  for (const name of block.names) {
    const result = addExportToDeclaration(content, name);
    content = result.content;
    if (!result.matched) unmatched.push(name);
    else totalInlined++;
  }

  if (content === original) continue; // nothing changed

  // Remove or reduce trailing block
  if (unmatched.length === 0) {
    // Remove entire trailing block
    content = content.replace(/\nexport \{[^}]+\};?\s*$/, '\n').trimEnd() + '\n';
  } else {
    // Replace with reduced block containing only unmatched names
    const reduced = `\nexport {\n${unmatched.map((n) => `  ${n},`).join('\n')}\n};\n`;
    content = content.replace(/\nexport \{[^}]+\};?\s*$/, reduced);
  }

  if (content !== original) {
    writeFileSync(filePath, content, 'utf8');
    totalFiles++;
    const rel = relative(SRC_DIR, filePath).replace(/\\/g, '/');
    const unmatchedNote = unmatched.length > 0 ? ` (${unmatched.length} unmatched: ${unmatched.join(', ')})` : '';
    console.log(`  inlined ${filePath.endsWith(rel) ? rel : filePath} [${block.names.length - unmatched.length}/${block.names.length}]${unmatchedNote}`);
  }
}

console.log(`\nDone: ${totalInlined} declarations inlined across ${totalFiles} files.`);
