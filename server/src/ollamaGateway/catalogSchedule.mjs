/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { CATALOG_TABLES } from './catalogContract.mjs';
import { archiveAttemptsUsed } from './archiveRevision.mjs';
import { ARCHIVE_POLICY } from './archiveSchedule.mjs';

// Own catalog publication/acknowledgment is not a source change. SQL rows are still fully captured.
export const catalogSemanticRevision = tables => createHash('sha256')
  .update(JSON.stringify(CATALOG_TABLES.map(table => [table, tables[table]]))).digest('hex');

export function catalogDue({ report, revision, compatibleRevisions = [revision], semantic, jobs, inferenceJobs, roots, now }) {
  if (!report.counterMatches || report.legacyActiveWithoutBinding) return 'source_inconsistent';
  if (!report.counts.request_binding) return 'empty';
  const all = [...jobs, ...inferenceJobs];
  if (all.some(job => ['exporting', 'awaiting_verification', 'interrupted', 'retiring'].includes(job.status))) return 'pending';
  if (all.some(job => job.ledger_id !== report.ledgerId || job.provider_hash !== report.providerHash)) return 'identity_changed';
  const currentCopies = roots.filter(root => root.manifest.revision === revision && root.manifest.catalog.semanticSha256 === semantic).length;
  const needsCopy = roots.length < 2 || currentCopies === 1;
  const matched = jobs.some(job => job.status === 'verified' && job.revision === revision && job.semantic_sha256 === semantic);
  if (!needsCopy && matched && currentCopies >= 2) return 'unchanged';
  const aliases = new Set([revision, ...compatibleRevisions]);
  const attempts = all.filter(job => aliases.has(job.revision) || job.compatible_revisions?.some(value => aliases.has(value)));
  if (archiveAttemptsUsed(attempts) >= ARCHIVE_POLICY.maxAttempts) return 'attempts_exhausted';
  if (attempts.some(job => job.retry_after && Date.parse(job.retry_after) > now)) return 'cooldown';
  const retry = jobs.some(job => attempts.includes(job) && job.status === 'failed');
  const last = jobs.filter(job => job.status === 'verified').at(-1);
  const interval = report.bindingCount >= ARCHIVE_POLICY.pressureCount ? ARCHIVE_POLICY.pressureMs : ARCHIVE_POLICY.dailyMs;
  return !needsCopy && !retry && last && now - Date.parse(last.completed_at) < interval ? 'not_due' : 'due';
}
