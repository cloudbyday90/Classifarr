/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import assert from 'node:assert/strict';
import { installationFailureEvidence, validateInstallationFailure, readInstallationFailure } from '../../scripts/installationFailureEvidence.mjs';
import { runScheduledCrashRecovery } from '../../../../scripts/lib/scheduledCrashRecovery.mjs';
import { runUpgradeProbe } from '../../scripts/publishedUpgradeProbe.mjs';

test.each([['ERR_ASSERTION', 'assertion', null], ['23505', 'database', '23505'], ['P0001', 'database', 'P0001'],
  ['XX000', 'database', 'XX000'], ['EPERM', 'other', null]])('classifies %s without raw values', (code, category, expectedCode) => {
  const result = installationFailureEvidence({ code, message: 'secret-value', actual: 'secret-value',
    stack: 'secret-value\n at helper (file:///app/src/scripts/installationBacklogProbe.mjs:56:11)' });
  expect(result).toEqual({ category, code: expectedCode, stage: null, locations: ['installationBacklogProbe.mjs:56:11'] });
  expect(validateInstallationFailure(result)).toEqual(result);
  expect(JSON.stringify(result)).not.toContain('secret-value');
});

test('bounds code locations and restricts timeout stages', () => {
  expect(installationFailureEvidence({ message: 'scheduled_installation_timeout:ingestion_complete' }))
    .toMatchObject({ category: 'timeout', stage: 'ingestion_complete' });
  const result = installationFailureEvidence({ message: 'scheduled_installation_timeout:secret',
    stack: 'at helper (file:///app/src/scripts/probe.mjs:1:2)\n'.repeat(1000) });
  expect(result.locations).toHaveLength(5);
  expect(result.stage).toBeNull();
});

test('retains only bounded counts for the explicitly named synthetic start-count assertion', () => {
  let failure;
  try { assert.equal(1, 2, 'installation_backlog_start_count'); } catch (error) { failure = error; }
  const evidence = installationFailureEvidence(failure);
  expect(evidence.taskStarts).toEqual({ expected: 2, observed: 1 });
  expect(validateInstallationFailure({ ...evidence, taskStarts: { ...evidence.taskStarts, secret: 'private' } }))
    .toEqual(evidence);
  expect(readInstallationFailure(`UPGRADE_PROBE_FAILURE ${JSON.stringify(evidence)}`)).toEqual(evidence);
  expect(installationFailureEvidence({ ...failure, message: 'unrelated' }).taskStarts).toBeUndefined();
});

test.each([{ expected: 3, observed: 1 }, { expected: 2, observed: 'private' }, { expected: 2, observed: -1 },
  { expected: 2, observed: 10001 }, { expected: 2, observed: 1.5 }, null])('rejects invalid start-count evidence %#', taskStarts => {
  const evidence = { category: 'assertion', code: null, stage: null, locations: [], taskStarts };
  expect(() => validateInstallationFailure(evidence)).toThrow();
  expect(readInstallationFailure(`UPGRADE_PROBE_FAILURE ${JSON.stringify(evidence)}`)).toBeNull();
  expect(installationFailureEvidence({ code: 'ERR_ASSERTION', message: 'installation_backlog_start_count',
    expected: taskStarts?.expected, actual: taskStarts?.observed }).taskStarts).toBeUndefined();
});

test('start-count evidence is restricted to assertion failures', () => {
  expect(() => validateInstallationFailure({ category: 'other', code: null, stage: null, locations: [],
    taskStarts: { expected: 2, observed: 1 } })).toThrow();
});

test.each([{ category: 'secret' }, { code: 'secret' }, { stage: 'secret' }, { locations: ['https://private.invalid'] },
  { locations: Array(6).fill('probe.mjs:1:2') }])('rejects untrusted failure marker %j', override => {
  expect(() => validateInstallationFailure({ category: 'other', code: null, stage: null, locations: [], ...override })).toThrow();
});

test('marker reader reconstructs allowlisted fields only', () => {
  expect(validateInstallationFailure({ category: 'other', code: null, stage: null, locations: [], secret: 'private' }))
    .toEqual({ category: 'other', code: null, stage: null, locations: [] });
});

test('foreground failure reader excludes raw stderr and unrecognized fields', () => {
  const evidence = { category: 'assertion', code: null, stage: null, locations: ['probe.mjs:1:2'] };
  expect(readInstallationFailure(`private\nUPGRADE_PROBE_FAILURE ${JSON.stringify({ ...evidence, secret: 'private' })}\n`))
    .toEqual(evidence);
});

test.each([null, '', 'UPGRADE_PROBE_FAILURE nope', 'UPGRADE_PROBE_FAILURE {}\nUPGRADE_PROBE_FAILURE {}',
  `UPGRADE_PROBE_FAILURE ${'a'.repeat(2048)}`])('invalid foreground evidence is ignored: %#', value => {
  expect(readInstallationFailure(value)).toBeNull();
});

test.each(['scheduled-crash-failure', 'scheduled-backlog-failure'])('%s refuses normal runtime before reading files', async phase => {
  const previous = process.env.CLASSIFARR_UPGRADE_DRILL;
  delete process.env.CLASSIFARR_UPGRADE_DRILL;
  try { await expect(runUpgradeProbe(phase)).rejects.toThrow(); }
  finally {
    if (previous === undefined) delete process.env.CLASSIFARR_UPGRADE_DRILL;
    else process.env.CLASSIFARR_UPGRADE_DRILL = previous;
  }
});

test.each(['scheduled-backlog-arm', 'scheduled-crash-arm', 'scheduled-crash-budget-arm']
  .flatMap(armPhase => [true, false].map(valid => [armPhase, valid])))('detached %s failure is visible without raw data, valid=%s', async (armPhase, valid) => {
  const report = jest.fn();
  const compose = jest.fn(() => ({ status: 0 }));
  const probe = jest.fn(() => ({ category: valid ? 'assertion' : 'secret', code: null, stage: null, locations: [], secret: 'private' }));
  const backlog = armPhase === 'scheduled-backlog-arm';
  const prefix = backlog ? 'UPGRADE_BACKLOG_FAILURE' : 'UPGRADE_CRASH_FAILURE';
  await expect(runScheduledCrashRecovery({ compose, probe, report, armPhase,
    poll: async check => check() })).rejects.toThrow(backlog ? 'upgrade_backlog_arm_failed' : 'upgrade_crash_arm_failed');
  expect(probe).toHaveBeenCalledWith(backlog ? 'scheduled-backlog-failure' : 'scheduled-crash-failure');
  expect(report).toHaveBeenCalledWith(valid ? `${prefix} {"category":"assertion","code":null,"stage":null,"locations":[]}`
    : `${prefix} unavailable`);
});
