/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHealthFreshnessPolicy, describeHealthObservation, isValidHeartbeatInterval, projectHealthDetails } from '../services/healthObservationFreshness.mjs';

const now = Date.parse('2026-10-12T12:00:00.000Z');
const policy = createHealthFreshnessPolicy({ now });
const checked = age => new Date(now - age).toISOString();

describe('health observation freshness', () => {
  test.each([
    [0, 'fresh', 'healthy'], [929999, 'fresh', 'healthy'],
    [930000, 'stale', 'unknown'], [930001, 'stale', 'unknown'],
  ])('expires at the configured interval plus grace: %i ms', (age, state, effectiveStatus) => {
    expect(describeHealthObservation({ status: 'connected', lastCheck: checked(age) }, policy)).toMatchObject({
      observedStatus: 'healthy', effectiveStatus,
      freshness: { state, ageMs: age, checkedAt: checked(age), maxAgeMs: 930000,
        expiresAt: checked(age - 930000) },
    });
  });

  test.each([undefined, null, '', 123, {}, 'yesterday', '2026-02-30T00:00:00.000Z', '2026-10-12T12:00:00+00:00'])('rejects missing or malformed check time %j', lastCheck => {
    expect(describeHealthObservation({ status: 'healthy', lastCheck, lastSuccessfulCheck: checked(0) }, policy)).toMatchObject({
      effectiveStatus: 'unknown', freshness: { state: 'unknown', ageMs: null, checkedAt: null, expiresAt: null },
    });
  });

  test('marks future time unknown and does not replace a bad check time with another timestamp', () => {
    expect(describeHealthObservation({ status: 'connected', lastCheck: checked(-1) }, policy)).toMatchObject({
      effectiveStatus: 'unknown', freshness: { reason: 'check_time_future', ageMs: null },
    });
    expect(describeHealthObservation({ status: 'connected', lastCheck: 'invalid', timestamp: checked(0) }, policy).effectiveStatus).toBe('unknown');
  });

  test('distinguishes a fresh failure from its old successful check and expires that failure later', () => {
    const observation = Object.freeze({ status: 'disconnected', lastCheck: checked(100), lastSuccessfulCheck: checked(1000000) });
    expect(describeHealthObservation(observation, policy).effectiveStatus).toBe('unhealthy');
    const later = createHealthFreshnessPolicy({ now: now + 930000 });
    expect(describeHealthObservation(observation, later)).toMatchObject({ observedStatus: 'unhealthy', effectiveStatus: 'unknown' });
    expect(observation.lastCheck).toBe(checked(100));
  });

  test.each(['disabled', 'not configured', 'not_configured'])('preserves explicit inactive configuration %s without counting it as health', status => {
    expect(describeHealthObservation({ status }, policy)).toMatchObject({ freshness: { state: 'inactive' } });
  });

  test('uses the queue check timestamp and never the receipt timestamp or parent time for an instance', () => {
    const instance = Object.freeze({ status: 'connected', lastCheck: checked(930000) });
    const group = Object.freeze({ status: 'connected', lastCheck: checked(0), instances: Object.freeze([instance]) });
    const result = projectHealthDetails({ radarr: group, queueWorker: { status: 'connected', timestamp: checked(0) }, absent: undefined }, policy);
    expect(result.radarr).toMatchObject({ effectiveStatus: 'unknown', freshness: { reason: 'instance_checks_incomplete' } });
    expect(result.radarr.instances[0]).toMatchObject({ status: 'connected', effectiveStatus: 'unknown' });
    expect(result.queueWorker.effectiveStatus).toBe('healthy');
    expect(result.absent.effectiveStatus).toBe('unknown');
    expect(result.radarr).not.toBe(group);
    expect(result.radarr.instances[0]).not.toBe(instance);
  });

  test.each([
    ['partial', 'connected', 'unknown'], ['disconnected', 'disconnected', 'unhealthy'],
    ['partial', 'disconnected', 'degraded'],
  ])('keeps a current fault visible but never a historical group claim: %s / %s', (status, current, expected) => {
    const result = projectHealthDetails({ radarr: { status, lastCheck: checked(0), instances: [
      { status: 'disconnected', lastCheck: checked(930000) },
      { status: current, lastCheck: checked(0) },
    ] } }, policy);
    expect(result.radarr.effectiveStatus).toBe(expected);
  });

  test('uses the configured interval and retains recency even if the heartbeat is paused', () => {
    const custom = createHealthFreshnessPolicy({ intervalMs: 60000, heartbeatActive: false, now });
    expect(custom).toMatchObject({ intervalMs: 60000, maxAgeMs: 90000, graceMs: 30000, heartbeatActive: false });
    expect(describeHealthObservation({ status: 'connected', lastCheck: checked(89999) }, custom).effectiveStatus).toBe('healthy');
    expect(describeHealthObservation({ status: 'connected', lastCheck: checked(90000) }, custom).effectiveStatus).toBe('unknown');
  });

  test.each([null, 0, -1, 999, 1000.1, NaN, Infinity, '60000', 86400001, 2147483648])('rejects unsafe interval %j', intervalMs => {
    expect(isValidHeartbeatInterval(intervalMs)).toBe(false);
    expect(() => createHealthFreshnessPolicy({ intervalMs })).toThrow(RangeError);
  });
  test.each([1000, 60000, 900000, 86400000])('accepts bounded whole interval %i', intervalMs => {
    expect(isValidHeartbeatInterval(intervalMs)).toBe(true);
  });
});
