/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import pino from 'pino';
import { createRootLogger } from '../../utils/logging/pinoFactory.mjs';
import { resolveLogConfig } from '../../utils/logging/logConfig.mjs';
import { createConsoleSpy } from '../setup/consoleHelpers.mjs';

test('silent one-shot logging creates no worker, file transport or console output', () => {
  const transport = jest.spyOn(pino, 'transport');
  const log = createConsoleSpy('log');
  const error = createConsoleSpy('error');
  try {
    const logger = createRootLogger(resolveLogConfig({ LOG_LEVEL: 'silent' }));
    logger.info('private');
    logger.error('private');
    logger.fatal('private');
    expect(transport).not.toHaveBeenCalled();
    expect(log.spy).not.toHaveBeenCalled();
    expect(error.spy).not.toHaveBeenCalled();
  } finally { jest.restoreAllMocks(); }
});
