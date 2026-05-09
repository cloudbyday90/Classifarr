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

const MOCK_FACTORY_RE = /\b(?:await\s+)?jest\.unstable_mockModule\s*\(\s*(['"`])(?:\\.|(?!\1)[\s\S])*\1\s*,\s*\(\)\s*=>\s*\(\s*\{([\s\S]*?)\}\s*\)\s*\)\s*;/g;
const SERVICE_EXPORT_RE = /\b[A-Za-z_$][\w$]*Service\s*:/;
const DEFAULT_EXPORT_RE = /\bdefault\s*:/;
const BASELINE_KEYS = new Set([
  "server/src/__tests__/backup-routes.test.mjs|jest.unstable_mockModule('../services/backupService.mjs', () => ({ backupService: { ENCRYPTED_BACKUP_PASSWORD_ERROR: 'Password must be a string with at least 8 characters for encrypted backups', isValidEncryptedBackupPassword, createBackup, logAudit, }, default: { ENCRYPTED_BACKUP_PASSWORD_ERROR: 'Password must be a string with at least 8 characters for encrypted backups', isValidEncryptedBackupPassword, createBackup, logAudit, }, }));",
  "server/src/__tests__/classificationPolicyPathService.test.mjs|jest.unstable_mockModule('../services/classificationRagLoopService.mjs', () => ({ ...classificationRagLoopService, classificationRagLoopService: classificationRagLoopService, default: classificationRagLoopService, }));",
  "server/src/__tests__/integration/queue-api.test.mjs|jest.unstable_mockModule('../../services/ollama.mjs', () => ({ ollamaService: ollamaService, ...ollamaService, default: ollamaService, ...ollamaService, }));",
  "server/src/__tests__/integration/queue-api.test.mjs|jest.unstable_mockModule('../../services/enrichmentRetryService.mjs', () => ({ enrichmentRetryService: enrichmentRetryService, ...enrichmentRetryService, default: enrichmentRetryService, ...enrichmentRetryService, }));",
  "server/src/__tests__/mappings-routes.test.mjs|jest.unstable_mockModule('../services/libraryMappingService.mjs', () => ({ libraryMappingService: { getMappings, getUnmappedLibraries, getAvailableArrInstances, getArrRootFolders, getLibraryMapping, saveMapping, deleteMapping, autoDetectMappings, linkArrToMediaServer, }, default: { getMappings, getUnmappedLibraries, getAvailableArrInstances, getArrRootFolders, getLibraryMapping, saveMapping, deleteMapping, autoDetectMappings, linkArrToMediaServer, }, }));",
  "server/src/__tests__/reclassification-routes.test.mjs|jest.unstable_mockModule('../services/reclassificationBatchService.mjs', () => ({ reclassificationBatchService: { cancelBatch, createBatch, executeBatch, getBatchProgress, getBatchStatus, listBatches, pauseBatch, resumeBatch, retryItem, skipItem, validateBatch, }, default: { cancelBatch, createBatch, executeBatch, getBatchProgress, getBatchStatus, listBatches, pauseBatch, resumeBatch, retryItem, skipItem, validateBatch, }, }));",
  "server/src/__tests__/requests-routes.test.mjs|jest.unstable_mockModule('../services/tmdb.mjs', () => ({ tmdbService: { search, getMovieDetails, getTVDetails, }, default: { search, getMovieDetails, getTVDetails, }, }));",
  "server/src/__tests__/requests-routes.test.mjs|jest.unstable_mockModule('../services/queueService.mjs', () => ({ queueService: { enqueue, }, default: { enqueue, }, }));",
  "server/src/__tests__/scheduler-routes.test.mjs|jest.unstable_mockModule('../services/schedulerService.mjs', () => ({ schedulerService: { getAllTasks, getTaskById, createTask, updateTask, deleteTask, runNow, }, default: { getAllTasks, getTaskById, createTask, updateTask, deleteTask, runNow, }, }));",
]);

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

function findCandidates(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const candidates = [];

  for (const match of source.matchAll(MOCK_FACTORY_RE)) {
    const fullMatch = match[0] || '';
    const body = match[2] || '';
    if (!SERVICE_EXPORT_RE.test(body) || !DEFAULT_EXPORT_RE.test(body)) {
      continue;
    }

    const lineNumber = source.slice(0, match.index).split('\n').length;
    candidates.push({
      file: toRepoPath(filePath),
      lineNumber,
      snippet: normalizeSnippet(fullMatch),
    });
  }

  return candidates;
}

function candidateKey(candidate) {
  return `${candidate.file}|${candidate.snippet}`;
}

const candidates = DEFAULT_SCAN_DIRS
  .flatMap((dir) => collectFiles(dir))
  .flatMap((filePath) => findCandidates(filePath));
const newCandidates = candidates.filter((candidate) => !BASELINE_KEYS.has(candidateKey(candidate)));
const args = parseArgs(process.argv);

if (args.output) {
  const outputPath = path.isAbsolute(args.output)
    ? args.output
    : path.join(ROOT, args.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(candidates, null, 2)}\n`, 'utf8');
}

if (args.check) {
  if (newCandidates.length === 0) {
    console.log(`ESM test mock-shape check passed (${candidates.length} baseline item${candidates.length === 1 ? '' : 's'}).`);
  } else {
    console.error(`Found ${newCandidates.length} new ESM test mock-shape candidate${newCandidates.length === 1 ? '' : 's'}:`);
    for (const candidate of newCandidates) {
      console.error(`  ${candidate.file}:${candidate.lineNumber} ${candidate.snippet}`);
    }
    process.exitCode = 1;
  }
} else if (args.json) {
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
