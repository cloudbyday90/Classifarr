/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { withRetry, isRetryableError } from '../utils/retryUtils.mjs';
import { EMBEDDING_MAX_RESPONSE_BYTES, postEmbeddingRequest } from '../services/embeddingHttpClient.mjs';
import { embeddingVector, embeddingResponse, embeddingShapes, expandedEmbeddingResponse } from './fixtures/embeddingResponseFixtures.mjs';

const logCost = jest.fn();
const logger = { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
jest.unstable_mockModule('../utils/logger.mjs', () => ({ createLogger: () => logger }));
jest.unstable_mockModule('../config/database.mjs', () => ({ query: jest.fn(), pool: {} }));
jest.unstable_mockModule('../services/cloudLLMUsage.mjs', () => ({ logEmbeddingCost: logCost }));
jest.unstable_mockModule('../services/ollama.mjs', () => ({ ollamaService: {
  embed: (...args) => sharedOllama(() => ({ baseUrl: base }), async () => [{ name: 'fixture' }], jest.fn(), ...args),
} }));
const { embed: sharedOllama, generate } = await import('../services/ollamaGeneration.mjs');
const { embed: sharedCloud, embedGemini: sharedGemini } = await import('../services/cloudLLMEmbeddings.mjs');
const { createAdapterMethods } = await import('../services/embeddingProviderAdapters.mjs');
const { embedLocal, embedVertex, embedVoyage, embedCohere, getLocalModels } = await import('../services/imageEmbeddingProviders.mjs');
const { warmEmbeddingModel } = await import('../services/ollamaModelWarming.mjs');

let server;
let base;
let body;
let compressed;
let status;
let calls;
const recordRetry = jest.fn();
const adapters = createAdapterMethods({ getAdaptiveTimeout: () => 5000, createRetriedOperation: withRetry, recordRetry });
const cloudConfig = () => ({ primary_provider: 'custom', api_endpoint: base, api_key: 'fixture-key' });
const imageOptions = () => ({ apiKey: 'fixture-key', apiEndpoint: base, model: 'fixture', imageSize: 512 });
const localConfig = () => ({ image_embedding_local_host: '127.0.0.1', image_embedding_local_port: server.address().port });
const cases = [
  ['OpenAI', 'openai', () => adapters.getOpenAIEmbedding('fixture', 'fixture-key', 'text-embedding-3-large')],
  ['Gemini', 'gemini', () => adapters.getGeminiEmbedding('fixture', 'fixture-key', 'fixture')],
  ['Voyage', 'openai', () => adapters.getVoyageEmbedding('fixture', 'fixture-key', 'fixture')],
  ['OpenRouter', 'openai', () => adapters.getOpenRouterEmbedding('fixture', 'fixture-key', 'fixture')],
  ['Cohere', 'cohere', () => adapters.getCohereEmbedding('fixture', 'fixture-key', 'fixture')],
  ['direct Ollama', 'ollama', () => adapters.getOllamaEmbedding('fixture', '127.0.0.1', server.address().port, 'fixture', {})],
  ['shared Ollama', 'ollama', () => adapters.getOllamaEmbedding('fixture', null, null, 'fixture', {})],
  ['same-provider cloud', 'openai', () => sharedCloud('fixture', cloudConfig())],
  ['same-provider Gemini', 'gemini', () => sharedGemini('fixture', { api_key: 'fixture-key' })],
  ['local image', 'sidecar', () => embedLocal(base + '/image', localConfig(), imageOptions(), 'fixture-key')],
  ['Vertex image', 'vertex', () => embedVertex(base + '/image', imageOptions())],
  ['Voyage image', 'openai', () => embedVoyage(base + '/image', imageOptions())],
  ['Cohere image', 'cohere', () => embedCohere(base + '/image', imageOptions())],
];

beforeAll(async () => {
  server = createServer((req, res) => {
    req.resume();
    if (req.url === '/image') { res.end('fixture-image'); return; }
    calls++;
    const data = compressed ? gzipSync(body) : body;
    res.writeHead(status, { 'Content-Type': 'application/json', Connection: 'close',
      ...(compressed ? { 'Content-Encoding': 'gzip', 'Content-Length': data.length } : {}) });
    res.end(data);
  });
  await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(() => {
  compressed = false; status = 200; calls = 0;
  jest.clearAllMocks();
  // Exercise real HTTP consumption while ensuring no provider can be contacted.
  const nativeFetch = globalThis.fetch;
  jest.spyOn(globalThis, 'fetch').mockImplementation((url, options) =>
    nativeFetch(String(url).startsWith(base) ? url : base + '/provider', options));
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  server.closeAllConnections();
  await new Promise(resolve => { server.close(resolve); });
});

test.each(cases)('%s accepts the expanded single-vector compatibility envelope', async (_name, shape, run) => {
  body = expandedEmbeddingResponse(shape);
  expect(Buffer.byteLength(body)).toBeGreaterThan(1024 * 1024);
  expect(Buffer.byteLength(body)).toBeLessThan(EMBEDDING_MAX_RESPONSE_BYTES / 2);
  const result = await run();
  expect(result.embedding).toEqual(embeddingVector(16000));
  expect(result.dims).toBe(16000);
  expect(calls).toBe(1);
});

describe.each([['empty', []], ['null component', [null]], ['numeric string', ['0.1']],
  ['float32 overflow', [1e39]], ['zero norm', [0, 0]], ['too many dimensions', new Array(16001).fill(1)]])
('%s vector responses', (_label, vector) => {
  test.each(cases)('%s rejects before cost accounting or immediate retry', async (_provider, shape, run) => {
    body = JSON.stringify(embeddingResponse(shape, vector));
    await expect(run()).rejects.toMatchObject({ code: 'INVALID_EMBEDDING' });
    expect(logCost).not.toHaveBeenCalled();
    expect(recordRetry).not.toHaveBeenCalled();
    expect(calls).toBe(1);
  });
});

test.each(cases)('%s rejects a missing response vector', async (_provider, _shape, run) => {
  body = '{}';
  await expect(run()).rejects.toMatchObject({ code: 'INVALID_EMBEDDING' });
  expect(logCost).not.toHaveBeenCalled();
  expect(recordRetry).not.toHaveBeenCalled();
  expect(calls).toBe(1);
});

test('warmup does not report a malformed embedding as healthy', async () => {
  body = JSON.stringify({ embeddings: [[]] });
  await expect(warmEmbeddingModel(async () => ({ host: '127.0.0.1', port: server.address().port }), 'fixture'))
    .resolves.toMatchObject({ success: false, errorCode: 'INVALID_EMBEDDING' });
  expect(calls).toBe(1);
});

describe.each([['plain', false, 200], ['compressed error', true, 503]])('%s oversized bodies', (_name, gzip, responseStatus) => {
  test.each(cases)('%s rejects without parsing, cost-success recording or immediate retry', async (_provider, shape, run) => {
    body = JSON.stringify({ ...embeddingResponse(shape, [0.1]), private: 'x'.repeat(EMBEDDING_MAX_RESPONSE_BYTES) });
    compressed = gzip; status = responseStatus;
    if (compressed) expect(gzipSync(body).length).toBeLessThan(EMBEDDING_MAX_RESPONSE_BYTES);
    const result = run();
    await expect(result).rejects.toMatchObject({ code: 'HTTP_RESPONSE_TOO_LARGE', maxBytes: EMBEDDING_MAX_RESPONSE_BYTES });
    const error = await result.catch(value => value);
    expect(error.message).toBe('HTTP response exceeds the configured byte limit');
    expect(error.response).toBeUndefined();
    expect(error.cause).toBeUndefined();
    expect(isRetryableError(error)).toBe(false);
    expect(recordRetry).not.toHaveBeenCalled();
    expect(logCost).not.toHaveBeenCalled();
    expect(calls).toBe(1);
  });
});

test.each(embeddingShapes)('accepts registered and reviewed dimensions in the %s response shape', async shape => {
  for (const dims of [384, 768, 1024, 1408, 1536, 2048, 3072]) {
    const expected = embeddingResponse(shape, embeddingVector(dims));
    body = JSON.stringify(expected);
    expect((await postEmbeddingRequest(base, {})).data).toEqual(expected);
  }
});

test('enforces the exact decoded boundary despite caller override attempts', async () => {
  const json = JSON.stringify(embeddingResponse('openai', [0.1]));
  body = json + ' '.repeat(EMBEDDING_MAX_RESPONSE_BYTES - Buffer.byteLength(json));
  await expect(postEmbeddingRequest(base, {}, { maxResponseBytes: 1 })).resolves.toMatchObject({ data: JSON.parse(json) });
  body += ' ';
  await expect(postEmbeddingRequest(base, {}, { maxResponseBytes: Infinity }))
    .rejects.toMatchObject({ code: 'HTTP_RESPONSE_TOO_LARGE' });
});

test('warmup uses the same budget and reports its existing failure envelope', async () => {
  body = expandedEmbeddingResponse('ollama');
  const getConfig = async () => ({ host: '127.0.0.1', port: server.address().port });
  await expect(warmEmbeddingModel(getConfig, 'fixture')).resolves.toMatchObject({ success: true });
  body = 'x'.repeat(EMBEDDING_MAX_RESPONSE_BYTES + 1);
  await expect(warmEmbeddingModel(getConfig, 'fixture')).resolves.toMatchObject({ success: false, errorCode: 'HTTP_RESPONSE_TOO_LARGE' });
});

test('generation and model lists retain their separate response-size contracts', async () => {
  const padding = 'x'.repeat(EMBEDDING_MAX_RESPONSE_BYTES + 1);
  body = JSON.stringify({ response: 'generated', padding });
  await expect(generate(async () => ({ baseUrl: base }), 'fixture')).resolves.toBe('generated');
  body = JSON.stringify({ models: [{ id: 'fixture', dims: 512 }], padding });
  await expect(getLocalModels(localConfig())).resolves.toMatchObject([{ id: 'fixture', dims: 512 }]);
});
