/**
 * Migration script: collapse makeDb/makeLogger thin wrapper aliases
 * and migrate remaining inline makeLogger implementations.
 *
 * Handles:
 *   A) Files with `const makeDb = () => createMockDb()` and `const makeLogger = () => createMockLogger()`
 *      → remove wrapper aliases, inline the createMockDb/createMockLogger calls
 *   B) Files with `const makeLogger = () => ({ info: jest.fn(), ... })` (no shared helper yet)
 *      → add createMockLogger import, replace inline definition
 *
 * Usage: node scripts/migrate-queue-wrappers.mjs [--dry-run]
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(__dirname, '..');

const DRY_RUN = process.argv.includes('--dry-run');

const TARGET_FILES = [
  'src/__tests__/classificationMaintenanceService.test.mjs',
  'src/__tests__/queueClassificationHistoryService.test.mjs',
  'src/__tests__/queueOmdbEnrichmentService.test.mjs',
  'src/__tests__/queueRefillService.test.mjs',
  'src/__tests__/queueTavilyEnrichmentService.test.mjs',
  'src/__tests__/schedulerRetentionService.test.mjs',
  // Not yet migrated (still have inline makeLogger):
  'src/__tests__/queueTaskProcessorService.test.mjs',
  'src/__tests__/queueTmdbResolutionService.test.mjs',
];

for (const relPath of TARGET_FILES) {
  const filePath = join(serverRoot, relPath);
  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    console.warn(`Skipping (not found): ${relPath}`);
    continue;
  }

  const original = content;
  let result = content;

  // ---- Pattern A: thin wrappers around shared helpers ----
  // Remove: const makeDb = () => createMockDb();
  result = result.replace(/^const makeDb\s*=\s*\(\)\s*=>\s*createMockDb\(\)\s*;\n?/m, '');
  // Replace calls: makeDb() → createMockDb()
  result = result.replace(/\bmakeDb\(\)/g, 'createMockDb()');

  // Remove: const makeLogger = () => createMockLogger();
  result = result.replace(/^const makeLogger\s*=\s*\(\)\s*=>\s*createMockLogger\(\)\s*;\n?/m, '');
  // Replace calls: makeLogger() → createMockLogger()
  result = result.replace(/\bmakeLogger\(\)/g, 'createMockLogger()');

  // ---- Pattern B: inline makeLogger implementations (not yet migrated) ----
  // Remove: const makeLogger = () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() });
  const inlineDef = /^const makeLogger\s*=\s*\(\)\s*=>\s*\(\{[^}]*info:\s*jest\.fn\(\)[^}]*warn:\s*jest\.fn\(\)[^}]*error:\s*jest\.fn\(\)[^}]*debug:\s*jest\.fn\(\)[^}]*\}\)\s*;\n?/ms;
  if (inlineDef.test(result)) {
    result = result.replace(inlineDef, '');
    // Replace makeLogger() calls
    result = result.replace(/\bmakeLogger\(\)/g, 'createMockLogger()');

    // Ensure createMockLogger is imported
    result = addImport(result, 'createMockLogger');
  }

  if (result === original) {
    console.log(`No changes: ${relPath}`);
    continue;
  }

  if (DRY_RUN) {
    console.log(`[DRY RUN] Would update: ${relPath}`);
  } else {
    writeFileSync(filePath, result, 'utf8');
    console.log(`Updated: ${relPath}`);
  }
}

/**
 * Adds a named import to the existing mockFactory.mjs import line, or adds a new line.
 */
function addImport(content, namedExport) {
  // Try to extend existing import from mockFactory.mjs
  const existingRe = /import\s*\{([^}]+)\}\s*from\s*(['"`][^'"`]*mockFactory\.mjs['"`])/;
  const match = content.match(existingRe);
  if (match) {
    if (match[1].includes(namedExport)) return content; // already there
    const newImports = match[1].trimEnd() + ', ' + namedExport;
    return content.replace(match[0], `import {${newImports}} from ${match[2]}`);
  }

  // No existing import - add after last static import
  const importMatches = [...content.matchAll(/^import\s+.+?(?:from\s+['"`][^'"`]+['"`])?\s*;?\s*$/gm)];
  if (importMatches.length === 0) {
    return `import { ${namedExport} } from './helpers/mockFactory.mjs';\n` + content;
  }
  const lastImport = importMatches[importMatches.length - 1];
  const insertPos = lastImport.index + lastImport[0].length;
  return (
    content.slice(0, insertPos) +
    `\nimport { ${namedExport} } from './helpers/mockFactory.mjs';` +
    content.slice(insertPos)
  );
}
