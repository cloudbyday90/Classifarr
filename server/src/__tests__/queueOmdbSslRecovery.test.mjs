/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { QueueTaskProcessorService } from '../services/queueTaskProcessorService.mjs';
import { createMockLogger } from './helpers/mockFactory.mjs';
import { availableOmdbQuotaFixture } from './helpers/omdbQuotaFixture.mjs';

const config = availableOmdbQuotaFixture();
function setup() {
    const probeOmdbSslRecovery = jest.fn().mockResolvedValue({ status: 'recovered' });
    const service = new QueueTaskProcessorService({ probeOmdbSslRecovery, logger: createMockLogger(), db: {} });
    service.omdbSslBlockedUntil = Date.now() + 900_000;
    return { service, probe: probeOmdbSslRecovery };
}

test.each(['no_block', 'expired', 'not_due'])('%s performs no recovery work', async state => {
    const { service, probe } = setup();
    if (state === 'no_block') service.omdbSslBlockedUntil = 0;
    if (state === 'expired') service.omdbSslBlockedUntil = Date.now() - 1;
    if (state === 'not_due') service.lastOmdbSslProbeAt = Date.now();
    expect(await service.isOmdbSslBlocked(config)).toBe(state === 'not_due');
    expect(probe).not.toHaveBeenCalled();
});

test('verified recovery clears pause and warnings', async () => {
    const { service, probe } = setup(); service.lastOmdbSslWarnAt = 42;
    expect(await service.isOmdbSslBlocked(config)).toBe(false);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(probe).toHaveBeenCalledWith(config);
    expect(service.omdbSslBlockedUntil).toBe(0); expect(service.lastOmdbSslWarnAt).toBe(0);
});

test.each([false, true])('certificate failure extends pause; warning throttled=%s', async throttled => {
    const { service, probe } = setup();
    service.omdbSslBlockedUntil = Date.now() + 20_000;
    if (throttled) service.lastOmdbSslWarnAt = Date.now();
    probe.mockResolvedValue({ status: 'ssl_error', code: 'certificate_validation_failed' });
    expect(await service.isOmdbSslBlocked(config)).toBe(true);
    expect(service.omdbSslBlockedUntil).toBeGreaterThan(Date.now() + 800_000);
    expect(service.logger.warn).toHaveBeenCalledTimes(throttled ? 0 : 1);
});

test.each(['paced', 'limit_reached', 'configuration_changed', 'admission_unavailable', 'authentication'])('%s retains pause and reports only fixed reason', async code => {
    const { service, probe } = setup(); const before = service.omdbSslBlockedUntil;
    probe.mockResolvedValue({ status: 'deferred', code });
    expect(await service.isOmdbSslBlocked(config)).toBe(true);
    expect(service.omdbSslBlockedUntil).toBe(before);
    expect(service.logger.debug).toHaveBeenCalledWith('OMDb SSL recovery remains pending', { reasonCode: code });
});

test('unexpected error is sanitized and releases in-flight flag', async () => {
    const { service, probe } = setup(); probe.mockRejectedValue(new Error('private-secret'));
    expect(await service.isOmdbSslBlocked(config)).toBe(true);
    expect(service.omdbSslRecoveryInFlight).toBe(false);
    expect(JSON.stringify(service.logger.debug.mock.calls)).not.toContain('private');
});

test.each(['concurrent', 'reset', 'new_pause'])('in-flight %s cannot duplicate or clear newer state', async state => {
    const { service, probe } = setup(); let resolve;
    probe.mockImplementation(() => new Promise(done => { resolve = done; }));
    const pending = service.isOmdbSslBlocked(config);
    service.lastOmdbSslProbeAt = 0; // Simulate the local cadence becoming due while HTTP remains pending.
    if (state === 'reset') {
        service.resetOmdbState();
        service.omdbSslBlockedUntil = Date.now() + 900_000;
    }
    if (state === 'new_pause') service.queueOmdbEnrichmentService.setRuntimeState({ omdbSslBlockedUntil: service.omdbSslBlockedUntil });
    expect(await service.isOmdbSslBlocked(config)).toBe(true);
    expect(probe).toHaveBeenCalledTimes(1);
    resolve({ status: 'recovered' });
    expect(await pending).toBe(state !== 'concurrent');
    expect(service.omdbSslRecoveryInFlight).toBe(false);
    expect(service.omdbSslBlockedUntil === 0).toBe(state === 'concurrent');
});
