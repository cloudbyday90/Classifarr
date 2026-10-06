/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { inspectRuntimeMemory, readRuntimeMemory } from './runtimeMemoryBudget.mjs';
import { DISCOVERY_START_HEADROOM } from './discoveryMemoryBudget.mjs';

const MIB = 1024 * 1024;
const WORK = Object.freeze({
  ingestion: { bytes: 128 * MIB, maximum: 2 },
  queue: { bytes: 64 * MIB, maximum: 25 },
  discovery: { bytes: DISCOVERY_START_HEADROOM, maximum: 1 },
});

/** Cooperative, process-local budget. Database ownership remains authoritative. */
export function createBackgroundResourceAdmission({ readMemory = readRuntimeMemory, onDecision = null } = {}) {
  const active = { ingestion: 0, queue: 0, discovery: 0 };
  const recovering = { ingestion: false, queue: false, discovery: false };
  let reserved = 0;
  // Opt-in aggregate diagnostics only. Never expose a permit or mutable policy state.
  const observe = (kind, allowed, reason, budget = {}) => {
    if (!onDecision) return;
    try { onDecision(Object.freeze({ kind, allowed, reason, reservedBytes: reserved, ...budget })); }
    catch { /* Diagnostics cannot reject work or leak a reservation. */ }
  };

  return {
    tryAcquire(kind) {
      if (!Object.hasOwn(WORK, kind)) throw new TypeError('Unknown background work class');
      const { bytes, maximum } = WORK[kind];
      if (active[kind] >= maximum || (kind === 'discovery' && active.ingestion + active.queue > 0)) {
        observe(kind, false, 'busy');
        return { allowed: false, reason: 'busy' };
      }
      let memory;
      try { memory = inspectRuntimeMemory(readMemory()); } catch { /* Unknown telemetry fails closed. */ }
      if (!memory) {
        recovering[kind] = true;
        observe(kind, false, 'memory_unknown');
        return { allowed: false, reason: 'memory_unknown' };
      }
      const hysteresis = recovering[kind] ? 64 * MIB : 0;
      const required = memory.reserve + reserved + bytes + hysteresis;
      const budget = onDecision ? { availableBytes: memory.available, reserveBytes: memory.reserve,
        workBytes: bytes, hysteresisBytes: hysteresis, requiredBytes: required } : undefined;
      if (memory.available < required) {
        recovering[kind] = true;
        observe(kind, false, 'memory_pressure', budget);
        return { allowed: false, reason: 'memory_pressure' };
      }
      recovering[kind] = false;
      const reservedBefore = reserved;
      active[kind] += 1;
      reserved += bytes;
      if (onDecision) observe(kind, true, null, { ...budget, reservedBytes: reservedBefore });
      let released = false;
      return {
        allowed: true,
        release() {
          if (released) return;
          released = true;
          active[kind] -= 1;
          reserved -= bytes;
        },
      };
    },
  };
}

export const backgroundResourceAdmission = createBackgroundResourceAdmission();
