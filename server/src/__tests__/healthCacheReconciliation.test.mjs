/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createLoggerModuleMock } from './helpers/mockFactory.mjs';
jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);
const { createHealthObservationCoordinator } = await import('../services/healthObservationCoordinator.mjs');
const { readHealthConfiguration } = await import('../services/healthConfigurationRead.mjs');

function deferred() {
    let resolve;
    const promise = new Promise(yes => { resolve = yes; });
    return { promise, resolve };
}
const observation = {
    status: 'connected', lastCheck: '2026-10-12T12:00:00.000Z',
    lastSuccessfulCheck: '2026-10-12T12:00:00.000Z', instances: [{ name: 'old fixture' }],
};
function probe(read, service = 'radarr', result = observation) {
    return async (previous, guard) => {
        const config = await readHealthConfiguration(previous, service, read, guard);
        return config.ok ? result : config.health;
    };
}

test.each([
    [{ id: 1, enabled: false }], [], [{ id: 2, endpoint: 'new fixture' }],
].map(rows => [rows]))('completed observations invalidate without a provider call for changed rows %j', async changed => {
    const coordinator = createHealthObservationCoordinator();
    const read = jest.fn().mockResolvedValue({ rows: [{ id: 1, enabled: true }] });
    const compute = jest.fn(probe(read));
    const alert = jest.fn();
    await coordinator.run('radarr', compute, alert);
    await coordinator.run('database', () => ({ status: 'connected' }));
    const version = coordinator.version();
    read.mockResolvedValue({ rows: changed });
    await coordinator.reconcile();
    expect(coordinator.snapshot().radarr).toMatchObject({
        status: 'unknown', lastCheck: observation.lastCheck,
        lastSuccessfulCheck: observation.lastSuccessfulCheck,
        failure: { stage: 'configuration_reconciliation', code: 'configuration_changed' },
    });
    expect(coordinator.snapshot().radarr.instances).toBeUndefined();
    expect(coordinator.snapshot().database.status).toBe('connected');
    expect(coordinator.version()).toBe(version + 1);
    expect(compute).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledTimes(1);
    await coordinator.reconcile();
    expect(read).toHaveBeenCalledTimes(3); // invalidated watch is retired
    await coordinator.run('radarr', compute);
    expect(coordinator.snapshot().radarr.status).toBe('connected');
});

test('unchanged and empty configurations keep original observation identity and timestamps', async () => {
    const coordinator = createHealthObservationCoordinator();
    await coordinator.reconcile();
    const read = jest.fn().mockResolvedValue({ rows: [] });
    const initial = await coordinator.run('tmdb', probe(read, 'tmdb', { status: 'not configured', lastCheck: observation.lastCheck }));
    const version = coordinator.version();
    await coordinator.reconcile();
    expect(coordinator.snapshot().tmdb).toBe(initial);
    expect(coordinator.version()).toBe(version);
    read.mockResolvedValue({ rows: [{ api_key: 'private fixture' }] });
    await coordinator.reconcile();
    expect(coordinator.snapshot().tmdb.status).toBe('unknown');
    expect(JSON.stringify(coordinator.snapshot())).not.toContain('private fixture');
});

test.each(['ECONNREFUSED', '42501', '42P01', 'ABORT_ERR', 'UNKNOWN'])('read failure %s retires stale success with safe history', async code => {
    const coordinator = createHealthObservationCoordinator();
    const read = jest.fn().mockResolvedValue({ rows: [] });
    await coordinator.run('radarr', probe(read));
    read.mockRejectedValue(Object.assign(new Error('private fixture'), { code }));
    await coordinator.reconcile();
    const result = coordinator.snapshot().radarr;
    expect(result.status).toBe('unknown');
    expect(result.lastCheck).toBe(observation.lastCheck);
    expect(result.lastSuccessfulCheck).toBe(observation.lastSuccessfulCheck);
    expect(result.failure.stage).toBe('configuration_read');
    expect(result.instances).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('private fixture');
});

test('malformed rows and unexpected serialization failures fail closed', async () => {
    for (const rows of [null, [{ value: 1n }]]) {
        const coordinator = createHealthObservationCoordinator();
        const read = jest.fn().mockResolvedValue({ rows: [] });
        await coordinator.run('radarr', probe(read));
        read.mockResolvedValue({ rows });
        await coordinator.reconcile();
        expect(coordinator.snapshot().radarr.status).toBe('unknown');
        expect(coordinator.snapshot().radarr.lastCheck).toBe(observation.lastCheck);
    }
});

test('shared cycle has at most two concurrent reads and excludes uncaptured/failed observations', async () => {
    const coordinator = createHealthObservationCoordinator();
    const gates = Array.from({ length: 5 }, deferred);
    const reads = [];
    for (const [i, service] of ['radarr', 'sonarr', 'tmdb', 'omdb', 'tavily'].entries()) {
        const read = jest.fn().mockResolvedValue({ rows: [] });
        await coordinator.run(service, probe(read, service));
        read.mockImplementation(() => gates[i].promise);
        read.mockClear();
        reads.push(read);
    }
    await coordinator.run('database', () => ({ status: 'connected' }));
    const failed = jest.fn().mockRejectedValue(new Error('private fixture'));
    await coordinator.run('rag', probe(failed, 'rag'));
    const cycle = coordinator.reconcile();
    expect(coordinator.reconcile()).toBe(cycle);
    expect(reads.map(read => read.mock.calls.length)).toEqual([1, 1, 0, 0, 0]);
    for (const gate of gates) gate.resolve({ rows: [] });
    await cycle;
    expect(reads.map(read => read.mock.calls.length)).toEqual([1, 1, 1, 1, 1]);
    expect(failed).toHaveBeenCalledTimes(1);
});

test('a slow reconciliation cannot invalidate a newer accepted observation', async () => {
    const coordinator = createHealthObservationCoordinator();
    const read = jest.fn().mockResolvedValue({ rows: [] });
    await coordinator.run('radarr', probe(read));
    const oldRead = deferred();
    read.mockReturnValueOnce(oldRead.promise);
    const cycle = coordinator.reconcile();
    const latest = await coordinator.run('radarr', probe(read, 'radarr', { status: 'connected', lastCheck: 'new' }));
    oldRead.resolve({ rows: [{ id: 2 }] });
    await cycle;
    expect(coordinator.snapshot().radarr).toBe(latest);
});

test('invalidation fences an in-flight probe but holds its admission until completion', async () => {
    const coordinator = createHealthObservationCoordinator();
    const read = jest.fn().mockResolvedValue({ rows: [] });
    await coordinator.run('radarr', probe(read));
    const gate = deferred();
    const alert = jest.fn();
    const pending = coordinator.run('radarr', () => gate.promise, alert);
    read.mockResolvedValue({ rows: [{ id: 2 }] });
    await coordinator.reconcile();
    expect(coordinator.run('radarr', () => { throw new Error('duplicate'); })).toBe(pending);
    gate.resolve(observation);
    expect((await pending).status).toBe('unknown');
    expect(alert).not.toHaveBeenCalled();
    await coordinator.run('radarr', probe(read));
    expect(coordinator.snapshot().radarr.status).toBe('connected');
});

test('reset fences reconciliation and prevents old cleanup from replacing new watches', async () => {
    const coordinator = createHealthObservationCoordinator();
    const read = jest.fn().mockResolvedValue({ rows: [] });
    for (const service of ['radarr', 'sonarr', 'tmdb']) await coordinator.run(service, probe(read, service));
    const gate = deferred();
    read.mockReturnValue(gate.promise);
    const cycle = coordinator.reconcile();
    coordinator.reset();
    expect(coordinator.reconcile()).toBe(cycle);
    const freshRead = jest.fn().mockResolvedValue({ rows: [] });
    const latest = await coordinator.run('radarr', probe(freshRead));
    gate.resolve({ rows: [{ id: 2 }] });
    await cycle;
    expect(coordinator.snapshot().radarr).toBe(latest);
    expect(coordinator.snapshot().sonarr.lastCheck).toBeNull();
    await coordinator.reconcile();
    expect(freshRead).toHaveBeenCalledTimes(3);
});

test('failed replacement check retires the previous watch', async () => {
    const coordinator = createHealthObservationCoordinator();
    const read = jest.fn().mockResolvedValue({ rows: [] });
    await coordinator.run('radarr', probe(read));
    await coordinator.run('radarr', () => { throw new Error('private fixture'); });
    await coordinator.reconcile();
    expect(read).toHaveBeenCalledTimes(2);
});

test.each(['connection_probe', 'connection_configuration'])('a provider diagnosis with %s still retires after settings change', async stage => {
    const coordinator = createHealthObservationCoordinator();
    const read = jest.fn().mockResolvedValue({ rows: [{ api_key: 'old synthetic' }] });
    const compute = jest.fn(probe(read, 'omdb', { ...observation, status: 'disconnected',
        failure: { stage, code: 'authentication_failed' } }));
    const accepted = await coordinator.run('omdb', compute);
    await coordinator.reconcile();
    expect(coordinator.snapshot().omdb).toBe(accepted);
    read.mockResolvedValue({ rows: [{ api_key: 'new synthetic' }] });
    await coordinator.reconcile();
    expect(coordinator.snapshot().omdb.failure.code).toBe('configuration_changed');
    expect(compute).toHaveBeenCalledTimes(1);
});
