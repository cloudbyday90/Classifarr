/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { resolve } from 'node:path';

import {
  buildHeldOutSemanticStudyRetrievalRepresentationResults,
} from '../services/heldOutSemanticStudyRetrievalRepresentationResults.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_STATUS_IDS,
} from '../services/policyCandidateSemanticEvaluationResultsSummaryContract.mjs';
import {
  readPrivateStudyJsonFile,
  writePrivateStudyJsonFile,
} from './privateStudyFileBoundary.mjs';

export const HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_RESULTS_WORKFLOW_VERSION =
  'policy.held_out_semantic_study_retrieval_representation_results_workflow.v1';

const REQUIRED_OPTION_NAMES = Object.freeze([
  '--bundle-file',
  '--reference-set-file',
  '--representation-file',
  '--output-file',
]);
const SUPPORTED_OPTION_NAMES = new Set(REQUIRED_OPTION_NAMES);

function parseArguments(argv) {
  if (!Array.isArray(argv) || argv.length !== REQUIRED_OPTION_NAMES.length * 2) {
    throw new Error('retrieval_representation_results_arguments_invalid');
  }
  const values = Object.create(null);
  for (let index = 0; index < argv.length; index += 2) {
    const optionName = argv[index];
    const optionValue = argv[index + 1];
    if (!SUPPORTED_OPTION_NAMES.has(optionName) || Object.hasOwn(values, optionName) ||
        typeof optionValue !== 'string' || !optionValue || optionValue.startsWith('--')) {
      throw new Error('retrieval_representation_results_arguments_invalid');
    }
    values[optionName] = optionValue;
  }
  if (REQUIRED_OPTION_NAMES.some((optionName) => !values[optionName])) {
    throw new Error('retrieval_representation_results_arguments_invalid');
  }
  return Object.freeze(values);
}

function publicReceipt(result, resultsWritten) {
  return Object.freeze({
    resultsWritten,
    status: result.status,
    version: HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_RESULTS_WORKFLOW_VERSION,
  });
}

/**
 * Runs a local, content-free representation comparison. Every input and the
 * aggregate output stay inside the established private study file boundary;
 * an invalid or not-yet-independent study writes nothing.
 */
export async function runHeldOutSemanticStudyRetrievalRepresentationResults({
  argv = process.argv.slice(2),
  buildResults = buildHeldOutSemanticStudyRetrievalRepresentationResults,
  readJson = readPrivateStudyJsonFile,
  writeJson = writePrivateStudyJsonFile,
} = {}) {
  const values = parseArguments(argv);
  const [evaluationBundle, referenceSetDocument, representationArtifact] = await Promise.all([
    readJson(values['--bundle-file'], { label: 'Held-out semantic-study evaluation bundle' }),
    readJson(values['--reference-set-file'], { label: 'Reviewer reference set' }),
    readJson(values['--representation-file'], { label: 'Retrieval-representation study artifact' }),
  ]);
  const result = buildResults({ evaluationBundle, referenceSetDocument, representationArtifact });
  const resultsAvailable = result?.status?.id ===
    POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_STATUS_IDS.SUMMARY_AVAILABLE;
  if (resultsAvailable) {
    await writeJson(values['--output-file'], result, {
      label: 'Aggregate retrieval-representation study results',
    });
  }
  return publicReceipt(result, resultsAvailable);
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  runHeldOutSemanticStudyRetrievalRepresentationResults().then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.status.id ===
      POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_STATUS_IDS.EVALUATION_SOURCE_INVALID) {
      process.exitCode = 1;
    } else if (result.status.id ===
      POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_STATUS_IDS
        .INDEPENDENT_REFERENCE_SET_REQUIRED) {
      process.exitCode = 2;
    }
  }).catch(() => {
    process.stderr.write('Held-out retrieval-representation results could not run.\n');
    process.exitCode = 1;
  });
}
