/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_SCAN_ROOTS = Object.freeze([
  'client/src',
  'server/src',
  'scripts',
  'database/migrations',
]);

const IGNORED_DIR_NAMES = Object.freeze([
  '.git',
  '.tmp',
  'node_modules',
  'dist',
  'build',
  'coverage',
]);

const TEXT_FILE_EXTENSIONS = Object.freeze([
  '.js',
  '.mjs',
  '.cjs',
  '.vue',
  '.sql',
  '.json',
  '.md',
  '.yml',
  '.yaml',
]);

const REFERENCE_SCAN_IGNORED_PATH_PREFIXES = Object.freeze([
  'client/src/__tests__/',
  'server/src/__tests__/',
]);

const REFERENCE_SCAN_IGNORED_PATHS = Object.freeze([
  'server/src/services/policyBuilderLegacyCompatibilityBoundary.mjs',
]);

function normalizeRepositoryPath(value = '') {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

function resolveRepositoryPath(cwd, repositoryPath) {
  return path.resolve(cwd, normalizeRepositoryPath(repositoryPath));
}

function isIgnoredDirectory(dirent) {
  return dirent.isDirectory() && IGNORED_DIR_NAMES.includes(dirent.name);
}

function isTextFile(filePath) {
  return TEXT_FILE_EXTENSIONS.includes(path.extname(filePath).toLowerCase());
}

function isIgnoredReferenceScanPath(repositoryPath = '') {
  const normalizedPath = normalizeRepositoryPath(repositoryPath);

  return REFERENCE_SCAN_IGNORED_PATHS.includes(normalizedPath) ||
    REFERENCE_SCAN_IGNORED_PATH_PREFIXES.some(prefix => normalizedPath.startsWith(prefix));
}

function walkTextFiles(rootPath) {
  if (!fs.existsSync(rootPath)) {
    return [];
  }

  const entries = fs.readdirSync(rootPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(rootPath, entry.name);

    if (isIgnoredDirectory(entry)) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...walkTextFiles(fullPath));
    } else if (entry.isFile() && isTextFile(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

function scanPolicyStorageClosureReferences({
  cwd,
  manifestPaths = [],
  scanRoots = DEFAULT_SCAN_ROOTS,
} = {}) {
  const normalizedManifestPaths = manifestPaths.map(normalizeRepositoryPath);
  const references = [];

  scanRoots
    .map(scanRoot => resolveRepositoryPath(cwd, scanRoot))
    .flatMap(walkTextFiles)
    .forEach(filePath => {
      const repositoryPath = normalizeRepositoryPath(path.relative(cwd, filePath));
      if (isIgnoredReferenceScanPath(repositoryPath)) {
        return;
      }

      let content = '';

      try {
        content = fs.readFileSync(filePath, 'utf8');
      } catch (_err) {
        return;
      }

      content.split(/\r?\n/).forEach((line, index) => {
        normalizedManifestPaths.forEach(manifestPath => {
          if (repositoryPath !== manifestPath && line.includes(manifestPath)) {
            references.push({
              path: manifestPath,
              referencedBy: repositoryPath,
              line: index + 1,
            });
          }
        });
      });
    });

  return {
    completed: normalizedManifestPaths.length > 0,
    checkedPaths: normalizedManifestPaths,
    references,
  };
}

export {
  DEFAULT_SCAN_ROOTS,
  isIgnoredReferenceScanPath,
  normalizeRepositoryPath,
  scanPolicyStorageClosureReferences,
};
