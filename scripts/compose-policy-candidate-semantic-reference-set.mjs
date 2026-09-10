/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { resolve } from 'node:path';

import {
  composePolicyCandidateSemanticIndependentReviewConsensus,
  POLICY_CANDIDATE_SEMANTIC_INDEPENDENT_REVIEW_CONSENSUS_STATUS_IDS,
} from '../server/src/services/policyCandidateSemanticIndependentReviewConsensus.mjs';
import {
  loadPolicyCandidateSemanticIndependentReviewInputs,
} from './lib/policy-candidate-semantic-independent-review-inputs.mjs';
import { writeProjectTemporaryJsonFile } from './lib/project-temporary-json-output.mjs';

function publicReport(result, outputWritten) {
  return Object.freeze({
    authority: result.authority,
    outputWritten,
    referenceSetFingerprint: result.referenceSetFingerprint,
    status: result.status,
    summary: result.summary,
    version: result.version,
  });
}

/**
 * Creates a reference-set file only after all redacted review evidence reaches
 * complete consensus. The emitted report deliberately omits paths, fixture
 * IDs, raw reviewer decisions, case text, and reviewer information.
 */
export async function composePolicyCandidateSemanticReferenceSet({ argv = process.argv.slice(2) } = {}) {
  const inputs = await loadPolicyCandidateSemanticIndependentReviewInputs({ argv });
  const result = composePolicyCandidateSemanticIndependentReviewConsensus(inputs);
  if (result.status.id !== POLICY_CANDIDATE_SEMANTIC_INDEPENDENT_REVIEW_CONSENSUS_STATUS_IDS.COMPLETE) {
    return publicReport(result, false);
  }
  await writeProjectTemporaryJsonFile(inputs.outputFile, result.referenceSetDocument);
  return publicReport(result, true);
}

async function main() {
  const report = await composePolicyCandidateSemanticReferenceSet();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status.id === POLICY_CANDIDATE_SEMANTIC_INDEPENDENT_REVIEW_CONSENSUS_STATUS_IDS.INVALID) {
    process.exitCode = 1;
  } else if (report.status.id ===
    POLICY_CANDIDATE_SEMANTIC_INDEPENDENT_REVIEW_CONSENSUS_STATUS_IDS.ADJUDICATION_REQUIRED) {
    process.exitCode = 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  main().catch(() => {
    process.stderr.write('Independent review reference-set composition could not run.\n');
    process.exitCode = 1;
  });
}
