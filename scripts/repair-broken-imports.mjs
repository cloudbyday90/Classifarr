/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

/**
 * Repairs broken `import {  as X }` patterns left by the fix-generic-export-names script bug.
 * Pattern: `import {  as localName } from 'path'`
 * Fix: `import { exportName as localName } from 'path'`  (or `import { exportName }` if names match)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { readdirSync } from 'node:fs';

const SCRIPT_DIR = import.meta.dirname;
const ROOT = join(SCRIPT_DIR, '..');
const SERVER_SRC = join(ROOT, 'server', 'src');

// Build map from filename stem → export name
const EXPORT_NAME_MAP = new Map([
  ['startupService.mjs',          'startupService'],
  ['backupService.mjs',           'backupService'],
  ['embyAuth.mjs',                'embyAuthService'],
  ['jellyfinAuth.mjs',            'jellyfinAuthService'],
  ['legacyMigration.mjs',         'legacyMigrationService'],
  ['tmdb.mjs',                    'tmdbService'],
  ['plexOAuth.mjs',               'plexOAuthService'],
  ['ragLogger.mjs',               'ragLogger'],
  ['aiRouter.mjs',                'aiRouterService'],
  ['policyQuestionBuilder.mjs',   'policyQuestionBuilder'],
  ['ragLoopHelpers.mjs',          'ragLoopHelpers'],
  ['enrichmentRetryService.mjs',  'enrichmentRetryService'],
  ['fileOperationsService.mjs',   'fileOperationsService'],
]);

function walk(dir, results = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.name === 'node_modules') continue;
    if (entry.isDirectory()) walk(full, results);
    else if (entry.isFile() && entry.name.endsWith('.mjs')) results.push(full);
  }
  return results;
}

const allFiles = walk(SERVER_SRC);
let totalFixed = 0;

for (const filePath of allFiles) {
  let content = readFileSync(filePath, 'utf8');
  let changed = false;

  // Match: `import {  as localName } from 'some/path/file.mjs'`
  // Also handle `import {  as localName, other } from ...` multi-export
  const brokenRe = /^import \{ {0,2}as ([A-Za-z_$][A-Za-z0-9_$]*)(,\s*[^}]*)? \} from (['"])(.*?\.mjs)\3/gm;

  content = content.replace(brokenRe, (match, localName, rest, q, importPath) => {
    // Get the basename of the imported module
    const segments = importPath.split('/');
    const basename = segments[segments.length - 1];
    const exportName = EXPORT_NAME_MAP.get(basename);

    if (!exportName) {
      console.warn(`  UNKNOWN export for ${basename} in ${relative(ROOT, filePath)}`);
      return match; // leave unchanged
    }

    const restPart = rest || '';
    if (localName === exportName) {
      return `import { ${exportName}${restPart} } from ${q}${importPath}${q}`;
    }
    return `import { ${exportName} as ${localName}${restPart} } from ${q}${importPath}${q}`;
  });

  if (content !== readFileSync(filePath, 'utf8')) {
    writeFileSync(filePath, content, 'utf8');
    totalFixed++;
    console.log(`  fixed: ${relative(ROOT, filePath).replace(/\\/g, '/')}`);
  }
}

console.log(`\nDone: ${totalFixed} files repaired.`);
