/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { readArchiveReceipt,writeArchiveReceipt,managedArchivePath } from '/app/src/ollamaGateway/archiveManagedFiles.mjs';
import { verifyArchiveRestore } from '/app/src/ollamaGateway/archiveVerifier.mjs';

// Fixture throughput only: 20 independent, sequential restores, never a fabricated receipt.
// Runs in the existing network-none verifier container with no source access.
assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE,'isolated');
let count=0;
for (const name of (await readdir('/archives')).sort()) {
  const id=name.slice('gateway-archive-'.length);
  assert.equal(name,`gateway-archive-${id}`);
  if (await readArchiveReceipt('/receipts',id)) continue;
  const receipt=await verifyArchiveRestore(managedArchivePath('/archives',id),'/verification',AbortSignal.timeout(120000));
  assert.equal(receipt.verified,true); await writeArchiveReceipt('/receipts',receipt);
  if (++count===20) break;
}
assert.equal(count,20);
process.stdout.write(`${JSON.stringify({ state:'verified',restored:count })}\n`);
