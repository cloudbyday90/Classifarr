/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { once } from 'node:events';
import pino from 'pino';
import { buildPinoOptions, buildTransport } from '../../utils/logging/pinoFactory.mjs';

const [mode, logDir] = process.argv.slice(2);
if (!['files', 'stdout'].includes(mode) || !logDir) throw new Error('invalid_fixture_arguments');
const config = {
  level: mode === 'files' ? 'debug' : 'warn',
  fileLoggingEnabled: mode === 'files',
  logDir,
  maxFileSizeBytes: 1024 * 1024,
};
const transport = buildTransport(config);
await once(transport, 'ready');
// Pino normally unrefs an idle worker; this one-shot fixture owns its close.
transport.ref();
try {
  // Allow lower-level records into the worker to verify its own target filters.
  const logger = pino({ ...buildPinoOptions(config), level: 'debug' }, transport)
    .child({ module: 'RuntimeSmoke', 'quoted"binding': 'synthetic', token: 'synthetic-token' });
  for (const level of ['debug', 'info', 'warn', 'error']) {
    logger[level](JSON.parse('{"__proto__":null,"password":"synthetic-password"}'), level);
  }
} finally {
  const closed = once(transport, 'close');
  transport.end();
  await closed;
}
