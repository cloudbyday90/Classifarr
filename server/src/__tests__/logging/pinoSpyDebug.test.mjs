import { jest } from '@jest/globals';

// Simulate loadDatabaseModule
async function loadLogger() {
  jest.resetModules();
  const { createLogger } = await import('../../utils/logger.mjs');
  return createLogger('test-module');
}

describe('pino testStream console spy debug', () => {
  let warnSpy;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('console.warn spy should capture pino warn output after resetModules', async () => {
    const logger = await loadLogger();
    logger.warn('test warn message', null);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('test warn message'));
  });
});
