/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  evaluatePolicyCandidateSyntheticReplayFixtureCorpus,
  POLICY_CANDIDATE_SYNTHETIC_REPLAY_EVALUATION_STATUS_IDS,
} from '../../services/policyCandidateSyntheticReplayEvaluation.mjs';

const FIXTURE_CORPUS_URL = new URL(
  '../../../../scripts/fixtures/policy-candidate-synthetic-replay.fixtures.json',
  import.meta.url,
);
const FIXTURE_CORPUS = JSON.parse(await readFile(FIXTURE_CORPUS_URL, 'utf8'));
const REPLAY_RUNNER = fileURLToPath(new URL('../../../../scripts/run-policy-candidate-synthetic-replay-evaluation.mjs', import.meta.url));

describe('policy candidate synthetic replay evaluation', () => {
  test('runs the offline entry point with package resolution disabled', () => {
    const localModulesOnly = `
      import { isBuiltin, registerHooks } from 'node:module';
      registerHooks({
        resolve(specifier, context, nextResolve) {
          if (!isBuiltin(specifier) && !/^(?:\\.\\.?\\/|file:)/.test(specifier)) {
            throw new Error('Offline replay imported a package: ' + specifier);
          }
          return nextResolve(specifier, context);
        },
      });
    `;
    const result = spawnSync(process.execPath, [
      '--import', `data:text/javascript,${encodeURIComponent(localModulesOnly)}`, REPLAY_RUNNER,
    ], { encoding: 'utf8', timeout: 10_000, maxBuffer: 64 * 1024, env: { ...process.env, NODE_OPTIONS: '' } });

    expect(result.error).toBeUndefined();
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      evaluation: { statusId: 'passed', summary: { fixtureCount: 8, matchedExpectationCount: 8, mismatchCount: 0 } },
      authority: { automaticActions: { aiInvocation: false, persistence: false, routing: false } },
    });
  });

  test('passes the checked-in corpus without emitting fixture detail', () => {
    const result = evaluatePolicyCandidateSyntheticReplayFixtureCorpus(FIXTURE_CORPUS);

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_CANDIDATE_SYNTHETIC_REPLAY_EVALUATION_STATUS_IDS.PASSED,
      summary: {
        fixtureCount: 8,
        matchedExpectationCount: 8,
        mismatchCount: 0,
        proposedLeadingCandidateChangedCount: 5,
      },
    }));
    expect(JSON.stringify(result)).not.toContain('broad-evidence-yields-to-specialized-evidence');
    expect(JSON.stringify(result)).not.toContain('candidateId');
  });

  test('reports only aggregate mismatch counts', () => {
    const corpus = JSON.parse(JSON.stringify(FIXTURE_CORPUS));
    corpus.fixtures[0].expected.proposedActionId = 'manual';

    const result = evaluatePolicyCandidateSyntheticReplayFixtureCorpus(corpus);

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_CANDIDATE_SYNTHETIC_REPLAY_EVALUATION_STATUS_IDS.EXPECTATION_MISMATCH,
      summary: expect.objectContaining({ fixtureCount: 8, matchedExpectationCount: 7, mismatchCount: 1 }),
    }));
    expect(JSON.stringify(result)).not.toContain(corpus.fixtures[0].id);
  });

  test('fails closed before projection when a corpus contains an unknown field', () => {
    const corpus = JSON.parse(JSON.stringify(FIXTURE_CORPUS));
    corpus.fixtures[0].proposedCandidates[0].providerResponse = 'untrusted';

    const result = evaluatePolicyCandidateSyntheticReplayFixtureCorpus(corpus);

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_CANDIDATE_SYNTHETIC_REPLAY_EVALUATION_STATUS_IDS.INVALID_FIXTURE_CORPUS,
      summary: {
        fixtureCount: 0,
        matchedExpectationCount: 0,
        mismatchCount: 0,
        proposedLeadingCandidateChangedCount: 0,
      },
      validation: expect.objectContaining({ ok: false }),
    }));
  });
});
