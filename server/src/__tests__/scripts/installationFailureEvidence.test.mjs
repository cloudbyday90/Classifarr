/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { installationFailureEvidence, validateInstallationFailure } from '../../scripts/installationFailureEvidence.mjs';
import { runScheduledCrashRecovery } from '../../../../scripts/lib/scheduledCrashRecovery.mjs';

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

test.each([true, false])('detached probe failure is visible without leaking raw marker data, valid=%s', async valid => {
  const report = jest.fn();
  const compose = jest.fn(() => ({ status: 0 }));
  const probe = jest.fn(() => ({ category: valid ? 'assertion' : 'secret', code: null, stage: null, locations: [], secret: 'private' }));
  await expect(runScheduledCrashRecovery({ compose, probe, report, armPhase: 'scheduled-backlog-arm',
    poll: async check => check() })).rejects.toThrow('upgrade_backlog_arm_failed');
  expect(probe).toHaveBeenCalledWith('scheduled-backlog-failure');
  expect(report).toHaveBeenCalledWith(valid ? 'UPGRADE_BACKLOG_FAILURE {"category":"assertion","code":null,"stage":null,"locations":[]}'
    : 'UPGRADE_BACKLOG_FAILURE unavailable');
});
