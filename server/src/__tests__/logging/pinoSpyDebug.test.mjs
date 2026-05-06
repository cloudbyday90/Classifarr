import { jest } from '@jest/globals';

// Simulate loadDatabaseModule
async function loadLogger() {
  jest.resetModules();
  const { createLogger } = await import('../../utils/logger.mjs');
  return createLogger('test-module');
}

describe('pino testStream console spy debug', () => {
  let warnSpy;
  let errorSpy;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation((...args) => {
      process.stdout.write('WARN SPY CALLED: ' + JSON.stringify(args) + '\n');
    });
    errorSpy = jest.spyOn(console, 'error').mockImplementation((...args) => {
      process.stdout.write('ERROR SPY CALLED: ' + JSON.stringify(args) + '\n');
    });
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('pino warn output via logger.warn', async () => {
    const logger = await loadLogger();
    process.stdout.write('LOG_LEVEL: ' + (process.env.LOG_LEVEL || 'undefined') + '\n');
    process.stdout.write('calling logger.warn...\n');
    logger.warn('test warn message', null);
    process.stdout.write('after logger.warn, spy calls: ' + warnSpy.mock.calls.length + '\n');
  });
});
