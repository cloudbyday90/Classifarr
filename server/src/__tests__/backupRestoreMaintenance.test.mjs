/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';

const session = { query: jest.fn() };
const withSession = jest.fn(async (_options, work) => work(session));
const execute = jest.fn();
const Lifecycle = jest.fn();
const recordVerification = jest.fn();
jest.unstable_mockModule('../services/backupRestoreSession.mjs', () => ({ withBackupRestoreSession: withSession }));
jest.unstable_mockModule('../services/backupRestoreExecution.mjs', () => ({ executeBackupRestore: execute }));
jest.unstable_mockModule('../services/nativeIntentReconciliationLifecycleService.mjs', () => ({ NativeIntentReconciliationLifecycleService: Lifecycle }));
jest.unstable_mockModule('../services/policyBackupRestoreVerificationPersistence.mjs', () => ({ insertPolicyBackupRestoreVerification: recordVerification }));
const { runBackupRestoreMaintenance } = await import('../services/backupRestoreMaintenance.mjs');

beforeEach(() => {
  jest.clearAllMocks();
  session.query.mockReset();
  execute.mockReset();
  withSession.mockImplementation(async (_options, work) => work(session));
});

test('one admitted session applies bounded settings, restores and verifies without minting a key', async () => {
  const database = {}, backupData = { version: '2.0', data: {} };
  execute.mockResolvedValue({ newApiKey: 'never-output' });
  expect(await runBackupRestoreMaintenance({ database, backupData, mode: 'replace' }))
    .toEqual({ status: 'complete', reason: 'restore_verified', mode: 'replace' });
  expect(withSession).toHaveBeenCalledTimes(1);
  expect(withSession.mock.calls[0][0].database).toBe(database);
  expect(session.query.mock.calls.map(([sql]) => sql)).toEqual([
    "SET statement_timeout = '30s'", "SET lock_timeout = '5s'",
    "SET idle_in_transaction_session_timeout = '10s'", "SET transaction_timeout = '120s'",
    'SET search_path = public, pg_temp',
  ]);
  expect(Lifecycle).toHaveBeenCalledWith(expect.objectContaining({ db: session }));
  expect(execute).toHaveBeenCalledWith(expect.objectContaining({ database: session, backupData,
    mode: 'replace', recordVerification }));
  expect(execute.mock.calls[0][0]).not.toHaveProperty('createSystemApiKey');
  expect(session.query.mock.invocationCallOrder.at(-1)).toBeLessThan(execute.mock.invocationCallOrder[0]);
});

test('active runtime never reaches any restore or setup queries', async () => {
  withSession.mockRejectedValue(new Error('busy'));
  await expect(runBackupRestoreMaintenance({ database: {}, backupData: {}, mode: 'merge' })).rejects.toThrow('busy');
  expect(session.query).not.toHaveBeenCalled();
  expect(execute).not.toHaveBeenCalled();
});

test.each(['settings', 'restore'])('%s failure never turns into success or an automatic retry', async phase => {
  (phase === 'settings' ? session.query : execute).mockRejectedValue(new Error('failed'));
  await expect(runBackupRestoreMaintenance({ database: {}, backupData: {}, mode: 'merge' })).rejects.toThrow('failed');
  expect(withSession).toHaveBeenCalledTimes(1);
  expect(execute).toHaveBeenCalledTimes(phase === 'restore' ? 1 : 0);
});
