/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, jest, test } from '@jest/globals';
import {
  createHeldOutSemanticStudyLifecycleReauditService,
} from '../../services/heldOutSemanticStudyLifecycleReauditService.mjs';
import {
  HELD_OUT_SEMANTIC_STUDY_LIFECYCLE_REAUDIT_MAXIMUM_ATTEMPTS,
  heldOutSemanticStudyLifecycleReauditSourceFingerprint,
} from '../../services/heldOutSemanticStudyLifecycleReauditContract.mjs';

function sourceRecord({ initial = 0, changed = 0, rebuild = 0 } = {}) {
  return {
    normal_lifecycle_receipt_count: initial + changed + rebuild,
    initial_intent_establishment_count: initial,
    native_intent_change_count: changed,
    library_rebuild_replacement_count: rebuild,
  };
}

function completeAuditReceipt() {
  return Object.freeze({
    version: 'policy.held_out_semantic_study_eligibility_audit.v3',
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

test('does not run the eligibility audit before a normal lifecycle receipt exists', async () => {
  const audit = { audit: jest.fn() };
  const saveState = jest.fn();
  const service = createHeldOutSemanticStudyLifecycleReauditService({
    audit,
    loadSourceRecord: async () => sourceRecord(),
    loadState: async () => null,
    saveState,
  });

  await expect(service.run()).resolves.toBeNull();
  expect(audit.audit).not.toHaveBeenCalled();
  expect(saveState).not.toHaveBeenCalled();
});

test('returns and persists the existing audit receipt unchanged after receipt evidence changes', async () => {
  const auditReceipt = completeAuditReceipt();
  const audit = { audit: jest.fn(async () => auditReceipt) };
  const saveState = jest.fn(async () => undefined);
  const service = createHeldOutSemanticStudyLifecycleReauditService({
    audit,
    loadSourceRecord: async () => sourceRecord({ initial: 1 }),
    loadState: async () => null,
    now: () => new Date('2026-09-08T00:00:00.000Z'),
    saveState,
  });

  await expect(service.run()).resolves.toBe(auditReceipt);
  expect(audit.audit).toHaveBeenCalledTimes(1);
  expect(saveState).toHaveBeenCalledWith(expect.objectContaining({
    attemptCount: 1,
    auditReceipt,
    auditedAt: '2026-09-08T00:00:00.000Z',
  }));
});

test('does not re-run a complete audit for an unchanged lifecycle receipt', async () => {
  const record = sourceRecord({ changed: 1 });
  const source = {
    version: 'policy.held_out_semantic_study_lifecycle_reaudit_source.v1',
    normalLifecycleReceiptCount: 1,
    lifecycleTransitionCounts: {
      initial_intent_establishment: 0,
      native_intent_change: 1,
      library_rebuild_replacement: 0,
    },
    rawConfigurationExposed: false,
    libraryIdentityExposed: false,
    mediaIdentityExposed: false,
  };
  const audit = { audit: jest.fn() };
  const service = createHeldOutSemanticStudyLifecycleReauditService({
    audit,
    loadSourceRecord: async () => record,
    loadState: async () => ({
      sourceFingerprint: heldOutSemanticStudyLifecycleReauditSourceFingerprint(source),
      attemptCount: 1,
      auditStatusId: 'complete',
    }),
    saveState: jest.fn(),
  });

  await expect(service.run()).resolves.toBeNull();
  expect(audit.audit).not.toHaveBeenCalled();
});

test('retries a failed unchanged source only through its bounded attempt budget', async () => {
  const audit = { audit: jest.fn(async () => ({
    version: 'policy.held_out_semantic_study_eligibility_audit.v3',
    status: { id: 'failed' },
    summary: null,
  })) };
  const saveState = jest.fn(async () => undefined);
  const record = sourceRecord({ rebuild: 1 });
  const source = {
    version: 'policy.held_out_semantic_study_lifecycle_reaudit_source.v1',
    normalLifecycleReceiptCount: 1,
    lifecycleTransitionCounts: {
      initial_intent_establishment: 0,
      native_intent_change: 0,
      library_rebuild_replacement: 1,
    },
    rawConfigurationExposed: false,
    libraryIdentityExposed: false,
    mediaIdentityExposed: false,
  };
  const sourceFingerprint = heldOutSemanticStudyLifecycleReauditSourceFingerprint(source);
  const service = createHeldOutSemanticStudyLifecycleReauditService({
    audit,
    loadSourceRecord: async () => record,
    loadState: async () => ({
      sourceFingerprint,
      attemptCount: HELD_OUT_SEMANTIC_STUDY_LIFECYCLE_REAUDIT_MAXIMUM_ATTEMPTS - 1,
      auditStatusId: 'failed',
    }),
    saveState,
  });

  await expect(service.run()).resolves.toEqual(expect.objectContaining({
    status: { id: 'failed' },
  }));
  expect(saveState).toHaveBeenCalledWith(expect.objectContaining({
    attemptCount: HELD_OUT_SEMANTIC_STUDY_LIFECYCLE_REAUDIT_MAXIMUM_ATTEMPTS,
  }));

  const exhaustedService = createHeldOutSemanticStudyLifecycleReauditService({
    audit,
    loadSourceRecord: async () => record,
    loadState: async () => ({
      sourceFingerprint,
      attemptCount: HELD_OUT_SEMANTIC_STUDY_LIFECYCLE_REAUDIT_MAXIMUM_ATTEMPTS,
      auditStatusId: 'failed',
    }),
    saveState,
  });
  await expect(exhaustedService.run()).resolves.toBeNull();
  expect(audit.audit).toHaveBeenCalledTimes(1);
});

test('fails closed with the established aggregate receipt when the audit throws', async () => {
  const saveState = jest.fn(async () => undefined);
  const service = createHeldOutSemanticStudyLifecycleReauditService({
    audit: { audit: jest.fn(async () => { throw new Error('private provider'); }) },
    loadSourceRecord: async () => sourceRecord({ initial: 1 }),
    loadState: async () => null,
    saveState,
  });

  await expect(service.run()).resolves.toEqual({
    version: 'policy.held_out_semantic_study_eligibility_audit.v3',
    status: { id: 'failed' },
    summary: null,
  });
  expect(saveState).toHaveBeenCalledWith(expect.objectContaining({
    auditReceipt: expect.objectContaining({ status: { id: 'failed' } }),
  }));
});
