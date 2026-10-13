/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createOmdbHealthAdmission } from '../services/healthOmdbAdmission.mjs';
import { availableOmdbQuotaFixture } from './helpers/omdbQuotaFixture.mjs';

const previous = { status: 'connected', lastCheck: '2026-10-01T00:00:00Z',
    lastSuccessfulCheck: '2026-10-01T00:00:00Z', responseTime: 12 };
let db, reserve, probe, check;
beforeEach(() => {
    db = {};
    reserve = jest.fn().mockResolvedValue({ status: 'reserved', apiKey: 'reserved-fixture-key' });
    probe = jest.fn().mockResolvedValue({ success: true });
    check = createOmdbHealthAdmission({ db, reserve, probe });
});

test('uses committed credentials with shared pacing and captured generation', async () => {
    const config = availableOmdbQuotaFixture();
    const result = await check(previous, config);
    expect(reserve).toHaveBeenCalledWith(db, { pacing: true,
        expectedContext: { source: 'omdb', id: config.id, generation: config.credential_generation } });
    expect(probe).toHaveBeenCalledTimes(1);
    expect(probe).toHaveBeenCalledWith('reserved-fixture-key', { observeResponse: expect.any(Function) });
    expect(result.status).toBe('connected');
    expect(result.lastSuccessfulCheck).not.toBe(previous.lastSuccessfulCheck);
    expect(JSON.stringify(result)).not.toMatch(/reserved-fixture-key|synthetic|credential/);
});

test.each([
    ['limit_reached', 'local_quota_exhausted'], ['paced', 'provider_wait'],
    ['credentials_rejected', 'credentials_rejected'], ['lookup_restart', 'configuration_changed'],
    ['not_configured', 'configuration_changed'], ['invalid_configuration', 'admission_configuration_invalid'],
    ['unexpected', 'admission_unavailable'],
])('%s never sends HTTP or refreshes last-success history', async (status, code) => {
    reserve.mockResolvedValue({ status, apiKey: 'private-key', error: 'private-error' });
    const result = await check(previous, availableOmdbQuotaFixture());
    expect(result).toMatchObject({ status: 'unknown', responseTime: null,
        lastSuccessfulCheck: previous.lastSuccessfulCheck, previousStatus: 'connected',
        failure: { stage: 'request_admission', code } });
    expect(probe).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toMatch(/private-key|private-error/);
});

test.each([null, undefined, {}])('malformed admission %j fails closed', async admission => {
    reserve.mockResolvedValue(admission);
    expect((await check(previous, availableOmdbQuotaFixture())).failure.code).toBe('admission_unavailable');
    expect(probe).not.toHaveBeenCalled();
});

test.each([{}, { id: 1 }, { id: -1, credential_generation: 'invalid' }])('invalid identity %j does not reserve', async config => {
    expect((await check(previous, config)).failure.code).toBe('admission_configuration_invalid');
    expect(reserve).not.toHaveBeenCalled(); expect(probe).not.toHaveBeenCalled();
});

test('pending commit cannot dispatch and uncertain commit cannot refund/retry', async () => {
    let reject;
    reserve.mockReturnValue(new Promise((_resolve, fail) => { reject = fail; }));
    const pending = check(previous, availableOmdbQuotaFixture());
    await Promise.resolve();
    expect(probe).not.toHaveBeenCalled();
    reject(new Error('private transaction failure'));
    const result = await pending;
    expect(result.failure.code).toBe('admission_unavailable');
    expect(JSON.stringify(result)).not.toContain('private transaction failure');
    expect(reserve).toHaveBeenCalledTimes(1); expect(probe).not.toHaveBeenCalled();
});

test.each([
    [{ success: false, code: 'quota_exhausted' }, 'disconnected', 'quota_exhausted'],
    [{ success: false, code: 'authentication_failed' }, 'disconnected', 'authentication_failed'],
    [null, 'unknown', 'response_invalid'],
])('admitted failure retains the provider outcome %j', async (outcome, status, code) => {
    probe.mockResolvedValue(outcome);
    expect(await check(previous, availableOmdbQuotaFixture())).toMatchObject({ status,
        failure: { stage: 'connection_probe', code }, lastSuccessfulCheck: previous.lastSuccessfulCheck });
    expect(reserve).toHaveBeenCalledTimes(1);
});

test('HTTP exceptions are sanitized without retry', async () => {
    probe.mockRejectedValue(new Error('private upstream body'));
    const result = await check(previous, availableOmdbQuotaFixture());
    expect(result.failure.code).toBe('connection_failed');
    expect(JSON.stringify(result)).not.toContain('private upstream body');
    expect(probe).toHaveBeenCalledTimes(1);
});

test('observes using committed context and awaits saving before publishing health', async () => {
    const context = { source: 'omdb', id: 3, generation: 'committed-generation' };
    reserve.mockResolvedValue({ status: 'reserved', apiKey: 'reserved-fixture-key', credentialContext: context });
    let finish;
    const observe = jest.fn(() => new Promise(resolve => { finish = resolve; }));
    const response = { status: 429, headers: { 'retry-after': '120' } };
    probe.mockImplementation(async (_key, { observeResponse }) => {
        await observeResponse(response);
        return { success: false, code: 'rate_limited' };
    });
    const run = createOmdbHealthAdmission({ db, reserve, probe, observe });
    let complete = false;
    const pending = run(previous, availableOmdbQuotaFixture()).then(result => { complete = true; return result; });
    await Promise.resolve();
    expect(observe).toHaveBeenCalledWith(response, context);
    expect(complete).toBe(false);
    finish();
    expect((await pending).failure.code).toBe('rate_limited');
    expect(observe).toHaveBeenCalledTimes(1);
});
