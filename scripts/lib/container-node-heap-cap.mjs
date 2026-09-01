#!/usr/bin/env node
/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const BYTES_PER_MEBIBYTE = 1024n * 1024n;
export const MINIMUM_HEAP_MEBIBYTES = 256n;
export const MAXIMUM_AUTOMATIC_CGROUP_BYTES = 1024n * 1024n * 1024n * 1024n * 1024n;
export const HEAP_PERCENTAGE = 75n;

function readLimit(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

export function parseCgroupMemoryLimit(rawLimit) {
  const normalized = String(rawLimit ?? '').trim();

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const bytes = BigInt(normalized);
  if (bytes === 0n || bytes >= MAXIMUM_AUTOMATIC_CGROUP_BYTES) {
    return null;
  }

  return bytes;
}

export function calculateNodeHeapCap(limitBytes) {
  if (typeof limitBytes !== 'bigint' || limitBytes <= 0n) {
    return null;
  }

  const heapMebibytes = (limitBytes * HEAP_PERCENTAGE) / 100n / BYTES_PER_MEBIBYTE;
  if (heapMebibytes < MINIMUM_HEAP_MEBIBYTES) {
    return null;
  }

  return {
    heapMebibytes,
    limitMebibytes: limitBytes / BYTES_PER_MEBIBYTE,
  };
}

export function resolveContainerNodeHeapCap({
  cgroupV2Limit = '',
  cgroupV1Limit = '',
} = {}) {
  const limitBytes = parseCgroupMemoryLimit(cgroupV2Limit) ?? parseCgroupMemoryLimit(cgroupV1Limit);
  return limitBytes ? calculateNodeHeapCap(limitBytes) : null;
}

export function readContainerNodeHeapCap({
  cgroupV2Path = '/sys/fs/cgroup/memory.max',
  cgroupV1Path = '/sys/fs/cgroup/memory/memory.limit_in_bytes',
} = {}) {
  return resolveContainerNodeHeapCap({
    cgroupV2Limit: readLimit(cgroupV2Path),
    cgroupV1Limit: readLimit(cgroupV1Path),
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cap = readContainerNodeHeapCap();
  if (cap) {
    process.stdout.write(`${cap.heapMebibytes} ${cap.limitMebibytes}\n`);
  }
}
