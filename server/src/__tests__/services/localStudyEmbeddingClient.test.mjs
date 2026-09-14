/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createServer } from 'node:http';
import { beforeEach, afterEach, expect, jest, test } from '@jest/globals';
import { canonicalStudyModel, createLocalStudyEmbeddingClient, resolveLocalStudyEmbeddingConfig } from '../../services/localStudyEmbeddingClient.mjs';
import { diagnoseProviderResponse } from '../../services/providerResponseDiagnosis.mjs';
import { createInventoryDescriptionRefreshWorker } from '../../services/inventoryDescriptionRefreshWorker.mjs';
import { createInventoryDescriptionRecovery } from '../../services/inventoryDescriptionRecovery.mjs';
import { createMemoryDescriptionIsolation } from '../fixtures/descriptionIsolation.mjs';

let server;
let config;
let mode;
let requests;
let failEmbeddingAt;
beforeEach(async () => {
  mode = 'normal';
  requests = [];
  failEmbeddingAt = 0;
  server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    requests.push({ path: request.url, body: body ? JSON.parse(body) : null });
    response.setHeader('Content-Type', 'application/json');
    if (mode === 'redirect') { response.writeHead(307, { Location: '/private' }); response.end(); return; }
    if (mode === 'oversized') { response.end('x'.repeat(4 * 1024 * 1024 + 1)); return; }
    if (mode === 'error') { response.writeHead(500); response.end('{"error":"PRIVATE provider detail"}'); return; }
    if (mode === 'malformed') { response.end('not JSON'); return; }
    if (request.url === '/api/tags') {
      response.end(JSON.stringify({ models: [{ name: 'test:latest', digest: 'a'.repeat(64), ...(mode === 'remote' ? { remote_host: 'https://example.com' } : {}) }] }));
    } else if (request.url === '/api/show') {
      response.end(JSON.stringify({ capabilities: mode === 'no_embedding' ? ['completion'] : ['embedding'],
        ...(['dimensions', 'two_dimensions'].includes(mode)
          ? { model_info: { 'general.architecture': 'bert', 'bert.embedding_length': mode === 'dimensions' ? 1024 : 2 } } : {}) }));
    } else if (request.url === '/api/embed') {
      const { input } = JSON.parse(body);
      response.end(JSON.stringify({ model: mode === 'different_model' ? 'other' : 'test',
        embeddings: mode === 'wrong_count' || requests.filter(entry => entry.path === '/api/embed').length === failEmbeddingAt
          ? [] : input.map(() => mode === 'zero' ? [0, 0] : [3, 4]) }));
    } else { response.writeHead(404); response.end('{}'); }
  });
  await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
  config = { rag_enabled: true, embedding_provider_mode: 'same', primary_provider: 'ollama',
    ollama_host: '127.0.0.1', ollama_port: server.address().port, embedding_model: 'test' };
});

afterEach(async () => {
  server.closeAllConnections();
  await new Promise(resolve => { server.close(resolve); });
});

test('uses installed local identity and sends ordered batches without hidden truncation', async () => {
  const client = createLocalStudyEmbeddingClient(config);
  expect(await client.inspect()).toEqual({ provider: 'ollama', model: 'test:latest', digest: 'a'.repeat(64) });
  expect(await client.embedBatch(['one', 'two'], { dimensions: 2 })).toEqual([[3, 4], [3, 4]]);
  expect(requests.map(request => request.path)).toEqual(['/api/tags', '/api/show', '/api/embed']);
  expect(requests[2].body).toEqual({ model: 'test:latest', input: ['one', 'two'], truncate: false, keep_alive: '5m' });
});

test('retains installed architecture dimensions for shadow cache provenance', async () => {
  mode = 'dimensions';
  expect(await createLocalStudyEmbeddingClient(config).inspect()).toMatchObject({ dimensions: 1024 });
});

test.each(['redirect', 'oversized', 'error', 'malformed', 'remote', 'no_embedding'])('rejects %s preflight without inference or redirected requests', async value => {
  mode = value;
  await expect(createLocalStudyEmbeddingClient(config).inspect()).rejects.toThrow();
  expect(requests.every(request => ['/api/tags', '/api/show'].includes(request.path))).toBe(true);
});

test.each(['different_model', 'wrong_count', 'zero'])('rejects %s embedding response', async value => {
  mode = value;
  await expect(createLocalStudyEmbeddingClient(config).embedBatch(['one'], { dimensions: 2 })).rejects.toThrow();
});

test('rejects dimensions, batch budgets, and cancellation before an HTTP request', async () => {
  const client = createLocalStudyEmbeddingClient(config);
  for (const texts of [[], Array(9).fill('x'), ['x'.repeat(1001)], ['']]) {
    await expect(client.embedBatch(texts, { dimensions: 2 })).rejects.toThrow('local_study_embedding_batch_invalid');
  }
  await expect(client.embedBatch(['one'], { dimensions: 0 })).rejects.toThrow();
  await expect(client.inspect({ signal: AbortSignal.abort() })).rejects.toThrow();
  expect(requests).toHaveLength(0);
});

test.each([
  { primary_provider: 'openai' }, { embedding_provider_mode: 'cloud' }, { rag_enabled: false },
  { ollama_host: 'example.com' }, { ollama_host: 'https://127.0.0.1/private' },
  { ollama_host: 'http://user:pass@127.0.0.1' }, { ollama_port: 70000 }, { embedding_model: 'model:cloud' },
])('rejects unsupported configuration %j before network access', override => {
  const fetchRequest = jest.fn();
  expect(() => createLocalStudyEmbeddingClient({ ...config, ...override }, { fetchRequest })).toThrow();
  expect(fetchRequest).not.toHaveBeenCalled();
});

test('uses only explicit separate-Ollama settings when that mode is selected', () => {
  const local = resolveLocalStudyEmbeddingConfig({ ...config, embedding_provider_mode: 'separate_ollama',
    embedding_ollama_host: 'http://127.0.0.1', embedding_ollama_port: 12000, embedding_ollama_model: 'different:tag' });
  expect(local).toEqual({ baseUrl: 'http://127.0.0.1:12000', model: 'different:tag' });
  expect(canonicalStudyModel('test')).toBe(canonicalStudyModel('test:latest'));
});

test.each([
  ['redirect', 'transport'], ['oversized', 'body_limit'], ['error', 'http_busy'], ['malformed', 'json'],
  ['remote', 'representation'], ['no_embedding', 'representation'],
])('classifies actual HTTP inspection failures: %s', async (value, code) => {
  mode = value;
  let error;
  try { await createLocalStudyEmbeddingClient(config).inspect(); } catch (caught) { error = caught; }
  expect(diagnoseProviderResponse(error)).toMatchObject({ code, phase: 'inspection' });
  expect(JSON.stringify(error)).not.toMatch(/PRIVATE|127\.0\.0\.1|https/);
});

test.each([[400, 'http_rejected'], [401, 'http_auth'], [403, 'http_auth'], [404, 'http_missing'],
  [408, 'timeout'], [429, 'http_busy'], [503, 'http_busy']])('classifies HTTP %i without retaining the error body', async (status, code) => {
  const fetchRequest = jest.fn(async () => new Response('PRIVATE token and input', { status }));
  const client = createLocalStudyEmbeddingClient(config, { fetchRequest });
  await expect(client.embedBatch(['one'], { dimensions: 2 })).rejects.toMatchObject({ providerResponseIssue: code });
  expect(fetchRequest).toHaveBeenCalledTimes(1);
});

test.each([
  [null, 'model'], [{ model: 'other', embeddings: [[1, 0]] }, 'model'],
  [{ model: 'test', remote_model: 'private', embeddings: [[1, 0]] }, 'model'],
  [{ model: 'test', embeddings: [] }, 'batch'], [{ model: 'test', embeddings: [null] }, 'shape'],
  [{ model: 'test', embeddings: [[1]] }, 'dimensions'], [{ model: 'test', embeddings: [[null, 1]] }, 'nonfinite'],
  [{ model: 'test', embeddings: [[1e39, 1]] }, 'float32'], [{ model: 'test', embeddings: [[0, 0]] }, 'zero'],
])('diagnoses rejected embedding data without retaining it: %#', async (body, code) => {
  const client = createLocalStudyEmbeddingClient(config, { fetchRequest: async () => new Response(JSON.stringify(body)) });
  let error;
  try { await client.embedBatch(['PRIVATE description'], { dimensions: 2 }); } catch (caught) { error = caught; }
  expect(diagnoseProviderResponse(error)).toMatchObject({ code, phase: 'embedding' });
  expect(JSON.stringify(error)).not.toContain('PRIVATE');
});

test('rejects invalid UTF-8 instead of replacing bytes in a provider response', async () => {
  const client = createLocalStudyEmbeddingClient(config, { fetchRequest: async () => new Response(new Uint8Array([0xc3, 0x28])) });
  await expect(client.embedBatch(['one'], { dimensions: 2 })).rejects.toMatchObject({ providerResponseIssue: 'encoding' });
});

test('an interrupted response stream is a transport failure, not malformed JSON', async () => {
  const client = createLocalStudyEmbeddingClient(config, { fetchRequest: async () => new Response(new ReadableStream({
    start(controller) { controller.error(new Error('PRIVATE stream failure')); },
  })) });
  await expect(client.embedBatch(['one'], { dimensions: 2 })).rejects.toMatchObject({ providerResponseIssue: 'transport' });
});

test('provider recovery backfills only missing descriptions after a rejected partial pass', async () => {
  mode = 'two_dimensions';
  const embedder = createLocalStudyEmbeddingClient(config);
  failEmbeddingAt = 2;
  let time = 0;
  const saved = new Set();
  const texts = new Map(Array.from({ length: 10 }, (_, index) => [String(index).padStart(64, '0'), `Synthetic description ${index}`]));
  const log = { warn: jest.fn(), info: jest.fn() };
  const dependencies = {
    repository: { readState: async () => ({ ...config, busy: false }), readCorpus: async () => ({ texts }) },
    cache: { pruneExpired: async () => 0, findPresent: async () => new Set(saved),
      write: async (identity, entries) => { entries.forEach(entry => saved.add(entry.hash)); } },
    createEmbedder: () => embedder, withSessionAdvisoryLock: async (key, callback) => { await callback(); return true; },
    now: () => time, recovery: createInventoryDescriptionRecovery({ log, now: () => time, random: () => 0 }),
    isolation: createMemoryDescriptionIsolation(() => time), random: () => 0,
  };
  const worker = createInventoryDescriptionRefreshWorker(dependencies);
  expect(await worker.run()).toMatchObject({ status: 'warming_cache', isolatedDescriptions: 2 });
  expect(saved.size).toBe(8);
  const calls = requests.length;
  expect(await worker.run()).toMatchObject({ status: 'waiting_for_retry' });
  expect(requests.slice(calls).map(entry => entry.path)).toEqual(['/api/tags', '/api/show']);
  time += 60_000;
  expect(await worker.run()).toMatchObject({ status: 'up_to_date', cacheHits: 8, embeddedDescriptions: 2 });
  expect(saved.size).toBe(10);
  expect(requests.filter(entry => entry.path === '/api/embed').map(entry => entry.body.input.length)).toEqual([8, 2, 1, 1]);
  expect(log.warn).toHaveBeenCalledTimes(1);
  expect(log.info).toHaveBeenCalledWith('Description backfill caught up', expect.objectContaining({ code: 'batch', validatedDescriptionsCommitted: 2 }));
  const restarted = createInventoryDescriptionRefreshWorker({ ...dependencies,
    recovery: createInventoryDescriptionRecovery({ now: () => time }) });
  expect(await restarted.run()).toMatchObject({ status: 'up_to_date', cacheHits: 10, embeddedDescriptions: 0 });
  expect(requests.filter(entry => entry.path === '/api/embed')).toHaveLength(4);
});
