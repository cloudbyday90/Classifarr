/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validateArchiveManifest } from './archiveContract.mjs';
import { validateArchiveReceipt } from './onlineArchiveContract.mjs';
import { retentionInventorySha256 } from './archiveRetentionContract.mjs';
import { gatewayError } from './errors.mjs';

/** Old restore receipts cannot stand in for exact-candidate verification. */
export function validateReceiptForArchive(receipt, manifest, manifestSha256) {
  validateArchiveManifest(manifest);
  validateArchiveReceipt(receipt);
  if (![3, 4].includes(manifest.version) || receipt.version !== (manifest.version === 4 ? 2 : 1) ||
      receipt.archiveId !== manifest.archiveId || receipt.manifestSha256 !== manifestSha256 ||
      receipt.dumpSha256 !== manifest.dump.sha256 ||
      receipt.preserves.some(id => !manifest.predecessors.some(prior => prior.archiveId === id)) ||
      manifest.version === 4 && receipt.verified && receipt.retentionSha256 !== retentionInventorySha256(manifest.retention)) {
    throw gatewayError('gateway_archive_receipt_invalid');
  }
  return receipt;
}
