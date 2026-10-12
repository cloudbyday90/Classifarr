/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createLoggerModuleMock } from './helpers/mockFactory.mjs';
jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);
const { createHealthObservationCoordinator } = await import('../services/healthObservationCoordinator.mjs');
const { createHealthConfigurationGuard } = await import('../services/healthConfigurationGuard.mjs');
const { readHealthConfiguration } = await import('../services/healthConfigurationRead.mjs');

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

test('shares admission per service without blocking independent checks', async () => {
    const coordinator = createHealthObservationCoordinator();
    const gate = deferred();
    const compute = jest.fn(() => gate.promise);
    const notify = jest.fn();
    const first = coordinator.run('radarr', compute, notify);
    const second = coordinator.run('radarr', compute, notify);
    expect(second).toBe(first);
    expect(await coordinator.run('sonarr', () => ({ status: 'connected' }))).toEqual({ status: 'connected' });
    gate.resolve({ status: 'disconnected' });
    expect(await first).toEqual({ status: 'disconnected' });
    expect(compute).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(coordinator.version()).toBe(2);
    await coordinator.run('radarr', () => ({ status: 'connected' }));
    expect(coordinator.snapshot().radarr.status).toBe('connected');
});

test.each([true, false])('reset fences old completion and cleanup (old finishes first: %s)', async oldFirst => {
    const coordinator = createHealthObservationCoordinator();
    const old = deferred();
    const current = deferred();
    const notify = jest.fn();
    const oldRead = jest.fn().mockResolvedValue({ rows: [] });
    const first = coordinator.run('radarr', async (previous, guard) => {
        await readHealthConfiguration(previous, 'radarr', oldRead, guard);
        return old.promise;
    }, notify);
    await Promise.resolve();
    await Promise.resolve();
    coordinator.reset();
    const second = coordinator.run('radarr', () => current.promise);
    if (oldFirst) {
        old.resolve({ status: 'disconnected' });
        expect((await first).status).toBe('unknown');
        expect(coordinator.run('radarr', () => { throw new Error('duplicate'); })).toBe(second);
    }
    current.resolve({ status: 'connected' });
    await second;
    if (!oldFirst) {
        old.resolve({ status: 'disconnected' });
        expect((await first).status).toBe('connected');
    }
    expect(coordinator.snapshot().radarr.status).toBe('connected');
    expect(notify).not.toHaveBeenCalled();
    expect(oldRead).toHaveBeenCalledTimes(1);
});

test('reset during validation also rejects the old result', async () => {
    const coordinator = createHealthObservationCoordinator();
    const started = deferred();
    const validation = deferred();
    const read = jest.fn().mockResolvedValueOnce({ rows: [] }).mockImplementationOnce(() => {
        started.resolve();
        return validation.promise;
    });
    const first = coordinator.run('tmdb', async (previous, guard) => {
        await readHealthConfiguration(previous, 'tmdb', read, guard);
        return { status: 'connected' };
    });
    await started.promise;
    coordinator.reset();
    validation.resolve({ rows: [] });
    expect((await first).status).toBe('unknown');
});

test('unknown failures release admission for the next normal check without leaking errors', async () => {
    const coordinator = createHealthObservationCoordinator();
    const result = await coordinator.run('tmdb', () => { throw new Error('private_fixture_exception'); });
    expect(result.failure.code).toBe('health_check_failed');
    expect(JSON.stringify(result)).not.toContain('private_fixture_exception');
    expect((await coordinator.run('tmdb', () => ({ status: 'connected' }))).status).toBe('connected');
    expect(() => coordinator.run('__proto__', () => ({}))).toThrow(RangeError);
});

test.each([
    [], [{ id: 1, active: false }], [{ id: 1, token: 'rotated' }],
    [{ id: 2, token: 'before' }], [{ id: 1, url: 'new-endpoint' }],
].map(rows => [rows]))('changed input %j invalidates old result without retaining provider details', async rows => {
    const read = jest.fn().mockResolvedValue({ rows });
    const guard = createHealthConfigurationGuard({ status: 'connected', lastSuccessfulCheck: 'history' }, 'radarr');
    guard.capture(read, [{ id: 1, token: 'before' }]);
    const result = await guard.validate({ status: 'connected', instances: [{ name: 'old private name' }] });
    expect(result).toMatchObject({ status: 'unknown', lastSuccessfulCheck: 'history',
        failure: { stage: 'configuration_validation', code: 'configuration_changed' } });
    expect(result.instances).toBeUndefined();
    expect(JSON.stringify(result)).not.toMatch(/before|rotated|old private name|digest/);
    expect(read).toHaveBeenCalledTimes(1);
});

test('canonical comparison handles key and row order, nested values, dates and empty configuration', async () => {
    for (const [before, after] of [
        [[], []],
        [[{ id: 1, config: { b: [1, null], a: true }, date: new Date(0) }, { id: 2 }],
            [{ id: 2 }, { date: new Date(0), config: { a: true, b: [1, null] }, id: 1 }]],
    ]) {
        const guard = createHealthConfigurationGuard({}, 'rag');
        guard.capture(() => Promise.resolve({ rows: after }), before);
        const observation = { status: 'disabled' };
        expect(await guard.validate(observation)).toBe(observation);
    }
});

test.each(['42P01', '42501', '57014', 'ECONNRESET', undefined])('validation failure %s stays unknown', async code => {
    const guard = createHealthConfigurationGuard({}, 'rag');
    guard.capture(() => Promise.reject(Object.assign(new Error('secret'), { code })), []);
    const result = await guard.validate({ status: 'available' });
    expect(result.status).toBe('unknown');
    expect(result.failure.stage).toBe('configuration_read');
    expect(JSON.stringify(result)).not.toContain('secret');
});

test('failed admission does not re-read; malformed validation and duplicate capture fail closed', async () => {
    const guard = createHealthConfigurationGuard({}, 'rag');
    const observation = { status: 'unknown' };
    expect(await guard.validate(observation)).toBe(observation);
    guard.capture(() => Promise.resolve({ rows: null }), []);
    expect(() => guard.capture(() => {}, [])).toThrow('already captured');
    expect((await guard.validate({ status: 'available' })).failure.code).toBe('configuration_read_invalid');
});
