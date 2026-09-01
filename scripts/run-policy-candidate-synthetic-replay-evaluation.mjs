/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { readFile } from 'node:fs/promises';

import {
  evaluatePolicyCandidateSyntheticReplayFixtureCorpus,
  POLICY_CANDIDATE_SYNTHETIC_REPLAY_EVALUATION_STATUS_IDS,
} from '../server/src/services/policyCandidateSyntheticReplayEvaluation.mjs';

const FIXTURE_CORPUS_URL = new URL(
  './fixtures/policy-candidate-synthetic-replay.fixtures.json',
  import.meta.url,
);

async function main() {
  const corpus = JSON.parse(await readFile(FIXTURE_CORPUS_URL, 'utf8'));
  const evaluation = evaluatePolicyCandidateSyntheticReplayFixtureCorpus(corpus);
  const report = Object.freeze({
    authority: evaluation.authority,
    evaluation: Object.freeze({
      fixtureCorpusVersion: evaluation.fixtureCorpusVersion,
      statusId: evaluation.statusId,
      summary: evaluation.summary,
      validation: evaluation.validation,
      version: evaluation.version,
    }),
    version: 'policy.candidate_synthetic_replay_evaluation_run.v1',
  });

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (evaluation.statusId !== POLICY_CANDIDATE_SYNTHETIC_REPLAY_EVALUATION_STATUS_IDS.PASSED) {
    process.exitCode = 1;
  }
}

main().catch(() => {
  process.stderr.write('Offline synthetic policy-candidate replay evaluation could not run.\n');
  process.exitCode = 1;
});
