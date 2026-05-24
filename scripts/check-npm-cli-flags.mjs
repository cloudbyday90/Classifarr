#!/usr/bin/env node
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
import { resolve } from 'node:path';
import { globSync } from 'glob';

export const DEFAULT_INCLUDE_PATTERNS = Object.freeze([
  'Dockerfile',
  'README.md',
  'package.json',
  'client/package.json',
  'server/package.json',
  '.github/workflows/**/*.{yml,yaml}',
  'docs/**/*.md',
  'scripts/**/*.mjs',
]);

export const DEFAULT_IGNORE_PATTERNS = Object.freeze([
  '**/.git/**',
  '**/.tmp/**',
  '**/node_modules/**',
  'CHANGELOG.md',
  'CHANGELOG_backup.md',
  'scripts/check-npm-cli-flags.mjs',
]);

export const LEGACY_NPM_FLAG_PATTERNS = Object.freeze([
  {
    key: 'npm-ci-only-production',
    description: 'Use `npm ci --omit=dev` instead of `npm ci --only=production`.',
    regex: /\bnpm\s+ci\b[^\r\n]*\s--only=production\b/,
  },
  {
    key: 'npm-install-only-production',
    description: 'Use `npm install --omit=dev` instead of `npm install --only=production`.',
    regex: /\bnpm\s+install\b[^\r\n]*\s--only=production\b/,
  },
  {
    key: 'npm-install-production',
    description: 'Use `npm install --omit=dev` instead of `npm install --production`.',
    regex: /\bnpm\s+install\b[^\r\n]*\s--production\b/,
  },
  {
    key: 'npm-config-only-production',
    description: 'Prefer omit-based installs over `npm_config_only=production` / `NPM_CONFIG_ONLY=production`.',
    regex: /\b(?:npm_config_only|NPM_CONFIG_ONLY)\s*=\s*production\b/,
  },
  {
    key: 'npm-global-style',
    description: 'Avoid the removed npm `--global-style` flag.',
    regex: /\bnpm\s+\S+[^\r\n]*\s--global-style\b/,
  },
  {
    key: 'npm-legacy-bundling',
    description: 'Avoid the removed npm `--legacy-bundling` flag.',
    regex: /\bnpm\s+\S+[^\r\n]*\s--legacy-bundling\b/,
  },
]);

function normalizePathForMatch(filePath) {
  return String(filePath).replace(/\\/g, '/');
}

export function listTargetFiles({
  cwd = process.cwd(),
  includePatterns = DEFAULT_INCLUDE_PATTERNS,
  ignorePatterns = DEFAULT_IGNORE_PATTERNS,
} = {}) {
  const files = new Set();

  for (const pattern of includePatterns) {
    const matches = globSync(pattern, {
      cwd,
      ignore: ignorePatterns,
      nodir: true,
      windowsPathsNoEscape: true,
    });

    for (const match of matches) {
      files.add(normalizePathForMatch(match));
    }
  }

  return Array.from(files).sort((left, right) => left.localeCompare(right));
}

export function scanContentForLegacyNpmCliFlags(content, filePath, patterns = LEGACY_NPM_FLAG_PATTERNS) {
  const normalizedPath = normalizePathForMatch(filePath);
  const lines = String(content).split(/\r?\n/u);
  const violations = [];

  lines.forEach((line, index) => {
    for (const pattern of patterns) {
      if (!pattern.regex.test(line)) {
        continue;
      }

      violations.push({
        filePath: normalizedPath,
        lineNumber: index + 1,
        patternKey: pattern.key,
        description: pattern.description,
        lineText: line.trim(),
      });
    }
  });

  return violations;
}

export function findLegacyNpmCliFlags({
  cwd = process.cwd(),
  includePatterns = DEFAULT_INCLUDE_PATTERNS,
  ignorePatterns = DEFAULT_IGNORE_PATTERNS,
  fileEntries = null,
} = {}) {
  const entries = fileEntries ?? listTargetFiles({ cwd, includePatterns, ignorePatterns }).map(filePath => ({
    filePath,
    content: fs.readFileSync(resolve(cwd, filePath), 'utf8'),
  }));

  return entries.flatMap(({ filePath, content }) =>
    scanContentForLegacyNpmCliFlags(content, filePath)
  );
}

export function formatLegacyNpmCliFlagViolation(violation) {
  return `${violation.filePath}:${violation.lineNumber} [${violation.patternKey}] ${violation.description}\n  ${violation.lineText}`;
}

export function checkNpmCliFlags(options = {}) {
  const violations = findLegacyNpmCliFlags(options);

  if (violations.length > 0) {
    const details = violations.map(formatLegacyNpmCliFlagViolation).join('\n');
    throw new Error(
      `Legacy npm CLI flags detected. Replace them with current npm omit-based forms.\n${details}`
    );
  }

  return [];
}

function main() {
  try {
    checkNpmCliFlags();
    console.log('✅ No legacy npm CLI flags detected.');
  } catch (error) {
    console.error('❌ npm CLI flag check failed:', error.message);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  main();
}
