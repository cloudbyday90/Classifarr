/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describeLiveMultiScaleFailure } from './liveMultiScaleFailure.mjs';
const deferred = new Map([
  ['busy', 'Another background job is using the shared work budget. No action is needed; this optional context will retry automatically.'],
  ['memory_pressure', 'Optional comparison work paused to protect memory. If this persists, review container memory usage and competing jobs; do not disable memory safeguards.'],
  ['memory_unknown', 'Available container memory could not be verified. Check runtime memory telemetry and container limits; work will retry without bypassing safeguards.'],
  ['unavailable', 'The inventory readiness check could not complete. Check database health and nearby sanitized error reports; this check will retry automatically.'],
]);
const retrying = new Map([
  ['invalidated', 'Inventory or embedding configuration changed during preparation. The optional context will retry against the current configuration.'],
  ['capacity', 'The optional profile exceeded its cache budget. Review inventory size and memory usage; ordinary retrieval remains available.'],
  ['degraded', 'Optional discovery did not complete fully. Ordinary retrieval remains available while preparation retries.'],
  ['unavailable', 'The cause was not classified. If this persists, open a GitHub issue with the reviewed bug report and image version; omit credentials and raw database or provider logs.'],
]);
const quietReasons = new Set(['disabled', 'waiting_for_libraries', 'waiting_for_inventory', 'ingesting', 'backfilling']);

/** Only fixed categories enter logs; never copy an arbitrary worker report. */
export function describeLiveMultiScaleRetry(report) {
  if (report.status === 'deferred') {
    if (quietReasons.has(report.reason)) return null;
    const reason = deferred.has(report.reason) ? report.reason : 'unknown';
    if (reason === 'unavailable' && report.failure) return { status: 'deferred', reason, ...describeLiveMultiScaleFailure(report.failure) };
    return { status: 'deferred', reason, recovery: deferred.get(reason) ?? retrying.get('unavailable') };
  }
  if (!retrying.has(report.status)) return null;
  if (report.status === 'unavailable' && report.failure) return { status: 'unavailable', reason: 'unavailable', ...describeLiveMultiScaleFailure(report.failure) };
  return { status: report.status, reason: report.status, recovery: retrying.get(report.status) };
}
