/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { availableMemory, constrainedMemory } from 'node:process';
import { totalmem } from 'node:os';

const MIB = 1024 * 1024;
export const DISCOVERY_START_HEADROOM = 768 * MIB;

/** OS-aware on Linux cgroups; no raw host configuration or content in telemetry. */
export function readDiscoveryMemory() {
  return { available: availableMemory(), constrained: constrainedMemory(), total: totalmem() };
}

export function assessDiscoveryMemory(memory, starting = false) {
  const { available, constrained, total } = memory ?? {};
  if (![available, constrained, total].every(value => Number.isFinite(value) && value >= 0) || total === 0) {
    return { allowed: false, reason: 'memory_unknown' };
  }
  const limit = constrained > 0 ? Math.min(constrained, total) : total;
  const reserve = Math.max(128 * MIB, Math.min(512 * MIB, Math.ceil(limit / 8)));
  const required = reserve + (starting ? DISCOVERY_START_HEADROOM : 0);
  return { allowed: Math.min(available, limit) >= required, reason: 'memory_pressure', reserve, required };
}
