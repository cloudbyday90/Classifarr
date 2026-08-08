/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/* eslint-disable security/detect-non-literal-fs-filename -- The inventory recursively reads only the fixed server source root declared below. */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const SERVER_SOURCE_ROOT = resolve(REPO_ROOT, 'server/src');

function normalizePolicyMigrationSourcePath(value) {
  return typeof value === 'string' ? value.replaceAll('\\', '/').trim() : '';
}

function normalizePolicyMigrationSourceFile(value = {}) {
  return {
    path: normalizePolicyMigrationSourcePath(value.path),
    source: typeof value.source === 'string' ? value.source : null,
  };
}

function listMjsFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : listMjsFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith('.mjs') ? [entryPath] : [];
  });
}

function listPolicyMigrationStaticSourceFiles() {
  return listMjsFiles(SERVER_SOURCE_ROOT).map(path => ({
    path: normalizePolicyMigrationSourcePath(relative(REPO_ROOT, path)),
    source: readFileSync(path, 'utf8'),
  }));
}

function resolveImportedPath({ importerPath, specifier }) {
  if (!specifier.startsWith('.')) {
    return null;
  }

  return normalizePolicyMigrationSourcePath(relative(
    REPO_ROOT,
    resolve(dirname(resolve(REPO_ROOT, importerPath)), specifier),
  ));
}

function listPolicyMigrationStaticImportPaths(sourceFile = {}) {
  const source = normalizePolicyMigrationSourceFile(sourceFile);
  if (!source.path || source.source === null) {
    return [];
  }

  const importPattern = /(?:\bfrom\s*|\bimport\s*\()['"]([^'"]+)['"]/gu;
  return [...source.source.matchAll(importPattern)]
    .map(match => resolveImportedPath({ importerPath: source.path, specifier: match[1] }))
    .filter(Boolean);
}

export {
  listPolicyMigrationStaticImportPaths,
  listPolicyMigrationStaticSourceFiles,
  normalizePolicyMigrationSourceFile,
};
