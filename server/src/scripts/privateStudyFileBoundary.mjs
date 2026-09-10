/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { lstat, mkdir, open, readFile, realpath } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';

const MAX_PRIVATE_STUDY_JSON_BYTES = 512 * 1024;
const SERVER_ROOT = resolve(import.meta.dirname, '../..');
// A checkout has `server/` below its repository root; the production image
// copies the application to `/app` and exposes only `/app/data` for writes.
const PROJECT_ROOT = process.env.NODE_ENV === 'production'
  ? resolve(SERVER_ROOT, 'data')
  : resolve(SERVER_ROOT, '..');
const PROJECT_TEMPORARY_ROOT = resolve(PROJECT_ROOT, '.tmp');

function remainsInsideOrSame(root, target) {
  const relativePath = relative(root, target);
  return !relativePath.startsWith('..') && !isAbsolute(relativePath);
}

function validateRelativeJsonPath(value, action, label) {
  if (typeof value !== 'string' || isAbsolute(value) || extname(value).toLowerCase() !== '.json') {
    throw new Error(`${label} ${action} must be a project-relative JSON file.`);
  }
  const requestedPath = resolve(PROJECT_ROOT, value);
  if (!remainsInsideOrSame(PROJECT_TEMPORARY_ROOT, requestedPath) || requestedPath === PROJECT_TEMPORARY_ROOT) {
    throw new Error(`${label} ${action} must remain beneath .tmp.`);
  }
  return requestedPath;
}

async function resolveExistingPrivateFile(requestedPath, label) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- requestedPath passed containment checks.
  const entry = await lstat(requestedPath);
  if (!entry.isFile() || entry.isSymbolicLink() || entry.size > MAX_PRIVATE_STUDY_JSON_BYTES) {
    throw new Error(`${label} input is not an allowed private JSON file.`);
  }
  const [realTemporaryRoot, realInputPath] = await Promise.all([
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed, server-owned private root.
    realpath(PROJECT_TEMPORARY_ROOT),
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- requestedPath passed containment checks.
    realpath(requestedPath),
  ]);
  if (!remainsInsideOrSame(realTemporaryRoot, realInputPath) || realInputPath === realTemporaryRoot) {
    throw new Error(`${label} input must resolve beneath .tmp.`);
  }
  return realInputPath;
}

/**
 * Reads one bounded private JSON document below `.tmp`. It rejects symlinks,
 * directories, oversized files, malformed JSON, and every path outside the
 * local private-study boundary.
 */
export async function readPrivateStudyJsonFile(inputFile, { label = 'Private reviewer packet' } = {}) {
  const requestedPath = validateRelativeJsonPath(inputFile, 'input', label);
  const inputPath = await resolveExistingPrivateFile(requestedPath, label);
  let source;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- realpath and containment checks constrain inputPath.
    source = await readFile(inputPath, 'utf8');
  } catch {
    throw new Error(`${label} input could not be read.`);
  }
  try {
    return JSON.parse(source);
  } catch {
    throw new Error(`${label} input must contain valid JSON.`);
  }
}

/**
 * Writes a generated private JSON document below `.tmp` only. The final path
 * is realpath-checked, created exclusively, and never returned to callers.
 */
export async function writePrivateStudyJsonFile(outputFile, document, { label = 'Private reviewer packet' } = {}) {
  const requestedPath = validateRelativeJsonPath(outputFile, 'output', label);

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- requestedPath passed containment checks.
  await mkdir(dirname(requestedPath), { recursive: true });
  const [realTemporaryRoot, realParentPath] = await Promise.all([
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed, server-owned private root.
    realpath(PROJECT_TEMPORARY_ROOT),
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- requested parent passed containment checks.
    realpath(dirname(requestedPath)),
  ]);
  if (!remainsInsideOrSame(realTemporaryRoot, realParentPath)) {
    throw new Error(`${label} output must resolve beneath .tmp.`);
  }
  const outputPath = resolve(realParentPath, relative(dirname(requestedPath), requestedPath));
  if (!remainsInsideOrSame(realTemporaryRoot, outputPath) || outputPath === realTemporaryRoot) {
    throw new Error(`${label} output must resolve beneath .tmp.`);
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- realpath and containment checks constrain outputPath.
  const handle = await open(outputPath, 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(document, null, 2)}\n`, 'utf8');
  } finally {
    await handle.close();
  }
}
