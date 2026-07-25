/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { randomUUID } from 'node:crypto';
import * as defaultDb from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { loadPolicyActiveIntentIntegrityReport, POLICY_ACTIVE_INTENT_INTEGRITY_STATUS_IDS } from './policyActiveIntentIntegrity.mjs';
import {
  NATIVE_INTENT_RECONCILIATION_LIFECYCLE_REASON_IDS,
  NATIVE_INTENT_RECONCILIATION_RESTORE_GATE_STATE_IDS,
  buildReconciliationExecutionEligibility,
  normalizePositiveInteger,
  normalizeSafeId,
  normalizeTimestamp,
  validateReentryAction,
} from './nativeIntentReconciliationLifecycleContract.mjs';
import {
  beginNativeIntentReconciliationRestore,
  completeNativeIntentReconciliationRestore,
  countNativeIntentPolicyLibraryMismatches,
  failNativeIntentReconciliationRestore,
  insertNativeIntentReconciliationHold,
  insertNativeIntentReconciliationReentryEvent,
  loadActiveNativeIntentReconciliationHolds,
  loadNativeIntentReconciliationRestoreGate,
  lockActiveNativeIntentReconciliationHold,
  lockNativeIntentReconciliationReentryPolicy,
  releaseNativeIntentReconciliationHold,
  verifyNativeIntentReconciliationSchema,
} from './nativeIntentReconciliationLifecyclePersistence.mjs';

const logger = createLogger('NativeIntentReconciliationLifecycleService');

const REQUIRED_RESTORE_SCHEMA_TABLES = Object.freeze([
  'library_policies',
  'policy_intents',
  'policy_intent_migration_events',
  'policy_native_intent_reconciliation_states',
  'policy_native_intent_reconciliation_holds',
  'policy_native_intent_reconciliation_restore_gates',
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePolicyIds(candidates = []) {
  return [...new Set(asArray(candidates)
    .map(candidate => normalizePositiveInteger(candidate?.policyId ?? candidate?.policy_id))
    .filter(Boolean))];
}

function toSafeHeldCandidate(candidate, hold) {
  return {
    ...candidate,
    hold: {
      sourceEventId: Number(hold.source_event_id),
      reasonId: normalizeSafeId(
        hold.reason_id,
        NATIVE_INTENT_RECONCILIATION_LIFECYCLE_REASON_IDS.ROLLBACK_RECONCILIATION_HOLD,
      ),
    },
  };
}

export class NativeIntentReconciliationLifecycleService {
  constructor({
    db = defaultDb,
    loggerInstance = logger,
    now = () => new Date(),
    createRestoreToken = randomUUID,
    loadRestoreGate = loadNativeIntentReconciliationRestoreGate,
    beginRestore = beginNativeIntentReconciliationRestore,
    completeRestore = completeNativeIntentReconciliationRestore,
    failRestore = failNativeIntentReconciliationRestore,
    loadHolds = loadActiveNativeIntentReconciliationHolds,
    lockHold = lockActiveNativeIntentReconciliationHold,
    insertHold = insertNativeIntentReconciliationHold,
    lockReentryPolicy = lockNativeIntentReconciliationReentryPolicy,
    insertReentryEvent = insertNativeIntentReconciliationReentryEvent,
    releaseHold = releaseNativeIntentReconciliationHold,
    verifySchema = verifyNativeIntentReconciliationSchema,
    countPolicyLibraryMismatches = countNativeIntentPolicyLibraryMismatches,
    loadAuthorityIntegrity = loadPolicyActiveIntentIntegrityReport,
  } = {}) {
    this.db = db;
    this.logger = loggerInstance;
    this.now = now;
    this.createRestoreToken = createRestoreToken;
    this.loadRestoreGate = loadRestoreGate;
    this.beginRestore = beginRestore;
    this.completeRestore = completeRestore;
    this.failRestore = failRestore;
    this.loadHolds = loadHolds;
    this.lockHold = lockHold;
    this.insertHold = insertHold;
    this.lockReentryPolicy = lockReentryPolicy;
    this.insertReentryEvent = insertReentryEvent;
    this.releaseHold = releaseHold;
    this.verifySchema = verifySchema;
    this.countPolicyLibraryMismatches = countPolicyLibraryMismatches;
    this.loadAuthorityIntegrity = loadAuthorityIntegrity;
  }

  async getExecutionEligibility({ dbClient = this.db } = {}) {
    const gate = await this.loadRestoreGate({ db: dbClient });
    return buildReconciliationExecutionEligibility(gate || {
      // The singleton is seeded by migration. Its absence indicates damaged or
      // incomplete operational state, so reconciliation must not fail open.
      gateState: NATIVE_INTENT_RECONCILIATION_RESTORE_GATE_STATE_IDS.REQUIRES_MAINTENANCE,
      reasonId: NATIVE_INTENT_RECONCILIATION_LIFECYCLE_REASON_IDS.RESTORE_VALIDATION_FAILED,
    });
  }

  async partitionCandidates({ candidates = [], dbClient = this.db } = {}) {
    const policyIds = normalizePolicyIds(candidates);
    const holds = await this.loadHolds({ db: dbClient, policyIds });
    const holdsByPolicyId = new Map(asArray(holds).map(hold => [Number(hold.policy_id), hold]));
    const eligibleCandidates = [];
    const heldCandidates = [];

    asArray(candidates).forEach(candidate => {
      const hold = holdsByPolicyId.get(Number(candidate?.policyId));
      if (hold) {
        heldCandidates.push(toSafeHeldCandidate(candidate, hold));
      } else {
        eligibleCandidates.push(candidate);
      }
    });

    return {
      eligibleCandidates,
      heldCandidates,
      outcomeOverrides: heldCandidates.map(candidate => ({
        policyId: candidate.policyId,
        outcomeState: 'blocked_current_state',
        reasonId: NATIVE_INTENT_RECONCILIATION_LIFECYCLE_REASON_IDS.ROLLBACK_RECONCILIATION_HOLD,
        retryNotBefore: null,
      })),
      rawPayloadExposed: false,
    };
  }

  async assertPolicyWriteEligible({ client, policyId } = {}) {
    const eligibility = await this.getExecutionEligibility({ dbClient: client });
    if (!eligibility.allowed) {
      return {
        allowed: false,
        reasonId: eligibility.reasonId,
      };
    }

    const hold = await this.lockHold({ client, policyId });
    if (hold) {
      return {
        allowed: false,
        reasonId: NATIVE_INTENT_RECONCILIATION_LIFECYCLE_REASON_IDS.ROLLBACK_RECONCILIATION_HOLD,
      };
    }

    return { allowed: true };
  }

  async recordReversionHold({ client, policyId, sourceEventId, heldAt = this.now() } = {}) {
    const normalizedPolicyId = normalizePositiveInteger(policyId);
    const normalizedSourceEventId = normalizePositiveInteger(sourceEventId);
    const normalizedHeldAt = normalizeTimestamp(heldAt);
    if (!normalizedPolicyId || !normalizedSourceEventId || !normalizedHeldAt) {
      throw new TypeError('Native intent reversion hold requires policy, event, and timestamp identifiers.');
    }

    const recordedPolicyId = await this.insertHold({
      client,
      policyId: normalizedPolicyId,
      sourceEventId: normalizedSourceEventId,
      reasonId: NATIVE_INTENT_RECONCILIATION_LIFECYCLE_REASON_IDS.ROLLBACK_APPLIED,
      heldAt: normalizedHeldAt,
    });
    if (!recordedPolicyId) {
      throw new Error('Native intent reversion hold could not be persisted.');
    }

    return {
      policyId: recordedPolicyId,
      reasonId: NATIVE_INTENT_RECONCILIATION_LIFECYCLE_REASON_IDS.ROLLBACK_RECONCILIATION_HOLD,
      rawPayloadExposed: false,
    };
  }

  async beginBackupRestore({ dbClient = this.db, startedAt = this.now() } = {}) {
    const restoreToken = this.createRestoreToken();
    const normalizedStartedAt = normalizeTimestamp(startedAt);
    const gate = await this.beginRestore({
      db: dbClient,
      restoreToken,
      startedAt: normalizedStartedAt,
    });
    if (!gate) {
      return {
        started: false,
        reasonId: NATIVE_INTENT_RECONCILIATION_LIFECYCLE_REASON_IDS.RESTORE_IN_PROGRESS,
        rawPayloadExposed: false,
      };
    }

    return {
      started: true,
      restoreToken,
      startedAt: normalizedStartedAt,
      rawPayloadExposed: false,
    };
  }

  async verifyRestoredDatabase({ dbClient = this.db } = {}) {
    const [schemaRows, authorityIntegrity, policyLibraryMismatchCount] = await Promise.all([
      this.verifySchema({ db: dbClient, expectedTables: REQUIRED_RESTORE_SCHEMA_TABLES }),
      this.loadAuthorityIntegrity(dbClient),
      this.countPolicyLibraryMismatches({ db: dbClient }),
    ]);
    const schemaParity = asArray(schemaRows).every(row => row.present === true);
    const nativeAuthorityIntegrity = authorityIntegrity?.statusId === POLICY_ACTIVE_INTENT_INTEGRITY_STATUS_IDS.CLEAN &&
      policyLibraryMismatchCount === 0;

    return {
      verified: schemaParity && nativeAuthorityIntegrity,
      schemaParity,
      nativeAuthorityIntegrity,
      policyLibraryMismatchCount,
      schemaStatusId: schemaParity ? 'schema_parity_verified' : 'schema_parity_missing',
      authorityStatusId: nativeAuthorityIntegrity
        ? 'native_authority_verified'
        : 'native_authority_integrity_failed',
      reasonId: schemaParity && nativeAuthorityIntegrity
        ? NATIVE_INTENT_RECONCILIATION_LIFECYCLE_REASON_IDS.RESTORE_VERIFIED
        : schemaParity
          ? NATIVE_INTENT_RECONCILIATION_LIFECYCLE_REASON_IDS.RESTORE_VALIDATION_FAILED
          : NATIVE_INTENT_RECONCILIATION_LIFECYCLE_REASON_IDS.RESTORE_SCHEMA_PARITY_FAILED,
      rawPayloadExposed: false,
    };
  }

  async completeBackupRestore({
    dbClient = this.db,
    restoreToken,
    verification,
    finishedAt = this.now(),
  } = {}) {
    const normalizedFinishedAt = normalizeTimestamp(finishedAt);
    if (verification?.verified !== true) {
      return { completed: false, reasonId: verification?.reasonId, rawPayloadExposed: false };
    }

    const gate = await this.completeRestore({
      db: dbClient,
      restoreToken,
      finishedAt: normalizedFinishedAt,
      reasonId: NATIVE_INTENT_RECONCILIATION_LIFECYCLE_REASON_IDS.RESTORE_VERIFIED,
    });
    return {
      completed: Boolean(gate),
      reasonId: gate?.reason_id || NATIVE_INTENT_RECONCILIATION_LIFECYCLE_REASON_IDS.RESTORE_VALIDATION_FAILED,
      verifiedAt: gate?.verified_at
        ? normalizeTimestamp(gate.verified_at)
        : normalizedFinishedAt,
      rawPayloadExposed: false,
    };
  }

  async failBackupRestore({
    dbClient = this.db,
    restoreToken,
    reasonId = NATIVE_INTENT_RECONCILIATION_LIFECYCLE_REASON_IDS.RESTORE_VALIDATION_FAILED,
    finishedAt = this.now(),
  } = {}) {
    const gate = await this.failRestore({
      db: dbClient,
      restoreToken,
      finishedAt: normalizeTimestamp(finishedAt),
      reasonId: normalizeSafeId(
        reasonId,
        NATIVE_INTENT_RECONCILIATION_LIFECYCLE_REASON_IDS.RESTORE_VALIDATION_FAILED,
      ),
    });
    return { failed: Boolean(gate), rawPayloadExposed: false };
  }

  async approvePolicyReentry({ dbClient = this.db, policyId, action = {}, now = this.now() } = {}) {
    const normalizedPolicyId = normalizePositiveInteger(policyId);
    const actionValidation = validateReentryAction(action);
    const releasedAt = normalizeTimestamp(now);
    if (!normalizedPolicyId || !actionValidation.ok || !releasedAt || typeof dbClient?.withTransaction !== 'function') {
      return {
        approved: false,
        reasonId: !normalizedPolicyId ? 'reentry_policy_invalid' :
          !actionValidation.ok ? actionValidation.reasonId : 'reentry_transaction_required',
        rawPayloadExposed: false,
      };
    }

    return dbClient.withTransaction(async client => {
      const policy = await this.lockReentryPolicy({ client, policyId: normalizedPolicyId });
      if (!policy) {
        return { approved: false, reasonId: 'reentry_policy_not_found', rawPayloadExposed: false };
      }
      if (policy.has_active_native_intent === true) {
        return {
          approved: false,
          reasonId: NATIVE_INTENT_RECONCILIATION_LIFECYCLE_REASON_IDS.ACTIVE_NATIVE_AUTHORITY,
          rawPayloadExposed: false,
        };
      }
      const hold = await this.lockHold({ client, policyId: normalizedPolicyId });
      if (!hold) {
        return { approved: false, reasonId: 'reentry_hold_not_active', rawPayloadExposed: false };
      }

      const eventId = await this.insertReentryEvent({
        client,
        policyId: normalizedPolicyId,
        actorType: actionValidation.normalizedAction.actorType,
        actorId: actionValidation.normalizedAction.actorId,
        reasonCode: actionValidation.normalizedAction.reasonCode,
        heldEventId: Number(hold.source_event_id),
      });
      const releasedPolicyId = await this.releaseHold({
        client,
        policyId: normalizedPolicyId,
        releaseEventId: eventId,
        releaseReasonId: NATIVE_INTENT_RECONCILIATION_LIFECYCLE_REASON_IDS.APPROVED_REENTRY,
        releasedAt,
      });
      if (!eventId || !releasedPolicyId) {
        throw new Error('Native intent reconciliation re-entry could not be persisted.');
      }

      return {
        approved: true,
        policyId: releasedPolicyId,
        reasonId: NATIVE_INTENT_RECONCILIATION_LIFECYCLE_REASON_IDS.RECONCILIATION_REENTRY_APPROVED,
        rawPayloadExposed: false,
      };
    });
  }
}

export const nativeIntentReconciliationLifecycleService =
  new NativeIntentReconciliationLifecycleService();

export {
  REQUIRED_RESTORE_SCHEMA_TABLES,
};
