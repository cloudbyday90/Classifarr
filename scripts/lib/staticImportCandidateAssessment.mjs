/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import fs from 'node:fs';
import path from 'node:path';

const MOCK_SETUP_RE = /\b(?:jest\.unstable_mockModule|jest\.mock|vi\.mock)\s*\(/;
const STATIC_IMPORT_SPECIFIER_RE = /^\s*import\s+(?:(?:[\s\S]*?)\s+from\s+)?(['"])([^'"]+)\1\s*;?/gmu;

function hasMockSetup(source) {
  return MOCK_SETUP_RE.test(source);
}

function getLocalStaticImportPaths(source, filePath) {
  return [...source.matchAll(STATIC_IMPORT_SPECIFIER_RE)]
    .map(match => match[2])
    .filter(specifier => specifier.startsWith('.'))
    .map(specifier => path.resolve(path.dirname(filePath), specifier));
}

function hasImportedMockSetup({
  source,
  filePath,
  readSource = importedPath => fs.readFileSync(importedPath, 'utf8'),
} = {}) {
  return getLocalStaticImportPaths(source, filePath).some(importedPath => {
    try {
      return hasMockSetup(readSource(importedPath));
    } catch {
      return false;
    }
  });
}

function requiresDynamicImportForMockOrder({ source, filePath, readSource } = {}) {
  return hasMockSetup(source) || hasImportedMockSetup({ source, filePath, readSource });
}

export {
  getLocalStaticImportPaths,
  hasImportedMockSetup,
  hasMockSetup,
  requiresDynamicImportForMockOrder,
};
