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
import { createLogger } from '../utils/logger.mjs';
import {
  runPolicyPostUpgradeApplyGate,
} from './policyPostUpgradeApplyGate.mjs';
import {
  POLICY_CONVERSION_ACTOR_SOURCE_IDS,
} from './policyConversionActorSources.mjs';

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

function buildResult({ applyGate = {}, startedAt, deadlineAt, failed = false } = {}) {
  const readyPolicyIds = asArray(applyGate.readyPolicyIds);

  return {
    version: NATIVE_INTENT_RECONCILIATION_VERSION,
    statusId: failed ? 'failed' : (applyGate.statusId || 'unknown'),
    startedAt,
    deadlineAt,
    completedAt: new Date().toISOString(),
    scope: {
      currentStateOnly: true,
      unconvertedOnly: true,
      excludesRevertedPolicies: true,
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
      ? ['native_intent_reconciliation_failed']
      : normalizeOperatorErrorIds(applyGate.operatorErrorIds),
  };
}

class NativeIntentReconciliationService {
  constructor({
    dbClient = database,
    runApplyGate = runPolicyPostUpgradeApplyGate,
    now = () => new Date(),
    loggerInstance = logger,
  } = {}) {
    this.dbClient = dbClient;
    this.runApplyGate = runApplyGate;
    this.now = now;
    this.logger = loggerInstance;
  }

  async run() {
    const startedAt = normalizeTimestamp(this.now());
    const deadlineAt = new Date(
      new Date(startedAt).getTime() + NATIVE_INTENT_RECONCILIATION_MAX_ELAPSED_MS,
    ).toISOString();

    try {
      const applyGate = await this.runApplyGate({
        dbClient: this.dbClient,
        maxPolicies: NATIVE_INTENT_RECONCILIATION_BATCH_SIZE,
        now: startedAt,
        executionDeadlineAt: deadlineAt,
        unconvertedOnly: true,
        excludeRevertedPolicies: true,
        action: {
          actorSourceId: POLICY_CONVERSION_ACTOR_SOURCE_IDS.NATIVE_INTENT_RECONCILIATION,
          reasonCode: 'native_intent_reconciliation',
          requestedAt: startedAt,
        },
      });
      const result = buildResult({ applyGate, startedAt, deadlineAt });

      this.logger.info('Native intent reconciliation completed', {
        statusId: result.statusId,
        applied: result.applied,
        counts: result.counts,
        operatorErrorIds: result.operatorErrorIds,
      });

      return result;
    } catch {
      const result = buildResult({ startedAt, deadlineAt, failed: true });

      this.logger.error('Native intent reconciliation failed', {
        statusId: result.statusId,
        failureCategory: 'execution',
      });

      return result;
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
