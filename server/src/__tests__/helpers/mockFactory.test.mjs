/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import { createLoggerModuleMock, resetLoggerModuleMock } from './mockFactory.mjs';

describe('mockFactory logger helpers', () => {
  it('reapplies createLogger after resetAllMocks clears the logger module mock', () => {
    const loggerModuleMock = createLoggerModuleMock();

    loggerModuleMock.module.createLogger('initial-service');
    loggerModuleMock.module.setLoggerDb('db');
    loggerModuleMock.logger.info('message');

    jest.resetAllMocks();

    expect(loggerModuleMock.module.createLogger('after-reset')).toBeUndefined();

    resetLoggerModuleMock(loggerModuleMock);

    expect(loggerModuleMock.module.createLogger('restored-service')).toBe(loggerModuleMock.logger);
    expect(loggerModuleMock.module.createLogger).toHaveBeenCalledWith('restored-service');
    expect(loggerModuleMock.module.setLoggerDb).not.toHaveBeenCalled();
    expect(loggerModuleMock.logger.info).not.toHaveBeenCalled();
    expect(loggerModuleMock.logger.warn).not.toHaveBeenCalled();
    expect(loggerModuleMock.logger.error).not.toHaveBeenCalled();
    expect(loggerModuleMock.logger.debug).not.toHaveBeenCalled();
  });
});