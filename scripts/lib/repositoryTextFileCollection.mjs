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

const DEFAULT_EXCLUDED_DIRECTORIES = Object.freeze([
  '.git',
  '.tmp',
  '.vite',
  'coverage',
  'data',
  'dist',
  'node_modules',
]);

const DEFAULT_TEXT_FILE_EXTENSIONS = Object.freeze([
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

function isTextFile(filePath, textFileExtensions) {
  return textFileExtensions.includes(path.extname(filePath).toLowerCase());
}

function isExcludedPath(repoPath, excludedDirectories) {
  const parts = normalizeRepoPath(repoPath).split('/');
  return parts.some(part => excludedDirectories.includes(part));
}

function resolveIncludedRoot(rootDir, rootEntry) {
  const absolutePath = path.resolve(rootDir, rootEntry);
  const relativePath = path.relative(rootDir, absolutePath);

  if (
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Included root must stay within the repository: ${rootEntry}`);
  }

  return absolutePath;
}

function listFilesRecursive({
  absolutePath,
  rootDir,
  excludedDirectories,
  textFileExtensions,
}) {
  if (!existsSync(absolutePath)) {
    return [];
  }

  const stats = statSync(absolutePath);

  if (stats.isFile()) {
    return isTextFile(absolutePath, textFileExtensions)
      ? [absolutePath]
      : [];
  }

  if (!stats.isDirectory()) {
    return [];
  }

  return readdirSync(absolutePath, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(absolutePath, entry.name);
    const repoPath = normalizeRepoPath(path.relative(rootDir, entryPath));

    if (isExcludedPath(repoPath, excludedDirectories)) {
      return [];
    }

    if (entry.isDirectory()) {
      return listFilesRecursive({
        absolutePath: entryPath,
        rootDir,
        excludedDirectories,
        textFileExtensions,
      });
    }

    if (entry.isFile() && isTextFile(entryPath, textFileExtensions)) {
      return [entryPath];
    }

    return [];
  });
}

function collectRepositoryTextFiles({
  rootDir = process.cwd(),
  includedRoots = [],
  excludedDirectories = DEFAULT_EXCLUDED_DIRECTORIES,
  textFileExtensions = DEFAULT_TEXT_FILE_EXTENSIONS,
} = {}) {
  const resolvedRootDir = path.resolve(rootDir);
  const files = includedRoots.flatMap(rootEntry =>
    listFilesRecursive({
      absolutePath: resolveIncludedRoot(resolvedRootDir, rootEntry),
      rootDir: resolvedRootDir,
      excludedDirectories,
      textFileExtensions,
    })
  );

  return [...new Set(files)]
    .sort((left, right) => left.localeCompare(right))
    .map(absolutePath => ({
      path: normalizeRepoPath(path.relative(resolvedRootDir, absolutePath)),
      content: readFileSync(absolutePath, 'utf8'),
    }));
}

export {
  DEFAULT_EXCLUDED_DIRECTORIES,
  DEFAULT_TEXT_FILE_EXTENSIONS,
  collectRepositoryTextFiles,
  normalizeRepoPath,
};
