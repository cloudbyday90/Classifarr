/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';

export const ARCHIVE_POLICY = Object.freeze({ version: 1, budgetBytes: 1073741824, copies: 2,
  assessmentMs: 300000, dailyMs: 86400000, pressureMs: 3600000, pressureCount: 80000, maxAttempts: 3 });
export const archivePolicyHash = retentionDays => createHash('sha256').update(JSON.stringify({ ...ARCHIVE_POLICY, retentionDays })).digest('hex');

export function archiveDue({ report, revision, jobs, now }) {
  if (!report.counterMatches || report.legacyActiveWithoutBinding) return 'source_inconsistent';
  if (!report.counts.request_binding) return 'empty';
  if (jobs.some(job => ['exporting','awaiting_verification','interrupted','retiring'].includes(job.status))) return 'pending';
  if (jobs.some(job => job.ledger_id !== report.ledgerId || job.provider_hash !== report.providerHash)) return 'identity_changed';
  const attempts = jobs.filter(job => job.revision === revision);
  if (attempts.some(job => ['verified','retired'].includes(job.status))) return 'unchanged';
  if (attempts.length >= ARCHIVE_POLICY.maxAttempts) return 'attempts_exhausted';
  if (attempts.some(job => job.retry_after && new Date(job.retry_after).getTime() > now)) return 'cooldown';
  const last = jobs.filter(job => ['verified','retired'].includes(job.status)).at(-1);
  const interval = report.bindingCount >= ARCHIVE_POLICY.pressureCount ? ARCHIVE_POLICY.pressureMs : ARCHIVE_POLICY.dailyMs;
  // A retry honors its persisted cooldown rather than waiting another daily interval.
  return last && !attempts.length && now - new Date(last.completed_at).getTime() < interval ? 'not_due' : 'due';
}
