/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

/**
 * Fix generic export names (instance, singleton, bad camelCase) left by Phase 7 script.
 * Renames the exported const in source files and updates all consumers.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { readdirSync } from 'node:fs';

const SCRIPT_DIR = import.meta.dirname;
const ROOT = join(SCRIPT_DIR, '..');
const SERVER_SRC = join(ROOT, 'server', 'src');

function walk(dir, results = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.name === 'node_modules') continue;
    if (entry.isDirectory()) walk(full, results);
    else if (entry.isFile() && entry.name.endsWith('.mjs')) results.push(full);
  }
  return results;
}

function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Maps: [sourceFile (relative to server/src), oldName, newName]
const RENAMES = [
  ['services/backupService.mjs',         'instance',        'backupService'],
  ['services/embyAuth.mjs',              'instance',        'embyAuthService'],
  ['services/enrichmentRetryService.mjs','singleton',       'enrichmentRetryService'],
  ['services/fileOperationsService.mjs', 'singleton',       'fileOperationsService'],
  ['services/jellyfinAuth.mjs',          'instance',        'jellyfinAuthService'],
  ['services/legacyMigration.mjs',       'instance',        'legacyMigrationService'],
  ['services/plexOAuth.mjs',             'instance',        'plexOAuthService'],
  ['services/policyQuestionBuilder.mjs', 'singleton',       'policyQuestionBuilder'],
  ['services/startupService.mjs',        'instance',        'startupService'],
  ['services/aiRouter.mjs',              'aIRouterService', 'aiRouterService'],
  ['services/tmdb.mjs',                  'tMDBService',     'tmdbService'],
  ['utils/ragLoopHelpers.mjs',           'helpers',         'ragLoopHelpers'],
  ['utils/ragLogger.mjs',                'ragLoggerInstance', 'ragLogger'],
];

const allFiles = walk(SERVER_SRC);
let totalChanged = 0;

for (const [relSrc, oldName, newName] of RENAMES) {
  const srcPath = join(SERVER_SRC, relSrc);

  // 1. Update source file: rename the export const
  let srcContent = readFileSync(srcPath, 'utf8');
  const exportRe = new RegExp(`^export const ${escRe(oldName)}\\b`, 'm');
  if (!exportRe.test(srcContent)) {
    console.warn(`  SKIP (not found): ${relSrc} — export const ${oldName}`);
    continue;
  }
  srcContent = srcContent.replace(exportRe, `export const ${newName}`);
  writeFileSync(srcPath, srcContent, 'utf8');
  console.log(`  renamed source: ${relSrc}  ${oldName} → ${newName}`);

  // 2. Update all consumer files
  for (const consumerPath of allFiles) {
    const content = readFileSync(consumerPath, 'utf8');

    // Compute relative path from consumer to source
    const relPath = relative(dirname(consumerPath), srcPath).replace(/\\/g, '/');
    const relPathNoExt = relPath.replace(/\.mjs$/, '');
    const aliases = new Set([
      relPath,
      relPathNoExt,
      relPath.startsWith('./') ? relPath : './' + relPath,
      relPathNoExt.startsWith('./') ? relPathNoExt : './' + relPathNoExt,
    ]);

    let updated = content;

    for (const pathAlias of aliases) {
      const ep = escRe(pathAlias);
      const en = escRe(oldName);

      // Static: `import { oldName as X }` → `import { newName as X }`
      updated = updated.replace(
        new RegExp(`(import \\{[^}]*?)\\b${en}\\s+as\\s+`, 'g'),
        (m, pre) => {
          // Only if this import is from our path
          return m; // handled below per-line
        }
      );

      // Per-line static import update (more reliable)
      updated = updated.replace(
        new RegExp(`^(import \\{[^}]*?)\\b${en}\\b([^}]*\\} from ['"]${ep}['"])`, 'gm'),
        (m, pre, post) => {
          return `${pre.replace(new RegExp(`\\b${en}\\b`), newName)}${post}`;
        }
      );

      // Dynamic destructure: `{ oldName: x }` or `{ oldName }` in await import(path)
      updated = updated.replace(
        new RegExp(`(\\{[^}]*?)\\b${en}\\b([^}]*\\} = await import\\(['"]${ep}['"]\\))`, 'g'),
        (m, pre, post) => {
          return `${pre.replace(new RegExp(`\\b${en}\\b`), newName)}${post}`;
        }
      );

      // Mock object: `{ oldName: x }` or `{ oldName }` in jest.unstable_mockModule
      // Only if this file has a reference to the path
      if (new RegExp(ep).test(updated)) {
        updated = updated.replace(
          new RegExp(`(\\{\\s*)\\b${en}\\b(\\s*[,}:])`, 'g'),
          (m, pre, post) => {
            return `${pre}${newName}${post}`;
          }
        );
      }
    }

    if (updated !== content) {
      writeFileSync(consumerPath, updated, 'utf8');
      totalChanged++;
      console.log(`    updated consumer: ${relative(ROOT, consumerPath).replace(/\\/g, '/')}`);
    }
  }
}

console.log(`\nDone: ${totalChanged} consumer files updated.`);
