/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { runFrozenReleaseRehearsal, formatFrozenRehearsalSummary } from '../../../../scripts/lib/frozenReleaseRehearsal.mjs';
import { withFrozenUpgradeCandidate } from '../../../../scripts/lib/frozenUpgradeCandidate.mjs';
import { upgradeBaseline, PublishedUpgradeProvenanceError } from '../../../../scripts/lib/publishedUpgradeProvenance.mjs';
import { INSTALLATION_CHECKS } from '../../../../scripts/lib/runtimeInstallationEvidence.mjs';
import { SCHEDULED_INSTALLATION_EXPECTED, SCHEDULED_CRASH_RECOVERY } from '../../../../scripts/lib/scheduledInstallationContract.mjs';
import { evidence } from '../fixtures/installationBudget.mjs';

const revision = 'a'.repeat(40);
const imageId = `sha256:${'b'.repeat(64)}`;
const identity = { sourceRevision: revision, worktreeClean: true };
const database = { version: '180006', migrations: 312 };
const success = profile => ({ status: 'passed', scope: 'fresh-and-upgrade', cleanup: 'passed', baseline: upgradeBaseline,
  candidateImageId: imageId, fresh: { status: 'passed', database },
  deployment: { profile, unchanged: true, configurationDigest: 'c'.repeat(64) },
  database: { candidate: database, baseline: { version: '180006', migrations: 222 } },
  scheduler: { fresh: SCHEDULED_INSTALLATION_EXPECTED, upgrade: SCHEDULED_INSTALLATION_EXPECTED },
  crashRecovery: SCHEDULED_CRASH_RECOVERY,
  recovery: { rollback: 'passed', explicitRetry: 'passed', maintenance: 'passed' },
  handoff: { movie: 'current', tv: 'current', music: 'excluded', routingTasks: 0 },
  checks: [...INSTALLATION_CHECKS], resourceBudget: { fresh: evidence(), upgrade: evidence() } });
function harness(options = {}) {
  const candidate = jest.fn(async operation => operation(imageId));
  const drill = jest.fn(async ({ deploymentProfile }) => success(deploymentProfile));
  const source = jest.fn(() => identity);
  const verify = jest.fn();
  return { candidate, drill, source, verify, report: jest.fn(), ...options };
}

test('builds once, tests all fixed profiles with one image and mandatory limits, and sanitizes evidence', async () => {
  const input = harness({ noCache: true });
  const result = await runFrozenReleaseRehearsal(input);
  expect(result).toMatchObject({ status: 'passed', sourceRevision: revision, worktreeClean: true,
    candidateImageId: imageId, candidateCleanup: 'passed', failureStage: null, buildCache: 'disabled' });
  expect(input.verify).toHaveBeenCalledTimes(1);
  expect(input.candidate).toHaveBeenCalledTimes(1);
  expect(input.candidate.mock.calls[0][1]).toEqual({ noCache: true, sourceRevision: revision });
  expect(input.drill.mock.calls.map(([args]) => args)).toEqual(['standard', 'unraid', 'custom'].map(deploymentProfile => ({
    deploymentProfile, candidateImageId: imageId, resourceBudget: true,
  })));
  expect(input.source).toHaveBeenCalledTimes(8);
  expect(result.profiles.every(row => row.checks.length === 12 && row.status === 'passed')).toBe(true);
  expect(formatFrozenRehearsalSummary(result)).toContain('not a real Unraid host');
});

test.each([false, 'false', undefined])('refuses unclean/unverified source %s before building', async worktreeClean => {
  const input = harness({ source: () => ({ ...identity, worktreeClean }) });
  expect((await runFrozenReleaseRehearsal(input)).status).toBe('blocked');
  expect(input.candidate).not.toHaveBeenCalled();
});

test('malformed source, invalid cache input and provenance failure do not build', async () => {
  for (const override of [{ source: () => ({ ...identity, sourceRevision: 'private-value' }) }, { noCache: 'yes' },
    { verify: () => { throw new PublishedUpgradeProvenanceError('authentication_failed', 'stored_cli'); } }]) {
    const input = harness(override);
    const receipt = await runFrozenReleaseRehearsal(input);
    expect(receipt.status).toBe('blocked');
    expect(input.candidate).not.toHaveBeenCalled();
    expect(JSON.stringify(receipt)).not.toContain('private-value');
  }
});

test.each([2, 3, 4, 5, 6, 7, 8])('source change at boundary %i blocks entire acceptance', async boundary => {
  let calls = 0;
  const input = harness({ source: () => ++calls === boundary ? { ...identity, sourceRevision: 'd'.repeat(40) } : identity });
  const receipt = await runFrozenReleaseRehearsal(input);
  expect(receipt).toMatchObject({ status: 'blocked', failureStage: 'source', worktreeClean: false });
});

test.each([
  ['mutable image', r => { r.candidateImageId = 'classifarr:latest'; }],
  ['different immutable image', r => { r.candidateImageId = `sha256:${'e'.repeat(64)}`; }],
  ['different profile', r => { r.deployment.profile = 'custom'; }],
  ['missing profile', r => { delete r.deployment; }],
  ['changed settings', r => { r.deployment.unchanged = false; }],
  ['missing checks', r => { r.checks.pop(); }],
  ['missing budget', r => { delete r.resourceBudget; }],
  ['failed cleanup', r => { r.cleanup = 'failed'; }],
  ['wrong baseline', r => { r.baseline = {}; }],
  ['routing occurred', r => { r.handoff.routingTasks = 1; }],
])('rejects %s without executing the next profile', async (_name, mutate) => {
  const input = harness({ drill: jest.fn(async ({ deploymentProfile }) => {
    const result = success(deploymentProfile); mutate(result); return result;
  }) });
  const receipt = await runFrozenReleaseRehearsal(input);
  expect(receipt).toMatchObject({ status: 'blocked', failureStage: 'evidence' });
  expect(input.drill).toHaveBeenCalledTimes(1);
});

test('different schema across profiles blocks acceptance and retains only verified partial evidence', async () => {
  const input = harness({ drill: async ({ deploymentProfile }) => {
    const result = success(deploymentProfile);
    if (deploymentProfile === 'unraid') result.database.baseline = { ...result.database.baseline, migrations: 221 };
    return result;
  } });
  const receipt = await runFrozenReleaseRehearsal(input);
  expect(receipt.status).toBe('blocked');
  expect(receipt.profiles.map(row => row.status)).toEqual(['passed', 'not_verified', 'not_verified']);
});

test('raw result and exception data never enter receipts; scenario stage is classified', async () => {
  const successInput = harness({ drill: async ({ deploymentProfile }) => ({ ...success(deploymentProfile), secret: 'private-value' }) });
  const failureInput = harness({ drill: async () => { throw new Error('private-value'); } });
  for (const input of [successInput, failureInput]) {
    const receipt = await runFrozenReleaseRehearsal(input);
    expect(JSON.stringify(receipt)).not.toContain('private-value');
  }
  expect(await runFrozenReleaseRehearsal(harness({ drill: async () => {
    throw new Error('published_upgrade_failed:restore_interrupt');
  } }))).toMatchObject({ status: 'blocked', failureStage: 'standard', scenarioFailureStage: 'restore_interrupt' });
});

test('image cleanup failure blocks acceptance after all profiles pass', async () => {
  const input = harness({ candidate: async operation => {
    await operation(imageId); throw new Error('frozen_candidate_cleanup_failed');
  } });
  expect(await runFrozenReleaseRehearsal(input)).toMatchObject({ status: 'blocked', failureStage: 'cleanup', candidateCleanup: 'not_verified' });
});

function dockerHarness(override = () => undefined) {
  const run = jest.fn((_cmd, args) => override(args) ?? ({ status: 0,
    stdout: args[1] === 'inspect' ? (args.includes('{{.Id}}') ? imageId : revision) : '' }));
  return { run, random: size => Buffer.alloc(size, 1), sourceRevision: revision };
}

test('candidate owner bounds commands, builds once, deletes only its tag and waits for all scenarios', async () => {
  const input = dockerHarness();
  let during = false;
  await withFrozenUpgradeCandidate(async candidateId => {
    expect(candidateId).toBe(imageId);
    during = true;
    expect(input.run.mock.calls.some(([, args]) => args[1] === 'rm')).toBe(false);
  }, { ...input, noCache: true });
  expect(during).toBe(true);
  const args = input.run.mock.calls.map(([, command]) => command);
  expect(args.filter(command => command[0] === 'build')).toHaveLength(1);
  expect(args[1]).toContain('--no-cache');
  expect(args[1]).toContain(`VCS_REF=${revision}`);
  expect(args.at(-2)).toEqual(['image', 'rm', `classifarr-release-rehearsal-${'01'.repeat(16)}:candidate`]);
  expect(args.some(command => command.includes('prune') || (command[1] === 'rm' && command.includes(imageId)))).toBe(false);
  for (const [, , options] of input.run.mock.calls) {
    expect(options).toMatchObject({ shell: false, windowsHide: true });
    expect(options.timeout).toBeGreaterThan(0);
    expect(options.maxBuffer).toBeLessThanOrEqual(8 * 1024 * 1024);
  }
});

test('existing tag collision never grants cleanup authority', async () => {
  const input = dockerHarness(() => ({ status: 0, stdout: 'existing' }));
  await expect(withFrozenUpgradeCandidate(jest.fn(), input)).rejects.toThrow('frozen_candidate_collision');
  expect(input.run).toHaveBeenCalledTimes(1);
});

test.each(['build', 'inspect', 'operation'])('cleans owned tag after %s failure without command output', async phase => {
  const input = dockerHarness(args => args.includes(phase) ? { status: 1, stdout: 'private-value' } : undefined);
  await expect(withFrozenUpgradeCandidate(async () => { throw new Error('scenario_failed'); }, input)).rejects.toThrow();
  expect(input.run.mock.calls.some(([, args]) => args[1] === 'rm')).toBe(true);
});

test('tag cleanup failure takes precedence over scenario success or failure', async () => {
  for (const fail of [false, true]) {
    const input = dockerHarness(args => args[1] === 'rm' ? { status: 1, error: new Error('private-value'), stdout: '' } : undefined);
    await expect(withFrozenUpgradeCandidate(async () => { if (fail) throw new Error('private-value'); }, input))
      .rejects.toThrow('frozen_candidate_cleanup_failed');
  }
});

test('refuses invalid identity or cache mode before invoking Docker', async () => {
  const input = dockerHarness();
  await expect(withFrozenUpgradeCandidate(jest.fn(), { ...input, random: () => Buffer.alloc(0) })).rejects.toThrow('invalid_rehearsal_identity');
  await expect(withFrozenUpgradeCandidate(jest.fn(), { ...input, noCache: 'true' })).rejects.toThrow('invalid_rehearsal_cache_mode');
  await expect(withFrozenUpgradeCandidate(jest.fn(), { ...input, sourceRevision: 'bad' })).rejects.toThrow('invalid_rehearsal_source');
  expect(input.run).not.toHaveBeenCalled();
});

test('wrong built source label blocks scenarios and cleans only its own tag', async () => {
  const input = dockerHarness(args => args.some(arg => arg.includes('org.opencontainers.image.revision'))
    ? { status: 0, stdout: 'unknown' } : undefined);
  const operation = jest.fn();
  await expect(withFrozenUpgradeCandidate(operation, input)).rejects.toThrow('frozen_candidate_revision_mismatch');
  expect(operation).not.toHaveBeenCalled();
  expect(input.run.mock.calls.some(([, args]) => args[1] === 'rm')).toBe(true);
});
