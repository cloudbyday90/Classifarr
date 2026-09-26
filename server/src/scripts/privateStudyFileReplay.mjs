/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isDeepStrictEqual } from 'node:util';
import { readPrivateStudyJsonFile, writePrivateStudyJsonFile } from './privateStudyFileBoundary.mjs';

/** Recompute first, then reuse only identical protected output; never overwrite or trust existence. */
export async function writeOrVerifyPrivateStudyJsonFile(outputFile, document, { options = { label: 'Private study output' },
  readJson = readPrivateStudyJsonFile, writeJson = writePrivateStudyJsonFile,
  conflictCode = 'STUDY_OUTPUT_CONFLICT', conflictMessage = 'Existing private output differs. Use a new output filename.' } = {}) {
  try { await writeJson(outputFile, document, options); }
  catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    const existing = await readJson(outputFile, options);
    if (!isDeepStrictEqual(existing, document)) throw Object.assign(new Error(conflictMessage), { code: conflictCode });
  }
}
