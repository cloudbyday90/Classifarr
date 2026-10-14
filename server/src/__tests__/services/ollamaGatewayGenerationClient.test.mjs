/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
const request = jest.fn(), close = jest.fn();
jest.unstable_mockModule('../../ollamaGateway/client.mjs', () => ({ createGatewayClient: () => ({ request, close }) }));
jest.unstable_mockModule('../../utils/logger.mjs', () => ({ createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }) }));
const { createOllamaGatewayGenerationClient } = await import('../../services/ollamaGatewayGenerationClient.mjs');
const model = 'synthetic:latest', digest = 'a'.repeat(64);
const create = () => createOllamaGatewayGenerationClient({ configuration: { baseUrl: 'http://127.0.0.1:11434', model: 'synthetic' }, gateway: { models: [model] } });
beforeEach(() => {
  jest.clearAllMocks();
  request.mockImplementation(async (path, body, options) => {
    options.signal?.throwIfAborted();
    if (path === '/api/tags') return { models: [{ name: model, digest }] };
    if (body.stream) await options.onRecord({ model, done: false, response: 'partial' });
    return { model, done: true, response: 'final' };
  });
});

test.each([undefined, 600000, 150000])('streaming deadline is bounded and carried to transport (%s)', async timeout => {
  const client = create();
  expect(await client.generateWithProgress('test', 'synthetic', 0, null, null, { hardTimeout: timeout })).toBe('partialfinal');
  expect(request.mock.calls[1][2].timeoutMs).toBe(timeout === 150000 ? 150000 : 300000);
  client.close();
});

test('buffered deadline, cancellation and existing schema builder pass through without private options', async () => {
  const client = create(), abort = new AbortController(), format = { type: 'object' };
  expect(await client.generate('test', 'synthetic', 0.9, { timeoutMs: 600000, signal: abort.signal, format, think: 'max', allowPartialOnAbort: false })).toBe('final');
  expect(request.mock.calls[1]).toEqual(['/api/generate', { model, prompt: 'test', stream: false, options: { temperature: 0 }, format, think: 'max' },
    { signal: abort.signal, timeoutMs: 300000 }]);
  client.close(); expect(close).toHaveBeenCalledTimes(1);
});

test('preflight read failure prevents generation and does not expose an unbound fallback', async () => {
  request.mockRejectedValue(new Error('gateway_transport_failed'));
  const client = create();
  await expect(client.generate('test')).rejects.toThrow('gateway_transport_failed');
  expect(request).toHaveBeenCalledTimes(1); expect(client.pullModel).toBeUndefined(); expect(client.embed).toBeUndefined(); client.close();
});

test('generation probe requires nonempty answer or thinking and remains a bounded compute call', async () => {
  const client = create();
  request.mockResolvedValueOnce({ models: [{ name: model, digest }] }).mockResolvedValueOnce({ done: true, response: '', thinking: '' });
  await expect(client.preflightConnection({ probeGeneration: true })).rejects.toMatchObject({ code: 'EINCOMPLETE' });
  expect(request.mock.calls[1][1].options).toEqual({ temperature: 0, num_predict: 4, num_ctx: 4096 });
  client.close();
});

test('model binding is copied at construction; later configuration mutation cannot change it', async () => {
  const configuration = { baseUrl: 'http://127.0.0.1:11434', model: 'synthetic' };
  const client = createOllamaGatewayGenerationClient({ configuration, gateway: { models: [model] } });
  configuration.model = 'other:latest'; configuration.baseUrl = 'http://127.0.0.1:9';
  await expect(client.generate('test', 'other:latest')).rejects.toMatchObject({ code: 'gateway_model_mismatch' });
  expect(request).not.toHaveBeenCalled(); expect(await client.generate('test')).toBe('final'); client.close();
});

test.each([false, true])('cancellation from final-token progress does not emit completion (strict=%s)', async strict => {
  const client = create(), abort = new AbortController(), progress = [];
  request.mockResolvedValueOnce({ models: [{ name: model, digest }] }).mockResolvedValueOnce({ model, done: true, response: 'final' });
  const pending = client.generateWithProgress('test', model, 0, (_count, done) => { progress.push(done); abort.abort('private caller reason'); }, null,
    { signal: abort.signal, requireDoneSignal: strict });
  if (strict) await expect(pending).rejects.toMatchObject({ name: 'AbortError' }); else expect(await pending).toBe('final');
  expect(progress).toEqual([false]); client.close();
});
