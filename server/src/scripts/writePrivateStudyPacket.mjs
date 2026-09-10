/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { mkdir, open, realpath } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';

const SERVER_ROOT = resolve(import.meta.dirname, '../..');
// A checkout has `server/` beneath the repository root, whereas the production
// image copies the server application directly to `/app`. Keep private packets
// in the ignored checkout root while placing container packets beneath its
// writable `/app/data/.tmp` boundary (the image root itself is read-only).
const PROJECT_ROOT = process.env.NODE_ENV === 'production'
  ? resolve(SERVER_ROOT, 'data')
  : resolve(SERVER_ROOT, '..');
const PROJECT_TEMPORARY_ROOT = resolve(PROJECT_ROOT, '.tmp');

function remainsInsideOrSame(root, target) {
  const relativePath = relative(root, target);
  return !relativePath.startsWith('..') && !isAbsolute(relativePath);
}

/**
 * Writes a reviewer packet only below the ignored temporary root. The path is
 * symlink-checked and opened with a 0600 mode on POSIX systems; on Windows the
 * installation directory's inherited ACL remains the local access boundary.
 * Callers receive no filesystem path in their public receipt.
 */
export async function writePrivateStudyPacket(outputFile, packet) {
  if (typeof outputFile !== 'string' || isAbsolute(outputFile) ||
      extname(outputFile).toLowerCase() !== '.json') {
    throw new Error('Private reviewer packet output must be a project-relative JSON file.');
  }
  const requestedPath = resolve(PROJECT_ROOT, outputFile);
  if (!remainsInsideOrSame(PROJECT_TEMPORARY_ROOT, requestedPath) || requestedPath === PROJECT_TEMPORARY_ROOT) {
    throw new Error('Private reviewer packet output must remain beneath .tmp.');
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- resolved under the fixed .tmp root above.
  await mkdir(dirname(requestedPath), { recursive: true });
  const [realTemporaryRoot, realParentPath] = await Promise.all([
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- the fixed .tmp root is server-owned.
    realpath(PROJECT_TEMPORARY_ROOT),
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- requested parent is constrained above.
    realpath(dirname(requestedPath)),
  ]);
  if (!remainsInsideOrSame(realTemporaryRoot, realParentPath)) {
    throw new Error('Private reviewer packet output must resolve beneath .tmp.');
  }
  const outputPath = resolve(realParentPath, relative(dirname(requestedPath), requestedPath));
  if (!remainsInsideOrSame(realTemporaryRoot, outputPath) || outputPath === realTemporaryRoot) {
    throw new Error('Private reviewer packet output must resolve beneath .tmp.');
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- realpath and containment checks constrain outputPath.
  const handle = await open(outputPath, 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(packet, null, 2)}\n`, 'utf8');
  } finally {
    await handle.close();
  }
}
