/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { ARCHIVE_TABLES } from './archiveTables.mjs';

/** Counts have already passed the strict seven-table archive report contract. */
export function archiveRevision(admission, counts, previousRevisions = []) {
  const digest = keys => createHash('sha256').update(admission)
    .update(JSON.stringify(Object.fromEntries(keys.map(key => [key, counts[key]])))).digest('hex');
  // Preserve the original serial-query encoding, but never depend on SQL row order.
  const revision = digest(ARCHIVE_TABLES), compatibleRevisions = [revision];
  const candidates = new Set(previousRevisions); candidates.delete(revision);
  if (candidates.size) {
    // Old jobs may have used any UNION ALL order. Only recognize hashes of these
    // exact current inputs; do not refund attempts or rewrite historical receipts.
    // Fixed seven-table vocabulary bounds this search to 7! (5,040) encodings.
    const visit = (prefix, remaining) => {
      if (!candidates.size) return;
      if (!remaining.length) {
        const legacy = digest(prefix);
        if (candidates.delete(legacy)) compatibleRevisions.push(legacy);
        return;
      }
      for (let index = 0; index < remaining.length; index++) {
        visit([...prefix, remaining[index]], remaining.filter((_, position) => position !== index));
      }
    };
    visit([], ARCHIVE_TABLES);
  }
  return { revision, compatibleRevisions };
}

/** Preserve both historical row counts and already-persisted attempt ordinals. */
export const archiveAttemptsUsed = jobs => Math.max(jobs.length, ...jobs.map(job => job.attempt ?? 0));
