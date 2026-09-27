/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { verifyInventoryCredential, inventoryCredentialProbeDelay } from '../services/inventoryCredentialProbe.mjs';
import { createInventoryCredentialWakeupService } from '../services/inventoryCredentialWakeupService.mjs';
import { QueueRefillService } from '../services/queueRefillService.mjs';

const valid = { status: 200, data: { change_keys: ['title'], images: { poster_sizes: ['original'], secure_base_url: 'https://image.tmdb.org/t/p/' } } };
test('verification uses shared admission, fixed origin, a deadline and decoded-body limit', async () => {
    const request = jest.fn().mockResolvedValue(valid), execute = jest.fn(fn => fn());
    expect(await verifyInventoryCredential('private-key', { request, execute })).toEqual({ verified: true });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('https://api.themoviedb.org/3/configuration', {
        params: { api_key: 'private-key' }, timeout: 5000, maxResponseBytes: 65536,
    });
});
test.each([null, '', '   ', 7])('empty/invalid key %j never calls the provider', async key => {
    const request = jest.fn();
    expect(await verifyInventoryCredential(key, { request })).toEqual({ verified: false, category: 'authentication' });
    expect(request).not.toHaveBeenCalled();
});
test.each([{}, { status: 201, data: valid.data }, { status: 200, data: '<html>OK</html>' },
    { status: 200, data: { ...valid.data, change_keys: [] } },
    { status: 200, data: { ...valid.data, images: { ...valid.data.images, poster_sizes: [1] } } },
    { status: 200, data: { ...valid.data, images: { ...valid.data.images, secure_base_url: 'http://insecure' } } }])
('does not treat malformed success as verified: %j', async response => {
    expect(await verifyInventoryCredential('fixture', { request: async () => response, execute: fn => fn() }))
        .toEqual({ verified: false, category: 'invalid_response' });
});
test.each([[401, 'authentication'], [403, 'authentication'], [429, 'rate_limited'], [503, 'upstream_error']])
('classifies %i without leaking provider details', async (status, category) => {
    const result = await verifyInventoryCredential('secret', { execute: fn => fn(), request: async () => {
        throw Object.assign(new Error('private-key'), { response: { status, data: 'private', headers: { 'retry-after': '3600' } } });
    } });
    expect(result).toMatchObject({ verified: false, category });
    if ([429, 503].includes(status)) expect(result.retryAfterMs).toBe(3600000);
    expect(JSON.stringify(result)).not.toContain('private');
});
test('probe delays are bounded, jittered and honor Retry-After', () => {
    expect(inventoryCredentialProbeDelay(0, null, () => 0)).toBe(900000);
    expect(inventoryCredentialProbeDelay(100, null, () => 1)).toBe(21600000);
    expect(inventoryCredentialProbeDelay(0, Infinity, () => NaN)).toBe(900000);
    expect(inventoryCredentialProbeDelay(0, 99999999999, () => -1)).toBe(30 * 86400000);
});
test('service coalesces runs and logs only sanitized transition/count information', async () => {
    let release;
    const verify = jest.fn(() => new Promise(resolve => { release = resolve; }));
    const claim = { api_key: 'private', probe_failures: 0 };
    const repository = { claim: jest.fn().mockResolvedValue(claim), finish: jest.fn().mockResolvedValue(true),
        release: jest.fn().mockResolvedValue({ released: 2 }) };
    const logger = { warn: jest.fn(), info: jest.fn() };
    const service = createInventoryCredentialWakeupService({ repository, verify, logger });
    const first = service.run(), second = service.run();
    expect(first).toBe(second); await Promise.resolve();
    release({ verified: false, category: 'authentication' });
    expect(await first).toEqual({ released: 2 });
    expect(verify).toHaveBeenCalledTimes(1); expect(logger.warn).toHaveBeenCalledTimes(1);
    repository.claim.mockResolvedValue({ ...claim, probe_failures: 1, last_failure_category: 'authentication' });
    verify.mockResolvedValue({ verified: false, category: 'authentication' }); await service.run();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('private');
});
test('stale completions do not report success; errors leave ordinary refill operational', async () => {
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn() };
    const repository = { claim: jest.fn().mockResolvedValue({ api_key: 'private', probe_failures: 0 }),
        finish: jest.fn().mockResolvedValue(false), release: jest.fn().mockResolvedValue(null) };
    const service = createInventoryCredentialWakeupService({ repository, logger, verify: async () => ({ verified: true }) });
    expect(await service.run()).toEqual({ released: 0 }); expect(logger.info).not.toHaveBeenCalled();
    repository.claim.mockRejectedValue(new Error('private-database-error'));
    const refill = new QueueRefillService({ logger, wakeInventoryRecovery: () => service.run() });
    refill.selectRefillCandidates = jest.fn().mockResolvedValue([]);
    expect(await refill.refillQueue()).toEqual({ queued: 0 });
    expect(refill.selectRefillCandidates).toHaveBeenCalled();
    expect(JSON.stringify(logger.debug.mock.calls)).not.toContain('private');
});
