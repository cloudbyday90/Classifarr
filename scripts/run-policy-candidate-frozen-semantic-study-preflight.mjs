/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { resolve } from 'node:path';

import {
  POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_STATUS_IDS,
} from '../server/src/services/policyCandidateFrozenSemanticStudyContract.mjs';
import {
  preflightPolicyCandidateFrozenSemanticStudy,
} from '../server/src/services/policyCandidateFrozenSemanticStudy.mjs';
import {
  loadPolicyCandidateFrozenSemanticStudyInputs,
} from './lib/policy-candidate-frozen-semantic-study-inputs.mjs';

export async function runPolicyCandidateFrozenSemanticStudyPreflight(argv = process.argv.slice(2)) {
  const inputs = await loadPolicyCandidateFrozenSemanticStudyInputs({ argv });
  return preflightPolicyCandidateFrozenSemanticStudy(inputs);
}

async function main() {
  const report = await runPolicyCandidateFrozenSemanticStudyPreflight();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status.id === POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_STATUS_IDS.INVALID_STUDY) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  main().catch(() => {
    process.stderr.write('Frozen semantic-study preflight could not run.\n');
    process.exitCode = 1;
  });
}
