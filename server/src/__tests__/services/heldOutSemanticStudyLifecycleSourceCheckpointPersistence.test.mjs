/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, jest, test } from '@jest/globals';
import {
  loadHeldOutSemanticStudyLifecycleSourceCheckpoint,
  saveHeldOutSemanticStudyLifecycleSourceCheckpoint,
} from '../../services/heldOutSemanticStudyLifecycleSourceCheckpointPersistence.mjs';

const source = {
  version: 'policy.held_out_semantic_study_lifecycle_reaudit_source.v2',
  normalLifecycleReceiptCount: 1,
  completePolicyEvidenceCount: 0,
  lifecycleTransitionCounts: {
    initial_intent_establishment: 1,
    native_intent_change: 0,
    library_rebuild_replacement: 0,
  },
};

test('loads only the aggregate source fingerprint', async () => {
  const db = {
    query: jest.fn(async () => ({ rows: [{ source_fingerprint: 'a'.repeat(64) }] })),
  };

  await expect(loadHeldOutSemanticStudyLifecycleSourceCheckpoint({ db })).resolves.toEqual({
    sourceFingerprint: 'a'.repeat(64),
  });

  const sql = db.query.mock.calls[0][0];
  expect(sql).not.toContain('source_receipt');
  expect(sql).not.toContain('policy_id');
  expect(sql).not.toContain('library_id');
  expect(sql).not.toContain('media');
});

test('upserts only a fixed aggregate source observation', async () => {
  const db = { query: jest.fn(async () => ({ rows: [] })) };

  await saveHeldOutSemanticStudyLifecycleSourceCheckpoint({
    db,
    source,
    sourceFingerprint: 'b'.repeat(64),
    observedAt: '2026-09-08T00:00:00.000Z',
  });

  const [sql, values] = db.query.mock.calls[0];
  expect(sql).toContain('ON CONFLICT (state_key) DO UPDATE');
  expect(sql).toContain('source_receipt');
  expect(JSON.parse(values[2])).toEqual(source);
  expect(JSON.stringify(values)).not.toMatch(/policy_id|library_id|tmdb|metadata/u);
});
