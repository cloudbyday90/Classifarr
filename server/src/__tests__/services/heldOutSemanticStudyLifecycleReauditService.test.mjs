/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, jest, test } from '@jest/globals';
import {
  createHeldOutSemanticStudyLifecycleReauditService,
} from '../../services/heldOutSemanticStudyLifecycleReauditService.mjs';
import {
  buildHeldOutSemanticStudyLifecycleReauditSource,
  HELD_OUT_SEMANTIC_STUDY_LIFECYCLE_REAUDIT_MAXIMUM_ATTEMPTS,
  heldOutSemanticStudyLifecycleReauditSourceFingerprint,
} from '../../services/heldOutSemanticStudyLifecycleReauditContract.mjs';
import {
  buildHeldOutSemanticStudyLifecycleReauditPurposeEvidence,
} from '../../services/heldOutSemanticStudyLifecycleReauditPurposeEvidence.mjs';

function sourceRecord({ initial = 0, changed = 0, rebuild = 0 } = {}) {
  return {
    normal_lifecycle_receipt_count: initial + changed + rebuild,
    initial_intent_establishment_count: initial,
    native_intent_change_count: changed,
    library_rebuild_replacement_count: rebuild,
  };
}

function completePurposeEvidenceRecord() {
  return {
    active_policy_count: 1,
    authoritative_active_native_policy_count: 1,
    current_intent_version_policy_count: 1,
    current_intent_schema_version_policy_count: 1,
    retained_purpose_policy_count: 1,
    normal_lifecycle_receipt_policy_count: 1,
    verifiable_lifecycle_receipt_policy_count: 1,
    current_intent_lifecycle_receipt_policy_count: 1,
    current_intent_retained_purpose_lifecycle_receipt_policy_count: 1,
    complete_policy_evidence_count: 1,
  };
}

function incompletePurposeEvidenceRecord() {
  return {
    ...completePurposeEvidenceRecord(),
    retained_purpose_policy_count: 0,
    complete_policy_evidence_count: 0,
  };
}

function sourceFor(record, purposeEvidenceRecord = completePurposeEvidenceRecord()) {
  return buildHeldOutSemanticStudyLifecycleReauditSource(
    record,
    buildHeldOutSemanticStudyLifecycleReauditPurposeEvidence(purposeEvidenceRecord),
  );
}

function completeAuditReceipt() {
  return Object.freeze({
    version: 'policy.held_out_semantic_study_eligibility_audit.v6',
    status: Object.freeze({ id: 'complete' }),
    summary: Object.freeze({
      candidateCount: 4,
      candidateCountByStratum: {},
      eligibilityDecisionCounts: {},
      eligibilityStatusCounts: {},
      eligibleCountByStratum: {},
      independentLabelsAvailable: false,
      policyChangeEligibility: false,
      policyCount: 0,
      policySourceScreen: {},
      semanticSelection: false,
    }),
  });
}

function createService({
  audit = { audit: jest.fn() },
  loadAuditState = async () => null,
  loadPurposeEvidenceRecord = async () => completePurposeEvidenceRecord(),
  loadSourceCheckpoint = async () => null,
  loadSourceRecord = async () => sourceRecord({ initial: 1 }),
  now = () => new Date('2026-09-08T00:00:00.000Z'),
  saveAuditState = jest.fn(async () => undefined),
  saveSourceCheckpoint = jest.fn(async () => undefined),
} = {}) {
  return {
    audit,
    saveAuditState,
    saveSourceCheckpoint,
    service: createHeldOutSemanticStudyLifecycleReauditService({
      audit,
      loadAuditState,
      loadPurposeEvidenceRecord,
      loadSourceCheckpoint,
      loadSourceRecord,
      now,
      saveAuditState,
      saveSourceCheckpoint,
    }),
  };
}

test('checkpoints a zero lifecycle source without reading purpose evidence or auditing', async () => {
  const loadPurposeEvidenceRecord = jest.fn();
  const { audit, saveAuditState, saveSourceCheckpoint, service } = createService({
    loadPurposeEvidenceRecord,
    loadSourceRecord: async () => sourceRecord(),
  });

  await expect(service.run()).resolves.toBeNull();
  expect(loadPurposeEvidenceRecord).not.toHaveBeenCalled();
  expect(audit.audit).not.toHaveBeenCalled();
  expect(saveAuditState).not.toHaveBeenCalled();
  expect(saveSourceCheckpoint).toHaveBeenCalledWith(expect.objectContaining({
    source: expect.objectContaining({
      completePolicyEvidenceCount: 0,
      normalLifecycleReceiptCount: 0,
    }),
  }));
});

test('returns and persists the existing audit receipt after a qualified source change', async () => {
  const auditReceipt = completeAuditReceipt();
  const audit = { audit: jest.fn(async () => auditReceipt) };
  const { saveAuditState, saveSourceCheckpoint, service } = createService({ audit });

  await expect(service.run()).resolves.toBe(auditReceipt);
  expect(audit.audit).toHaveBeenCalledTimes(1);
  expect(saveSourceCheckpoint).toHaveBeenCalledWith(expect.objectContaining({
    observedAt: '2026-09-08T00:00:00.000Z',
  }));
  expect(saveAuditState).toHaveBeenCalledWith(expect.objectContaining({
    attemptCount: 1,
    auditReceipt,
    auditedAt: '2026-09-08T00:00:00.000Z',
  }));
});

test('does not re-run a complete audit for an unchanged lifecycle source', async () => {
  const record = sourceRecord({ changed: 1 });
  const sourceFingerprint = heldOutSemanticStudyLifecycleReauditSourceFingerprint(sourceFor(record));
  const { audit, saveAuditState, saveSourceCheckpoint, service } = createService({
    loadAuditState: async () => ({
      sourceFingerprint,
      attemptCount: 1,
      auditStatusId: 'complete',
      auditReceipt: completeAuditReceipt(),
    }),
    loadSourceCheckpoint: async () => ({ sourceFingerprint }),
    loadSourceRecord: async () => record,
  });

  await expect(service.run()).resolves.toBeNull();
  expect(audit.audit).not.toHaveBeenCalled();
  expect(saveAuditState).not.toHaveBeenCalled();
  expect(saveSourceCheckpoint).not.toHaveBeenCalled();
});

test('refreshes a prior-version receipt only when the qualified source is otherwise unchanged', async () => {
  const record = sourceRecord({ changed: 1 });
  const sourceFingerprint = heldOutSemanticStudyLifecycleReauditSourceFingerprint(sourceFor(record));
  const auditReceipt = completeAuditReceipt();
  const audit = { audit: jest.fn(async () => auditReceipt) };
  const { saveAuditState, saveSourceCheckpoint, service } = createService({
    audit,
    loadAuditState: async () => ({
      sourceFingerprint,
      attemptCount: 3,
      auditStatusId: 'complete',
      auditReceipt: {
        version: 'policy.held_out_semantic_study_eligibility_audit.v3',
        status: { id: 'complete' },
        summary: { candidateCount: 4 },
      },
    }),
    loadSourceCheckpoint: async () => ({ sourceFingerprint }),
    loadSourceRecord: async () => record,
  });

  await expect(service.run()).resolves.toBe(auditReceipt);
  expect(audit.audit).toHaveBeenCalledTimes(1);
  expect(saveAuditState).toHaveBeenCalledWith(expect.objectContaining({
    attemptCount: 1,
    auditReceipt,
  }));
  expect(saveSourceCheckpoint).not.toHaveBeenCalled();
});

test('retries a failed unchanged source only through its bounded attempt budget', async () => {
  const record = sourceRecord({ rebuild: 1 });
  const sourceFingerprint = heldOutSemanticStudyLifecycleReauditSourceFingerprint(sourceFor(record));
  const audit = { audit: jest.fn(async () => ({
    version: 'policy.held_out_semantic_study_eligibility_audit.v6',
    status: { id: 'failed' },
    summary: null,
  })) };
  const saveAuditState = jest.fn(async () => undefined);
  const { service } = createService({
    audit,
    loadAuditState: async () => ({
      sourceFingerprint,
      attemptCount: HELD_OUT_SEMANTIC_STUDY_LIFECYCLE_REAUDIT_MAXIMUM_ATTEMPTS - 1,
      auditStatusId: 'failed',
      auditReceipt: {
        version: 'policy.held_out_semantic_study_eligibility_audit.v6',
        status: { id: 'failed' },
        summary: null,
      },
    }),
    loadSourceCheckpoint: async () => ({ sourceFingerprint }),
    loadSourceRecord: async () => record,
    saveAuditState,
  });

  await expect(service.run()).resolves.toEqual(expect.objectContaining({
    status: { id: 'failed' },
  }));
  expect(saveAuditState).toHaveBeenCalledWith(expect.objectContaining({
    attemptCount: HELD_OUT_SEMANTIC_STUDY_LIFECYCLE_REAUDIT_MAXIMUM_ATTEMPTS,
  }));

  const { service: exhaustedService } = createService({
    audit,
    loadAuditState: async () => ({
      sourceFingerprint,
      attemptCount: HELD_OUT_SEMANTIC_STUDY_LIFECYCLE_REAUDIT_MAXIMUM_ATTEMPTS,
      auditStatusId: 'failed',
      auditReceipt: {
        version: 'policy.held_out_semantic_study_eligibility_audit.v6',
        status: { id: 'failed' },
        summary: null,
      },
    }),
    loadSourceCheckpoint: async () => ({ sourceFingerprint }),
    loadSourceRecord: async () => record,
    saveAuditState,
  });
  await expect(exhaustedService.run()).resolves.toBeNull();
  expect(audit.audit).toHaveBeenCalledTimes(1);
});

test('fails closed with the established aggregate receipt when the audit throws', async () => {
  const { saveAuditState, service } = createService({
    audit: { audit: jest.fn(async () => { throw new Error('private provider'); }) },
  });

  await expect(service.run()).resolves.toEqual({
    version: 'policy.held_out_semantic_study_eligibility_audit.v6',
    status: { id: 'failed' },
    summary: null,
  });
  expect(saveAuditState).toHaveBeenCalledWith(expect.objectContaining({
    auditReceipt: expect.objectContaining({ status: { id: 'failed' } }),
  }));
});

test('defers incomplete purpose evidence after recording only its source checkpoint', async () => {
  const audit = { audit: jest.fn() };
  const { saveAuditState, saveSourceCheckpoint, service } = createService({
    audit,
    loadPurposeEvidenceRecord: async () => incompletePurposeEvidenceRecord(),
  });

  await expect(service.run()).resolves.toBeNull();
  expect(audit.audit).not.toHaveBeenCalled();
  expect(saveAuditState).not.toHaveBeenCalled();
  expect(saveSourceCheckpoint).toHaveBeenCalledWith(expect.objectContaining({
    source: expect.objectContaining({ completePolicyEvidenceCount: 0 }),
  }));
});

test('re-audits when complete purpose evidence returns to a previously audited aggregate', async () => {
  const record = sourceRecord({ initial: 1 });
  const completeFingerprint = heldOutSemanticStudyLifecycleReauditSourceFingerprint(sourceFor(record));
  const incompleteFingerprint = heldOutSemanticStudyLifecycleReauditSourceFingerprint(
    sourceFor(record, incompletePurposeEvidenceRecord()),
  );
  const auditReceipt = completeAuditReceipt();
  const audit = { audit: jest.fn(async () => auditReceipt) };
  const retainedAuditState = {
    sourceFingerprint: completeFingerprint,
    attemptCount: 1,
    auditStatusId: 'complete',
    auditReceipt: completeAuditReceipt(),
  };

  const first = createService({
    audit,
    loadAuditState: async () => retainedAuditState,
    loadPurposeEvidenceRecord: async () => incompletePurposeEvidenceRecord(),
    loadSourceCheckpoint: async () => ({ sourceFingerprint: completeFingerprint }),
    loadSourceRecord: async () => record,
  });
  await expect(first.service.run()).resolves.toBeNull();
  expect(first.saveSourceCheckpoint).toHaveBeenCalledWith(expect.objectContaining({
    sourceFingerprint: incompleteFingerprint,
  }));
  expect(first.saveAuditState).not.toHaveBeenCalled();

  const restored = createService({
    audit,
    loadAuditState: async () => retainedAuditState,
    loadSourceCheckpoint: async () => ({ sourceFingerprint: incompleteFingerprint }),
    loadSourceRecord: async () => record,
  });
  await expect(restored.service.run()).resolves.toBe(auditReceipt);
  expect(restored.saveSourceCheckpoint).toHaveBeenCalledWith(expect.objectContaining({
    sourceFingerprint: completeFingerprint,
  }));
  expect(restored.saveAuditState).toHaveBeenCalledWith(expect.objectContaining({
    attemptCount: 1,
    sourceFingerprint: completeFingerprint,
  }));
  expect(audit.audit).toHaveBeenCalledTimes(1);
});
