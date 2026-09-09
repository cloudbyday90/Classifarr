/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

const RECORDED_REASONS = new Set(['invalid_source_identity', 'concurrent_source_change']);
const RECORDED_IDENTITY_ISSUES = new Set([
  'conflicting_provider_ids',
  'invalid_provider_ids',
  'invalid_media_type',
  'invalid_external_id',
  'invalid_media_server_id',
]);

function increment(counts, value) {
  counts.set(value, (counts.get(value) || 0) + 1);
}

function sortedCounts(counts) {
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

/**
 * Aggregates fixed identity outcomes for one sync. It deliberately excludes
 * source keys, titles, provider values, URLs, and fingerprints: the bounded
 * source-observation store remains the place to inspect a specific conflict.
 */
export function createMediaSyncSkipSummary() {
  const reasonCounts = new Map();
  const identityIssueCounts = new Map();

  return Object.freeze({
    /** @param {{reason?: string, identityIssue?: string}} [skippedItem] */
    record(skippedItem = {}) {
      const { reason, identityIssue } = skippedItem;
      if (!RECORDED_REASONS.has(reason)) return false;
      increment(reasonCounts, reason);
      if (reason === 'invalid_source_identity' && RECORDED_IDENTITY_ISSUES.has(identityIssue)) {
        increment(identityIssueCounts, identityIssue);
      }
      return true;
    },

    snapshot() {
      const skippedItemCount = [...reasonCounts.values()].reduce((total, count) => total + count, 0);
      if (!skippedItemCount) return null;
      return {
        skippedItemCount,
        reasonCounts: sortedCounts(reasonCounts),
        identityIssueCounts: sortedCounts(identityIssueCounts),
      };
    },
  });
}
