/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { createQueueMetadataRecoveryService } from '../services/queueMetadataRecoveryService.mjs';

let claim, repository, provider, readProvider, service;
beforeEach(() => {
  claim = { id: 1, tmdb_id: '42', media_type: 'tv', token: 'lease' };
  repository = { claim: jest.fn().mockResolvedValue(claim), finish: jest.fn().mockResolvedValue(false) };
  provider = { configured: true, revision: 'one', getDetails: jest.fn().mockResolvedValue({ id: 42, name: 'Fixture' }) };
  readProvider = jest.fn(async () => ({ ...provider }));
  service = createQueueMetadataRecoveryService({ repository, readProvider });
});
test('does no provider work when there is no due task', async () => {
  repository.claim.mockResolvedValue(null);
  expect(await service.run()).toEqual({ state: 'idle', queued: 0 });
  expect(readProvider).not.toHaveBeenCalled();
});
test('proves the exact typed identity and revalidates configuration before admission', async () => {
  repository.finish.mockImplementation(async (_claim, outcome, validate) => outcome === 'available' && await validate('transaction'));
  expect(await service.run()).toEqual({ state: 'requeued', queued: 1 });
  expect(provider.getDetails).toHaveBeenCalledWith(42, 'tv', expect.any(AbortSignal));
  expect(readProvider).toHaveBeenLastCalledWith('transaction');
});
test('configuration drift cannot admit a retry', async () => {
  provider.getDetails.mockImplementation(async () => { provider.revision = 'two'; return { id: 42, name: 'Fixture' }; });
  repository.finish.mockImplementation(async (_claim, _outcome, validate) => validate('transaction'));
  expect((await service.run()).queued).toBe(0);
});
test.each([[404, 'not_found'], [429, 'rate_limited'], [401, 'authentication'], [503, 'upstream_error']])('retains bounded failure category for HTTP %s', async (status, category) => {
  provider.getDetails.mockRejectedValue({ response: { status, data: 'secret', headers: { 'retry-after': '86400' } } });
  expect(await service.run()).toEqual({ state: category, queued: 0 });
  expect(repository.finish).toHaveBeenCalledWith(claim, category, expect.any(Function), {
    signal: expect.any(AbortSignal), retryAfterMs: [429,503].includes(status) ? 86400000 : 0,
  });
  expect(JSON.stringify(repository.finish.mock.calls)).not.toContain('secret');
});
test('invalid success is not proof of recovery', async () => {
  provider.getDetails.mockResolvedValue({ id: 43, name: 'Different item' });
  expect(await service.run()).toEqual({ state: 'invalid_response', queued: 0 });
});
test('disabled provider does not call HTTP', async () => {
  provider.configured = false;
  expect((await service.run()).state).toBe('not_configured');
  expect(provider.getDetails).not.toHaveBeenCalled();
});
test('pre-aborted shutdown does not claim work', async () => {
  const controller = new AbortController(); controller.abort();
  await expect(service.run(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(repository.claim).not.toHaveBeenCalled();
});
test('deadline aborts pending work and does not retry it', async () => {
  service = createQueueMetadataRecoveryService({ repository, readProvider, deadlineMs: 15 });
  provider.getDetails.mockImplementation((_id, _type, signal) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));
  expect((await service.run()).state).toBe('timeout');
  expect(provider.getDetails).toHaveBeenCalledTimes(1);
});
