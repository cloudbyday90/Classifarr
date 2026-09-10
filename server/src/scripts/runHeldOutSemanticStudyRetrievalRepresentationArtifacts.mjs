/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { resolve } from 'node:path';

import {
  buildHeldOutSemanticStudyRetrievalRepresentationArtifactSetFromSubmission,
  HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_PRODUCER_STATUS_IDS,
} from '../services/heldOutSemanticStudyRetrievalRepresentationArtifactProducer.mjs';
import {
  readPrivateStudyJsonFile,
  writePrivateStudyJsonFile,
} from './privateStudyFileBoundary.mjs';

export const HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACTS_WORKFLOW_VERSION =
  'policy.held_out_semantic_study_retrieval_representation_artifacts_workflow.v1';

const REQUIRED_OPTION_NAMES = Object.freeze([
  '--bundle-file',
  '--submission-file',
  '--output-file',
]);
const SUPPORTED_OPTION_NAMES = new Set(REQUIRED_OPTION_NAMES);

function parseArguments(argv) {
  if (!Array.isArray(argv) || argv.length !== REQUIRED_OPTION_NAMES.length * 2) {
    throw new Error('retrieval_representation_artifacts_arguments_invalid');
  }
  const values = Object.create(null);
  for (let index = 0; index < argv.length; index += 2) {
    const optionName = argv[index];
    const optionValue = argv[index + 1];
    if (!SUPPORTED_OPTION_NAMES.has(optionName) || Object.hasOwn(values, optionName) ||
        typeof optionValue !== 'string' || !optionValue || optionValue.startsWith('--')) {
      throw new Error('retrieval_representation_artifacts_arguments_invalid');
    }
    values[optionName] = optionValue;
  }
  if (REQUIRED_OPTION_NAMES.some((optionName) => !values[optionName])) {
    throw new Error('retrieval_representation_artifacts_arguments_invalid');
  }
  return Object.freeze(values);
}

function publicReceipt(result, artifactsWritten) {
  return Object.freeze({
    artifactsWritten,
    status: result.status,
    version: HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACTS_WORKFLOW_VERSION,
  });
}

/**
 * Converts one complete content-free evaluator submission into paired label
 * ablation artifacts. Inputs and output remain inside the private study file
 * boundary; invalid bundles or submissions write nothing.
 */
export async function runHeldOutSemanticStudyRetrievalRepresentationArtifacts({
  argv = process.argv.slice(2),
  buildArtifacts = buildHeldOutSemanticStudyRetrievalRepresentationArtifactSetFromSubmission,
  readJson = readPrivateStudyJsonFile,
  writeJson = writePrivateStudyJsonFile,
} = {}) {
  const values = parseArguments(argv);
  const [evaluationBundle, submission] = await Promise.all([
    readJson(values['--bundle-file'], { label: 'Held-out semantic-study evaluation bundle' }),
    readJson(values['--submission-file'], { label: 'Retrieval-representation evaluator submission' }),
  ]);
  const result = buildArtifacts({ evaluationBundle, submission });
  const artifactsReady = result?.status?.id ===
    HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_PRODUCER_STATUS_IDS
      .ARTIFACT_SET_READY;
  if (artifactsReady) {
    await writeJson(values['--output-file'], result.artifactSet, {
      label: 'Paired retrieval-representation study artifacts',
    });
  }
  return publicReceipt(result, artifactsReady);
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  runHeldOutSemanticStudyRetrievalRepresentationArtifacts().then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.artifactsWritten) process.exitCode = 1;
  }).catch(() => {
    process.stderr.write('Held-out retrieval-representation artifacts could not run.\n');
    process.exitCode = 1;
  });
}
