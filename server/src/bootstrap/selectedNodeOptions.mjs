/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** A heap cap only: never forward arbitrary NODE_OPTIONS into an isolated child. */
export function validSelectedNodeOptions(value) {
  if (typeof value !== 'string' || !/^--max-old-space-size=[1-9]\d{2,4}$/.test(value)) return false;
  const heapMiB = Number(value.slice('--max-old-space-size='.length));
  return heapMiB >= 256 && heapMiB <= 65536;
}
