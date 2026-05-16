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
const EXCLUDED_REPO_PATHS = new Set([
  'server/src/__tests__/scripts/report-esm-test-mock-shapes.test.mjs',
]);

const MOCK_FACTORY_RE = /\b(?:await\s+)?jest\.unstable_mockModule\s*\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*)\1\s*,\s*\(\)\s*=>\s*\(\s*\{([\s\S]*?)\}\s*\)\s*\)\s*;/g;
const SERVICE_EXPORT_RE = /\b[A-Za-z_$][\w$]*Service\s*:/;
const NAMED_EXPORT_RE = /\b(?!default\b)[A-Za-z_$][\w$]*\s*:/;
const DEFAULT_EXPORT_RE = /\bdefault\s*:/;
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

function parseArgs(argv) {
  const args = {
    check: false,
    json: false,
    output: null,
    strict: false,
    categorySummary: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--check') {
      args.check = true;
      continue;
    }

    if (arg === '--json') {
      args.json = true;
      continue;
    }

    if (arg === '--strict') {
      args.strict = true;
      continue;
    }

    if (arg === '--category-summary') {
      args.categorySummary = true;
      continue;
    }

    if (arg.startsWith('--output=')) {
      args.output = arg.slice('--output='.length);
      continue;
    }

    if (arg === '--output') {
      args.output = argv[index + 1] || null;
      index += 1;
      continue;
    }
  }

  return args;
}

function normalizeSnippet(snippet) {
  return snippet.replace(/\s+/g, ' ').trim();
}

function categorizeCandidate(moduleSpecifier) {
  if (/\butils\/logger\.mjs$/.test(moduleSpecifier)) return 'logger';
  if (/\bmiddleware\/(?:auth|apiKeyAuth)\.mjs$/.test(moduleSpecifier)) return 'auth';
  if (/\bconfig\//.test(moduleSpecifier)) return 'config';
  if (/\bservices\//.test(moduleSpecifier)) return 'service';
  if (moduleSpecifier.startsWith('node:')) return 'builtin';
  if (!moduleSpecifier.startsWith('./') && !moduleSpecifier.startsWith('../')) {
    const bareBuiltin = new Set(['fs', 'path', 'url', 'crypto', 'events', 'http', 'https', 'stream']);
    return bareBuiltin.has(moduleSpecifier) ? 'builtin' : 'external';
  }

  return 'other';
}

function printCategorySummary(candidates, prefix = 'Category summary') {
  const counts = new Map();
  for (const candidate of candidates) {
    counts.set(candidate.category, (counts.get(candidate.category) || 0) + 1);
  }

  const entries = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  console.log(`${prefix}:`);
  if (entries.length === 0) {
    console.log('  (none)');
    return;
  }

  for (const [category, count] of entries) {
    console.log(`  ${category}: ${count}`);
  }
}

function findCandidates(filePath, args) {
  const repoPath = toRepoPath(filePath);
  if (EXCLUDED_REPO_PATHS.has(repoPath)) {
    return [];
  }

  const source = fs.readFileSync(filePath, 'utf8');
  const candidates = [];

  for (const match of source.matchAll(MOCK_FACTORY_RE)) {
    const fullMatch = match[0] || '';
    const moduleSpecifier = match[2] || '';
    const body = match[3] || '';
    const hasDefault = DEFAULT_EXPORT_RE.test(body);
    const hasServiceExport = SERVICE_EXPORT_RE.test(body);
    const hasNamedExport = NAMED_EXPORT_RE.test(body);
    const shouldInclude = args.strict
      ? hasDefault && hasNamedExport
      : hasDefault && hasServiceExport;

    if (!shouldInclude) {
      continue;
    }

    const lineNumber = source.slice(0, match.index).split('\n').length;
    candidates.push({
      file: repoPath,
      lineNumber,
      moduleSpecifier,
      category: categorizeCandidate(moduleSpecifier),
      snippet: normalizeSnippet(fullMatch),
    });
  }

  return candidates;
}

function candidateKey(candidate) {
  return `${candidate.file}|${candidate.snippet}`;
}

const args = parseArgs(process.argv);
const candidates = DEFAULT_SCAN_DIRS
  .flatMap((dir) => collectFiles(dir))
  .flatMap((filePath) => findCandidates(filePath, args));
const newCandidates = candidates.filter((candidate) => !BASELINE_KEYS.has(candidateKey(candidate)));
const modeLabel = args.strict ? 'strict' : 'service';

if (args.output) {
  const outputPath = path.isAbsolute(args.output)
    ? args.output
    : path.join(ROOT, args.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(candidates, null, 2)}\n`, 'utf8');
}

if (args.check) {
  if (newCandidates.length === 0) {
    console.log(`ESM test mock-shape check (${modeLabel}) passed (${candidates.length} baseline item${candidates.length === 1 ? '' : 's'}).`);
    if (args.categorySummary) {
      printCategorySummary(candidates, 'Category summary (all candidates)');
    }
  } else {
    console.error(`Found ${newCandidates.length} new ESM test mock-shape candidate${newCandidates.length === 1 ? '' : 's'} (${modeLabel} mode):`);
    for (const candidate of newCandidates) {
      console.error(`  [${candidate.category}] ${candidate.file}:${candidate.lineNumber} ${candidate.snippet}`);
    }
    if (args.categorySummary) {
      printCategorySummary(newCandidates, 'Category summary (new candidates)');
    }
    process.exitCode = 1;
  }
} else if (args.json) {
  console.log(JSON.stringify(candidates, null, 2));
} else if (candidates.length === 0) {
  console.log(`No ESM test mock-shape candidates found (${modeLabel} mode).`);
} else {
  console.log(`ESM test mock-shape candidates (${modeLabel} mode, ${candidates.length}; ${newCandidates.length} new):`);
  for (const candidate of candidates) {
    const label = BASELINE_KEYS.has(candidateKey(candidate)) ? 'baseline' : 'new';
    console.log(`  [${label}][${candidate.category}] ${candidate.file}:${candidate.lineNumber} ${candidate.snippet}`);
  }
  if (args.categorySummary) {
    printCategorySummary(candidates, 'Category summary (all candidates)');
  }
}
