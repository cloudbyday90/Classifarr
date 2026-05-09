#!/usr/bin/env node

/**
 * Fix script: Remove duplicate jest.unstable_mockModule('../config/database.mjs', ...) registrations
 * 
 * Jest will only use the LAST registration when the same module path is mocked multiple times.
 * This script keeps the first/best registration and removes redundant duplicates.
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

/**
 * Remove duplicate database mock registrations, keeping the first one
 * This handles any inline object pattern, not just standard ones
 */
function removeDuplicateDbMocks(content) {
  // Split content by lines to find jest.unstable_mockModule calls for database.mjs
  const lines = content.split('\n');
  const dbMockStartLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('jest.unstable_mockModule') && 
        lines[i].includes('database.mjs')) {
      dbMockStartLines.push(i);
    }
  }

  if (dbMockStartLines.length <= 1) {
    return [content, false];
  }

  // Find the full extent of each mock registration
  const mocks = [];
  for (const startLine of dbMockStartLines) {
    let endLine = startLine;
    let parenCount = 0;
    let foundOpen = false;

    // Find matching closing paren
    for (let i = startLine; i < lines.length; i++) {
      for (const char of lines[i]) {
        if (char === '(') {
          parenCount++;
          foundOpen = true;
        } else if (char === ')') {
          parenCount--;
          if (foundOpen && parenCount === 0) {
            endLine = i;
            break;
          }
        }
      }
      if (endLine !== startLine && parenCount === 0) break;
    }

    mocks.push({ startLine, endLine });
  }

  // Keep first, mark others for deletion (delete from end backwards to preserve indices)
  const toDelete = mocks.slice(1).reverse();
  
  for (const mock of toDelete) {
    lines.splice(mock.startLine, mock.endLine - mock.startLine + 1);
  }

  return [lines.join('\n'), true];
}

// ---- Main ----

const files = collectTestFiles(testsRoot);
let fixedCount = 0;
let skippedCount = 0;

for (const filePath of files) {
  const content = readFileSync(filePath, 'utf8');

  // Count database.mjs mocks - simple pattern that should definitely match
  const matches = [...content.matchAll(/jest\.unstable_mockModule\s*\(\s*['"`][^'"`]*database\.mjs['"`]/g)];

  if (matches.length <= 1) {
    skippedCount++;
    continue;
  }

  // Has duplicates
  const [fixedContent, changed] = removeDuplicateDbMocks(content);

  if (!changed) {
    skippedCount++;
    continue;
  }

  const relPath = relative(serverRoot, filePath);
  if (DRY_RUN) {
    console.log(`[DRY RUN] Would remove ${matches.length - 1} duplicate(s) from: ${relPath}`);
  } else {
    writeFileSync(filePath, fixedContent, 'utf8');
    console.log(`Fixed: ${relPath} (removed ${matches.length - 1} duplicate(s))`);
  }

  fixedCount++;
}

console.log(`Done. Fixed ${fixedCount} files, skipped ${skippedCount}.`);
