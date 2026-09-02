/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve } from 'node:path';

export const PROJECT_ROOT = resolve(import.meta.dirname, '../..');
export const MAX_PROJECT_JSON_INPUT_BYTES = 128 * 1024;

/**
 * Resolves a small, project-contained JSON input for an offline-only script.
 * The caller must not expose the resulting path in its output.
 */
export async function resolveProjectJsonFile(value) {
  if (typeof value !== 'string' || isAbsolute(value) || extname(value).toLowerCase() !== '.json') {
    throw new Error('Input must be a project-relative JSON file.');
  }

  const requestedPath = resolve(PROJECT_ROOT, value);
  const requestedProjectRelativePath = relative(PROJECT_ROOT, requestedPath);
  if (!requestedProjectRelativePath || requestedProjectRelativePath.startsWith('..') ||
      isAbsolute(requestedProjectRelativePath)) {
    throw new Error('Input must remain inside the project.');
  }

  const [realProjectRoot, realInputPath] = await Promise.all([
    realpath(PROJECT_ROOT),
    realpath(requestedPath),
  ]);
  const resolvedProjectRelativePath = relative(realProjectRoot, realInputPath);
  if (!resolvedProjectRelativePath || resolvedProjectRelativePath.startsWith('..') ||
      isAbsolute(resolvedProjectRelativePath)) {
    throw new Error('Input must resolve inside the project.');
  }

  return realInputPath;
}

/**
 * Loads a bounded JSON input without allowing a directory, device, or an
 * unbounded file to become an offline evaluation source.
 */
export async function loadProjectJsonFile(value) {
  const path = await resolveProjectJsonFile(value);
  const inputStats = await stat(path);
  if (!inputStats.isFile()) throw new Error('Input must be a regular file.');
  if (inputStats.size > MAX_PROJECT_JSON_INPUT_BYTES) {
    throw new Error('Input exceeds the offline evaluation size limit.');
  }

  return JSON.parse(await readFile(path, 'utf8'));
}
