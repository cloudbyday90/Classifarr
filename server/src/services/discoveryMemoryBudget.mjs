/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { inspectRuntimeMemory, readRuntimeMemory } from './runtimeMemoryBudget.mjs';

const MIB = 1024 * 1024;
export const DISCOVERY_START_HEADROOM = 768 * MIB;

/** OS-aware on Linux cgroups; no raw host configuration or content in telemetry. */
export const readDiscoveryMemory = readRuntimeMemory;

export function assessDiscoveryMemory(memory, starting = false) {
  const inspected = inspectRuntimeMemory(memory);
  if (!inspected) return { allowed: false, reason: 'memory_unknown' };
  const { available, reserve } = inspected;
  const required = reserve + (starting ? DISCOVERY_START_HEADROOM : 0);
  return { allowed: available >= required, reason: 'memory_pressure', reserve, required };
}
