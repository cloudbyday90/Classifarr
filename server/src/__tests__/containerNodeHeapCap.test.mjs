/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * Licensed under GPL-3.0 - See LICENSE file for details.
 */

import {
  calculateNodeHeapCap,
  MAXIMUM_AUTOMATIC_CGROUP_BYTES,
  parseCgroupMemoryLimit,
  resolveContainerNodeHeapCap,
} from '../../../scripts/lib/container-node-heap-cap.mjs';

describe('container Node heap cap', () => {
  test('uses 75% of a bounded cgroup v2 memory limit', () => {
    expect(resolveContainerNodeHeapCap({ cgroupV2Limit: String(1024 * 1024 * 1024) })).toEqual({
      heapMebibytes: 768n,
      limitMebibytes: 1024n,
    });
  });

  test('falls back to a bounded cgroup v1 memory limit', () => {
    expect(resolveContainerNodeHeapCap({ cgroupV2Limit: 'max', cgroupV1Limit: String(2048 * 1024 * 1024) })).toEqual({
      heapMebibytes: 1536n,
      limitMebibytes: 2048n,
    });
  });

  test('does not turn cgroup unlimited sentinels into invalid V8 heap values', () => {
    expect(parseCgroupMemoryLimit('9223372036854771712')).toBeNull();
    expect(parseCgroupMemoryLimit(String(MAXIMUM_AUTOMATIC_CGROUP_BYTES))).toBeNull();
    expect(resolveContainerNodeHeapCap({ cgroupV1Limit: '9223372036854771712' })).toBeNull();
  });

  test('does not impose an impractical heap cap on small or malformed limits', () => {
    expect(calculateNodeHeapCap(128n * 1024n * 1024n)).toBeNull();
    expect(parseCgroupMemoryLimit('not-a-number')).toBeNull();
  });
});
