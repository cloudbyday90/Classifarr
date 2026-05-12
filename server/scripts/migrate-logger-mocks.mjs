/**
 * Migration script: replace inline logger mock patterns with createLoggerModuleMock().
 *
 * Handles three variants:
 *   A) jest.unstable_mockModule('...logger.mjs', () => ({ createLogger: jest.fn(() => ({...})), }));
 *   B) const mockLoggerModule = { createLogger: jest.fn(() => ({...})) };
 *      jest.unstable_mockModule('...logger.mjs', () => createMockModule(mockLoggerModule));
 *   C) Single-line version of A
 *
 * All become:
 *   jest.unstable_mockModule('...logger.mjs', () => createLoggerModuleMock().module);
 *
 * Usage: node server/scripts/migrate-logger-mocks.mjs [--dry-run]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { collectTestFiles, resolveMockFactoryImportPath } from './mockMigrationSupport.mjs';

const serverRoot = path.join(import.meta.dirname, '..');
const testsRoot = path.join(serverRoot, 'src', '__tests__');

const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Main migration function for a single file.
 * Returns [newContent, changed] tuple.
 */
function migrateFile(content) {
  let changed = false;
  let result = content;

  // ---- Pattern A/C: inline mock with object literal ----
  // Match multiline or single-line variants using a manual approach

  // Use a broad regex that captures the full unstable_mockModule call for logger
  // We'll do a string-based search for the key signature and replace the block
  result = replaceInlineLoggerBlock(result);
  if (result !== content) changed = true;

  // ---- Pattern D: createLogger: () => ({...}) — bare arrow function (not jest.fn) ----
  {
    const prev = result;
    result = replaceBareFnLoggerBlock(result);
    if (result !== prev && !changed) changed = true;
  }

  // ---- Pattern B: createMockModule(mockLoggerModule) ----
  // Check if there's a variable-based logger module definition
  result = replaceCreateMockModulePattern(result);
  if (result !== content && !changed) changed = true;

  return [result, result !== content];
}

/**
 * Replaces the common multiline/singleline inline logger mock block.
 *
 * Targets:
 *   jest.unstable_mockModule('...logger.mjs', () => ({
 *     createLogger: jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() })),
 *   }));
 */
function replaceInlineLoggerBlock(content) {
  // Strategy: find "jest.unstable_mockModule(" containing "logger.mjs"
  // then check if the body is the inline createLogger pattern
  // Use a state-machine approach to handle nested parens

  let result = '';
  let i = 0;

  while (i < content.length) {
    // Look for the start of unstable_mockModule call for logger
    const searchStr = 'jest.unstable_mockModule(';
    const idx = content.indexOf(searchStr, i);
    if (idx === -1) {
      result += content.slice(i);
      break;
    }

    // Extract the module path argument
    const afterCall = content.slice(idx + searchStr.length).trimStart();
    const quoteMatch = afterCall.match(/^(['"`])([^'"`]+)\1/);
    if (!quoteMatch || !quoteMatch[2].includes('logger.mjs')) {
      result += content.slice(i, idx + 1);
      i = idx + 1;
      continue;
    }

    // Check if the factory body matches our inline createLogger pattern
    // Find the end of this call by counting parens
    const callStart = idx;
    let parenDepth = 0;
    let j = idx + searchStr.length - 1; // position of the opening (
    // find the first (
    while (j < content.length && content[j] !== '(') j++;
    parenDepth = 1;
    j++;
    while (j < content.length && parenDepth > 0) {
      if (content[j] === '(') parenDepth++;
      else if (content[j] === ')') parenDepth--;
      j++;
    }
    const callEnd = j; // exclusive
    const fullCall = content.slice(callStart, callEnd);

    // Check if this call body contains the inline createLogger pattern
    const hasInlineLogger = /createLogger:\s*jest\.fn\(\(\)\s*=>\s*\(?\{[^}]*info:\s*jest\.fn\(\)[^}]*warn:\s*jest\.fn\(\)[^}]*error:\s*jest\.fn\(\)[^}]*debug:\s*jest\.fn\(\)[^}]*\}\)?\)/.test(fullCall);

    if (!hasInlineLogger) {
      result += content.slice(i, idx + 1);
      i = idx + 1;
      continue;
    }

    // Build replacement - preserve the module path string
    const pathMatch = fullCall.match(/jest\.unstable_mockModule\(\s*(['"`][^'"`]*logger\.mjs['"`])/);
    if (!pathMatch) {
      result += content.slice(i, idx + 1);
      i = idx + 1;
      continue;
    }
    const modulePath = pathMatch[1];

    // Preserve leading whitespace before the jest.unstable_mockModule call
    const lineStart = content.lastIndexOf('\n', callStart) + 1;
    const indent = content.slice(lineStart, callStart).match(/^(\s*)/)?.[1] ?? '';

    const replacement = `jest.unstable_mockModule(${modulePath}, () => createLoggerModuleMock().module)`;

    result += content.slice(i, callStart) + indent.trimStart() + replacement;
    i = callEnd;

    // Skip trailing semicolon if present
    if (content[i] === ';') {
      result += ';';
      i++;
    }
  }

  return result;
}

/**
 * Replaces the bare arrow function variant:
 *   jest.unstable_mockModule('...logger.mjs', () => ({
 *     createLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
 *   }));
 *
 * Only migrates when the createLogger factory returns ONLY inline jest.fn() calls
 * (not references to external variables, to avoid disconnecting assertion mocks).
 */
function replaceBareFnLoggerBlock(content) {
  let result = '';
  let i = 0;

  while (i < content.length) {
    const searchStr = 'jest.unstable_mockModule(';
    const idx = content.indexOf(searchStr, i);
    if (idx === -1) {
      result += content.slice(i);
      break;
    }

    // Extract the module path argument
    const afterCall = content.slice(idx + searchStr.length).trimStart();
    const quoteMatch = afterCall.match(/^(['"`])([^'"`]+)\1/);
    if (!quoteMatch || !quoteMatch[2].includes('logger.mjs')) {
      result += content.slice(i, idx + 1);
      i = idx + 1;
      continue;
    }

    // Find the end of this call by counting parens
    let parenDepth = 0;
    let j = idx + searchStr.length - 1;
    while (j < content.length && content[j] !== '(') j++;
    parenDepth = 1;
    j++;
    while (j < content.length && parenDepth > 0) {
      if (content[j] === '(') parenDepth++;
      else if (content[j] === ')') parenDepth--;
      j++;
    }
    const callEnd = j;
    const fullCall = content.slice(idx, callEnd);

    // Check for bare arrow function createLogger: () => ({ ... })
    // Only where the return value is purely inline jest.fn() calls (no variable refs)
    const hasBareArrowLogger = /createLogger:\s*\(\)\s*=>\s*\(?\{[^}]*info:\s*jest\.fn\(\)[^}]*warn:\s*jest\.fn\(\)[^}]*error:\s*jest\.fn\(\)[^}]*debug:\s*jest\.fn\(\)[^}]*\}/.test(fullCall);

    // Skip if createLogger references external mock variables (e.g., mockLogger.info)
    // but NOT jest.fn() which is a method call, not a variable reference
    const hasExternalRefs = /(?:info|warn|error|debug):\s*(?!jest\.)(\w+)\.(\w+)/.test(fullCall);

    if (!hasBareArrowLogger || hasExternalRefs) {
      result += content.slice(i, idx + 1);
      i = idx + 1;
      continue;
    }

    // Build replacement
    const pathMatch = fullCall.match(/jest\.unstable_mockModule\(\s*(['"`][^'"`]*logger\.mjs['"`])/);
    if (!pathMatch) {
      result += content.slice(i, idx + 1);
      i = idx + 1;
      continue;
    }
    const modulePath = pathMatch[1];

    const replacement = `jest.unstable_mockModule(${modulePath}, () => createLoggerModuleMock().module)`;

    result += content.slice(i, idx) + replacement;
    i = callEnd;

    if (content[i] === ';') {
      result += ';';
      i++;
    }
  }

  return result;
}

/**
 * Replaces: const varName = { createLogger: jest.fn(() => ({...})) };
 *   + jest.unstable_mockModule('...logger.mjs', () => createMockModule(varName));
 * With: jest.unstable_mockModule('...logger.mjs', () => createLoggerModuleMock().module);
 *
 * Also removes the now-unused variable.
 */
function replaceCreateMockModulePattern(content) {
  // Find: jest.unstable_mockModule('...logger.mjs', () => createMockModule(VAR))
  const mockModuleCall = /jest\.unstable_mockModule\(\s*(['"`][^'"`]*logger\.mjs['"`])\s*,\s*\(\)\s*=>\s*createMockModule\(\s*(\w+)\s*\)\s*\)/g;
  let match;
  let result = content;

  while ((match = mockModuleCall.exec(content)) !== null) {
    const [fullMatch, modulePath, varName] = match;

    // Check if varName is a simple { createLogger: jest.fn(... inline logger ...) } object
    // Find the const declaration for this variable
    const varDeclPattern = new RegExp(
      `(?:const|let|var)\\s+${varName}\\s*=\\s*\\{[^}]*createLogger:\\s*jest\\.fn\\(\\(\\)\\s*=>\\s*\\(?\\{[^}]*info:\\s*jest\\.fn\\(\\)[^}]*warn:\\s*jest\\.fn\\(\\)[^}]*error:\\s*jest\\.fn\\(\\)[^}]*debug:\\s*jest\\.fn\\(\\)[^}]*\\}\\)?\\)[^}]*\\}\\s*;`,
      's'
    );

    const varDeclMatch = result.match(varDeclPattern);
    if (!varDeclMatch) continue;

    // Replace the unstable_mockModule call
    const replacement = `jest.unstable_mockModule(${modulePath}, () => createLoggerModuleMock().module)`;
    result = result.replace(fullMatch, replacement);

    // Remove the variable declaration (it's now unused)
    result = result.replace(varDeclMatch[0], '');

    // Clean up double blank lines
    result = result.replace(/\n{3,}/g, '\n\n');
  }

  return result;
}

/**
 * Update the import line in the file to include createLoggerModuleMock.
 */
function updateImports(content, helperPath) {
  // Case 1: Already imports from mockFactory.mjs - add createLoggerModuleMock if missing
  const existingImportRe = /import\s*\{([^}]+)\}\s*from\s*(['"`][^'"`]*mockFactory\.mjs['"`])/;
  const existingMatch = content.match(existingImportRe);

  if (existingMatch) {
    const imports = existingMatch[1];
    if (imports.includes('createLoggerModuleMock')) {
      return content; // already imported
    }
    // Add createLoggerModuleMock to existing import
    const newImports = imports.trimEnd() + ', createLoggerModuleMock';
    return content.replace(existingMatch[0], `import {${newImports}} from ${existingMatch[2]}`);
  }

  // Case 2: No mockFactory import yet - add one after the last static import
  // Find the position to insert after the last import statement
  const importLines = [...content.matchAll(/^import\s+.+?(?:from\s+['"`][^'"`]+['"`])?\s*;?\s*$/gm)];
  if (importLines.length === 0) {
    // Fallback: add after the first non-comment line
    return `import { createLoggerModuleMock } from '${helperPath}';\n` + content;
  }

  const lastImport = importLines[importLines.length - 1];
  const insertPos = lastImport.index + lastImport[0].length;
  return (
    content.slice(0, insertPos) +
    `\nimport { createLoggerModuleMock } from '${helperPath}';` +
    content.slice(insertPos)
  );
}

// ---- Main ----

const files = collectTestFiles(testsRoot);
let migratedCount = 0;
let skippedCount = 0;

for (const filePath of files) {
  const content = readFileSync(filePath, 'utf8');

  // Quick check: does this file have an inline logger mock?
  const hasInlineLogger = /unstable_mockModule\s*\(\s*['"`][^'"`]*logger\.mjs['"`]/.test(content) &&
    /createLogger:\s*(jest\.fn\(\(\)\s*=>|\(\)\s*=>)/.test(content);

  const hasCreateMockModuleLogger = /unstable_mockModule\s*\(\s*['"`][^'"`]*logger\.mjs['"`].*?createMockModule\s*\(/s.test(content) &&
    /createLogger:\s*jest\.fn\(\(\)\s*=>/.test(content);

  if (!hasInlineLogger && !hasCreateMockModuleLogger) {
    skippedCount++;
    continue;
  }

  const [migratedContent, changed] = migrateFile(content);

  if (!changed) {
    skippedCount++;
    continue;
  }

  // Update imports
  const helperPath = resolveMockFactoryImportPath(testsRoot, filePath);
  const finalContent = updateImports(migratedContent, helperPath);

  const relPath = path.relative(serverRoot, filePath);
  if (DRY_RUN) {
    console.log(`[DRY RUN] Would migrate: ${relPath}`);
  } else {
    writeFileSync(filePath, finalContent, 'utf8');
    console.log(`Migrated: ${relPath}`);
  }
  migratedCount++;
}

console.log(`\nDone. Migrated ${migratedCount} files, skipped ${skippedCount}.`);
