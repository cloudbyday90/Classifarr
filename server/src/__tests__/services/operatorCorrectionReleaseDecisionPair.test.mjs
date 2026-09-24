/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { BASELINE_COMMIT } from '../../scripts/pinnedReleaseSchema.mjs';
import { validateReleaseDecisionInput, projectReleaseDecisionWorkerInput,
  fingerprintReleaseDecisionInput } from '../../services/operatorCorrectionReleaseDecisionInput.mjs';
import { buildReleaseDecisionPair } from '../../services/operatorCorrectionReleaseDecisionPair.mjs';
import { runIsolatedReleaseDecisionWorker } from '../../scripts/isolatedReleaseDecisionWorker.mjs';
import { buildIsolatedDecisionDockerArgs,
  runIsolatedReleaseDecisionPair } from '../../../../scripts/run-isolated-release-decision-pair.mjs';

const commit = 'c'.repeat(40);
const input = { version: 1, cases: [
  { mediaType: 'movie', labelLibraryId: 3, candidates: [
    { policyId: 1, libraryId: 3, score: 92, viability: 'identity_evidence',
      autoThreshold: 85, promptThreshold: 60 },
    { policyId: 2, libraryId: 4, score: 65, viability: 'compatibility_only',
      autoThreshold: 85, promptThreshold: 60 },
  ] },
  { mediaType: 'tv', labelLibraryId: 5, candidates: [
    { policyId: 3, libraryId: 5, score: 42, viability: 'profile_only',
      autoThreshold: 85, promptThreshold: 60 },
  ] },
] };
const outcomes = (role, destination) => ({ version: 1, role, cases: [
  { index: 0, statusId: 'destination', destinationLibraryId: destination },
  { index: 1, statusId: 'abstained', destinationLibraryId: null },
] });

test('strict private input is hashed from content and labels never reach the worker', () => {
  const validated = validateReleaseDecisionInput(input);
  const worker = projectReleaseDecisionWorkerInput(validated);
  expect(worker.cases[0].candidates[0].score).toBe(92);
  expect(JSON.stringify(worker)).not.toContain('labelLibraryId');
  expect(fingerprintReleaseDecisionInput(validated)).toMatch(/^[a-f0-9]{64}$/);
  expect(fingerprintReleaseDecisionInput({ ...input, cases: [
    { ...input.cases[0], labelLibraryId: 4 }, input.cases[1] ] })).not.toBe(fingerprintReleaseDecisionInput(input));
});

test.each(['extra_field', 'duplicate_policy', 'invalid_score', 'invalid_threshold', 'invalid_viability'])(
  'rejects unsafe or ambiguous input: %s', kind => {
    const changed = structuredClone(input);
    if (kind === 'extra_field') changed.cases[0].title = 'Private title';
    if (kind === 'duplicate_policy') changed.cases[0].candidates[1].policyId = 1;
    if (kind === 'invalid_score') changed.cases[0].candidates[0].score = Infinity;
    if (kind === 'invalid_threshold') changed.cases[0].candidates[0].promptThreshold = 95;
    if (kind === 'invalid_viability') changed.cases[0].candidates[0].viability = 'unknown';
    expect(() => validateReleaseDecisionInput(changed)).toThrow();
  });

test('executed results pair exact case indexes without promoting decision replay to accuracy', () => {
  const tokens = ['1'.repeat(32), '2'.repeat(32)];
  const paired = buildReleaseDecisionPair({ input, baselineResult: outcomes('baseline', 4),
    candidateResult: outcomes('candidate', 3), candidateCommit: commit, token: () => tokens.shift() });
  expect(paired.baselineBundle.commit).toBe(BASELINE_COMMIT);
  expect(paired.candidateBundle.frozenInputFingerprint).toBe(paired.baselineBundle.frozenInputFingerprint);
  expect(paired.report).toMatchObject({ scope: 'policy_decision_subpath_only', sampled: 2,
    fullPipelineAccuracy: null, promotionAllowed: false,
    media: { movie: { gains: 1, regressions: 0 }, tv: { candidateAbstentions: 1 } } });
  expect(JSON.stringify(paired.report)).not.toContain('11111111111111111111111111111111');
});

test.each(['duplicate_index', 'missing_case', 'extra_field', 'invalid_status'])(
  'refuses malformed worker result: %s', kind => {
    const result = outcomes('candidate', 3);
    if (kind === 'duplicate_index') result.cases[1].index = 0;
    if (kind === 'missing_case') result.cases.pop();
    if (kind === 'extra_field') result.cases[0].title = 'Leak';
    if (kind === 'invalid_status') result.cases[0].statusId = 'auto_route';
    expect(() => buildReleaseDecisionPair({ input, baselineResult: outcomes('baseline', 4),
      candidateResult: result, candidateCommit: commit })).toThrow();
  });

test('worker does not count review prompts as routes and drops private errors', async () => {
  const seen = [];
  const fake = { evaluateItem: async (item, options, deps) => {
    seen.push({ item, options, policies: await deps.getActivePolicies() });
    if (item.media_type === 'tv') throw new Error('Private failure title');
    return { action: 'prompt_confirm', topCandidate: { library_id: 3 } };
  } };
  const result = await runIsolatedReleaseDecisionWorker({ role: 'baseline',
    input: projectReleaseDecisionWorkerInput(input), loadEvaluator: async () => fake });
  expect(result.cases).toEqual([
    { index: 0, statusId: 'safety_blocked', destinationLibraryId: null },
    { index: 1, statusId: 'failed', destinationLibraryId: null },
  ]);
  expect(JSON.stringify(seen)).not.toContain('labelLibraryId');
  expect(JSON.stringify(result)).not.toContain('Private failure');
});

test('both container roles are offline, read-only, non-root and mount source read-only', () => {
  for (const role of ['baseline', 'candidate']) {
    const args = buildIsolatedDecisionDockerArgs({ role, stageSource: '/private/release/server/src',
      imageId: `sha256:${'a'.repeat(64)}` });
    expect(args).toEqual(expect.arrayContaining(['--network', 'none', '--read-only', '--cap-drop',
      'ALL', '--user', '65534:65534', '--pull=never']));
    expect(args.filter(value => value.startsWith('type=bind,'))).toHaveLength(2);
    expect(args.filter(value => value.startsWith('type=bind,'))).toEqual(expect.arrayContaining([
      expect.stringContaining('target=/app/release/server/src,readonly'),
      expect.stringContaining('target=/app/current/src,readonly'),
    ]));
    expect(args).not.toContain('--privileged');
    expect(args.at(-1)).toBe(role);
  }
});

test('runner refuses an unverified checkout before reading private input or invoking Docker', async () => {
  const loadInput = jest.fn();
  const execute = jest.fn();
  await expect(runIsolatedReleaseDecisionPair({ inputFile: '.tmp/private.json',
    check: () => { throw new Error('release_decision_checkout_dirty'); }, loadInput, execute }))
    .rejects.toThrow('release_decision_checkout_dirty');
  expect(loadInput).not.toHaveBeenCalled();
  expect(execute).not.toHaveBeenCalled();
});
