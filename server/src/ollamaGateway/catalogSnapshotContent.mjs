/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { captureCatalogContent } from './catalogContent.mjs';
import { assertArchiveSnapshot } from './onlineArchiveSnapshot.mjs';
import { gatewayError } from './errors.mjs';

const active = new WeakMap();
export function freezeCatalogValue(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freezeCatalogValue); Object.freeze(value); }
  return value;
}

/** Internal owner-only registration; no raw source escapes to its consumer. */
export async function withCatalogSnapshotContent(source,context,signal,consume) {
  assertArchiveSnapshot(source,context); signal?.throwIfAborted();
  if (active.has(context)) throw gatewayError('gateway_archive_snapshot_invalid');
  const budget = {bytes:0}, tables = freezeCatalogValue(await captureCatalogContent(source,signal,budget));
  assertArchiveSnapshot(source,context); signal?.throwIfAborted();
  active.set(context,{source,tables,bytes:budget.bytes});
  try { return await consume(tables); }
  finally { active.delete(context); }
}

export async function captureSnapshotCatalogContent(source,context,signal,budget) {
  assertArchiveSnapshot(source,context); signal?.throwIfAborted();
  const cached = active.get(context);
  if (!cached) return captureCatalogContent(source,signal,budget,3);
  if (cached.source !== source || source.getTransactionStatus() !== 'T') throw gatewayError('gateway_archive_snapshot_invalid');
  // On overflow, preserve the original row-by-row refusal and failed-budget value.
  if (budget.bytes + cached.bytes > 268435456) return captureCatalogContent(source,signal,budget,3);
  budget.bytes += cached.bytes;
  const tail = await captureCatalogContent(source,signal,budget,3,3);
  assertArchiveSnapshot(source,context); signal?.throwIfAborted();
  return { ...cached.tables,...tail };
}
