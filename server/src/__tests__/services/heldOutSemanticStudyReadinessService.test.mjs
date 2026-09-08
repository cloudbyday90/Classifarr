/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, jest, test } from '@jest/globals';
import {
  createHeldOutSemanticStudyReadinessService,
} from '../../services/heldOutSemanticStudyReadinessService.mjs';

const lifecycleRecord = {
  normal_lifecycle_receipt_count: 1,
  initial_intent_establishment_count: 1,
  native_intent_change_count: 0,
  library_rebuild_replacement_count: 0,
};

const purposeEvidenceRecord = {
  active_policy_count: 1,
  authoritative_active_native_policy_count: 1,
  current_intent_version_policy_count: 1,
  current_intent_schema_version_policy_count: 1,
  retained_purpose_policy_count: 1,
  normal_lifecycle_receipt_policy_count: 1,
  verifiable_lifecycle_receipt_policy_count: 1,
  current_intent_lifecycle_receipt_policy_count: 1,
  complete_policy_evidence_count: 1,
};

test('reads both aggregate sources and returns the reviewed readiness projection', async () => {
  const dbClient = { query: jest.fn() };
  const loadLifecycleRecord = jest.fn(async () => lifecycleRecord);
  const loadPurposeEvidenceRecord = jest.fn(async () => purposeEvidenceRecord);
  const loadAuditState = jest.fn(async () => null);
  const service = createHeldOutSemanticStudyReadinessService({
    loadAuditState,
    loadLifecycleRecord,
    loadPurposeEvidenceRecord,
  });

  await expect(service.getReport({ dbClient })).resolves.toEqual(expect.objectContaining({
    statusId: 'eligibility_audit_available',
    reAuditPreconditionSatisfied: true,
  }));
  expect(loadLifecycleRecord).toHaveBeenCalledWith({ db: dbClient });
  expect(loadPurposeEvidenceRecord).toHaveBeenCalledWith({ db: dbClient });
  expect(loadAuditState).toHaveBeenCalledWith({ db: dbClient });
});

test('fails closed when either aggregate source cannot be read', async () => {
  const service = createHeldOutSemanticStudyReadinessService({
    loadAuditState: async () => null,
    loadLifecycleRecord: async () => { throw new Error('database unavailable'); },
    loadPurposeEvidenceRecord: async () => purposeEvidenceRecord,
  });

  await expect(service.getReport()).resolves.toEqual(expect.objectContaining({
    statusId: 'held_out_semantic_study_readiness_unavailable',
    reAuditPreconditionSatisfied: false,
  }));
});
