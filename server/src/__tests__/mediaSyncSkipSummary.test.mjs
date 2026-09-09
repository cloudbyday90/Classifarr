/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { expect, test } from '@jest/globals';
import { createMediaSyncSkipSummary } from '../services/mediaSyncSkipSummary.mjs';

test('summarizes only fixed skipped-item categories without source data', () => {
  const summary = createMediaSyncSkipSummary();

  expect(summary.record({
    reason: 'invalid_source_identity',
    identityIssue: 'conflicting_provider_ids',
    externalId: 'private-source',
    title: 'Private title',
  })).toBe(true);
  expect(summary.record({ reason: 'concurrent_source_change' })).toBe(true);
  expect(summary.record({ reason: 'forged_reason', identityIssue: 'forged_issue' })).toBe(false);

  expect(summary.snapshot()).toEqual({
    skippedItemCount: 2,
    reasonCounts: {
      concurrent_source_change: 1,
      invalid_source_identity: 1,
    },
    identityIssueCounts: {
      conflicting_provider_ids: 1,
    },
  });
});

test('has no summary when no known item was skipped', () => {
  expect(createMediaSyncSkipSummary().snapshot()).toBeNull();
});
