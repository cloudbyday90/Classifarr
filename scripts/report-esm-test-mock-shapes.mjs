/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DEFAULT_SCAN_DIRS = [
  path.join(ROOT, 'server', 'src', '__tests__'),
];

const TARGET_RE = /\b(?:await\s+)?jest\.unstable_mockModule\s*\([^\n]*\(\)\s*=>\s*\(\{[^\n]*\b[A-Za-z_$][\w$]*Service\s*:[^\n]*\bdefault\s*:/;
const BASELINE_KEYS = new Set([]);

function collectFiles(dir, results = []) {
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      collectFiles(fullPath, results);
    } else if (entry.isFile() && /\.(?:mjs|js)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }

  return results;
}

function toRepoPath(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function findCandidates(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  return source
    .split('\n')
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => TARGET_RE.test(line))
    .map(({ line, lineNumber }) => ({
      file: toRepoPath(filePath),
      lineNumber,
      snippet: line.trim(),
    }));
}

function candidateKey(candidate) {
  return `${candidate.file}|${candidate.snippet}`;
}

const candidates = DEFAULT_SCAN_DIRS
  .flatMap((dir) => collectFiles(dir))
  .flatMap((filePath) => findCandidates(filePath));
const newCandidates = candidates.filter((candidate) => !BASELINE_KEYS.has(candidateKey(candidate)));

if (process.argv.includes('--check')) {
  if (newCandidates.length === 0) {
    console.log(`ESM test mock-shape check passed (${candidates.length} baseline item${candidates.length === 1 ? '' : 's'}).`);
  } else {
    console.error(`Found ${newCandidates.length} new ESM test mock-shape candidate${newCandidates.length === 1 ? '' : 's'}:`);
    for (const candidate of newCandidates) {
      console.error(`  ${candidate.file}:${candidate.lineNumber} ${candidate.snippet}`);
    }
    process.exitCode = 1;
  }
} else if (process.argv.includes('--json')) {
  console.log(JSON.stringify(candidates, null, 2));
} else if (candidates.length === 0) {
  console.log('No ESM test mock-shape candidates found.');
} else {
  console.log(`ESM test mock-shape candidates (${candidates.length}; ${newCandidates.length} new):`);
  for (const candidate of candidates) {
    const label = BASELINE_KEYS.has(candidateKey(candidate)) ? 'baseline' : 'new';
    console.log(`  [${label}] ${candidate.file}:${candidate.lineNumber} ${candidate.snippet}`);
  }
}
