/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { resolve } from 'node:path';

import {
  readPrivateStudyJsonFile,
  writePrivateStudyJsonFile,
} from './privateStudyFileBoundary.mjs';

export const HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORER_WORKFLOW_VERSION =
  'policy.held_out_semantic_study_retrieval_representation_scorer_workflow.v1';

const REQUIRED_OPTION_NAMES = Object.freeze([
  '--bundle-file',
  '--scoring-input-file',
  '--output-file',
]);
const SUPPORTED_OPTION_NAMES = new Set(REQUIRED_OPTION_NAMES);
const SUBMISSION_READY_STATUS_ID = 'submission_ready';

function parseArguments(argv) {
  if (!Array.isArray(argv) || argv.length !== REQUIRED_OPTION_NAMES.length * 2) {
    throw new Error('retrieval_representation_scorer_arguments_invalid');
  }
  const values = Object.create(null);
  for (let index = 0; index < argv.length; index += 2) {
    const optionName = argv[index];
    const optionValue = argv[index + 1];
    if (!SUPPORTED_OPTION_NAMES.has(optionName) || Object.hasOwn(values, optionName) ||
        typeof optionValue !== 'string' || !optionValue || optionValue.startsWith('--')) {
      throw new Error('retrieval_representation_scorer_arguments_invalid');
    }
    values[optionName] = optionValue;
  }
  if (REQUIRED_OPTION_NAMES.some((optionName) => !values[optionName])) {
    throw new Error('retrieval_representation_scorer_arguments_invalid');
  }
  return Object.freeze(values);
}

async function loadPrivateRuntime() {
  process.env.LOG_LEVEL = 'fatal';
  process.env.FILE_LOGGING_ENABLED = 'false';
  process.env.PGOPTIONS = `${process.env.PGOPTIONS || ''} -c default_transaction_read_only=on`.trim();
  try {
    // Load database-owning modules only after PGOPTIONS has been fixed for
    // this short-lived process. `database.mjs` constructs its pool at import.
    const { createHeldOutSemanticStudyRetrievalRepresentationScoringSource } = await import(
      '../services/heldOutSemanticStudyRetrievalRepresentationScoringSource.mjs'
    );
    const { createHeldOutSemanticStudyRetrievalRepresentationStructuredEvaluator } = await import(
      '../services/heldOutSemanticStudyRetrievalRepresentationStructuredEvaluator.mjs'
    );
    const { createHeldOutSemanticStudyRetrievalRepresentationScorer } = await import(
      '../services/heldOutSemanticStudyRetrievalRepresentationScorer.mjs'
    );
    const database = await import('../config/database.mjs');
    const historySource = createHeldOutSemanticStudyRetrievalRepresentationScoringSource();
    const evaluator = createHeldOutSemanticStudyRetrievalRepresentationStructuredEvaluator();
    return Object.freeze({
      close: () => database.pool.end(),
      scorer: createHeldOutSemanticStudyRetrievalRepresentationScorer({ evaluator, historySource }),
    });
  } catch (error) {
    const database = await import('../config/database.mjs');
    await database.pool.end();
    throw error;
  }
}

function publicReceipt(result, submissionWritten) {
  return Object.freeze({
    status: result?.status ?? Object.freeze({ id: 'scorer_failed' }),
    submissionWritten,
    version: HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORER_WORKFLOW_VERSION,
  });
}

/**
 * Runs the private scorer against exactly one pinned cohort. The process is
 * read-only for the database and writes only the categorical submission below
 * `.tmp`; source media and model output never enter its receipt.
 */
export async function runHeldOutSemanticStudyRetrievalRepresentationScorer({
  argv = process.argv.slice(2),
  loadRuntime = loadPrivateRuntime,
  readJson = readPrivateStudyJsonFile,
  writeJson = writePrivateStudyJsonFile,
} = {}) {
  const values = parseArguments(argv);
  const [evaluationBundle, scoringInput] = await Promise.all([
    readJson(values['--bundle-file'], { label: 'Held-out semantic-study evaluation bundle' }),
    readJson(values['--scoring-input-file'], { label: 'Private retrieval-representation scoring input' }),
  ]);
  const runtime = await loadRuntime();
  try {
    const result = await runtime.scorer.score({ evaluationBundle, scoringInput });
    const submissionReady = result?.status?.id === SUBMISSION_READY_STATUS_ID;
    if (submissionReady) {
      await writeJson(values['--output-file'], result.submission, {
        label: 'Retrieval-representation categorical scorer submission',
      });
    }
    return publicReceipt(result, submissionReady);
  } finally {
    await runtime.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  runHeldOutSemanticStudyRetrievalRepresentationScorer().then((receipt) => {
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
    if (receipt.status.id !== SUBMISSION_READY_STATUS_ID) {
      process.exitCode = 1;
    }
  }).catch(() => {
    process.stderr.write('Held-out retrieval-representation scorer could not run.\n');
    process.exitCode = 1;
  });
}
