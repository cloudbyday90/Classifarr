/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { measureConnectionProbe, buildConnectionProbeHealthState } from '../services/healthConnectionProbe.mjs';
import { buildAggregateInstancesHealthState } from '../services/healthCheckServiceShared.mjs';

const previous = { status: 'connected', lastSuccessfulCheck: '2026-10-01T00:00:00.000Z', responseTime: 7 };

test.each([false, true, null, undefined, {}, { success: 'true' }, { success: 1 }])('ambiguous helper result is unknown: %j', async value => {
    const result = buildConnectionProbeHealthState(previous, await measureConnectionProbe(async () => value));
    expect(result.status).toBe('unknown');
    expect(result.lastSuccessfulCheck).toBe(previous.lastSuccessfulCheck);
    expect(result.failure.code).toBe('response_invalid');
});

test('explicit refusal is disconnected and never exposes provider text', async () => {
    const result = buildConnectionProbeHealthState(previous,
        await measureConnectionProbe(async () => ({ success: false, error: 'private-token provider body' })));
    expect(result.status).toBe('disconnected');
    expect(result.lastSuccessfulCheck).toBe(previous.lastSuccessfulCheck);
    expect(JSON.stringify(result)).not.toContain('private-token');
});

test.each([
    [{ response: { status: 401 } }, 'authentication_failed', 'disconnected'],
    [{ response: { status: 403 } }, 'authentication_failed', 'disconnected'],
    [{ response: { status: 429 } }, 'rate_limited', 'disconnected'],
    [{ code: 'ETIMEDOUT' }, 'connection_timeout', 'disconnected'],
    [{ name: 'TimeoutError' }, 'connection_timeout', 'disconnected'],
    [{ code: 'ABORT_ERR' }, 'check_cancelled', 'unknown'],
    [{ name: 'AbortError' }, 'check_cancelled', 'unknown'],
    [{ code: 'HTTP_RESPONSE_TOO_LARGE' }, 'response_too_large', 'unknown'],
    [{ code: 'ECONNREFUSED' }, 'connection_failed', 'disconnected'],
    [null, 'connection_failed', 'disconnected'],
])('sanitizes exceptions: %j', async (fields, code, status) => {
    const probe = await measureConnectionProbe(async () => { throw fields && Object.assign(new Error('secret'), fields); });
    expect(probe.code).toBe(code);
    const result = buildConnectionProbeHealthState(previous, probe);
    expect(result.status).toBe(status);
    expect(result.lastSuccessfulCheck).toBe(previous.lastSuccessfulCheck);
    expect(JSON.stringify(result)).not.toContain('secret');
});

test('only explicit success advances last success', async () => {
    const result = buildConnectionProbeHealthState(previous, await measureConnectionProbe(async () => ({ success: true })));
    expect(result.status).toBe('connected');
    expect(result.lastSuccessfulCheck).not.toBe(previous.lastSuccessfulCheck);
    expect(result.responseTime).toBeGreaterThanOrEqual(0);
});

test.each([
    [['unknown'], 'unknown'], [['unknown', 'disconnected'], 'unknown'],
    [['unknown', 'connected'], 'partial'], [['disconnected'], 'disconnected'],
])('unknown instances cannot imply all probes failed: %j', (statuses, expected) => {
    const result = buildAggregateInstancesHealthState(previous, statuses.map(status => ({ status })));
    expect(result.status).toBe(expected);
    expect(result.lastSuccessfulCheck).toBe(previous.lastSuccessfulCheck);
});
