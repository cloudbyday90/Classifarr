/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { REPRESENTATIVE_SHADOW_VERSION, REPRESENTATIVE_SHADOW_COUNTERS } from './inventoryRepresentativeShadow.mjs';

/** Admin-facing fixed counts only; never copy arbitrary fields from the private observer. */
export function projectRepresentativeShadowSummary(source) {
  if (source?.version !== REPRESENTATIVE_SHADOW_VERSION || source.routingAffected !== false || source.status !== 'available') return null;
  const valid = count => Number.isInteger(count) && count >= 0 && count <= 1000000;
  if (!Number.isInteger(source.pending) || source.pending < 0 || source.pending > 32) return null;
  const counts = {}, latency = {};
  for (const key of REPRESENTATIVE_SHADOW_COUNTERS) {
    if (!valid(source.counts?.[key])) return null;
    counts[key] = source.counts[key];
  }
  for (const key of ['under_1ms', 'under_10ms', 'at_least_10ms']) {
    if (!valid(source.latency?.[key])) return null;
    latency[key] = source.latency[key];
  }
  return { version: REPRESENTATIVE_SHADOW_VERSION, routingAffected: false, status: 'available', pending: source.pending, counts, latency };
}
