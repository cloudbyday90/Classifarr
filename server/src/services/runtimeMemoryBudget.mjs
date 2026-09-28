/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { availableMemory, constrainedMemory } from 'node:process';
import { totalmem } from 'node:os';

const MIB = 1024 * 1024;

/** Linux cgroup-aware; contains no application data or host identifiers. */
export function readRuntimeMemory() {
  return { available: availableMemory(), constrained: constrainedMemory(), total: totalmem() };
}

export function inspectRuntimeMemory(memory) {
  const { available, constrained, total } = memory ?? {};
  if (![available, constrained, total].every(value => Number.isFinite(value) && value >= 0) || total === 0) {
    return null;
  }
  const limit = constrained > 0 ? Math.min(constrained, total) : total;
  return {
    available: Math.min(available, limit),
    reserve: Math.max(128 * MIB, Math.min(512 * MIB, Math.ceil(limit / 8))),
  };
}
