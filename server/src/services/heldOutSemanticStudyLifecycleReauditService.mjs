/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as database from '../config/database.mjs';
import {
  createHeldOutSemanticStudyEligibilityAudit,
  HELD_OUT_SEMANTIC_STUDY_ELIGIBILITY_AUDIT_STATUS_IDS,
  HELD_OUT_SEMANTIC_STUDY_ELIGIBILITY_AUDIT_VERSION,
} from './heldOutSemanticStudyEligibilityAudit.mjs';
import {
  buildHeldOutSemanticStudyLifecycleReauditSource,
  HELD_OUT_SEMANTIC_STUDY_LIFECYCLE_REAUDIT_MAXIMUM_ATTEMPTS,
  heldOutSemanticStudyLifecycleReauditSourceFingerprint,
  isHeldOutSemanticStudyLifecycleReauditSourceChanged,
} from './heldOutSemanticStudyLifecycleReauditContract.mjs';
import {
  loadHeldOutSemanticStudyLifecycleReauditState,
  saveHeldOutSemanticStudyLifecycleReauditState,
} from './heldOutSemanticStudyLifecycleReauditPersistence.mjs';
import {
  loadHeldOutSemanticStudyLifecycleSourceCheckpoint,
  saveHeldOutSemanticStudyLifecycleSourceCheckpoint,
} from './heldOutSemanticStudyLifecycleSourceCheckpointPersistence.mjs';
import {
  loadHeldOutSemanticStudyLifecycleReauditSourceRecord,
} from './heldOutSemanticStudyLifecycleReauditSource.mjs';
import {
  buildHeldOutSemanticStudyLifecycleReauditPurposeEvidence,
  loadHeldOutSemanticStudyLifecycleReauditPurposeEvidenceRecord,
} from './heldOutSemanticStudyLifecycleReauditPurposeEvidence.mjs';

function failedAuditReceipt() {
  return Object.freeze({
    version: HELD_OUT_SEMANTIC_STUDY_ELIGIBILITY_AUDIT_VERSION,
    status: Object.freeze({
      id: HELD_OUT_SEMANTIC_STUDY_ELIGIBILITY_AUDIT_STATUS_IDS.FAILED,
    }),
    summary: null,
  });
}

function isAuditReceipt(value) {
  return value && typeof value === 'object' &&
    value.version === HELD_OUT_SEMANTIC_STUDY_ELIGIBILITY_AUDIT_VERSION &&
    typeof value.status?.id === 'string' &&
    Object.values(HELD_OUT_SEMANTIC_STUDY_ELIGIBILITY_AUDIT_STATUS_IDS)
      .includes(value.status.id);
}

function auditStateMatchesSource({ auditState, sourceFingerprint }) {
  return auditState?.sourceFingerprint === sourceFingerprint && isAuditReceipt(auditState.auditReceipt);
}

function nextAttemptCount({ auditState, auditStateCurrent, sourceChanged }) {
  return sourceChanged || !auditStateCurrent ? 1 : auditState.attemptCount + 1;
}

function shouldRun({ auditState, auditStateCurrent, source, sourceChanged }) {
  if (source.normalLifecycleReceiptCount === 0) return false;
  if (source.completePolicyEvidenceCount === 0) return false;
  if (sourceChanged || !auditStateCurrent) return true;

  return auditState.auditStatusId === HELD_OUT_SEMANTIC_STUDY_ELIGIBILITY_AUDIT_STATUS_IDS.FAILED &&
    auditState.attemptCount < HELD_OUT_SEMANTIC_STUDY_LIFECYCLE_REAUDIT_MAXIMUM_ATTEMPTS;
}

/**
 * Re-runs the existing private eligibility audit only after a durable normal
 * lifecycle receipt changes. A run returns the audit's unmodified aggregate
 * receipt or null when no receipt changed. It never invokes cohort capture,
 * labels, semantic retrieval, policy mutation, or routing.
 */
export function createHeldOutSemanticStudyLifecycleReauditService({
  audit = createHeldOutSemanticStudyEligibilityAudit(),
  db = database,
  loadPurposeEvidenceRecord = () =>
    loadHeldOutSemanticStudyLifecycleReauditPurposeEvidenceRecord({ db }),
  loadSourceRecord = () => loadHeldOutSemanticStudyLifecycleReauditSourceRecord({ db }),
  loadAuditState = () => loadHeldOutSemanticStudyLifecycleReauditState({ db }),
  loadSourceCheckpoint = () => loadHeldOutSemanticStudyLifecycleSourceCheckpoint({ db }),
  now = () => new Date(),
  saveAuditState = (input) => saveHeldOutSemanticStudyLifecycleReauditState({ db, ...input }),
  saveSourceCheckpoint = (input) =>
    saveHeldOutSemanticStudyLifecycleSourceCheckpoint({ db, ...input }),
} = {}) {
  return Object.freeze({
    async run() {
      const sourceRecord = await loadSourceRecord();
      const lifecycleSource = buildHeldOutSemanticStudyLifecycleReauditSource(sourceRecord);
      const source = lifecycleSource.normalLifecycleReceiptCount === 0
        ? lifecycleSource
        : buildHeldOutSemanticStudyLifecycleReauditSource(
          sourceRecord,
          buildHeldOutSemanticStudyLifecycleReauditPurposeEvidence(
            await loadPurposeEvidenceRecord(),
          ),
        );
      const [sourceCheckpoint, auditState] = await Promise.all([
        loadSourceCheckpoint(),
        loadAuditState(),
      ]);
      const sourceFingerprint = heldOutSemanticStudyLifecycleReauditSourceFingerprint(source);
      const sourceChanged = isHeldOutSemanticStudyLifecycleReauditSourceChanged({
        source,
        state: sourceCheckpoint,
      });
      const auditStateCurrent = auditStateMatchesSource({ auditState, sourceFingerprint });

      if (sourceChanged) {
        await saveSourceCheckpoint({
          source,
          sourceFingerprint,
          observedAt: now().toISOString(),
        });
      }

      if (!shouldRun({ auditState, auditStateCurrent, source, sourceChanged })) return null;

      let auditReceipt;
      try {
        auditReceipt = await audit.audit();
      } catch {
        auditReceipt = failedAuditReceipt();
      }
      if (!isAuditReceipt(auditReceipt)) auditReceipt = failedAuditReceipt();

      await saveAuditState({
        source,
        sourceFingerprint,
        attemptCount: nextAttemptCount({ auditState, auditStateCurrent, sourceChanged }),
        auditReceipt,
        auditedAt: now().toISOString(),
      });

      return auditReceipt;
    },
  });
}

export const heldOutSemanticStudyLifecycleReauditService =
  createHeldOutSemanticStudyLifecycleReauditService();
