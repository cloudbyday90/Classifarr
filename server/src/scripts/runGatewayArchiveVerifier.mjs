/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readdir, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { archiveDirectory } from '../ollamaGateway/archiveFiles.mjs';
import { archiveUuid } from '../ollamaGateway/archiveContract.mjs';
import { managedArchivePath,readArchiveReceipt,writeArchiveReceipt,recoverArchiveReceiptPublication } from '../ollamaGateway/archiveManagedFiles.mjs';
import { verifyArchiveRestore } from '../ollamaGateway/archiveVerifier.mjs';
import { validateCatalogVerification } from '../ollamaGateway/catalogVerificationResult.mjs';

// Fixed container paths; no source configuration, database secrets, HTTP or Docker API.
const controller = new AbortController();
process.once('SIGINT',() => controller.abort()); process.once('SIGTERM',() => controller.abort());
let previous;
try {
  const args = process.argv.slice(2), once = args.includes('--once'), catalog = args.includes('--catalog');
  if (process.platform !== 'linux' || new Set(args).size !== args.length || args.some(arg => !['--once','--catalog'].includes(arg))) throw new Error();
  const parent = await archiveDirectory(catalog ? '/catalogs' : '/archives'), receipts = await archiveDirectory('/receipts');
  const validate = catalog ? validateCatalogVerification : undefined;
  const context = catalog ? { archives: await archiveDirectory('/archives'), receipts } : null;
  const scratch = await archiveDirectory('/verification');
  while (!controller.signal.aborted) {
    let state = 'idle';
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- checked fixed /archives or /catalogs mount, never an archived path.
    const names = await readdir(parent);
    if (names.length > 10000) throw new Error();
    for (const name of names.sort()) {
      const id = name.slice('gateway-archive-'.length);
      if (!name.startsWith('gateway-archive-') || !archiveUuid(id)) { state = 'unmanaged_input'; continue; }
      try {
        await recoverArchiveReceiptPublication(receipts,id,validate);
        if (await readArchiveReceipt(receipts,id,validate)) continue;
        // In-progress exports have no completion marker; do not let one starve completed archives.
        const directory = managedArchivePath(parent,id);
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed marker in validated UUIDv7 child of the fixed read-only input mount.
        try { await lstat(join(directory,'manifest.json')); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
        const signal = AbortSignal.any([controller.signal,AbortSignal.timeout(180000)]);
        const receipt = await verifyArchiveRestore(directory,scratch,signal,context);
        if (catalog !== ('kind' in receipt)) throw new Error();
        await writeArchiveReceipt(receipts,receipt,validate);
        state = ('kind' in receipt ? receipt.dependenciesAvailable : receipt.verified) ? 'verified' : 'verification_failed';
      } catch { state = 'verification_blocked'; }
      // At most one restore per pass, including failed/partial artifacts. Never flood the sandbox.
      break;
    }
    if (state !== previous) { process.stdout.write(`${JSON.stringify({ state,purgeAuthorized: false })}\n`); previous = state; }
    if (once) break;
    await delay(300000,undefined,{ signal: controller.signal });
  }
} catch { if (!controller.signal.aborted) { process.stderr.write('gateway_archive_verifier_unavailable\n'); process.exitCode = 1; } }
finally { controller.abort(); }
