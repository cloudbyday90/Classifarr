/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { writePrivateStudyJsonFile } from './privateStudyFileBoundary.mjs';

/**
 * Writes a reviewer packet only below the ignored temporary root. The path is
 * symlink-checked and opened with a 0600 mode on POSIX systems; on Windows the
 * installation directory's inherited ACL remains the local access boundary.
 * Callers receive no filesystem path in their public receipt.
 */
export async function writePrivateStudyPacket(outputFile, packet) {
  return writePrivateStudyJsonFile(outputFile, packet);
}
