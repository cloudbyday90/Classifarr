/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { addAbortSignal } from 'node:stream';
import { loadBoundedStdinJsonInput } from './boundedStdinJsonInput.mjs';

/** Offline CLI only: bounded input, no file paths, database or provider runtime. */
export async function loadSourceCatalogScopePlanInput({ stdin = process.stdin, timeoutMs = 10000 } = {}) {
  return loadBoundedStdinJsonInput({ maximumBytes: 32 * 1024,
    stdin: addAbortSignal(AbortSignal.timeout(timeoutMs), stdin) });
}
