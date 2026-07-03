#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildPolicyBuilderProductionNameInventory,
} from '../server/src/services/policyBuilderProductionNameInventory.mjs';

const DEFAULT_EXCLUDED_DIRECTORIES = Object.freeze([
  '.git',
  '.tmp',
  '.vite',
  'coverage',
  'data',
  'dist',
  'node_modules',
]);

const DEFAULT_INCLUDED_ROOTS = Object.freeze([
  'server/src',
  'client/src',
  'scripts',
  'database/migrations',
  'docs/architecture',
  'CHANGELOG.md',
  'package.json',
  'server/package.json',
  'client/package.json',
]);

const TEXT_FILE_EXTENSIONS = Object.freeze([
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.sql',
  '.vue',
]);

function normalizeRepoPath(value) {
  return String(value || '').trim().replaceAll('\\', '/').replace(/^\/+/, '');
}

function isTextFile(filePath) {
  return TEXT_FILE_EXTENSIONS.includes(path.extname(filePath).toLowerCase());
}

function isExcludedPath(repoPath) {
  const parts = normalizeRepoPath(repoPath).split('/');
  return parts.some(part => DEFAULT_EXCLUDED_DIRECTORIES.includes(part));
}

function listFilesRecursive(absolutePath, rootDir) {
  if (!existsSync(absolutePath)) {
    return [];
  }

  const stats = statSync(absolutePath);

  if (stats.isFile()) {
    return isTextFile(absolutePath)
      ? [absolutePath]
      : [];
  }

  if (!stats.isDirectory()) {
    return [];
  }

  return readdirSync(absolutePath, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(absolutePath, entry.name);
    const repoPath = normalizeRepoPath(path.relative(rootDir, entryPath));

    if (isExcludedPath(repoPath)) {
      return [];
    }

    if (entry.isDirectory()) {
      return listFilesRecursive(entryPath, rootDir);
    }

    if (entry.isFile() && isTextFile(entryPath)) {
      return [entryPath];
    }

    return [];
  });
}

function loadInventoryFiles(rootDir) {
  const files = DEFAULT_INCLUDED_ROOTS.flatMap(rootEntry =>
    listFilesRecursive(path.resolve(rootDir, rootEntry), rootDir)
  );

  return [...new Set(files)].map(absolutePath => ({
    path: normalizeRepoPath(path.relative(rootDir, absolutePath)),
    content: readFileSync(absolutePath, 'utf8'),
  }));
}

function parseArgs(argv) {
  const options = {
    rootDir: process.cwd(),
    outputPath: null,
    requireValid: false,
  };

  argv.forEach((arg, index) => {
    if (arg === '--root') {
      options.rootDir = argv[index + 1] || options.rootDir;
    }

    if (arg === '--output') {
      options.outputPath = argv[index + 1] || null;
    }

    if (arg === '--require-valid') {
      options.requireValid = true;
    }
  });

  return options;
}

function writeJsonFile(outputPath, payload) {
  if (!outputPath) {
    return;
  }

  const resolvedPath = path.resolve(outputPath);
  mkdirSync(path.dirname(resolvedPath), { recursive: true });
  writeFileSync(resolvedPath, `${JSON.stringify(payload, null, 2)}\n`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const rootDir = path.resolve(options.rootDir);
  const files = loadInventoryFiles(rootDir);
  const inventory = buildPolicyBuilderProductionNameInventory({
    files,
    generatedAt: new Date().toISOString(),
  });

  writeJsonFile(options.outputPath, inventory);
  console.log(JSON.stringify({
    validation: inventory.validation,
    summary: inventory.summary,
    outputPath: options.outputPath,
  }, null, 2));

  if (options.requireValid && inventory.validation.ok !== true) {
    process.exit(1);
  }
}

main();
