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

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import {
  buildPolicyProductionNamingInventory,
  validatePolicyBuilderProductionNameInventory,
} from './policyProductionNamingInventory.mjs';

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

function loadPolicyProductionNamingRepositoryFiles({
  rootDir = process.cwd(),
} = {}) {
  const resolvedRootDir = path.resolve(rootDir);
  const files = DEFAULT_INCLUDED_ROOTS.flatMap(rootEntry =>
    listFilesRecursive(path.resolve(resolvedRootDir, rootEntry), resolvedRootDir)
  );

  return [...new Set(files)].map(absolutePath => ({
    path: normalizeRepoPath(path.relative(resolvedRootDir, absolutePath)),
    content: readFileSync(absolutePath, 'utf8'),
  }));
}

function buildPolicyProductionNamingRepositoryInventory({
  rootDir = process.cwd(),
  generatedAt,
} = {}) {
  const inventory = buildPolicyProductionNamingInventory({
    files: loadPolicyProductionNamingRepositoryFiles({ rootDir }),
    generatedAt,
  });
  const sideEffects = {
    ...inventory.sideEffects,
    filesRead: true,
  };
  const currentInventory = {
    ...inventory,
    scanScope: 'repository',
    sideEffects,
  };

  return {
    ...currentInventory,
    validation: validatePolicyBuilderProductionNameInventory(currentInventory),
  };
}

export {
  DEFAULT_EXCLUDED_DIRECTORIES,
  DEFAULT_INCLUDED_ROOTS,
  buildPolicyProductionNamingRepositoryInventory,
  loadPolicyProductionNamingRepositoryFiles,
};
