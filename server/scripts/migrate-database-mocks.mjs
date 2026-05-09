#!/usr/bin/env node

/**
 * Migration script: Normalize database mocks to use createDatabaseModuleMock factory
 * 
 * Patterns handled:
 * A) createNamedMockModule style:
 *    const mockDb = { query: jest.fn(), ... };
 *    jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));
 *    → jest.unstable_mockModule('../config/database.mjs', () => createDatabaseModuleMock());
 *
 * B) Inline object style:
 *    jest.unstable_mockModule('../config/database.mjs', () => ({ pool: { query: jest.fn(), ... }, default: ... }));
 *    → jest.unstable_mockModule('../config/database.mjs', () => createDatabaseModuleMock());
 *
 * C) With inline query spy:
 *    jest.unstable_mockModule('../config/database.mjs', () => ({ pool: mockDb, default: mockDb, query: mockDb.query }));
 *    → jest.unstable_mockModule('../config/database.mjs', () => createDatabaseModuleMock());
 */

import { readFileSync, writeFileSync } from 'fs';
import { readdirSync } from 'fs';
import { join, relative } from 'path';

const serverRoot = process.cwd();
const testsRoot = join(serverRoot, 'src', '__tests__');
const DRY_RUN = process.argv.includes('--dry-run');

function collectTestFiles(dir) {
  const files = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.test.mjs')) {
      files.push(join(dir, entry.name));
    } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
      files.push(...collectTestFiles(join(dir, entry.name)));
    }
  }
  return files;
}

function helperImportPath(filePath) {
  const depth = filePath.split('\\').filter(p => p === '..').length;
  const relPath = relative(testsRoot, join(filePath, '..')).split('\\').length;
  const goUp = relPath;
  return '../'.repeat(goUp) + 'helpers/mockFactory.mjs';
}

/**
 * Replace createNamedMockModule('pool', mockDb) pattern
 */
function replaceNamedModuleDbPattern(content) {
  // Find: jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', <varName>));
  const pattern = /jest\.unstable_mockModule\(\s*(['"`][^'"`]*config\/database\.mjs['"`])\s*,\s*\(\)\s*=>\s*createNamedMockModule\(\s*['"`]pool['"`]\s*,\s*(\w+)\s*\)\s*\);/gs;

  let result = content;
  let replaced = false;
  let match;

  while ((match = pattern.exec(content)) !== null) {
    const [fullMatch, modulePath, varName] = match;

    // Check if mockDb is just { query: jest.fn(), pool: { connect: jest.fn() } } with no special logic
    const varDeclPattern = new RegExp(
      `const\\s+${varName}\\s*=\\s*\\{[^}]*query:\\s*jest\\.fn\\([^}]*pool:\\s*\\{[^}]*\\}[^}]*\\}\\s*;`,
      's'
    );

    if (content.match(varDeclPattern)) {
      // Safe to replace - it's just a standard mockDb
      const replacement = `jest.unstable_mockModule(${modulePath}, () => createDatabaseModuleMock());`;
      result = result.replace(fullMatch, replacement);

      // Try to remove the mockDb variable declaration
      const varDeclRegex = new RegExp(
        `const\\s+${varName}\\s*=\\s*\\{[^}]*query:\\s*jest\\.fn\\([^}]*pool:\\s*\\{[^}]*\\}[^}]*\\};`,
        's'
      );
      result = result.replace(varDeclRegex, '');

      replaced = true;
    }
  }

  return [result, replaced];
}

/**
 * Replace inline object literal database mocks
 */
function replaceInlineDbPattern(content) {
  // Pattern: jest.unstable_mockModule('../config/database.mjs', () => ({ pool: {...}, default: ... }))
  const pattern = /jest\.unstable_mockModule\(\s*(['"`][^'"`]*config\/database\.mjs['"`])\s*,\s*\(\)\s*=>\s*\(?\{\s*pool:\s*\{[^}]*query:\s*jest\.fn\(\)[^}]*\}[^}]*(?:default[^}]*)?\}?\s*\)\s*\);/gs;

  let result = content;
  let replaced = false;
  let match;

  while ((match = pattern.exec(content)) !== null) {
    const [fullMatch, modulePath] = match;
    const replacement = `jest.unstable_mockModule(${modulePath}, () => createDatabaseModuleMock());`;
    result = result.replace(fullMatch, replacement);
    replaced = true;
  }

  return [result, replaced];
}

/**
 * Update imports to include createDatabaseModuleMock
 */
function updateImports(content, helperPath) {
  if (!content.includes('createDatabaseModuleMock')) return content;

  const existingImportRe = /import\s*\{([^}]+)\}\s*from\s*(['"`][^'"`]*mockFactory\.mjs['"`])/;
  const existingMatch = content.match(existingImportRe);

  if (existingMatch) {
    const imports = existingMatch[1];
    if (imports.includes('createDatabaseModuleMock')) return content;

    const newImports = imports.trimEnd() + ', createDatabaseModuleMock';
    return content.replace(existingMatch[0], `import {${newImports}} from ${existingMatch[2]}`);
  }

  // Add new import after last static import
  const importLines = [...content.matchAll(/^import\s+.+?from\s+['"`][^'"`]+['"`]\s*;?\s*$/gm)];
  if (importLines.length === 0) {
    return `import { createDatabaseModuleMock } from '${helperPath}';\n` + content;
  }

  const lastImport = importLines[importLines.length - 1];
  const insertPos = lastImport.index + lastImport[0].length;
  return (
    content.slice(0, insertPos) +
    `\nimport { createDatabaseModuleMock } from '${helperPath}';` +
    content.slice(insertPos)
  );
}

/**
 * Main migration function
 */
function migrateFile(content, filePath) {
  let result = content;
  let changed = false;

  // Try named module pattern first
  let [result1, replaced1] = replaceNamedModuleDbPattern(result);
  if (replaced1) {
    result = result1;
    changed = true;
  }

  // Try inline pattern
  let [result2, replaced2] = replaceInlineDbPattern(result);
  if (replaced2) {
    result = result2;
    changed = true;
  }

  return [result, changed];
}

// ---- Main ----

const files = collectTestFiles(testsRoot);
let migratedCount = 0;
let skippedCount = 0;

for (const filePath of files) {
  const content = readFileSync(filePath, 'utf8');

  // Quick check: does this file have a database.mjs mock?
  const hasDbMock = /jest\.unstable_mockModule\s*\(\s*['"`][^'"`]*config\/database\.mjs['"`]/.test(content);

  if (!hasDbMock) {
    skippedCount++;
    continue;
  }

  const [migratedContent, changed] = migrateFile(content, filePath);

  if (!changed) {
    skippedCount++;
    continue;
  }

  // Update imports
  const helperPath = helperImportPath(filePath);
  const finalContent = updateImports(migratedContent, helperPath);

  const relPath = relative(serverRoot, filePath);
  if (DRY_RUN) {
    console.log(`[DRY RUN] Would migrate: ${relPath}`);
  } else {
    writeFileSync(filePath, finalContent, 'utf8');
    console.log(`Migrated: ${relPath}`);
  }

  migratedCount++;
}

console.log(`Done. Migrated ${migratedCount} files, skipped ${skippedCount}.`);
