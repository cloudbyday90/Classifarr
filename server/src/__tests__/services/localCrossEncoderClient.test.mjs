/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createLocalCrossEncoderClient, parseCrossEncoderScores, validateCrossEncoderInput } from '../../services/localCrossEncoderClient.mjs';
import { inspectCrossEncoderInfo, resolveCrossEncoderOrigin, CROSS_ENCODER_MODEL_PATH, CROSS_ENCODER_REVISION } from '../../services/localCrossEncoderConfig.mjs';

const info = { model_id: CROSS_ENCODER_MODEL_PATH, model_sha: CROSS_ENCODER_REVISION, version: '1.9.4', model_dtype: 'float32',
  model_type: { reranker: {} }, max_input_length: 512, max_client_batch_size: 16, auto_truncate: false,
  max_concurrent_requests: 16, max_batch_tokens: 512, max_batch_requests: 4, tokenization_workers: 2 };
const input = { query: 'query', texts: ['first', 'second'] };
const response = value => new Response(JSON.stringify(value));
test.each(['https://example.com', 'http://localhost:80', 'http://127.1', 'http://2130706433', 'http://127.0.0.1/path',
  'http://u:p@127.0.0.1', 'http://127.0.0.1?token=private', 'http://127.0.0.1#part', 'ftp://127.0.0.1', 'not a URL', null,
  'http://inventory-cross-encoder.evil:21325', 'http://inventory-cross-encoder:21325/path'])('rejects unsafe endpoint %s', origin => {
  expect(() => resolveCrossEncoderOrigin(origin)).toThrow('endpoint_invalid');
});
test('permits the fixed private service or canonical loopback, verifies identity and restores original indices', async () => {
  expect(resolveCrossEncoderOrigin()).toBe('http://inventory-cross-encoder:21325');
  expect(resolveCrossEncoderOrigin('http://127.0.0.1:21325')).toBe('http://127.0.0.1:21325');
  expect(resolveCrossEncoderOrigin('http://[::1]:21325/')).toBe('http://[::1]:21325');
  const fetchRequest = jest.fn(async url => response(url.endsWith('/info') ? info : [{ index: 1, score: -2 }, { index: 0, score: 3, text: null }]));
  const onScoringCall = jest.fn(), client = createLocalCrossEncoderClient({}, { fetchRequest, now: () => 0 });
  expect(await client.score(input, { onScoringCall })).toMatchObject({ scores: [3, -2], latencyMs: 0 });
  expect(fetchRequest).toHaveBeenCalledTimes(3); expect(onScoringCall).toHaveBeenCalledTimes(1);
  expect(fetchRequest.mock.calls[1][1]).toMatchObject({ redirect: 'error', method: 'POST' });
  expect(JSON.parse(fetchRequest.mock.calls[1][1].body)).toEqual({ ...input, raw_scores: true, return_text: false, truncate: false });
});
test.each([{ model_sha: 'changed' }, { version: 'other' }, { model_dtype: 'float16' }, { model_id: 'remote' },
  { model_type: { embedding: {} } }, { max_input_length: 1024 }, { max_client_batch_size: 1 }, { auto_truncate: true },
  { max_concurrent_requests: 2 }, { max_batch_tokens: 16384 }, { tokenization_workers: 8 }, { max_batch_requests: null }])('rejects runtime drift %j', changes => {
  expect(() => inspectCrossEncoderInfo({ ...info, ...changes })).toThrow('identity_invalid');
});
test.each([[429, 'overloaded'], [422, 'input_rejected'], [413, 'input_rejected'], [400, 'input_rejected']])('HTTP %s has a bounded actionable failure code', async (status, reason) => {
  const client = createLocalCrossEncoderClient({}, { fetchRequest: async () => new Response('PRIVATE', { status }) });
  await expect(client.inspect()).rejects.toThrow(`cross_encoder_${reason}`);
});
test.each([[{ index: 0, score: 1 }, { index: 0, score: 2 }], [{ index: 0, score: '1' }, { index: 1, score: 2 }],
  [{ index: -1, score: 1 }, { index: 1, score: 2 }], [{ index: 0, score: Infinity }, { index: 1, score: 2 }],
  [{ index: 0, score: 1, text: 'PRIVATE' }, { index: 1, score: 2 }], [{ index: 0, score: 1, extra: 1 }, { index: 1, score: 2 }], []].map(rows => [rows]))('rejects malformed scores %#', rows => {
  expect(() => parseCrossEncoderScores(rows, 2)).toThrow('response_invalid');
});
test.each([{ query: '' }, { texts: [] }, { texts: Array(17).fill('x') }, { texts: [null] }, { query: 'x'.repeat(4097) }, { texts: ['x'.repeat(4097)] }])('bounds input %j', changes => {
  expect(() => validateCrossEncoderInput({ ...input, ...changes })).toThrow('input_invalid');
});
test('request budget includes transport option overhead, not only query and texts', () => {
  const value = { query: 'q', texts: Array(16).fill('x'.repeat(4090)) };
  expect(Buffer.byteLength(JSON.stringify(value))).toBeLessThanOrEqual(65536);
  expect(() => validateCrossEncoderInput(value)).toThrow('input_invalid');
});
test.each(['http', 'json', 'oversize', 'utf8', 'network'])('redacts %s failures', async kind => {
  const fetchRequest = jest.fn(async () => {
    if (kind === 'network') throw new Error('PRIVATE token');
    return kind === 'http' ? new Response('PRIVATE', { status: 503 }) : kind === 'json' ? new Response('PRIVATE') :
      kind === 'utf8' ? new Response(new Uint8Array([255])) : new Response('x'.repeat(65537));
  });
  await expect(createLocalCrossEncoderClient({}, { fetchRequest }).inspect()).rejects.toThrow('cross_encoder_transport_unavailable');
});
test('post-inference identity drift cannot publish results, and cancellation makes no request', async () => {
  let calls = 0;
  const fetchRequest = jest.fn(async url => response(url.endsWith('/info') ? { ...info, model_sha: ++calls === 1 ? CROSS_ENCODER_REVISION : 'changed' }
    : [{ index: 0, score: 1 }, { index: 1, score: 2 }]));
  const client = createLocalCrossEncoderClient({}, { fetchRequest });
  await expect(client.score(input)).rejects.toThrow('identity_invalid');
  fetchRequest.mockClear(); const controller = new AbortController(); controller.abort();
  await expect(client.score(input, { signal: controller.signal })).rejects.toThrow();
  expect(fetchRequest).not.toHaveBeenCalled();
});
