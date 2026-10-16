/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isDeepStrictEqual } from 'node:util';
import { reportSnapshot } from './archiveRepository.mjs';
import { captureRetentionInventory } from './archiveRetentionQueries.mjs';
import { retentionInventorySha256 } from './archiveRetentionContract.mjs';
import { gatewayError } from './errors.mjs';

/** Validated v4 manifest; isolated restored DB, UTC read-only repeatable-read transaction. */
export async function verifyRestoredRetention(client, manifest, signal) {
  signal?.throwIfAborted();
  const { report } = manifest;
  const restored = await reportSnapshot(client, report.providerHash, report.retentionDays, report);
  // Recompute all categories, including candidates beyond the bounded inventory page.
  if (!isDeepStrictEqual(restored, report)) throw gatewayError('gateway_archive_restore_mismatch');
  signal?.throwIfAborted();
  const inventory = await captureRetentionInventory(client, restored);
  if (!isDeepStrictEqual(inventory, manifest.retention)) throw gatewayError('gateway_archive_restore_mismatch');
  signal?.throwIfAborted();
  return retentionInventorySha256(inventory);
}
