/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createOmdbSslRecovery, createOmdbSslProbe } from '../services/omdbSslRecovery.mjs';
import { availableOmdbQuotaFixture } from './helpers/omdbQuotaFixture.mjs';
import { providerCredentialContext } from '../services/providerCredentialRejection.mjs';

const config = availableOmdbQuotaFixture();
function setup() {
    const db = { query: jest.fn().mockResolvedValue({ rows: [config] }) };
    const reserve = jest.fn().mockResolvedValue({ status: 'reserved', apiKey: 'committed-key' });
    const probe = jest.fn().mockResolvedValue({ status: 'recovered' });
    return { db, reserve, probe, recover: createOmdbSslRecovery({ db, reserve, probe }) };
}

test('reserves with the saved generation and uses only the committed key', async () => {
    const { recover, reserve, probe, db } = setup();
    expect(await recover(config)).toEqual({ status: 'recovered', code: 'transport_verified' });
    expect(reserve).toHaveBeenCalledWith(db, { pacing: true, expectedContext: providerCredentialContext('omdb', config) });
    expect(probe).toHaveBeenCalledTimes(1);
    expect(probe).toHaveBeenCalledWith('committed-key', { observeResponse: expect.any(Function) });
    expect(db.query).toHaveBeenCalledTimes(1);
});

test.each([null, {}, { ...config, credential_generation: 'bad' }, { ...config, id: -1 }])('invalid context does not reserve: %j', async value => {
    const { recover, reserve, probe } = setup();
    expect(await recover(value)).toEqual({ status: 'deferred', code: 'invalid_configuration' });
    expect(reserve).not.toHaveBeenCalled(); expect(probe).not.toHaveBeenCalled();
});

test('observes with committed context before the completion fence', async () => {
    const { db, reserve } = setup();
    const context = providerCredentialContext('omdb', config);
    reserve.mockResolvedValue({ status: 'reserved', apiKey: 'committed-key', credentialContext: context });
    let finish;
    const observe = jest.fn(() => new Promise(resolve => { finish = resolve; }));
    const response = { status: 200, headers: { 'retry-after': '120' } };
    const probe = jest.fn(async (_key, { observeResponse }) => {
        await observeResponse(response);
        return { status: 'recovered' };
    });
    const pending = createOmdbSslRecovery({ db, reserve, probe, observe })(config);
    await Promise.resolve();
    expect(observe).toHaveBeenCalledWith(response, context);
    expect(db.query).not.toHaveBeenCalled();
    finish();
    expect((await pending).status).toBe('recovered');
    expect(observe).toHaveBeenCalledTimes(1);
});

test.each(['not_configured', 'credentials_rejected', 'invalid_configuration', 'limit_reached', 'lookup_restart', 'paced', 'private-provider-body', undefined])('denied %s never probes', async status => {
    const { recover, reserve, probe, db } = setup();
    reserve.mockResolvedValue(status ? { status } : undefined);
    const expected = !status || status === 'private-provider-body' ? 'admission_unavailable' : status;
    expect(await recover(config)).toEqual({ status: 'deferred', code: expected });
    expect(probe).not.toHaveBeenCalled(); expect(db.query).not.toHaveBeenCalled();
});

test('pending commit does not send; uncertain commit never sends or refunds', async () => {
    const { recover, reserve, probe } = setup();
    let reject;
    reserve.mockImplementation(() => new Promise((_resolve, fail) => { reject = fail; }));
    const pending = recover(config);
    expect(probe).not.toHaveBeenCalled();
    reject(new Error('private commit reply'));
    expect(await pending).toEqual({ status: 'deferred', code: 'admission_unavailable' });
    expect(probe).not.toHaveBeenCalled(); expect(reserve).toHaveBeenCalledTimes(1);
});

test.each([undefined, { ...config, id: 2 }, { ...config, credential_generation: 'changed' }, { ...config, credential_rejected_at: new Date() }])('fences stale recovery %j', async current => {
    const { recover, db } = setup();
    db.query.mockResolvedValue({ rows: current ? [current] : [] });
    expect(await recover(config)).toEqual({ status: 'deferred', code: 'configuration_changed' });
});

test.each(['query', 'probe'])('%s failure cannot disclose or authorize recovery', async collaborator => {
    const { recover, db, probe } = setup();
    (collaborator === 'query' ? db.query : probe).mockRejectedValue(new Error('private-secret'));
    expect(await recover(config)).toEqual({ status: 'deferred', code: 'probe_unavailable' });
});

test.each([
    [{ status: 'ssl_error' }, { status: 'ssl_error', code: 'certificate_validation_failed' }],
    [{ status: 'deferred', code: 'authentication' }, { status: 'deferred', code: 'authentication' }],
    [{ status: 'deferred', code: 'private-secret' }, { status: 'deferred', code: 'probe_unavailable' }],
    [null, { status: 'deferred', code: 'probe_unavailable' }],
])('allowlists probe results %j', async (result, expected) => {
    const { recover, probe } = setup(); probe.mockResolvedValue(result);
    expect(await recover(config)).toEqual(expected);
});

test.each([
    [{ Response: 'True', Title: 'Fixture', imdbID: 'tt0133093', Type: 'movie' }, 'recovered'],
    [{ Response: 'False', Error: 'Movie not found!' }, 'recovered'],
    [{ Response: 'False', Error: 'Invalid API key!' }, 'deferred'],
    [{ Response: 'False', Error: 'Request limit reached!' }, 'deferred'],
    [{ Response: 'True' }, 'deferred'], [null, 'deferred'],
])('bounded probe validates payload %j', async (data, status) => {
    const readJson = jest.fn().mockResolvedValue(data);
    expect((await createOmdbSslProbe({ readJson })('synthetic')).status).toBe(status);
    expect(readJson).toHaveBeenCalledTimes(1);
    expect(readJson).toHaveBeenCalledWith('https://www.omdbapi.com/', {}, { params: { apikey: 'synthetic', t: 'Test' } });
});

test.each([
    [{ code: 'CERT_HAS_EXPIRED' }, 'ssl_error'],
    [{ code: 'ABORT_ERR' }, 'deferred'], [{ code: 'HTTP_RESPONSE_TOO_LARGE' }, 'deferred'],
    [{ code: 'ETIMEDOUT' }, 'deferred'],
    [{ response: { status: 429, data: 'private-body' } }, 'deferred'],
    [{ response: { status: 401, data: { Response: 'False', Error: 'Movie not found!' } } }, 'deferred'],
])('transport failure %j cannot claim recovery', async (error, status) => {
    const readJson = jest.fn().mockRejectedValue({ message: 'private-secret', ...error });
    const result = await createOmdbSslProbe({ readJson })('synthetic');
    expect(result.status).toBe(status); expect(JSON.stringify(result)).not.toContain('private');
});
