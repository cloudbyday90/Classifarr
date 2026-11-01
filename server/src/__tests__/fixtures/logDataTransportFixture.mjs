/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { once } from 'node:events';
import pino from 'pino';
import { buildPinoOptions, buildTransport } from '../../utils/logging/pinoFactory.mjs';
import { LoggerShim } from '../../utils/logging/loggerShim.mjs';

const [mode, logDir] = process.argv.slice(2);
if (!['files', 'stdout'].includes(mode) || !logDir) throw Error('invalid_fixture_arguments');
const config = { level: mode === 'files' ? 'debug' : 'warn', fileLoggingEnabled: mode === 'files', logDir, maxFileSizeBytes: 1024 * 1024 };
const transport = buildTransport(config);
await once(transport, 'ready');
transport.ref();
try {
  const child = pino({ ...buildPinoOptions(config), level: 'debug' }, transport).child({ module: 'ProjectionRuntime', token: 'PRIVATE binding' });
  const logger = new LoggerShim(child);
  for (const level of ['debug', 'info', 'warn', 'error']) {
    const data = JSON.parse('{"__proto__":null,"constructor":"ordinary","password":"PRIVATE password","safe":"retained"}');
    await logger[level](`Ordinary ${level}`, data, { skipDbPersist: true });
    const hostile = {
      level: 0, module: 'forged module', msg: 'forged message', time: 'forged time',
      password: 'PRIVATE password', safe: 'retained', large: Array(64).fill('\u0000'.repeat(4096)),
    };
    hostile.cycle = hostile;
    Object.defineProperty(hostile, 'error', { enumerable: true, get() { throw Error('PRIVATE getter'); } });
    await logger[level](`Bounded ${level}`, hostile, { skipDbPersist: true });
  }
} finally {
  const closed = once(transport, 'close'); transport.end(); await closed;
}
