/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import fs from 'node:fs';
import path from 'node:path';
import { requiresDynamicImportForMockOrder } from './lib/staticImportCandidateAssessment.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DEFAULT_SCAN_DIRS = [
  path.join(ROOT, 'server', 'src', '__tests__'),
  path.join(ROOT, 'client', 'src', '__tests__'),
];

const DYNAMIC_IMPORT_RE = /\bawait\s+import\s*\(\s*['"][^'"]+['"]\s*\)/;

function collectFiles(dir, results = []) {
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      collectFiles(full, results);
    } else if (entry.isFile() && /\.(?:mjs|js|vue)$/.test(entry.name)) {
      results.push(full);
    }
  }

  return results;
}

function toRepoPath(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function findCandidates(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  if (!DYNAMIC_IMPORT_RE.test(source) || requiresDynamicImportForMockOrder({ source, filePath })) {
    return [];
  }

  return source
    .split('\n')
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => DYNAMIC_IMPORT_RE.test(line))
    .map(({ line, lineNumber }) => ({
      file: toRepoPath(filePath),
      lineNumber,
      snippet: line.trim()
    }));
}

const candidates = DEFAULT_SCAN_DIRS
  .flatMap((dir) => collectFiles(dir))
  .flatMap((filePath) => findCandidates(filePath));

if (process.argv.includes('--check')) {
  if (candidates.length === 0) {
    console.log('Static import candidate check passed.');
  } else {
    console.error(`Found ${candidates.length} static import candidate${candidates.length === 1 ? '' : 's'}:`);
    for (const candidate of candidates) {
      console.error(`  ${candidate.file}:${candidate.lineNumber} ${candidate.snippet}`);
    }
    process.exitCode = 1;
  }
} else if (process.argv.includes('--json')) {
  console.log(JSON.stringify(candidates, null, 2));
} else if (candidates.length === 0) {
  console.log('No static import candidates found.');
} else {
  console.log(`Static import candidates (${candidates.length}):`);
  for (const candidate of candidates) {
    console.log(`  ${candidate.file}:${candidate.lineNumber} ${candidate.snippet}`);
  }
}
