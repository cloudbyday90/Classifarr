/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
const request = jest.fn(), close = jest.fn(), createClient = jest.fn(() => ({ request, close }));
jest.unstable_mockModule('../../ollamaGateway/client.mjs', () => ({ createGatewayClient: createClient }));
jest.unstable_mockModule('../../utils/logger.mjs', () => ({ createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }) }));
const { createOllamaGatewayProviderContext } = await import('../../services/ollamaGatewayProviderContext.mjs');
const { validateGatewayBody } = await import('../../ollamaGateway/contract.mjs');
const model = 'synthetic:latest', embeddingModel = 'vectors:latest', digest = 'a'.repeat(64);
const configuration = { baseUrl: 'http://127.0.0.1:11434', model: 'synthetic', embeddingModel: 'vectors' };
const create = (changes = {}) => createOllamaGatewayProviderContext({ configuration: { ...configuration, ...changes }, gateway: { models: [model, embeddingModel] } });
beforeEach(() => {
  jest.clearAllMocks();
  request.mockImplementation(async (path, body) => {
    if (path === '/api/tags' || path === '/api/ps') return { models: [{ name: model, digest }, { name: embeddingModel, digest }, { name: 'other:latest' }] };
    if (path === '/api/version') return { version: 'synthetic' };
    if (path === '/api/show') return { capabilities: ['embedding'] };
    if (path === '/api/embed') return { model: embeddingModel, embeddings: [[0, 1]] };
    return { model, done: true, response: body.prompt ? 'answer' : '' };
  });
});

test('one immutable context owns generation, inspection, embeddings and warming', async () => {
  const context = create();
  expect(Object.isFrozen(context)).toBe(true);
  expect(await context.generate('question')).toBe('answer');
  expect(await context.embed('evidence')).toEqual({ embedding: [0, 1], dims: 2 });
  expect(await context.warmModel()).toEqual({ success: true, model });
  expect(await context.warmEmbeddingModel()).toEqual({ success: true, model: embeddingModel });
  expect(await context.getVersion()).toBe('synthetic');
  expect(await context.getModels()).toHaveLength(2);
  expect(await context.getLoadedModels()).toHaveLength(2);
  expect(await context.getModelInfo(embeddingModel)).toEqual({ capabilities: ['embedding'] });
  expect(createClient).toHaveBeenCalledTimes(1);
  expect(request.mock.calls.filter(([path]) => path === '/api/embed').map(([, body]) => body)).toEqual([
    { model: embeddingModel, input: 'evidence', truncate: false, keep_alive: '5m' },
    { model: embeddingModel, input: 'warmup', truncate: false, keep_alive: '5m' },
  ]);
  expect(context.pullModel).toBeUndefined(); context.close(); context.close(); expect(close).toHaveBeenCalledTimes(1);
});

test.each(['embed', 'warmModel', 'warmEmbeddingModel', 'getModels', 'getLoadedModels', 'getVersion', 'generate', 'preflightConnection'])('%s cannot dispatch after close', async method => {
  const context = create(); context.close();
  await expect(context[method]('text')).rejects.toMatchObject({ code: 'gateway_client_closed' });
  expect(request).not.toHaveBeenCalled();
});

test.each([['127.0.0.1', 9], [null, 11434], ['127.0.0.1', null], ['evil@127.0.0.1', 11434], ['127.0.0.1', '11434/path'], ['127.0.0.1', 65536]])('endpoint overrides fail closed (%s, %s)', (host, port) => {
  const context = create(); expect(() => context.assertEndpoint(host, port)).toThrow('gateway_provider_mismatch');
  expect(request).not.toHaveBeenCalled(); context.close();
});

test('matching endpoint is accepted; inconsistent initial endpoint is refused before client creation', () => {
  const context = create(); context.assertEndpoint('127.0.0.1', '11434'); context.assertEndpoint(); context.close();
  expect(() => create({ host: '127.0.0.1', port: 9 })).toThrow('gateway_provider_mismatch');
  expect(createClient).toHaveBeenCalledTimes(1);
});

test.each([['', embeddingModel, '5m'], [['text'], embeddingModel, '5m'], ['text', model, '5m'], ['text', embeddingModel, '24h']])('unsupported embedding request never dispatches (%j)', async (text, selected, keepAlive) => {
  const context = create(); await expect(context.embed(text, selected, keepAlive)).rejects.toThrow(/^gateway_/);
  expect(request).not.toHaveBeenCalled(); context.close();
});

test.each([[], [{ name: 'vectors:other', digest }], [{ name: embeddingModel, digest }, { name: embeddingModel, digest }]].map(value => [value]))('missing or ambiguous exact embedding model never pulls (%j)', async models => {
  request.mockResolvedValueOnce({ models }); const context = create();
  await expect(context.embed('text')).rejects.toMatchObject({ code: 'MODEL_NOT_FOUND' });
  expect(request).toHaveBeenCalledTimes(1); context.close();
});

test('embedding digest mismatch refuses compute and later mutation cannot change model binding', async () => {
  const settings = { ...configuration }; const context = createOllamaGatewayProviderContext({ configuration: settings, gateway: { models: [model, embeddingModel] } });
  settings.embeddingModel = model;
  await expect(context.embed('text', model)).rejects.toThrow('gateway_model_mismatch');
  await expect(context.embed('text', embeddingModel, '5m', null, { expectedModelDigest: 'b'.repeat(64) })).rejects.toMatchObject({ code: 'MODEL_DIGEST_MISMATCH' });
  expect(request).toHaveBeenCalledTimes(1); context.close();
});

test('optional embedding model is not guessed from generation', async () => {
  const context = create({ embeddingModel: null });
  await expect(context.embed('text')).rejects.toThrow('gateway_model_mismatch');
  await expect(context.warmEmbeddingModel()).rejects.toThrow('gateway_model_mismatch');
  expect(request).not.toHaveBeenCalled(); context.close();
});

test('warming and inspection retain deadlines and cancellation', async () => {
  const context = create(), abort = new AbortController();
  await context.warmModel({ timeoutMs: 900000, signal: abort.signal });
  expect(request.mock.calls[1]).toEqual(['/api/generate', { model, prompt: '', stream: false, keep_alive: '5m' }, { timeoutMs: 300000, signal: abort.signal }]);
  await context.getModelInfo(model, { timeoutMs: 2100, signal: abort.signal });
  expect(request.mock.lastCall).toEqual(['/api/show', { model, verbose: false }, { timeoutMs: 2100, signal: abort.signal }]);
  context.close();
});

test.each([[], [0, 0], [1e100], [1e-100]].map(value => [value]))('embedding evidence must be finite nonzero float32 (%j)', async vector => {
  const context = create(); request.mockResolvedValueOnce({ models: [{ name: embeddingModel, digest }] }).mockResolvedValueOnce({ embeddings: [vector] });
  await expect(context.embed('text')).rejects.toMatchObject({ code: 'INVALID_EMBEDDING' }); context.close();
});

test.each([{ keep_alive: 0 }, { stream: true }, { options: {} }, { think: false }, { format: 'json' }, { keep_alive: '24h' }])('warming contract cannot unload or expand generation (%j)', changes => {
  expect(() => validateGatewayBody('/api/generate', { model, prompt: '', stream: false, keep_alive: '5m', ...changes }, { models: [model] })).toThrow('gateway_body_invalid');
});

test('only bounded buffered warming is admitted', () => {
  const body = { model, prompt: '', stream: false, keep_alive: '5m' };
  expect(validateGatewayBody('/api/generate', body, { models: [model] })).toBe(body);
});
