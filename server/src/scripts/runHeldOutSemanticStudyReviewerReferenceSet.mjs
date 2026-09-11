/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import {
  composeHeldOutSemanticStudyReviewerReferenceSet,
} from '../services/heldOutSemanticStudyReviewerReferenceSet.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_INDEPENDENT_REVIEW_CONSENSUS_STATUS_IDS,
} from '../services/policyCandidateSemanticIndependentReviewConsensus.mjs';
import {
  readPrivateStudyJsonFile,
  writePrivateStudyJsonFile,
} from './privateStudyFileBoundary.mjs';

export const HELD_OUT_SEMANTIC_STUDY_REVIEWER_REFERENCE_SET_WORKFLOW_VERSION =
  'policy.held_out_semantic_study_reviewer_reference_set_workflow.v1';

const REQUIRED_OPTION_NAMES = Object.freeze([
  '--packet-file',
  '--reviewer-one-file',
  '--reviewer-two-file',
  '--output-file',
]);
const OPTIONAL_OPTION_NAMES = Object.freeze(['--adjudication-file']);
const SUPPORTED_OPTION_NAMES = new Set([...REQUIRED_OPTION_NAMES, ...OPTIONAL_OPTION_NAMES]);

function parseArguments(argv) {
  if (!Array.isArray(argv) || argv.length < REQUIRED_OPTION_NAMES.length * 2 || argv.length % 2 !== 0) {
    throw new Error('reviewer_reference_set_arguments_invalid');
  }
  const values = Object.create(null);
  for (let index = 0; index < argv.length; index += 2) {
    const optionName = argv[index];
    const optionValue = argv[index + 1];
    if (!SUPPORTED_OPTION_NAMES.has(optionName) || Object.hasOwn(values, optionName) ||
        typeof optionValue !== 'string' || !optionValue || optionValue.startsWith('--')) {
      throw new Error('reviewer_reference_set_arguments_invalid');
    }
    values[optionName] = optionValue;
  }
  if (REQUIRED_OPTION_NAMES.some((optionName) => !values[optionName])) {
    throw new Error('reviewer_reference_set_arguments_invalid');
  }
  return Object.freeze(values);
}

function publicReport(result, referenceSetWritten) {
  return Object.freeze({
    referenceSetWritten,
    status: result.status,
    summary: result.summary,
    version: HELD_OUT_SEMANTIC_STUDY_REVIEWER_REFERENCE_SET_WORKFLOW_VERSION,
  });
}

async function writeOrVerifyReferenceSet(outputFile, document, { readJson, writeJson }) {
  const options = { label: 'Reviewer reference set' };
  try {
    await writeJson(outputFile, document, options);
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    // Consensus was recomputed from the current packet and submissions. Reuse
    // only the exact resulting document, with all existing read protections.
    const existing = await readJson(outputFile, options);
    if (!isDeepStrictEqual(existing, document)) {
      throw Object.assign(new Error('Existing reference set differs from current reviewer consensus.'), {
        code: 'STUDY_REFERENCE_SET_CONFLICT',
      });
    }
  }
}

/**
 * Completes the offline human-review handoff with one packet-bound consensus
 * attempt. It reads and writes only bounded local `.tmp` JSON and prints an
 * aggregate-only receipt. A disagreement never writes a partial reference set.
 * An identical, freshly validated result can be reused after a downstream failure.
 */
export async function runHeldOutSemanticStudyReviewerReferenceSet({
  argv = process.argv.slice(2),
  composeReferenceSet = composeHeldOutSemanticStudyReviewerReferenceSet,
  readJson = readPrivateStudyJsonFile,
  writeJson = writePrivateStudyJsonFile,
} = {}) {
  const values = parseArguments(argv);
  const [packet, reviewerOneSubmission, reviewerTwoSubmission, adjudicationSubmission] = await Promise.all([
    readJson(values['--packet-file'], { label: 'Private reviewer packet' }),
    readJson(values['--reviewer-one-file'], { label: 'Reviewer one submission' }),
    readJson(values['--reviewer-two-file'], { label: 'Reviewer two submission' }),
    values['--adjudication-file']
      ? readJson(values['--adjudication-file'], { label: 'Adjudication submission' })
      : Promise.resolve(null),
  ]);
  const result = composeReferenceSet({
    adjudicationSubmission,
    packet,
    reviewerOneSubmission,
    reviewerTwoSubmission,
  });
  const complete = result.status?.id ===
    POLICY_CANDIDATE_SEMANTIC_INDEPENDENT_REVIEW_CONSENSUS_STATUS_IDS.COMPLETE;
  if (complete) {
    await writeOrVerifyReferenceSet(values['--output-file'], result.referenceSetDocument, { readJson, writeJson });
  }
  return publicReport(result, complete);
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  runHeldOutSemanticStudyReviewerReferenceSet().then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.status.id === POLICY_CANDIDATE_SEMANTIC_INDEPENDENT_REVIEW_CONSENSUS_STATUS_IDS.INVALID) {
      process.exitCode = 1;
    } else if (result.status.id ===
      POLICY_CANDIDATE_SEMANTIC_INDEPENDENT_REVIEW_CONSENSUS_STATUS_IDS.ADJUDICATION_REQUIRED) {
      process.exitCode = 2;
    }
  }).catch(() => {
    process.stderr.write('Held-out reviewer reference-set completion could not run.\n');
    process.exitCode = 1;
  });
}
