/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { writePrivateStudyJsonFile } from './privateStudyFileBoundary.mjs';

/** Writes the redacted study companion through the same constrained `.tmp` boundary. */
export async function writeHeldOutSemanticStudyEvaluationBundle(outputFile, bundle) {
  return writePrivateStudyJsonFile(outputFile, bundle, {
    label: 'Held-out semantic-study evaluation bundle',
  });
}
