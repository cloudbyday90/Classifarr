/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { mkdir, open, realpath } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';

import { PROJECT_ROOT } from './project-json-input.mjs';

const PROJECT_TEMPORARY_ROOT = resolve(PROJECT_ROOT, '.tmp');

function remainsInsideOrSame(root, target) {
  const relativePath = relative(root, target);
  return !relativePath.startsWith('..') && !isAbsolute(relativePath);
}

/**
 * Writes one generated study artifact beneath ignored .tmp only. The final
 * path is realpath-checked, created exclusively, and never returned for
 * command-line echoing. Existing files are never overwritten.
 */
export async function writeProjectTemporaryJsonFile(value, document) {
  if (typeof value !== 'string' || isAbsolute(value) || extname(value).toLowerCase() !== '.json') {
    throw new Error('Output must be a project-relative JSON file.');
  }
  const requestedPath = resolve(PROJECT_ROOT, value);
  if (!remainsInsideOrSame(PROJECT_TEMPORARY_ROOT, requestedPath) ||
      requestedPath === PROJECT_TEMPORARY_ROOT) {
    throw new Error('Output must remain beneath the project temporary directory.');
  }

  await mkdir(dirname(requestedPath), { recursive: true });
  const [realTemporaryRoot, realParentPath] = await Promise.all([
    realpath(PROJECT_TEMPORARY_ROOT),
    realpath(dirname(requestedPath)),
  ]);
  if (!remainsInsideOrSame(realTemporaryRoot, realParentPath)) {
    throw new Error('Output must resolve beneath the project temporary directory.');
  }

  const outputPath = resolve(realParentPath, relative(dirname(requestedPath), requestedPath));
  if (!remainsInsideOrSame(realTemporaryRoot, outputPath) || outputPath === realTemporaryRoot) {
    throw new Error('Output must resolve beneath the project temporary directory.');
  }

  const handle = await open(outputPath, 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(document, null, 2)}\n`, 'utf8');
  } finally {
    await handle.close();
  }
}
