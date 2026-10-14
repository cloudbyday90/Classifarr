/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, jest } from '@jest/globals';
import { Readable, Writable } from 'node:stream';
import { randomBytes } from 'node:crypto';
import { readGatewayStream, writeGatewayRecord } from '../ollamaGateway/stream.mjs';
import { createGatewayClient } from '../ollamaGateway/client.mjs';

const model = 'synthetic:latest', signal = new AbortController().signal;
const record = (extra = {}) => ({ model,response: '',done: false,...extra });
const wire = (...records) => records.map(value => JSON.stringify(value)).join('\n');
const read = (text, callback = async () => {}) => readGatewayStream(Readable.from([Buffer.from(text)]),model,callback,signal);
const config = () => ({ url: 'http://127.0.0.1:11435',upstream: 'http://127.0.0.1:11434',models: [model],token: randomBytes(32).toString('base64url') });

test('split UTF-8 and record boundaries preserve thinking, text and final statistics', async () => {
  const text = wire(record({ thinking: 'think' }),record({ response: '📺' }),record({ done: true,eval_count: 2 }));
  const parts = [...Buffer.from(text)].map(byte => Buffer.from([byte])), seen = [];
  const final = await readGatewayStream(Readable.from(parts),model,async value => { seen.push(value); },signal);
  expect(seen).toEqual([record({ thinking: 'think' }),record({ response: '📺' })]);
  expect(final).toEqual(record({ done: true,eval_count: 2 }));
});
test.each([
  '', wire(record()), '{not json}', wire(record({ model: 'other:latest' })),
  wire(record({ done: 'true' })), wire(record({ error: 'secret' })), wire(record({ remote_model: '' })),
  wire(record({ response: 12 })), wire(record({ done: true }),record()),
  wire(record({ done: true }),record({ done: true })), wire(record({ response: 'x'.repeat(65536) })),
  Array.from({ length: 8193 },() => wire(record())).join('\n'),
  Array.from({ length: 20 },() => wire(record({ response: 'x'.repeat(60000) }))).join('\n'),
])('invalid or unbounded stream %# cannot complete', async text => {
  await expect(read(text)).rejects.toThrow('gateway_response_invalid');
});
test('invalid UTF-8 and missing final UTF-8 continuation reject', async () => {
  for (const bytes of [[0xff],[0xf0,0x9f]]) {
    await expect(readGatewayStream(Readable.from([Buffer.from(bytes)]),model,async () => {},signal)).rejects.toThrow('gateway_response_invalid');
  }
});
test('terminal record is not delivered as partial progress', async () => {
  const callback = jest.fn(); await read(wire(record({ done: true })),callback); expect(callback).not.toHaveBeenCalled();
});
test('cancellation bounds a stalled consumer callback without accepting final completion', async () => {
  const controller = new AbortController(); let entered = false;
  const result = readGatewayStream(Readable.from([Buffer.from(wire(record(),record({ done: true })))]),model,
    () => { entered = true; return new Promise(() => {}); },controller.signal);
  const checked = expect(result).rejects.toThrow('gateway_cancelled');
  while (!entered) await new Promise(resolve => { setImmediate(resolve); });
  controller.abort(); await checked;
});
test('backpressure blocks until drain; cancellation bounds a non-reading destination', async () => {
  let release;
  const output = new Writable({ highWaterMark: 1,write(_chunk,_encoding,done) { release = done; } });
  let completed = false;
  const pending = writeGatewayRecord(output,record(),signal).then(() => { completed = true; });
  await Promise.resolve(); expect(completed).toBe(false); release(); await pending; output.destroy();
  const controller = new AbortController(), blocked = new Writable({ highWaterMark: 1,write() {} });
  const waiting = writeGatewayRecord(blocked,record(),controller.signal);
  const checked = expect(waiting).rejects.toMatchObject({ name: 'AbortError' }); controller.abort(); await checked; blocked.destroy();
});
test.each(['http://192.168.1.2:11435','https://127.0.0.1:11435','http://localhost:11435',
  'http://user:secret@127.0.0.1:11435','http://127.0.0.1:11435/path','http://127.0.0.1:11435/?token=x'])('rejects gateway URL %s', url => {
  expect(() => createGatewayClient({ ...config(),url },{ expectedUpstream: config().upstream })).toThrow();
});
test('client hides credentials, checks expected provider, and refuses requests after close', async () => {
  const raw = config(), client = createGatewayClient(raw,{ expectedUpstream: raw.upstream });
  expect(JSON.stringify(client)).not.toContain(raw.token);
  expect(() => createGatewayClient(raw,{ expectedUpstream: 'http://127.0.0.1:9' })).toThrow('gateway_provider_mismatch');
  await expect(client.request('/api/pull',{ model })).rejects.toThrow('gateway_route_rejected');
  await expect(client.request('/api/generate',{ model,prompt: 'test',stream: true })).rejects.toThrow('gateway_client_request_invalid');
  await expect(client.request('/api/generate',{ model,prompt: 'test',stream: false },{ timeoutMs: 300001 })).rejects.toThrow();
  await expect(client.request('/api/tags',undefined,{ maxResponseBytes: 99999999 })).rejects.toThrow();
  client.close(); await expect(client.request('/api/tags')).rejects.toThrow('gateway_client_closed');
});
