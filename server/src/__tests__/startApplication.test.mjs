/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { EventEmitter } from 'node:events';
import { jest } from '@jest/globals';
import { startApplication } from '../bootstrap/startApplication.mjs';
import { readOperatingMode, getBackupRuntimeStatus } from '../config/operatingMode.mjs';

function setup(mode) {
  const admission = { assertHealthy: jest.fn(), release: jest.fn() };
  const normal = { registerServerProcessHandlers: jest.fn(), startServer: jest.fn().mockResolvedValue('normal') };
  const restore = { startRestoreServer: jest.fn().mockResolvedValue('restore') };
  const options = {
    database: {}, environment: mode === undefined ? {} : { CLASSIFARR_RUNTIME_MODE: mode },
    processRef: new EventEmitter(), acquireAdmission: jest.fn().mockResolvedValue(admission),
    onAdmissionLost: jest.fn(), loadNormal: jest.fn().mockResolvedValue(normal), loadRestore: jest.fn().mockResolvedValue(restore),
  };
  return { options, admission, normal, restore, start: () => startApplication(options) };
}

test('normal default admits before importing normal services and retains lock through shutdown', async () => {
  const { start, options, admission, normal } = setup();
  await expect(start()).resolves.toBe('normal');
  expect(options.acquireAdmission).toHaveBeenCalledWith({ database: options.database, onLost: options.onAdmissionLost });
  expect(options.acquireAdmission.mock.invocationCallOrder[0]).toBeLessThan(options.loadNormal.mock.invocationCallOrder[0]);
  expect(admission.assertHealthy).toHaveBeenCalledTimes(2);
  expect(normal.registerServerProcessHandlers).toHaveBeenCalledTimes(1);
  expect(options.loadRestore).not.toHaveBeenCalled();
  expect(admission.release).not.toHaveBeenCalled();
  options.processRef.emit('exit');
  expect(admission.release).toHaveBeenCalledTimes(1);
});

test('restore branch never acquires normal admission or imports normal runtime', async () => {
  const { start, options, restore } = setup('restore');
  await expect(start()).resolves.toBe('restore');
  expect(restore.startRestoreServer).toHaveBeenCalledWith({ database: options.database });
  expect(options.acquireAdmission).not.toHaveBeenCalled();
  expect(options.loadNormal).not.toHaveBeenCalled();
});

test.each(['', 'NORMAL', ' restore ', 'other'])('invalid mode %s loads neither runtime', async mode => {
  const { start, options } = setup(mode);
  await expect(start()).rejects.toThrow('must be normal or restore');
  expect(options.acquireAdmission).not.toHaveBeenCalled();
  expect(options.loadNormal).not.toHaveBeenCalled();
  expect(options.loadRestore).not.toHaveBeenCalled();
});

test('refused admission prevents all normal imports', async () => {
  const { start, options } = setup();
  options.acquireAdmission.mockRejectedValue(new Error('blocked'));
  await expect(start()).rejects.toThrow('blocked');
  expect(options.loadNormal).not.toHaveBeenCalled();
});

test('normal startup cannot omit the fail-stop callback', async () => {
  const { start, options } = setup();
  options.onAdmissionLost = undefined;
  await expect(start()).rejects.toThrow('requires a fail-stop handler');
  expect(options.acquireAdmission).not.toHaveBeenCalled();
  expect(options.loadNormal).not.toHaveBeenCalled();
});

test('loss while importing prevents initialization and does not release before process exits', async () => {
  const { start, options, admission, normal } = setup();
  admission.assertHealthy.mockImplementationOnce(() => {}).mockImplementationOnce(() => { throw new Error('lost'); });
  await expect(start()).rejects.toThrow('lost');
  expect(normal.startServer).not.toHaveBeenCalled();
  expect(admission.release).not.toHaveBeenCalled();
  options.processRef.emit('exit');
  expect(admission.release).toHaveBeenCalledTimes(1);
});

test('runtime status and mode are explicit and fail closed', () => {
  const original = process.env.CLASSIFARR_RUNTIME_MODE;
  try {
    delete process.env.CLASSIFARR_RUNTIME_MODE;
    expect(readOperatingMode()).toBe('normal');
    expect(getBackupRuntimeStatus()).toEqual({ mode: 'normal', restoreAllowed: false, restartRequired: false });
    process.env.CLASSIFARR_RUNTIME_MODE = 'restore';
    expect(getBackupRuntimeStatus()).toEqual({ mode: 'restore', restoreAllowed: true, restartRequired: true });
    process.env.CLASSIFARR_RUNTIME_MODE = 'invalid';
    expect(getBackupRuntimeStatus).toThrow();
  } finally {
    if (original === undefined) delete process.env.CLASSIFARR_RUNTIME_MODE;
    else process.env.CLASSIFARR_RUNTIME_MODE = original;
  }
});
