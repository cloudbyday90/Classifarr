/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { resolve } from 'node:path';

import {
  policyCandidateCurrentInventorySemanticStudyCapture,
} from '../services/policyCandidateCurrentInventorySemanticStudyCapture.mjs';
import {
  POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_CAPTURE_STATUS_IDS,
} from '../services/policyCandidateCurrentInventorySemanticStudyCaptureContract.mjs';
import { loadBoundedStdinJsonInput } from './boundedStdinJsonInput.mjs';

function validateArguments(argv) {
  if (!Array.isArray(argv) || argv.length !== 0) {
    throw new Error('This command accepts its study request only on standard input.');
  }
}

/**
 * Runs one private, bounded capture. The raw request is read from standard
 * input and discarded after retrieval; the returned document is redacted and
 * safe to pass into the existing offline study flow.
 */
export async function runPolicyCandidateCurrentInventorySemanticStudyCapture({
  argv = process.argv.slice(2),
  capture = policyCandidateCurrentInventorySemanticStudyCapture,
  stdin = process.stdin,
} = {}) {
  validateArguments(argv);
  const request = await loadBoundedStdinJsonInput({ stdin });
  const result = await capture.capture(request);
  if (result?.status?.id !== POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_CAPTURE_STATUS_IDS.COMPLETE ||
      !result.document) {
    throw new Error('Current-inventory semantic study capture is invalid.');
  }
  return result.document;
}

async function main() {
  const document = await runPolicyCandidateCurrentInventorySemanticStudyCapture();
  process.stdout.write(`${JSON.stringify(document, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  main().catch(() => {
    process.stderr.write('Current-inventory semantic study capture could not run.\n');
    process.exitCode = 1;
  });
}
