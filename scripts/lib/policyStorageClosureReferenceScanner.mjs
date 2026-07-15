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

// These services retain the approved removal manifest as audit evidence. Their
// string literals are not runtime dependencies, but any actual import from one
// of them must still block closure.
const CONTROL_PLANE_EVIDENCE_PATHS = Object.freeze([
  'server/src/services/policyCompatibilityDeletionGates.mjs',
  'server/src/services/policyEngineCompletionAudit.mjs',
  'server/src/services/policyMigrationDeletionPath.mjs',
]);

function normalizeRepositoryPath(value = '') {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

function resolveRepositoryPath(cwd, repositoryPath) {
  return path.resolve(cwd, normalizeRepositoryPath(repositoryPath));
}

function buildScanIssue(issueId, repositoryPath) {
  return {
    issueId,
    repositoryPath: normalizeRepositoryPath(repositoryPath),
  };
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

function isControlPlaneEvidencePath(repositoryPath = '') {
  return CONTROL_PLANE_EVIDENCE_PATHS.includes(
    normalizeRepositoryPath(repositoryPath)
  );
}

function extractStaticModuleSpecifiers(line = '') {
  const specifiers = [];
  const patterns = [
    /\bimport\s+(?:[^'"()]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+(?:[^'"()]*?\s+from\s+)['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  patterns.forEach(pattern => {
    for (const match of line.matchAll(pattern)) {
      if (match[1]) {
        specifiers.push(match[1]);
      }
    }
  });

  return [...new Set(specifiers)];
}

function resolveModuleSpecifier({ cwd, repositoryPath, specifier }) {
  const normalizedSpecifier = normalizeRepositoryPath(specifier);

  if (specifier.startsWith('.')) {
    const importerDirectory = path.dirname(
      resolveRepositoryPath(cwd, repositoryPath)
    );

    return normalizeRepositoryPath(
      path.relative(cwd, path.resolve(importerDirectory, specifier))
    );
  }

  return normalizedSpecifier;
}

function buildModuleReferences({
  cwd,
  repositoryPath,
  line,
  manifestPathSet,
  lineNumber,
} = {}) {
  return extractStaticModuleSpecifiers(line)
    .map(specifier => resolveModuleSpecifier({ cwd, repositoryPath, specifier }))
    .filter(resolvedPath => (
      resolvedPath &&
      resolvedPath !== repositoryPath &&
      manifestPathSet.has(resolvedPath)
    ))
    .map(path => ({
      path,
      referencedBy: repositoryPath,
      line: lineNumber,
    }));
}

function walkTextFiles({ cwd, rootPath, scanIssues }) {
  if (!fs.existsSync(rootPath)) {
    return [];
  }

  let entries;

  try {
    entries = fs.readdirSync(rootPath, { withFileTypes: true });
  } catch (_err) {
    scanIssues.push(buildScanIssue(
      'scan_directory_unreadable',
      path.relative(cwd, rootPath)
    ));
    return [];
  }

  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(rootPath, entry.name);

    if (isIgnoredDirectory(entry)) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...walkTextFiles({ cwd, rootPath: fullPath, scanIssues }));
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
  const manifestPathSet = new Set(normalizedManifestPaths);
  const references = [];
  const referenceKeys = new Set();
  const scanIssues = [];
  const scanIssueKeys = new Set();
  const normalizedScanRoots = [...new Set(
    scanRoots.map(normalizeRepositoryPath).filter(Boolean)
  )];

  function addReference(reference) {
    const key = `${reference.path}:${reference.referencedBy}:${reference.line}`;

    if (!referenceKeys.has(key)) {
      referenceKeys.add(key);
      references.push(reference);
    }
  }

  function addScanIssue(issue) {
    const key = `${issue.issueId}:${issue.repositoryPath}`;

    if (!scanIssueKeys.has(key)) {
      scanIssueKeys.add(key);
      scanIssues.push(issue);
    }
  }

  if (normalizedScanRoots.length === 0) {
    addScanIssue(buildScanIssue('scan_roots_missing', ''));
  }

  normalizedScanRoots.forEach(scanRoot => {
    const rootPath = resolveRepositoryPath(cwd, scanRoot);

    if (!fs.existsSync(rootPath)) {
      addScanIssue(buildScanIssue('scan_root_missing', scanRoot));
    }
  });

  normalizedScanRoots
    .map(scanRoot => resolveRepositoryPath(cwd, scanRoot))
    .flatMap(rootPath => walkTextFiles({ cwd, rootPath, scanIssues }))
    .forEach(filePath => {
      const repositoryPath = normalizeRepositoryPath(path.relative(cwd, filePath));
      if (isIgnoredReferenceScanPath(repositoryPath)) {
        return;
      }

      let content = '';

      try {
        content = fs.readFileSync(filePath, 'utf8');
      } catch (_err) {
        addScanIssue(buildScanIssue(
          'scan_file_unreadable',
          path.relative(cwd, filePath)
        ));
        return;
      }

      content.split(/\r?\n/).forEach((line, index) => {
        const lineNumber = index + 1;

        buildModuleReferences({
          cwd,
          repositoryPath,
          line,
          manifestPathSet,
          lineNumber,
        }).forEach(addReference);

        if (isControlPlaneEvidencePath(repositoryPath)) {
          return;
        }

        normalizedManifestPaths.forEach(manifestPath => {
          if (repositoryPath !== manifestPath && line.includes(manifestPath)) {
            addReference({
              path: manifestPath,
              referencedBy: repositoryPath,
              line: lineNumber,
            });
          }
        });
      });
    });

  const scan = {
    completed: normalizedManifestPaths.length > 0,
    checkedPaths: normalizedManifestPaths,
    references,
  };

  if (scanIssues.length > 0) {
    return {
      ...scan,
      completed: false,
      scanIssues,
    };
  }

  return scan;
}

export {
  CONTROL_PLANE_EVIDENCE_PATHS,
  DEFAULT_SCAN_ROOTS,
  extractStaticModuleSpecifiers,
  isIgnoredReferenceScanPath,
  normalizeRepositoryPath,
  resolveModuleSpecifier,
  scanPolicyStorageClosureReferences,
};
