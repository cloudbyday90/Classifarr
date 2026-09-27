/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { upgradeBaseline } from '../../../../scripts/lib/publishedUpgradeCompose.mjs';
import { INSTALLATION_CHECKS, createRuntimeInstallationReceipt, formatRuntimeInstallationSummary,
  installationFailureStage } from '../../../../scripts/lib/runtimeInstallationReceipt.mjs';
import { readInstallationSource, runRuntimeInstallationAcceptance } from '../../../../scripts/run-runtime-installation-acceptance.mjs';

const revision = 'a'.repeat(40);
const identity = { sourceRevision: revision, worktreeClean: true };
const db = { version: '180006', migrations: 286 };
const success = () => ({ status: 'passed', cleanup: 'passed', baseline: upgradeBaseline,
  candidateImageId: `sha256:${'b'.repeat(64)}`, fresh: { status: 'passed', database: db },
  database: { candidate: db, baseline: { version: '180006', migrations: 222 } },
  recovery: { rollback: 'passed', explicitRetry: 'passed', maintenance: 'passed' },
  handoff: { movie: 'current', tv: 'current', music: 'excluded', routingTasks: 0 }, checks: [...INSTALLATION_CHECKS] });

test('bounded receipt and summary identify both scenarios and no unsafe raw data', () => {
  const result = { ...success(), debug: { token: 'secret-value' } };
  const receipt = createRuntimeInstallationReceipt({ ...identity, result });
  expect(receipt.status).toBe('passed');
  expect(receipt.database.fresh).toEqual(db);
  expect(JSON.stringify(receipt)).not.toContain('secret-value');
  expect(formatRuntimeInstallationSummary(receipt)).toContain('| fresh install and operational seeds | Passed |');
  expect(formatRuntimeInstallationSummary(receipt)).toContain('not live-provider quality');
});

test.each([
  ['missing check', r => { r.checks.pop(); }],
  ['duplicate check', r => { r.checks[0] = r.checks[1]; }],
  ['failed cleanup', r => { r.cleanup = 'failed'; }],
  ['wrong baseline', r => { r.baseline = { ...r.baseline, revision: revision }; }],
  ['mutable image', r => { r.candidateImageId = 'classifarr:latest'; }],
  ['no fresh check', r => { delete r.fresh; }],
  ['different fresh schema', r => { r.fresh = { status: 'passed', database: { ...db, migrations: 285 } }; }],
  ['no upgrade', r => { r.database.baseline = db; }],
  ['invalid count', r => { r.database.baseline.migrations = '222'; }],
  ['invalid version', r => { r.database.baseline.version = 'private'; }],
  ['routing happened', r => { r.handoff.routingTasks = 1; }],
  ['unverified retry', r => { r.recovery.explicitRetry = 'failed'; }],
])('rejects %s', (_name, mutate) => {
  const result = success();
  mutate(result);
  expect(() => createRuntimeInstallationReceipt({ ...identity, result })).toThrow();
});

test('safe failure receipt never claims unverified checks or cleanup passed', () => {
  const receipt = createRuntimeInstallationReceipt({ failureStage: 'password=secret' });
  expect(receipt.status).toBe('blocked');
  expect(receipt.failureStage).toBe('evidence');
  expect(receipt.checks.every(check => check.status === 'not_verified')).toBe(true);
  expect(receipt.cleanup).toBe('not_verified');
  expect(formatRuntimeInstallationSummary(receipt)).toContain('Publication remains blocked');
});
test.each([
  ['published_upgrade_failed:fresh_install', 'fresh_install'],
  [`published_upgrade_cleanup_failed:classifarr-upgrade-drill-${'a'.repeat(32)}:explicit_retry`, 'cleanup'],
  ['untrusted secret body', 'preflight'], ['published_upgrade_failed:private-data', 'preflight'],
])('classifies only known stages: %s', (message, stage) => {
  expect(installationFailureStage(new Error(message))).toBe(stage);
});

test('CI requires a matching clean checkout before touching Docker', async () => {
  for (const current of [{ ...identity, worktreeClean: false }, { ...identity, sourceRevision: 'c'.repeat(40) }]) {
    const drill = jest.fn();
    const save = jest.fn();
    const receipt = await runRuntimeInstallationAcceptance({ ci: true, expectedRevision: revision, source: () => current, drill, save });
    expect(receipt.status).toBe('blocked');
    expect(drill).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledTimes(1);
  }
});
test('local dirty evidence remains labelled while CI clean evidence passes', async () => {
  for (const ci of [false, true]) {
    const receipt = await runRuntimeInstallationAcceptance({ ci, expectedRevision: revision,
      source: () => ({ ...identity, worktreeClean: ci }), drill: async () => success(), save: () => {} });
    expect(receipt.status).toBe('passed');
    expect(receipt.worktreeClean).toBe(ci);
  }
});
test('source change during the drill or malformed results blocks evidence', async () => {
  const source = jest.fn().mockReturnValueOnce(identity).mockReturnValue({ ...identity, worktreeClean: false });
  const receipt = await runRuntimeInstallationAcceptance({ ci: true, expectedRevision: revision, source,
    drill: async () => success(), save: () => {} });
  expect(receipt.status).toBe('blocked');
  expect(receipt.failureStage).toBe('evidence');
  expect((await runRuntimeInstallationAcceptance({ source: () => identity, drill: async () => ({}), save: () => {} })).status).toBe('blocked');
});
test('provider and command errors are not copied into receipts', async () => {
  const receipt = await runRuntimeInstallationAcceptance({ source: () => identity,
    drill: async () => { throw new Error('url?api_key=secret'); }, save: () => {} });
  expect(JSON.stringify(receipt)).not.toContain('secret');
});
test('reads only source revision and worktree status with bounded shell-free commands', () => {
  const run = jest.fn((_binary, args) => ({ status: 0, stdout: args[0] === 'rev-parse' ? revision : '' }));
  expect(readInstallationSource(run)).toEqual(identity);
  expect(run.mock.calls.every(([, , options]) => options.shell === false && options.timeout === 10000)).toBe(true);
  expect(() => readInstallationSource(() => ({ status: 1, stdout: 'private' }))).toThrow('source_unavailable');
  expect(() => readInstallationSource(() => ({ status: 0, stdout: 'private' }))).toThrow('source_invalid');
});
