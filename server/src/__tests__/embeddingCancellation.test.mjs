/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createServer } from 'node:http';
import { withRetry } from '../utils/retryUtils.mjs';

const warn = jest.fn();
jest.unstable_mockModule('../utils/logger.mjs', () => ({ createLogger: () => ({ warn }) }));
jest.unstable_mockModule('../services/ollama.mjs', () => ({ ollamaService: { embed: jest.fn() } }));
const { executeCloudEmbedding } = await import('../services/embeddingCloudAdapterHelper.mjs');
const { createAdapterMethods } = await import('../services/embeddingProviderAdapters.mjs');

let server;
let base;
let mode;
let requests;
let onRequest;
const recordRetry = jest.fn();
const deps = { getAdaptiveTimeout: () => 5000, createRetriedOperation: withRetry, recordRetry };
const config = { max_retries: 2, retry_delay: 1 };
const bodyBuilder = jest.fn(() => ({ body: { input: 'fixture' }, headers: {} }));
const responseParser = jest.fn(data => ({ embedding: data.embedding }));
const errorExtractor = jest.fn(error => error.message);
const cloud = signal => executeCloudEmbedding({
  text: 'fixture', model: 'fixture', config, signal, url: base,
  bodyBuilder, responseParser, errorExtractor, providerName: 'Fixture',
}, deps);
const ollama = signal => createAdapterMethods(deps).getOllamaEmbedding(
  'fixture', '127.0.0.1', server.address().port, 'fixture', config, signal,
);

beforeAll(async () => {
  server = createServer((req, res) => {
    requests++;
    req.resume();
    if (mode === 'retry' || mode === 'transient' && requests === 1) {
      res.writeHead(503, { Connection: 'close', 'Content-Type': 'application/json',
        ...(mode === 'retry' ? { 'Retry-After': '60' } : {}) });
      res.end('{"error":"fixture unavailable"}');
    } else {
      res.writeHead(200, { Connection: 'close', 'Content-Type': 'application/json' });
      if (mode === 'stall') res.write('{');
      else res.end('{"embedding":[0.1,0.2]}');
    }
    onRequest?.(res);
  });
  await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(() => { requests = 0; mode = 'success'; onRequest = undefined; jest.clearAllMocks(); recordRetry.mockReset(); });
afterAll(async () => {
  server.closeAllConnections();
  await new Promise(resolve => { server.close(resolve); });
});

test.each([['cloud', cloud], ['Ollama', ollama]])('%s stops pre-aborted embedding before HTTP or retry logging', async (_name, run) => {
  await expect(run(AbortSignal.abort('private reason'))).rejects.toMatchObject({ code: 'ABORT_ERR' });
  expect(requests).toBe(0);
  expect(bodyBuilder).not.toHaveBeenCalled();
  expect(recordRetry).not.toHaveBeenCalled();
  expect(warn).not.toHaveBeenCalled();
});

test.each([['cloud', cloud], ['Ollama', ollama]])('%s aborts during request without parsing or retrying', async (_name, run) => {
  mode = 'stall';
  const caller = new AbortController();
  const closed = Promise.withResolvers();
  onRequest = res => { res.once('close', closed.resolve); caller.abort(new Error('private timeout reason')); };
  await expect(run(caller.signal)).rejects.toMatchObject({ name: 'AbortError', code: 'ABORT_ERR' });
  await closed.promise;
  expect(requests).toBe(1);
  expect(responseParser).not.toHaveBeenCalled();
  expect(errorExtractor).not.toHaveBeenCalled();
  expect(recordRetry).not.toHaveBeenCalled();
});

test.each([['cloud', cloud], ['Ollama', ollama]])('%s cancels Retry-After without a second HTTP attempt', async (_name, run) => {
  mode = 'retry';
  const caller = new AbortController();
  recordRetry.mockImplementation(() => { queueMicrotask(() => caller.abort({ secret: 'private reason' })); });
  await expect(run(caller.signal)).rejects.toMatchObject({ code: 'ABORT_ERR', message: 'Request cancelled' });
  expect(requests).toBe(1);
  expect(recordRetry).toHaveBeenCalledTimes(1);
  expect(errorExtractor).not.toHaveBeenCalled();
});

test.each([['cloud', cloud], ['Ollama', ollama]])('%s retains successful transient retries', async (_name, run) => {
  mode = 'transient';
  await expect(run(new AbortController().signal)).resolves.toMatchObject({ embedding: [0.1, 0.2] });
  expect(requests).toBe(2);
  expect(recordRetry).toHaveBeenCalledTimes(1);
});
