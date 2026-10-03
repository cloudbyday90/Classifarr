/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { runInstallationWithRouting } from '../../../../scripts/lib/installationRoutingAcceptance.mjs';
import { withRoutingBaseline } from '../../../../scripts/lib/routingBaselineCandidate.mjs';
import { routingRehearsalEvidence } from '../../../../scripts/lib/routingRehearsalEvidence.mjs';
import { validateRuntimeInstallationGate } from '../../../../scripts/lib/runtimeInstallationGate.mjs';
import { ROUTING_BASELINE } from '../../../../scripts/lib/manualRoutingRehearsalDocker.mjs';
import { ROUTING_EXPECTED } from '../../../../scripts/lib/manualRoutingRehearsal.mjs';
import { INSTALLATION_CHECKS } from '../../../../scripts/lib/runtimeInstallationEvidence.mjs';
import { upgradeBaseline } from '../../../../scripts/lib/publishedUpgradeProvenance.mjs';
import { runRuntimeInstallationAcceptance } from '../../../../scripts/run-runtime-installation-acceptance.mjs';
import { installationBudgetEvidence } from '../../scripts/installationBudgetContract.mjs';
import { evidence as budgetFixture } from '../fixtures/installationBudget.mjs';

const sourceRevision = 'a'.repeat(40), candidateImageId = `sha256:${'b'.repeat(64)}`, baselineImageId = `sha256:${'c'.repeat(64)}`;
const expected = { sourceRevision, candidateImageId, runId: '12345', runAttempt: '2', now: Date.parse('2026-10-03T12:00:00.000Z') };
const rehearsal = () => ({ status: 'passed', candidate: candidateImageId, baseline: baselineImageId,
  checks: Object.keys(ROUTING_EXPECTED), ...ROUTING_EXPECTED.complete, cleanup: 'passed' });
const receipt = () => ({ schemaVersion: 'classifarr.runtime-installation-acceptance.v4', status: 'passed', failureStage: null,
  sourceRevision, candidateImageId, worktreeClean: true, completedAt: '2026-10-03T11:59:00.000Z',
  workflow: { runId: expected.runId, runAttempt: expected.runAttempt }, cleanup: 'passed', baseline: { ...upgradeBaseline },
  database: { fresh: { version: '180006', migrations: 315 }, candidate: { version: '180006', migrations: 315 }, baseline: { version: '180006', migrations: 222 } },
  checks: INSTALLATION_CHECKS.map(id => ({ id, status: 'passed' })), routing: routingRehearsalEvidence(rehearsal(), expected) });

test('same-run gate accepts bounded same-image proof', () => {
  expect(validateRuntimeInstallationGate(receipt(), expected)).toEqual({ status: 'passed', sourceRevision, candidateImageId });
});

test('optional budget receipt is revalidated after serialization', () => {
  const value = receipt();
  value.resourceBudget = { status: 'passed', fresh: installationBudgetEvidence(budgetFixture()),
    upgrade: installationBudgetEvidence(budgetFixture()) };
  expect(validateRuntimeInstallationGate(JSON.parse(JSON.stringify(value)), expected).status).toBe('passed');
});

test.each([
  ['missing', () => null],
  ['old schema', r => { r.schemaVersion = 'classifarr.runtime-installation-acceptance.v3'; }],
  ['blocked', r => { r.status = 'blocked'; }],
  ['contradictory failure', r => { r.failureStage = 'routing_rehearsal'; }],
  ['provenance failure', r => { r.provenanceFailure = {}; }],
  ['dirty source', r => { r.worktreeClean = false; }],
  ['wrong source', r => { r.sourceRevision = 'd'.repeat(40); }],
  ['wrong image', r => { r.candidateImageId = `sha256:${'d'.repeat(64)}`; }],
  ['wrong run', r => { r.workflow.runId = '12346'; }],
  ['old attempt', r => { r.workflow.runAttempt = '1'; }],
  ['missing workflow', r => { delete r.workflow; }],
  ['missing date', r => { delete r.completedAt; }],
  ['old date', r => { r.completedAt = '2026-10-03T05:59:59.000Z'; }],
  ['future date', r => { r.completedAt = '2026-10-03T12:05:01.000Z'; }],
  ['cleanup failed', r => { r.cleanup = 'failed'; }],
  ['wrong published baseline', r => { r.baseline.revision = sourceRevision; }],
  ['missing installation check', r => { r.checks.pop(); }],
  ['failed installation check', r => { r.checks[0].status = 'not_verified'; }],
  ['different fresh schema', r => { r.database.fresh.migrations = 314; }],
  ['no upgrade', r => { r.database.baseline.migrations = 315; }],
  ['missing routing', r => { delete r.routing; }],
  ['wrong routing image', r => { r.routing.candidateImageId = baselineImageId; }],
  ['wrong routing source', r => { r.routing.sourceRevision = 'd'.repeat(40); }],
  ['wrong routing baseline', r => { r.routing.baseline.revision = sourceRevision; }],
  ['mutable routing baseline', r => { r.routing.baseline.imageId = 'latest'; }],
  ['same-image routing', r => { r.routing.baseline.imageId = candidateImageId; }],
  ['missing routing phase', r => { r.routing.checks.pop(); }],
  ['duplicate routing phase', r => { r.routing.checks[0] = r.routing.checks[1]; }],
  ['provider write', r => { r.routing.providerWrites = 1; }],
  ['extra request', r => { r.routing.movieGets = 3; }],
  ['no TV repair', r => { r.routing.tvGets = 1; }],
  ['changed history', r => { r.routing.historyPreserved = false; }],
  ['legacy enrollment', r => { r.routing.legacyNotEnrolled = false; }],
  ['routing cleanup', r => { r.routing.cleanup = 'failed'; }],
  ['raw routing data', r => { r.routing.secret = 'private'; }],
  ['missing budget proof', r => { r.resourceBudget = { status: 'passed' }; }],
])('gate rejects %s evidence', (_name, mutate) => {
  const value = receipt();
  const replacement = mutate(value);
  expect(() => validateRuntimeInstallationGate(replacement === null ? null : value, expected)).toThrow();
});

test.each(['sourceRevision', 'candidateImageId', 'runId', 'runAttempt', 'now'])('caller must supply valid expected %s', key => {
  expect(() => validateRuntimeInstallationGate(receipt(), { ...expected, [key]: null })).toThrow();
});

function harness() {
  return { verify: jest.fn(), candidate: jest.fn(async operation => operation(candidateImageId)),
    baseline: jest.fn(async operation => operation(baselineImageId)),
    installation: jest.fn(async () => ({ candidateImageId })), routing: jest.fn(async () => rehearsal()) };
}

test('builds one source-bound candidate, borrowing it for both drills', async () => {
  const tools = harness();
  const value = await runInstallationWithRouting({ sourceRevision, resourceBudget: true }, tools);
  expect(tools.candidate.mock.calls[0][1]).toEqual({ sourceRevision });
  expect(tools.installation).toHaveBeenCalledWith({ candidateImageId, resourceBudget: true });
  expect(tools.routing).toHaveBeenCalledWith({ baseline: baselineImageId, candidate: candidateImageId });
  expect(value.routing).toEqual(routingRehearsalEvidence(rehearsal(), expected));
  expect(tools.verify.mock.invocationCallOrder[0]).toBeLessThan(tools.candidate.mock.invocationCallOrder[0]);
});

test('provenance failure prevents builds', async () => {
  const tools = harness(); tools.verify.mockImplementation(() => { throw new Error('provenance_failed'); });
  await expect(runInstallationWithRouting({ sourceRevision }, tools)).rejects.toThrow('provenance_failed');
  expect(tools.candidate).not.toHaveBeenCalled();
});

test.each(['baseline', 'routing', 'candidateCleanup', 'baselineCleanup', 'wrongInstallation', 'wrongRouting'])('blocks %s and releases owned candidate', async failure => {
  const tools = harness(); let cleaned = false;
  tools.candidate = async operation => {
    try { return await operation(candidateImageId); } finally {
      cleaned = true;
      if (failure === 'candidateCleanup') throw new Error('frozen_candidate_cleanup_failed');
    }
  };
  if (failure === 'baseline') tools.baseline.mockRejectedValue(new Error('private'));
  if (failure === 'routing') tools.routing.mockRejectedValue(new Error('private'));
  if (failure === 'baselineCleanup') tools.baseline.mockImplementation(async operation => {
    await operation(baselineImageId); throw new Error('routing_baseline_cleanup_failed');
  });
  if (failure === 'wrongInstallation') tools.installation.mockResolvedValue({ candidateImageId: baselineImageId });
  if (failure === 'wrongRouting') tools.routing.mockResolvedValue({ ...rehearsal(), candidate: baselineImageId });
  await expect(runInstallationWithRouting({ sourceRevision }, tools)).rejects.toThrow();
  expect(cleaned).toBe(true);
});

function baselineHarness({ collision = false, retained = false, revision = ROUTING_BASELINE, fail } = {}) {
  let built = false;
  const run = jest.fn((binary, args) => {
    if (binary === 'git' && args[0] === 'rev-parse') return { status: 0, stdout: revision };
    if (binary === fail) return { status: 1, stdout: 'private', stderr: 'private' };
    if (binary === 'docker') {
      if (args[0] === 'build') built = true;
      if (args[1] === 'ls') return { status: 0, stdout: collision || (built && retained) ? 'occupied' : '' };
      if (args[1] === 'inspect') return { status: 0, stdout: args.includes('{{.Id}}') ? baselineImageId : revision };
    }
    return { status: 0, stdout: '' };
  });
  return { run, random: size => Buffer.alloc(size, 7) };
}

test('fixed baseline archive is shell-free, cleaned, and never switches branches or deletes by ID', async () => {
  const input = baselineHarness();
  expect(await withRoutingBaseline(async id => id, input)).toBe(baselineImageId);
  const calls = input.run.mock.calls;
  const archive = calls.find(([bin, args]) => bin === 'git' && args[0] === 'archive')[1];
  expect(archive.at(-1)).toBe(ROUTING_BASELINE);
  expect(existsSync(dirname(archive.find(arg => arg.startsWith('--output=')).slice(9)))).toBe(false);
  expect(calls.every(([, , options]) => options.shell === false && options.timeout <= 1_200_000)).toBe(true);
  expect(calls.filter(([bin, args]) => bin === 'docker' && args[1] === 'rm').map(([, args]) => args[2]))
    .toEqual([`classifarr-routing-baseline-${'07'.repeat(16)}:baseline`]);
  expect(calls.some(([, args]) => args.includes('checkout') || args.includes('fetch') || args.includes('prune'))).toBe(false);
});

test.each([{ collision: true }, { revision: 'unknown' }])('baseline preflight failure never deletes or builds (%j)', async options => {
  const input = baselineHarness(options);
  await expect(withRoutingBaseline(jest.fn(), input)).rejects.toThrow();
  expect(input.run.mock.calls.some(([, args]) => args.includes('rm') || args.includes('build'))).toBe(false);
});

test.each([{ retained: true }, { fail: 'tar' }])('baseline cleanup and extraction failures fail closed (%j)', async options => {
  const input = baselineHarness(options);
  await expect(withRoutingBaseline(jest.fn(), input)).rejects.toThrow(/routing_baseline_(cleanup|command)_failed/);
});

test.each([null, {}, { runId: 12345, runAttempt: '2' }, { runId: '12345', runAttempt: '0' },
  { runId: 'private', runAttempt: '1' }])('invalid CI run identity blocks before any build (%j)', async workflow => {
  const drill = jest.fn();
  const result = await runRuntimeInstallationAcceptance({ ci: true, workflow, expectedRevision: sourceRevision,
    source: () => ({ sourceRevision, worktreeClean: true }), drill, save: () => {} });
  expect(result.status).toBe('blocked'); expect(drill).not.toHaveBeenCalled();
});
