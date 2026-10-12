/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createLoggerModuleMock } from './helpers/mockFactory.mjs';
const mockLogger = createLoggerModuleMock();
jest.unstable_mockModule('../utils/logger.mjs', () => mockLogger.module);
const { readHealthConfiguration, buildUnknownHealthState } = await import('../services/healthConfigurationRead.mjs');

const previous = Object.freeze({ status: 'connected', lastSuccessfulCheck: '2026-10-11T12:00:00.000Z', responseTime: 12,
    instances: [{ name: 'private history', status: 'connected' }], credentials: 'never copy' });

beforeEach(() => { mockLogger.logger.warn.mockReset(); });

test.each([
    ['08000', 'unavailable'], ['08001', 'unavailable'], ['08003', 'unavailable'], ['08006', 'unavailable'],
    ['53300', 'unavailable'], ['57P01', 'unavailable'], ['57P02', 'unavailable'], ['57P03', 'unavailable'],
    ['ECONNREFUSED', 'unavailable'], ['ECONNRESET', 'unavailable'], ['ETIMEDOUT', 'unavailable'], ['EAI_AGAIN', 'unavailable'],
    ['42P01', 'schema'], ['42703', 'schema'], ['42501', 'access'], ['28P01', 'access'], ['28000', 'access'],
    ['57014', 'cancelled'], ['ABORT_ERR', 'cancelled'], ['private-code\nsecret', 'failed'], [undefined, 'failed'],
])('classifies %s without parsing or leaking exception text', async (code, category) => {
    const codes = { unavailable: 'configuration_read_unavailable', schema: 'configuration_schema_unavailable',
        access: 'configuration_access_denied', cancelled: 'configuration_read_cancelled', failed: 'configuration_read_failed' };
    const read = jest.fn().mockRejectedValue(Object.assign(new Error('private SQL/password/token\nsecret'), { code }));
    const result = await readHealthConfiguration(previous, 'radarr', read);
    expect(read).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ ok: false, health: { status: 'unknown', responseTime: null, previousResponseTime: 12,
        previousStatus: 'connected', lastSuccessfulCheck: previous.lastSuccessfulCheck,
        failure: { stage: 'configuration_read', code: codes[category] } } });
    expect(Number.isFinite(Date.parse(result.health.lastCheck))).toBe(true);
    expect(result.health).not.toHaveProperty('instances');
    expect(JSON.stringify([result, mockLogger.logger.warn.mock.calls])).not.toMatch(/private-code|private history|secret|SQL\/password|never copy/);
    expect(mockLogger.logger.warn).toHaveBeenCalledWith('Health observation could not be completed', {
        service: 'radarr', ...result.health.failure, checkedAt: result.health.lastCheck,
    }, { skipDbPersist: true });
});

test.each([undefined, null, {}, { rows: null }, { rows: {} }, { rows: [null] }, { rows: ['secret'] }, { rows: [[]] }])(
    'invalid result %j is not absence', async result => {
        const observed = await readHealthConfiguration({}, 'rag', async () => result);
        expect(observed.health.failure.code).toBe('configuration_read_invalid');
        expect(observed.health.status).toBe('unknown');
    });

test.each([{ rows: [] }, { rows: [{ id: 1 }] }])('returns successful rows, including empty configuration', async ({ rows }) => {
    const result = await readHealthConfiguration({}, 'radarr', async () => ({ rows }));
    expect(result).toEqual({ ok: true, rows });
    expect(mockLogger.logger.warn).not.toHaveBeenCalled();
});

test('same failure is quiet until recovery or a different failure, without a separate cache', async () => {
    const read = async () => { throw null; };
    const first = await readHealthConfiguration(undefined, 'radarr', read);
    const second = await readHealthConfiguration(first.health, 'radarr', read);
    expect(second.health.lastSuccessfulCheck).toBeNull();
    expect(mockLogger.logger.warn).toHaveBeenCalledTimes(1);
    buildUnknownHealthState(second.health, 'radarr');
    expect(mockLogger.logger.warn).toHaveBeenCalledTimes(2);
});

test('unexpected stages and service names are bounded and exceptions are ignored', () => {
    const result = buildUnknownHealthState(previous, 'private service', 'private stage', new Error('secret'));
    expect(result.failure).toEqual({ stage: 'health_check', code: 'health_check_failed' });
    expect(mockLogger.logger.warn.mock.calls[0][1].service).toBe('unknown');
    expect(JSON.stringify([result, mockLogger.logger.warn.mock.calls])).not.toMatch(/private service|private stage|secret/);
});

test.each(['sync', 'async'])('logging %s failure cannot replace or reject unknown health', async kind => {
    mockLogger.logger.warn.mockImplementation(() => {
        if (kind === 'sync') throw new Error('logging failed');
        return Promise.reject(new Error('logging failed'));
    });
    const result = await readHealthConfiguration(previous, 'radarr', async () => { throw new Error('db failed'); });
    expect(result.health.status).toBe('unknown');
    await Promise.resolve();
});
