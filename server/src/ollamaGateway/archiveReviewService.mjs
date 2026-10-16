/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayError } from './errors.mjs';
import { archiveHash } from './archiveRetentionContract.mjs';
import { validateArchiveManifest, ARCHIVE_TABLES } from './archiveContract.mjs';
import { readVerifiedGatewayArchive } from './archiveFiles.mjs';
import { withGatewayArchiveSnapshot } from './archiveRepository.mjs';
import { readRetentionState, readRetentionEntries } from './archiveRetentionQueries.mjs';

/** Internal database comparison only; a match is never deletion authority. */
export async function compareGatewayRetention(client, configuration, manifest, manifestSha256, signal) {
  validateArchiveManifest(manifest);
  if (manifest.version !== 2) throw gatewayError('gateway_archive_review_requires_inventory');
  if (!archiveHash(manifestSha256)) throw gatewayError('gateway_archive_review_hash_invalid');
  return withGatewayArchiveSnapshot(client, { ...configuration, signal }, async ({ report, archiveId: reviewId }) => {
    const reasons = [];
    if (report.ledgerId !== manifest.report.ledgerId || report.providerHash !== manifest.report.providerHash) reasons.push('source_mismatch');
    if (configuration.retentionDays !== manifest.report.retentionDays) reasons.push('retention_changed');
    if (!report.counterMatches || report.legacyActiveWithoutBinding || !manifest.report.counterMatches ||
        manifest.report.legacyActiveWithoutBinding) reasons.push('inconsistent_history');
    if (ARCHIVE_TABLES.some(name => report.counts[name] !== manifest.report.counts[name])) reasons.push('history_changed');
    const state = await readRetentionState(client);
    if (state.digest !== manifest.retention.ledgerSha256) reasons.push('ledger_changed');
    const current = await readRetentionEntries(client, state.active_request, manifest.report.cutoff,
      manifest.retention.entries.map(entry => entry.bindingId));
    const byId = new Map(current.map(entry => [entry.bindingId, entry]));
    const entries = manifest.retention.entries.map(entry => {
      const row = byId.get(entry.bindingId);
      const status = !row ? 'missing' : row.category !== 'older_terminal_review' ? 'protected' :
        row.requestId !== entry.requestId || row.attempt !== entry.attempt || row.rowSha256 !== entry.rowSha256 ? 'changed' : 'matched';
      return { ...entry, status };
    });
    if (entries.some(entry => entry.status !== 'matched')) reasons.push('entries_changed');
    return { version: 1, reviewId, archiveId: manifest.archiveId, manifestSha256, ledgerId: report.ledgerId,
      observedAt: report.capturedAt, cutoff: manifest.report.cutoff,
      status: reasons.length ? 'blocked' : entries.length ? 'ready_for_review' : 'no_work', reasons, entries,
      remainingCandidates: manifest.retention.totalCandidates - entries.length,
      restoreVerified: false, purgeAuthorized: false };
  });
}

export async function reviewGatewayArchive(client, configuration, directory, expectedManifestSha256, signal) {
  if (!archiveHash(expectedManifestSha256)) throw gatewayError('gateway_archive_review_hash_invalid');
  const { manifest, manifestSha256 } = await readVerifiedGatewayArchive(directory, signal);
  if (manifestSha256 !== expectedManifestSha256) throw gatewayError('gateway_archive_review_hash_mismatch');
  return compareGatewayRetention(client, configuration, manifest, manifestSha256, signal);
}
