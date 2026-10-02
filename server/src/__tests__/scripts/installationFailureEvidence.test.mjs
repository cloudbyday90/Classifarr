/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { installationFailureEvidence, validateInstallationFailure } from '../../scripts/installationFailureEvidence.mjs';
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

test.each([{ category: 'secret' }, { code: 'secret' }, { stage: 'secret' }, { locations: ['https://private.invalid'] },
  { locations: Array(6).fill('probe.mjs:1:2') }])('rejects untrusted failure marker %j', override => {
  expect(() => validateInstallationFailure({ category: 'other', code: null, stage: null, locations: [], ...override })).toThrow();
});

test('marker reader reconstructs allowlisted fields only', () => {
  expect(validateInstallationFailure({ category: 'other', code: null, stage: null, locations: [], secret: 'private' }))
    .toEqual({ category: 'other', code: null, stage: null, locations: [] });
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
