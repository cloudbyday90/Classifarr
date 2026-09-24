/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile } from 'node:fs/promises';
import { jest } from '@jest/globals';
import { validateFrozenPolicyInput, projectFrozenPolicyWorkerInput,
  fingerprintFrozenPolicyInput } from '../../services/operatorCorrectionFrozenPolicyInput.mjs';
import { captureOperatorCorrectionFrozenPolicyInput } from '../../services/operatorCorrectionFrozenPolicyCapture.mjs';
import { buildReleaseDecisionPair } from '../../services/operatorCorrectionReleaseDecisionPair.mjs';
import { runIsolatedReleaseDecisionWorker } from '../../scripts/isolatedReleaseDecisionWorker.mjs';
import { createIsolatedFrozenPolicyScorer } from '../../services/isolatedFrozenPolicyScoring.mjs';

const fixturePath = new URL('../../../../scripts/fixtures/frozen-policy-pair.synthetic-example.json', import.meta.url);
const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));

test('v2 freezes policy, fold profiles, source and sample provenance but removes labels from workers', () => {
  const validated = validateFrozenPolicyInput(structuredClone(fixture));
  const projected = projectFrozenPolicyWorkerInput(validated);
  expect(projected.cases[0].metadata.title).toBe('Synthetic Example');
  expect(projected.folds[0].profiles[0].profile.genre_distribution.Action).toBe(90);
  expect(JSON.stringify(projected)).not.toContain('labelLibraryId');
  expect(fingerprintFrozenPolicyInput(validated)).toMatch(/^[a-f0-9]{64}$/);
  const changed = structuredClone(fixture);
  changed.cases[0].labelLibraryId = 4;
  expect(fingerprintFrozenPolicyInput(changed)).not.toBe(fingerprintFrozenPolicyInput(fixture));
});

test.each(['extra case content', 'duplicate fold', 'invalid distribution', 'policy side channel', 'wrong media',
  'unbounded text'])('v2 rejects %s', kind => {
  const changed = structuredClone(fixture);
  if (kind === 'extra case content') changed.cases[0].tmdbId = 42;
  if (kind === 'duplicate fold') changed.folds.push(changed.folds[0]);
  if (kind === 'invalid distribution') changed.folds[0].profiles[0].profile.genre_distribution.Action = -1;
  if (kind === 'policy side channel') changed.policies[0].database_url = 'private';
  if (kind === 'wrong media') changed.cases[0].metadata.media_type = 'tv';
  if (kind === 'unbounded text') changed.cases[0].metadata.overview = 'x'.repeat(10_001);
  expect(() => validateFrozenPolicyInput(changed)).toThrow();
});

test('capture binds each correction to held-out profiles and strips source IDs', () => {
  const held = new Set(['hash']);
  const source = { fingerprint: 'a'.repeat(64) };
  const prepared = { sampleFingerprint: 'b'.repeat(64), cases: [
    { mediaType: 'movie', foldIndex: 0, itemIdentity: { tmdbId: 42 },
      descriptionHash: 'hash', heldDescriptionHashes: held },
  ] };
  const correctionCohort = { corrections: new Map([['movie:42', { libraryId: 3 }]]),
    source: { policies: fixture.policies } };
  const evidence = { forCase: jest.fn(() => ({ metadata: { ...fixture.cases[0].metadata, tmdb_id: 42 },
    profiles: new Map(fixture.folds[0].profiles.map(row => [row.libraryId, { profile: row.profile }])) })) };
  const input = captureOperatorCorrectionFrozenPolicyInput({ source, prepared, correctionCohort, evidence });
  expect(input.cases[0]).toEqual({ mediaType: 'movie', labelLibraryId: 3, foldIndex: 0,
    metadata: fixture.cases[0].metadata });
  expect(input.eligibleCorrections).toBe(1);
  expect(JSON.stringify(projectFrozenPolicyWorkerInput(input))).not.toContain('42');
  expect(input.folds[0].heldDescriptionFingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(evidence.forCase).toHaveBeenCalledTimes(1);
});

test('v2 worker scores without receiving labels and comparison remains diagnostic', async () => {
  const projected = projectFrozenPolicyWorkerInput(fixture);
  const score = jest.fn(async ({ metadata, profiles }) => {
    expect(metadata.title).toBe('Synthetic Example');
    expect(profiles).toHaveLength(2);
    return { action: 'auto_classify', library: { library_id: 3 } };
  });
  const baseline = await runIsolatedReleaseDecisionWorker({ role: 'baseline', input: projected,
    loadScorer: async () => score });
  const candidate = await runIsolatedReleaseDecisionWorker({ role: 'candidate', input: projected,
    loadScorer: async () => score });
  const pair = buildReleaseDecisionPair({ input: fixture, baselineResult: baseline, candidateResult: candidate,
    candidateCommit: 'd'.repeat(40), token: () => 'e'.repeat(32) });
  expect(pair.report).toMatchObject({ scope: 'frozen_policy_scoring_and_decision_subpath',
    foldProfileInputSchemaVerified: true, eligibleCorrections: 1, sampledCorrectionCoverage: 1,
    fullPipelineAccuracy: null, promotionAllowed: false });
  expect(pair.report.omittedSources).not.toContain('policy_scoring');
});

test('candidate scorer uses the actual installed policy formulas on a frozen case', async () => {
  const loadModule = path => import(path.replace('file:///app/current/src/services/',
    new URL('../../services/', import.meta.url).href));
  const score = await createIsolatedFrozenPolicyScorer('candidate', loadModule);
  const result = await score({ metadata: fixture.cases[0].metadata,
    policies: fixture.policies, profiles: fixture.folds[0].profiles });
  expect(result.ranked).toHaveLength(1);
  expect(result.ranked[0].library_id).toBe(3);
  expect(result.ranked[0].score).toBeGreaterThan(0);
});
