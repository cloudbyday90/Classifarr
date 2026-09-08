/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, jest, test } from '@jest/globals';
import {
  loadHeldOutSemanticStudyLifecycleReauditState,
  saveHeldOutSemanticStudyLifecycleReauditState,
} from '../../services/heldOutSemanticStudyLifecycleReauditPersistence.mjs';

const source = {
  version: 'policy.held_out_semantic_study_lifecycle_reaudit_source.v1',
  normalLifecycleReceiptCount: 1,
  lifecycleTransitionCounts: {
    initial_intent_establishment: 1,
    native_intent_change: 0,
    library_rebuild_replacement: 0,
  },
};

const auditReceipt = {
  version: 'policy.held_out_semantic_study_eligibility_audit.v4',
  status: { id: 'complete' },
  summary: { candidateCount: 4 },
};

test('normalizes the latest stored aggregate receipt without returning source detail', async () => {
  const db = {
    query: jest.fn(async () => ({
      rows: [{
        source_fingerprint: 'a'.repeat(64),
        attempt_count: '2',
        audit_status_id: 'failed',
        audit_receipt: JSON.stringify(auditReceipt),
      }],
    })),
  };

  await expect(loadHeldOutSemanticStudyLifecycleReauditState({ db })).resolves.toEqual({
    sourceFingerprint: 'a'.repeat(64),
    attemptCount: 2,
    auditStatusId: 'failed',
    auditReceipt,
  });

  const sql = db.query.mock.calls[0][0];
  expect(sql).not.toContain('source_receipt');
  expect(sql).not.toContain('policy_id');
  expect(sql).not.toContain('library_id');
  expect(sql).not.toContain('media');
});

test('upserts only fixed aggregate receipts', async () => {
  const db = { query: jest.fn(async () => ({ rows: [] })) };

  await saveHeldOutSemanticStudyLifecycleReauditState({
    db,
    source,
    sourceFingerprint: 'b'.repeat(64),
    attemptCount: 1,
    auditReceipt,
    auditedAt: '2026-09-08T00:00:00.000Z',
  });

  const [sql, values] = db.query.mock.calls[0];
  expect(sql).toContain('ON CONFLICT (state_key) DO UPDATE');
  expect(sql).toContain('audit_receipt');
  expect(JSON.parse(values[2])).toEqual(source);
  expect(JSON.parse(values[5])).toEqual(auditReceipt);
  expect(JSON.stringify(values)).not.toMatch(/policy_id|library_id|tmdb|metadata/u);
});
