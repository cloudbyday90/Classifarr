/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { normalizeServiceHealthStatus } from './serviceHealthSummary.mjs';

export const DEFAULT_HEARTBEAT_MS = 15 * 60 * 1000;
export const HEALTH_CHECK_GRACE_MS = 30000;

export function isValidHeartbeatInterval(intervalMs) {
  return Number.isSafeInteger(intervalMs) && intervalMs >= 1000 && intervalMs <= 86400000;
}

export function createHealthFreshnessPolicy({ intervalMs = DEFAULT_HEARTBEAT_MS, heartbeatActive = false, now = Date.now() } = {}) {
  if (!isValidHeartbeatInterval(intervalMs)) throw new RangeError('Invalid heartbeat interval');
  return { evaluatedAt: new Date(now).toISOString(), intervalMs, graceMs: HEALTH_CHECK_GRACE_MS,
    maxAgeMs: intervalMs + HEALTH_CHECK_GRACE_MS, heartbeatActive: heartbeatActive === true };
}

function parseCheckTime(value) {
  if (typeof value !== 'string' || (value.length !== 20 && value.length !== 24)) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  const canonical = new Date(time).toISOString();
  return value === canonical || value === canonical.replace('.000Z', 'Z') ? time : null;
}

/** Pure, read-only projection. A response timestamp cannot renew a check. */
export function describeHealthObservation(observation, policy) {
  const observedStatus = normalizeServiceHealthStatus(observation?.status);
  const now = Date.parse(policy.evaluatedAt);
  const rawTime = observation?.lastCheck ?? observation?.timestamp;
  const time = parseCheckTime(rawTime);
  const ageMs = time === null || time > now ? null : now - time;
  let state = 'unknown';
  let reason = rawTime == null ? 'check_time_missing' : 'check_time_invalid';
  if (time !== null) {
    if (time > now) reason = 'check_time_future';
    else if (ageMs >= policy.maxAgeMs) { state = 'stale'; reason = 'check_overdue'; }
    else { state = 'fresh'; reason = 'within_budget'; }
  }
  if (observedStatus === 'disabled' || observedStatus === 'not_configured') {
    state = 'inactive'; reason = 'inactive_configuration';
  }
  return {
    observedStatus,
    effectiveStatus: state === 'fresh' || state === 'inactive' ? observedStatus : 'unknown',
    freshness: { state, reason, checkedAt: time === null ? null : new Date(time).toISOString(),
      ageMs, maxAgeMs: policy.maxAgeMs,
      expiresAt: time === null ? null : new Date(time + policy.maxAgeMs).toISOString() },
  };
}

export function projectHealthDetails(details, policy) {
  return Object.fromEntries(Object.entries(details).map(([key, observation]) => {
    const projected = { ...observation, ...describeHealthObservation(observation, policy) };
    if (Array.isArray(observation?.instances)) {
      projected.instances = observation.instances.map(instance => ({ ...instance, ...describeHealthObservation(instance, policy) }));
      const incomplete = projected.instances.some(instance => instance.effectiveStatus === 'unknown');
      const currentFault = projected.instances.some(instance => ['unhealthy', 'degraded'].includes(instance.effectiveStatus));
      // A current fault still proves a problem. Without one, incomplete instance
      // observations cannot support a current healthy/degraded group claim.
      if (projected.freshness.state === 'fresh' && incomplete && !currentFault) {
        projected.effectiveStatus = 'unknown';
        projected.freshness = { ...projected.freshness, state: 'unknown', reason: 'instance_checks_incomplete' };
      }
    }
    return [key, projected];
  }));
}
