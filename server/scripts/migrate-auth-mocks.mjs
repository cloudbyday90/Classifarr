#!/usr/bin/env node

/**
 * Migration script: Extract inline auth middleware mocks to createAdminAuthMock / createPassThroughAuthMock
 * 
 * Patterns handled:
 * A) Simple pass-through:
 *    jest.unstable_mockModule('../middleware/auth.mjs', () => ({
 *      authenticateToken: (_req, _res, next) => next(),
 *      requireAdmin: (_req, _res, next) => next(),
 *    }));
 *    → jest.unstable_mockModule('../middleware/auth.mjs', () => createPassThroughAuthMock());
 * 
 * B) With user assignment:
 *    jest.unstable_mockModule('../middleware/auth.mjs', () => ({
 *      authenticateToken: (req, _res, next) => { req.user = {...}; next(); },
 *      requireAdmin: ...
 *    }));
 *    → jest.unstable_mockModule('../middleware/auth.mjs', () => createAdminAuthMock({...}));
 * 
 * C) Variable-based:
 *    const mockAuth = { authenticateToken: ..., requireAdmin: ... };
 *    jest.unstable_mockModule('../middleware/auth.mjs', () => ({...mockAuth}));
 *    → jest.unstable_mockModule('../middleware/auth.mjs', () => createAdminAuthMock(...));
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
 * Try to migrate simple pass-through auth mock pattern
 */
function replacePassThroughAuthMock(content) {
  // More flexible: authenticateToken that just calls next(), with or without requireAdmin
  const passThrough = /jest\.unstable_mockModule\(\s*(['"`][^'"`]*middleware\/auth\.mjs['"`])\s*,\s*\(\)\s*=>\s*\(?\{\s*authenticateToken:\s*\([^)]*\)\s*=>\s*next\(\)[^}]*\}?\s*\)\s*\);/gs;

  let result = content;
  let match;
  let replaced = false;

  while ((match = passThrough.exec(content)) !== null) {
    const [fullMatch, modulePath] = match;
    const replacement = `jest.unstable_mockModule(${modulePath}, () => createPassThroughAuthMock());`;
    result = result.replace(fullMatch, replacement);
    replaced = true;
  }

  return [result, replaced];
}

/**
 * Try to migrate admin auth mock with req.user assignment
 */
function replaceAdminAuthMock(content) {
  // Pattern: authenticateToken: (req, ...) => { req.user = {...}; next(); }
  const adminAuthRegex = /jest\.unstable_mockModule\(\s*(['"`][^'"`]*middleware\/auth\.mjs['"`])\s*,\s*\(\)\s*=>\s*\(?\{\s*authenticateToken:\s*\(req[^)]*\)\s*=>\s*\{\s*req\.user\s*=\s*(\{[^}]*\})[^}]*next\(\)[^}]*\}\s*,\s*requireAdmin:[^}]*\}\s*\)\s*\);/gs;

  let result = content;
  let match;
  let replaced = false;

  while ((match = adminAuthRegex.exec(content)) !== null) {
    const [fullMatch, modulePath, userObj] = match;
    const replacement = `jest.unstable_mockModule(${modulePath}, () => createAdminAuthMock(${userObj}));`;
    result = result.replace(fullMatch, replacement);
    replaced = true;
  }

  return [result, replaced];
}

/**
 * Migrate inline const mockAuth = {...} pattern with createNamedMockModule
 */
function replaceNamedModuleAuthPattern(content) {
  // Pattern: const mockAuth = { authenticateToken: ... }; jest.unstable_mockModule(..., () => createNamedMockModule('...', mockAuth));
  
  let result = content;
  let replaced = false;

  // Extract mockAuth definitions
  const mockAuthVar = /const\s+(\w+)\s*=\s*\{([^}]*authenticateToken:[^}]*)\}/s;
  const mockAuthMatch = content.match(mockAuthVar);
  
  if (mockAuthMatch) {
    const [varDef, varName, varBody] = mockAuthMatch;
    
    // Check if it has req.user assignment
    const hasUserAssignment = /req\.user\s*=\s*\{[^}]*\}/.test(varBody);
    
    // Find jest.unstable_mockModule call using this variable
    const unstableMockRegex = new RegExp(
      `jest\\.unstable_mockModule\\(\\s*(['"\`][^'"\`]*middleware/auth\\.mjs['"\`])\\s*,\\s*\\(\\)\\s*=>\\s*createNamedMockModule\\([^,]*,\\s*${varName}\\s*\\)\\s*\\)`,
      'gs'
    );
    
    let match;
    while ((match = unstableMockRegex.exec(content)) !== null) {
      const [fullMatch, modulePath] = match;
      
      if (hasUserAssignment) {
        // Extract the user object
        const userMatch = varBody.match(/req\.user\s*=\s*(\{[^}]*\})/);
        if (userMatch && userMatch[1]) {
          const replacement = `jest.unstable_mockModule(${modulePath}, () => createAdminAuthMock(${userMatch[1]}))`;
          result = result.replace(fullMatch, replacement);
          replaced = true;
        }
      } else {
        // Simple pass-through
        const replacement = `jest.unstable_mockModule(${modulePath}, () => createPassThroughAuthMock())`;
        result = result.replace(fullMatch, replacement);
        replaced = true;
      }
    }
  }

  return [result, replaced];
}

/**
 * Update import to include createAdminAuthMock and/or createPassThroughAuthMock
 */
function updateImports(content, helperPath) {
  const needsAdmin = content.includes('createAdminAuthMock');
  const needsPassThrough = content.includes('createPassThroughAuthMock');

  if (!needsAdmin && !needsPassThrough) return content;

  const existingImportRe = /import\s*\{([^}]+)\}\s*from\s*(['"`][^'"`]*mockFactory\.mjs['"`])/;
  const existingMatch = content.match(existingImportRe);

  const toAdd = [];
  if (needsAdmin) toAdd.push('createAdminAuthMock');
  if (needsPassThrough) toAdd.push('createPassThroughAuthMock');

  if (existingMatch) {
    const imports = existingMatch[1];
    const toAddFiltered = toAdd.filter(name => !imports.includes(name));

    if (toAddFiltered.length === 0) return content;

    const newImports = imports.trimEnd() + ', ' + toAddFiltered.join(', ');
    return content.replace(existingMatch[0], `import {${newImports}} from ${existingMatch[2]}`);
  }

  // Add new import after last static import
  const importLines = [...content.matchAll(/^import\s+.+?from\s+['"`][^'"`]+['"`]\s*;?\s*$/gm)];
  if (importLines.length === 0) {
    return `import { ${toAdd.join(', ')} } from '${helperPath}';\n` + content;
  }

  const lastImport = importLines[importLines.length - 1];
  const insertPos = lastImport.index + lastImport[0].length;
  return (
    content.slice(0, insertPos) +
    `\nimport { ${toAdd.join(', ')} } from '${helperPath}';` +
    content.slice(insertPos)
  );
}

/**
 * Main migration function for a single file
 */
function migrateFile(content, filePath) {
  let result = content;
  let changed = false;

  // Try pass-through pattern first
  let [result1, replaced1] = replacePassThroughAuthMock(result);
  if (replaced1) {
    result = result1;
    changed = true;
  }

  // Try admin auth pattern
  let [result2, replaced2] = replaceAdminAuthMock(result);
  if (replaced2) {
    result = result2;
    changed = true;
  }

  // Try createNamedMockModule pattern
  let [result3, replaced3] = replaceNamedModuleAuthPattern(result);
  if (replaced3) {
    result = result3;
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

  // Quick check: does this file have an auth.mjs mock not already using our factories?
  const hasAuthMock = /jest\.unstable_mockModule\s*\(\s*['"`][^'"`]*middleware\/auth\.mjs['"`]/.test(content);
  const alreadyMigrated = /createAdminAuthMock|createPassThroughAuthMock/.test(content);

  if (!hasAuthMock || alreadyMigrated) {
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
