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
import * as database from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import {
  POLICY_CONVERSION_ACTOR_SOURCE_IDS,
} from './policyConversionActorSources.mjs';
import {
  nativeIntentReconciliationLedgerService as defaultLedgerService,
} from './nativeIntentReconciliationLedgerService.mjs';
import {
  nativeIntentReconciliationExecutionService,
} from './nativeIntentReconciliationExecutionService.mjs';
import {
  nativeIntentReconciliationControlService as defaultControlService,
} from './nativeIntentReconciliationControlService.mjs';
import {
  nativeIntentReconciliationAlertService as defaultAlertService,
} from './nativeIntentReconciliationAlertService.mjs';
import {
  buildNativeIntentReconciliationFailureAttribution,
  NATIVE_INTENT_RECONCILIATION_FAILURE_STAGE_IDS,
  runNativeIntentReconciliationStage,
} from './nativeIntentReconciliationFailureAttribution.mjs';
import {
  buildNativeIntentReconciliationAlertFailureAttribution,
} from './nativeIntentReconciliationAlertFailureAttribution.mjs';
import {
  getNativeIntentReconciliationRuntimeProvenance,
  normalizeNativeIntentReconciliationRuntimeProvenance,
} from './nativeIntentReconciliationRuntimeProvenance.mjs';

const NATIVE_INTENT_RECONCILIATION_VERSION = 'native_intent_reconciliation.v1';
const NATIVE_INTENT_RECONCILIATION_BATCH_SIZE = 10;
const NATIVE_INTENT_RECONCILIATION_MAX_ELAPSED_MS = 20_000;
const MAX_OPERATOR_ERROR_IDS = 12;
const logger = createLogger('NativeIntentReconciliationService');

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function normalizeCount(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : 0;
}

function normalizeOperatorErrorIds(value) {
  return [...new Set(asArray(value)
    .filter(errorId => typeof errorId === 'string' && /^[a-z0-9][a-z0-9_:-]{0,79}$/u.test(errorId)))]
    .slice(0, MAX_OPERATOR_ERROR_IDS);
}

function normalizeLedgerResult(value) {
  if (value && typeof value === 'object' && typeof value.statusId === 'string') {
    return value;
  }

  return {
    statusId: 'failed',
    reasonId: 'ledger_write_invalid_result',
    rawPayloadExposed: false,
  };
}

function resolveRuntimeProvenance(provider) {
  try {
    return normalizeNativeIntentReconciliationRuntimeProvenance(provider());
  } catch {
    return normalizeNativeIntentReconciliationRuntimeProvenance();
  }
}

function buildResult({
  applyGate = {},
  startedAt,
  deadlineAt,
  failed = false,
  control = null,
  correlationId,
  runtimeProvenance,
} = {}) {
  const readyPolicyIds = asArray(applyGate.readyPolicyIds);

  return {
    version: NATIVE_INTENT_RECONCILIATION_VERSION,
    correlationId,
    statusId: failed ? 'failed' : (applyGate.statusId || 'unknown'),
    startedAt,
    deadlineAt,
    completedAt: new Date().toISOString(),
    runtime: normalizeNativeIntentReconciliationRuntimeProvenance(runtimeProvenance),
    scope: {
      currentStateOnly: true,
      unconvertedOnly: true,
      respectsActiveReversionHolds: true,
      batchSize: NATIVE_INTENT_RECONCILIATION_BATCH_SIZE,
      maxElapsedMs: NATIVE_INTENT_RECONCILIATION_MAX_ELAPSED_MS,
    },
    counts: {
      attemptedPolicyCount: readyPolicyIds.length,
      appliedPolicyCount: normalizeCount(applyGate.appliedPolicyCount),
      alreadyConvertedCount: normalizeCount(applyGate.alreadyConvertedCount),
    },
    applied: applyGate.applied === true,
    operatorErrorIds: failed
      ? (normalizeOperatorErrorIds(applyGate.operatorErrorIds).length > 0
        ? normalizeOperatorErrorIds(applyGate.operatorErrorIds)
        : ['native_intent_reconciliation_failed'])
      : normalizeOperatorErrorIds(applyGate.operatorErrorIds),
    ...(applyGate.reconciliationFailure
      ? { failure: applyGate.reconciliationFailure }
      : {}),
    ...(control ? { control } : {}),
  };
}

function buildFailedApplyGate({ failure }) {
  return {
    statusId: 'failed',
    applied: false,
    appliedPolicyCount: 0,
    alreadyConvertedCount: 0,
    readyPolicyIds: [],
    operatorErrorIds: [failure.reasonId],
    reconciliationCandidates: [],
    reconciliationOutcomeOverrides: [],
    reconciliationFailure: failure,
  };
}

function buildControlDeferredApplyGate(eligibility = {}) {
  return {
    statusId: eligibility.statusId || 'deferred_by_reconciliation_control',
    applied: false,
    appliedPolicyCount: 0,
    alreadyConvertedCount: 0,
    readyPolicyIds: [],
    operatorErrorIds: [eligibility.reasonId || 'reconciliation_control_unavailable'],
  };
}

class NativeIntentReconciliationService {
  constructor({
    dbClient = database,
    runApplyGate = nativeIntentReconciliationExecutionService.run.bind(
      nativeIntentReconciliationExecutionService,
    ),
    ledgerService = defaultLedgerService,
    controlService = defaultControlService,
    alertService = defaultAlertService,
    now = () => new Date(),
    runtimeProvenanceProvider = getNativeIntentReconciliationRuntimeProvenance,
    loggerInstance = logger,
  } = {}) {
    this.dbClient = dbClient;
    this.runApplyGate = runApplyGate;
    this.ledgerService = ledgerService;
    this.controlService = controlService;
    this.alertService = alertService;
    this.now = now;
    this.runtimeProvenanceProvider = runtimeProvenanceProvider;
    this.logger = loggerInstance;
  }

  async evaluateAlerts(result) {
    try {
      result.alertEvaluation = await this.alertService.evaluateAndNotify({
        dbClient: this.dbClient,
        correlationId: result.correlationId,
      });
    } catch (error) {
      const failure = buildNativeIntentReconciliationAlertFailureAttribution(error);
      result.alertEvaluation = {
        statusId: 'failed',
        reasonId: failure.reasonId,
        stageId: failure.stageId,
        categoryId: failure.categoryId,
        rawPayloadExposed: false,
      };
      this.logger.error('Native intent reconciliation alert evaluation failed', {
        correlationId: result.correlationId,
        statusId: result.statusId,
        alertFailureStageId: failure.stageId,
        alertFailureReasonId: failure.reasonId,
        failureCategory: failure.categoryId,
        rawPayloadExposed: false,
      }, { persistStack: false });
    }
    return result;
  }

  async run() {
    const startedAt = normalizeTimestamp(this.now());
    const correlationId = randomUUID();
    const runtimeProvenance = resolveRuntimeProvenance(this.runtimeProvenanceProvider);
    const deadlineAt = new Date(
      new Date(startedAt).getTime() + NATIVE_INTENT_RECONCILIATION_MAX_ELAPSED_MS,
    ).toISOString();

    try {
      const controlEligibility = await runNativeIntentReconciliationStage({
        stageId: NATIVE_INTENT_RECONCILIATION_FAILURE_STAGE_IDS.CONTROL_ELIGIBILITY,
        execute: () => this.controlService.getExecutionEligibility({
          dbClient: this.dbClient,
          now: startedAt,
        }),
      });
      if (!controlEligibility.allowed) {
        const result = buildResult({
          applyGate: buildControlDeferredApplyGate(controlEligibility),
          startedAt,
          deadlineAt,
          control: controlEligibility.control,
          correlationId,
          runtimeProvenance,
        });
        this.logger.info('Native intent reconciliation deferred by operational control', {
          statusId: result.statusId,
          reasonId: controlEligibility.reasonId,
          circuitState: controlEligibility.control?.circuitState,
        });
        return this.evaluateAlerts(result);
      }

      const applyGate = await this.runApplyGate({
        dbClient: this.dbClient,
        maxPolicies: NATIVE_INTENT_RECONCILIATION_BATCH_SIZE,
        now: startedAt,
        executionDeadlineAt: deadlineAt,
        correlationId,
        action: {
          actorSourceId: POLICY_CONVERSION_ACTOR_SOURCE_IDS.NATIVE_INTENT_RECONCILIATION,
          reasonCode: 'native_intent_reconciliation',
          requestedAt: startedAt,
        },
      });
      const result = buildResult({
        applyGate,
        startedAt,
        deadlineAt,
        control: controlEligibility.control,
        correlationId,
        runtimeProvenance,
      });

      try {
        const controlOutcome = await this.controlService.recordExecutionResult({
          dbClient: this.dbClient,
          applyGate,
          now: result.completedAt,
        });
        if (controlOutcome?.control) {
          result.control = controlOutcome.control;
        }
      } catch {
        result.control = {
          statusId: 'unavailable',
          rawPayloadExposed: false,
        };
        this.logger.error('Native intent reconciliation control write failed', {
          correlationId,
          statusId: result.statusId,
          failureCategory: 'control_state',
          rawPayloadExposed: false,
        }, { persistStack: false });
      }

      try {
        result.ledger = normalizeLedgerResult(await this.ledgerService.record({
          applyGate,
          startedAt,
          finishedAt: result.completedAt,
          runKey: correlationId,
          runtimeProvenance,
        }));
      } catch {
        result.ledger = {
          statusId: 'failed',
          reasonId: 'ledger_write_failed',
          rawPayloadExposed: false,
        };
        this.logger.error('Native intent reconciliation ledger write failed', {
          correlationId,
          statusId: result.statusId,
          failureCategory: 'ledger_write',
          rawPayloadExposed: false,
        }, { persistStack: false });
      }

      this.logger.info('Native intent reconciliation completed', {
        statusId: result.statusId,
        applied: result.applied,
        counts: result.counts,
        operatorErrorIds: result.operatorErrorIds,
        ledgerStatusId: result.ledger.statusId,
        correlationId,
        runtime: result.runtime,
      });

      return this.evaluateAlerts(result);
    } catch (error) {
      const failure = buildNativeIntentReconciliationFailureAttribution(error);
      let control = null;
      try {
        const controlOutcome = await this.controlService.recordExecutionError({
          dbClient: this.dbClient,
          error,
          now: new Date(),
        });
        control = controlOutcome?.control || null;
      } catch {
        control = {
          statusId: 'unavailable',
          rawPayloadExposed: false,
        };
        this.logger.error('Native intent reconciliation control failure recording failed', {
          correlationId,
          statusId: 'failed',
          failureCategory: 'control_state',
          rawPayloadExposed: false,
        }, { persistStack: false });
      }

      const failedApplyGate = buildFailedApplyGate({ failure });
      const result = buildResult({
        applyGate: failedApplyGate,
        startedAt,
        deadlineAt,
        failed: true,
        control,
        correlationId,
        runtimeProvenance,
      });

      try {
        result.ledger = normalizeLedgerResult(await this.ledgerService.record({
          applyGate: failedApplyGate,
          startedAt,
          finishedAt: result.completedAt,
          runKey: correlationId,
          runtimeProvenance,
        }));
      } catch {
        result.ledger = {
          statusId: 'failed',
          reasonId: 'ledger_write_failed',
          rawPayloadExposed: false,
        };
      }

      await this.logger.error('Native intent reconciliation failed', {
        correlationId,
        statusId: result.statusId,
        failureStageId: failure.stageId,
        failureReasonId: failure.reasonId,
        failureCategory: failure.categoryId,
        systemFailureCategory: failure.systemFailureCategory,
        ledgerStatusId: result.ledger.statusId,
        runtime: result.runtime,
        rawPayloadExposed: false,
      }, { persistStack: false });

      return this.evaluateAlerts(result);
    }
  }
}

const nativeIntentReconciliationService = new NativeIntentReconciliationService();

export {
  NATIVE_INTENT_RECONCILIATION_BATCH_SIZE,
  NATIVE_INTENT_RECONCILIATION_MAX_ELAPSED_MS,
  NATIVE_INTENT_RECONCILIATION_VERSION,
  NativeIntentReconciliationService,
  nativeIntentReconciliationService,
};
