/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { resolve } from 'node:path';

import {
  createHeldOutSemanticStudyRetrievalEvaluationCompletionWorkflow,
  HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_EVALUATION_COMPLETION_STATUS_IDS,
} from '../services/heldOutSemanticStudyRetrievalEvaluationCompletionWorkflow.mjs';
import {
  deriveHeldOutSemanticStudyRetrievalEvaluationCompletionPaths,
} from './heldOutSemanticStudyRetrievalEvaluationCompletionPath.mjs';
import {
  runHeldOutSemanticStudyRetrievalRepresentationArtifacts,
} from './runHeldOutSemanticStudyRetrievalRepresentationArtifacts.mjs';
import {
  runHeldOutSemanticStudyRetrievalRepresentationResults,
} from './runHeldOutSemanticStudyRetrievalRepresentationResults.mjs';
import {
  runHeldOutSemanticStudyRetrievalRepresentationScorer,
} from './runHeldOutSemanticStudyRetrievalRepresentationScorer.mjs';
import {
  runHeldOutSemanticStudyReviewerReferenceSet,
} from './runHeldOutSemanticStudyReviewerReferenceSet.mjs';

export const HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_EVALUATION_COMPLETION_COMMAND_VERSION =
  'policy.held_out_semantic_study_retrieval_evaluation_completion_command.v1';

const CONFIRMATION_FLAG = '--confirm-private-study-evaluation';
const REQUIRED_OPTION_NAMES = Object.freeze([
  '--packet-file',
  '--reviewer-one-file',
  '--reviewer-two-file',
  '--output-file',
]);
const OPTIONAL_OPTION_NAMES = Object.freeze(['--adjudication-file']);
const SUPPORTED_OPTION_NAMES = new Set([...REQUIRED_OPTION_NAMES, ...OPTIONAL_OPTION_NAMES]);

function parseArguments(argv) {
  if (!Array.isArray(argv) || argv[0] !== CONFIRMATION_FLAG) {
    throw new Error('retrieval_evaluation_completion_arguments_invalid');
  }
  const options = argv.slice(1);
  if (options.length < REQUIRED_OPTION_NAMES.length * 2 || options.length % 2 !== 0) {
    throw new Error('retrieval_evaluation_completion_arguments_invalid');
  }
  const values = Object.create(null);
  for (let index = 0; index < options.length; index += 2) {
    const optionName = options[index];
    const optionValue = options[index + 1];
    if (!SUPPORTED_OPTION_NAMES.has(optionName) || Object.hasOwn(values, optionName) ||
        typeof optionValue !== 'string' || !optionValue || optionValue.startsWith('--')) {
      throw new Error('retrieval_evaluation_completion_arguments_invalid');
    }
    values[optionName] = optionValue;
  }
  if (REQUIRED_OPTION_NAMES.some((optionName) => !values[optionName])) {
    throw new Error('retrieval_evaluation_completion_arguments_invalid');
  }
  const paths = deriveHeldOutSemanticStudyRetrievalEvaluationCompletionPaths({
    packetFile: values['--packet-file'],
    resultsOutputFile: values['--output-file'],
  });
  if (!paths) throw new Error('retrieval_evaluation_completion_arguments_invalid');
  return Object.freeze({
    adjudicationFile: values['--adjudication-file'] ?? null,
    paths,
    reviewerOneFile: values['--reviewer-one-file'],
    reviewerTwoFile: values['--reviewer-two-file'],
  });
}

/**
 * Completes one independently labelled, private study after an explicit local
 * command. It prints only a fixed stage receipt; all documents stay below the
 * existing private-study file boundary owned by the composed commands.
 */
export async function runHeldOutSemanticStudyRetrievalEvaluationCompletion({
  argv = process.argv.slice(2),
  createWorkflow = createHeldOutSemanticStudyRetrievalEvaluationCompletionWorkflow,
  runArtifacts = runHeldOutSemanticStudyRetrievalRepresentationArtifacts,
  runReferenceSet = runHeldOutSemanticStudyReviewerReferenceSet,
  runResults = runHeldOutSemanticStudyRetrievalRepresentationResults,
  runScorer = runHeldOutSemanticStudyRetrievalRepresentationScorer,
} = {}) {
  const input = parseArguments(argv);
  const workflow = createWorkflow({ runArtifacts, runReferenceSet, runResults, runScorer });
  return workflow.complete(input);
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  runHeldOutSemanticStudyRetrievalEvaluationCompletion().then((completion) => {
    process.stdout.write(`${JSON.stringify(completion, null, 2)}\n`);
    if (completion.status.id ===
        HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_EVALUATION_COMPLETION_STATUS_IDS.REVIEWER_CONSENSUS_INCOMPLETE) {
      process.exitCode = 2;
    } else if (completion.status.id !==
               HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_EVALUATION_COMPLETION_STATUS_IDS.COMPLETE) {
      process.exitCode = 1;
    }
  }).catch(() => {
    process.stderr.write('Held-out retrieval evaluation could not complete.\n');
    process.exitCode = 1;
  });
}
