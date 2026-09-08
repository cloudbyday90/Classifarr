/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, jest, test } from '@jest/globals';
import {
  buildHeldOutSemanticStudyLifecycleReauditPurposeEvidence,
  loadHeldOutSemanticStudyLifecycleReauditPurposeEvidenceRecord,
} from '../../services/heldOutSemanticStudyLifecycleReauditPurposeEvidence.mjs';

test('reduces complete declared-purpose evidence to a fixed aggregate receipt', () => {
  expect(buildHeldOutSemanticStudyLifecycleReauditPurposeEvidence({
    active_policy_count: 3,
    authoritative_active_native_policy_count: 3,
    current_intent_version_policy_count: 3,
    current_intent_schema_version_policy_count: 3,
    retained_purpose_policy_count: 2,
    normal_lifecycle_receipt_policy_count: 2,
    verifiable_lifecycle_receipt_policy_count: 2,
    current_intent_lifecycle_receipt_policy_count: 2,
    current_intent_retained_purpose_lifecycle_receipt_policy_count: 2,
    complete_policy_evidence_count: 2,
  })).toEqual({
    version: 'policy.held_out_semantic_study_lifecycle_reaudit_purpose_evidence.v3',
    completePolicyEvidenceCount: 2,
    completePolicyEvidenceAvailable: true,
    rawConfigurationExposed: false,
    libraryIdentityExposed: false,
    mediaIdentityExposed: false,
  });
});

test('loads the existing aggregate inventory without a second query contract', async () => {
  const db = { query: jest.fn(async () => ({ rows: [{}] })) };

  await loadHeldOutSemanticStudyLifecycleReauditPurposeEvidenceRecord({ db });

  expect(db.query).toHaveBeenCalledTimes(1);
  const sql = db.query.mock.calls[0][0];
  expect(sql).toContain('complete_policy_evidence_count');
  expect(sql).not.toContain('policy.name');
  expect(sql).not.toContain('library.name');
  expect(sql).not.toContain('rule.values');
});
