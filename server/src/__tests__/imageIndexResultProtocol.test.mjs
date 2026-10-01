/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { imageIndexResultByte, imageIndexFailureCode, imageIndexResultCode, IMAGE_INDEX_RESULTS, IMAGE_INDEX_DEFERRED_REASONS } from '../utils/imageIndexResultProtocol.mjs';
import { encodeImageIndexClaim } from '../utils/imageIndexHandoffProtocol.mjs';
import { runCompatibleImageIndex } from '../scripts/runCompatibleImageIndex.mjs';
import { compatibleMaintenanceEnvironment } from '../bootstrap/embeddedCompatibleMaintenanceEnvironment.mjs';
import { createCompatibleImageIndexBroker } from '../bootstrap/embeddedCompatibleImageIndex.mjs';
import { openImageIndexHandoff } from '../services/imageIndexHandoffClient.mjs';
import { createQueueMaintenanceHandoffClient } from '../services/queueMaintenanceHandoffClient.mjs';
import { rebuildImageIndexes } from '../services/queueTaskProcessorIndexing.mjs';

const task = { id: '1', claim_token: '11111111-1111-4111-8111-111111111111' };
const cases = Object.entries(IMAGE_INDEX_RESULTS).filter(([code]) => Number(code) >= 70);
const stream = () => Object.assign(new EventEmitter(), { write: jest.fn(() => true), destroy: jest.fn(), unref: jest.fn() });

test.each(cases)('fixed result %s (%s) survives child, broker, client and queue adapter without raw output', async (raw, reason) => {
  const code = Number(raw), deferred = IMAGE_INDEX_DEFERRED_REASONS.includes(reason), output = jest.fn();
  const exitCode = await runCompatibleImageIndex({ environment: compatibleMaintenanceEnvironment(),
    context: { uid: 99, gid: 100, platform: 'linux', cwd: '/app', args: ['--claim'] },
    input: Readable.from([encodeImageIndexClaim(task)]), assertDatabase: jest.fn(),
    loadDatabase: async () => ({ pool: { end: jest.fn() } }), output,
    run: async () => { if (deferred) return { status: 'deferred', reason }; throw new Error(reason); },
  });
  expect(exitCode).toBe(code);
  expect(JSON.parse(output.mock.calls[0][0]).status).toBe(reason);
  const server = stream(), client = stream();
  server.write.mockImplementation(bytes => { client.emit('data', bytes); return true; });
  client.write.mockImplementation(bytes => { server.emit('data', bytes); return true; });
  const broker = createCompatibleImageIndexBroker({ channel: server, uid: 99, gid: 100, platform: 'linux',
    start: () => ({ done: Promise.resolve({ code: exitCode, signal: null }) }) });
  const handoff = openImageIndexHandoff({ environment: { CLASSIFARR_IMAGE_INDEX_CHANNEL: 'stdio-v1' }, platform: 'linux', connect: () => client });
  const logger = { info: jest.fn(), debug: jest.fn() };
  try {
    const work = rebuildImageIndexes(task, { handoff, logger });
    if (deferred) await expect(work).resolves.toMatchObject({ status: 'deferred', reason });
    else await expect(work).rejects.toThrow(reason);
  } finally { handoff.close(); await broker.stop(); }
});

test.each([['55P03', 71], ['57014', 72], ['08006', 76], ['ECONNRESET', 76], ['57P01', 76], ['private', 1]])(
  'SQL/transport code %s uses category %s without exception text', (code, expected) => {
    expect(imageIndexFailureCode({ code, message: 'secret SQL with private credentials' })).toBe(expected);
  });

test('unknown and signalled results never impersonate a classified success or failure', () => {
  expect(imageIndexFailureCode(null)).toBe(1);
  expect(imageIndexFailureCode(new Error('image_index_memory_pressure'))).toBe(1);
  expect(imageIndexResultCode('arbitrary')).toBeNull();
  expect(imageIndexResultByte({ code: 70, signal: 'SIGTERM' })).toBe(0x45);
  expect(imageIndexResultByte({ code: 200, signal: null })).toBe(0x45);
  expect(imageIndexResultByte(null)).toBe(0x45);
});

test('ordinary queue protocol still refuses image-only status bytes', async () => {
  const channel = stream(), client = createQueueMaintenanceHandoffClient({ channel });
  const pending = client.request(); channel.emit('data', Buffer.from([70]));
  await expect(pending).resolves.toMatchObject({ status: 'unavailable' });
  expect(channel.destroy).toHaveBeenCalledTimes(1);
});
