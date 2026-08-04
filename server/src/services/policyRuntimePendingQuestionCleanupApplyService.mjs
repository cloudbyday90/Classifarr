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

import { ValidationError } from '../utils/appError.mjs';
import {
  POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS,
  POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_VERSION,
  buildPolicyRuntimePendingQuestionCleanupPlan,
} from './policyRuntimePendingQuestionCleanupPlan.mjs';
import {
  loadPendingQuestionCleanupCurrentContext,
} from './policyRuntimePendingQuestionCleanupContext.mjs';
import {
  FRESH_RUNTIME_EVALUATION_PENDING_REASON,
  insertPendingQuestionCleanupAuditRecord,
  lockPendingQuestionCleanupClassification,
  loadPendingQuestionCleanupFreshRuntimeReplay,
  queuePendingQuestionCleanupFreshRuntimeEvaluation,
} from './policyRuntimePendingQuestionCleanupApplyRepository.mjs';
import {
  replayRecordedRuntimeQuestionAnswer,
} from './policyRuntimePendingQuestionCleanupOutcomeReplay.mjs';

const POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_APPLY_VERSION =
  'policy.runtime_pending_question_cleanup_apply.v1';
const POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_APPLY_MAX_RECORDS = 100;

const RESULT_STATUS_IDS = Object.freeze({
  NOT_FOUND: 'not_found',
  UNCHANGED: 'unchanged',
  QUEUED_FRESH_RUNTIME_EVALUATION: 'queued_fresh_runtime_evaluation',
  RESOLVED_OUTCOME_ONLY: 'resolved_outcome_only',
});
const FRESH_RUNTIME_EVALUATION_ACTION_IDS = new Set([
  POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.REGENERATE_UNDER_CURRENT_CONTRACT,
  POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.MARK_STALE_REQUIRE_RETRY,
  POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.BLOCK_LEARNING_PERMANENTLY,
]);
const REPLAY_RECEIPT_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizePositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function normalizeClassificationIds(value) {
  if (!Array.isArray(value) || value.length === 0 ||
      value.length > POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_APPLY_MAX_RECORDS) {
    return null;
  }

  const ids = [...new Set(value.map(normalizePositiveInteger))];
  if (ids.length !== value.length || ids.some(id => !id)) return null;

  return ids.sort((left, right) => left - right);
}

function normalizeActorId(value) {
  if (typeof value !== 'string') return 'admin';
  const actorId = value.trim();
  return /^[A-Za-z0-9:_-]{1,160}$/.test(actorId) ? actorId : 'admin';
}

function uniqueReasonIds(reasonIds = []) {
  return [...new Set(reasonIds.filter(reasonId => typeof reasonId === 'string'))].sort();
}

function summarizeApplyRecords(records = []) {
  return records.reduce((summary, record) => {
    summary[record.resultStatusId] = (summary[record.resultStatusId] || 0) + 1;
    return summary;
  }, Object.fromEntries(Object.values(RESULT_STATUS_IDS).map(statusId => [statusId, 0])));
}

function requiresFreshRuntimeEvaluation(actionId) {
  return FRESH_RUNTIME_EVALUATION_ACTION_IDS.has(actionId);
}

function parseAuditReasonIds(value) {
  let source = value;
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source);
    } catch {
      return null;
    }
  }

  if (!Array.isArray(source) || source.length > 20) return null;

  const reasonIds = uniqueReasonIds(source);
  return reasonIds.length === source.length && reasonIds.every(reasonId =>
    /^[a-z0-9_]{1,120}$/.test(reasonId)
  ) ? reasonIds : null;
}

function normalizeFreshRuntimeReplayAudit(value) {
  if (!value || typeof value !== 'object') return null;

  const actionId = typeof value.action_id === 'string' ? value.action_id : '';
  const resultStatusId = typeof value.result_status_id === 'string'
    ? value.result_status_id
    : '';
  const sourceVersion = typeof value.source_version === 'string'
    ? value.source_version
    : '';
  const replayReceipt = typeof value.replay_receipt === 'string'
    ? value.replay_receipt
    : '';
  const reasonIds = parseAuditReasonIds(value.reason_ids);

  if (!requiresFreshRuntimeEvaluation(actionId) ||
      sourceVersion !== POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_VERSION ||
      resultStatusId !== RESULT_STATUS_IDS.QUEUED_FRESH_RUNTIME_EVALUATION ||
      !REPLAY_RECEIPT_PATTERN.test(replayReceipt) ||
      !reasonIds) {
    return null;
  }

  return {
    actionId,
    reasonIds,
    resultStatusId,
    replayReceipt,
  };
}

export class PolicyRuntimePendingQuestionCleanupApplyService {
  constructor({
    db,
    lockClassification = lockPendingQuestionCleanupClassification,
    loadCurrentContext = loadPendingQuestionCleanupCurrentContext,
    loadFreshRuntimeReplay = loadPendingQuestionCleanupFreshRuntimeReplay,
    queueFreshRuntimeEvaluation = queuePendingQuestionCleanupFreshRuntimeEvaluation,
    replayOutcome = replayRecordedRuntimeQuestionAnswer,
    insertAuditRecord = insertPendingQuestionCleanupAuditRecord,
    createReceipt = randomUUID,
  } = {}) {
    if (!db || typeof db.withTransaction !== 'function') {
      throw new TypeError('Pending-question cleanup apply requires a transaction-capable database.');
    }

    this.db = db;
    this.lockClassification = lockClassification;
    this.loadCurrentContext = loadCurrentContext;
    this.loadFreshRuntimeReplay = loadFreshRuntimeReplay;
    this.queueFreshRuntimeEvaluation = queueFreshRuntimeEvaluation;
    this.replayOutcome = replayOutcome;
    this.insertAuditRecord = insertAuditRecord;
    this.createReceipt = createReceipt;
  }

  async run({ classificationIds, actorId = 'admin' } = {}) {
    const ids = normalizeClassificationIds(classificationIds);
    if (!ids) {
      throw new ValidationError(
        `classificationIds must contain between 1 and ${POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_APPLY_MAX_RECORDS} unique positive integers.`,
      );
    }
    const normalizedActorId = normalizeActorId(actorId);

    const records = await this.db.withTransaction(async client => {
      const applied = [];
      for (const classificationId of ids) {
        const classification = await this.lockClassification({ client, classificationId });
        if (!classification) {
          applied.push({
            classificationId,
            actionId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.NONE,
            reasonIds: [],
            resultStatusId: RESULT_STATUS_IDS.NOT_FOUND,
            replayReceipt: null,
          });
          continue;
        }

        if (classification.status === 'pending_retry' &&
            classification.pending_reason === FRESH_RUNTIME_EVALUATION_PENDING_REASON) {
          const replay = normalizeFreshRuntimeReplayAudit(
            await this.loadFreshRuntimeReplay({ client, classificationId }),
          );
          if (replay) {
            applied.push({
              classificationId,
              statusId: 'cleanup_already_queued',
              ...replay,
              replayed: true,
            });
            continue;
          }
        }

        const currentContext = await this.loadCurrentContext({ client, classification });
        const plan = buildPolicyRuntimePendingQuestionCleanupPlan({
          classification,
          currentContextVersion: currentContext.currentContextVersion,
          activeLibraryIds: currentContext.activeLibraryIds,
          contextEvaluated: currentContext.contextEvaluated,
        });
        if (plan.audit.ok !== true) {
          throw new Error('Pending-question cleanup plan failed its internal audit.');
        }

        let actionId = plan.actionId;
        let reasonIds = plan.reasonIds;
        let resultStatusId = RESULT_STATUS_IDS.UNCHANGED;
        if (actionId === POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.RESOLVE_OUTCOME_ONLY) {
          const replay = await this.replayOutcome({
            client,
            classification,
            currentContextVersion: currentContext.currentContextVersion,
            actorId: normalizedActorId,
          });
          if (replay.resolved === true) {
            resultStatusId = RESULT_STATUS_IDS.RESOLVED_OUTCOME_ONLY;
          } else {
            actionId = POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.MARK_STALE_REQUIRE_RETRY;
            reasonIds = uniqueReasonIds([...reasonIds, replay.reasonId]);
          }
        }

        if (requiresFreshRuntimeEvaluation(actionId)) {
          await this.queueFreshRuntimeEvaluation({ client, classificationId });
          resultStatusId = RESULT_STATUS_IDS.QUEUED_FRESH_RUNTIME_EVALUATION;
        }

        const receipt = this.createReceipt();
        await this.insertAuditRecord({
          client,
          classificationId,
          actionId,
          reasonIds,
          sourceVersion: plan.version,
          actorId: normalizedActorId,
          resultStatusId,
          replayReceipt: receipt,
        });
        applied.push({
          classificationId,
          statusId: plan.statusId,
          actionId,
          reasonIds,
          resultStatusId,
          replayReceipt: receipt,
        });
      }

      return applied;
    });

    return {
      version: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_APPLY_VERSION,
      mode: 'apply',
      records,
      summary: {
        requestedRecordCount: ids.length,
        replayedRecordCount: records.filter(record => record.replayed === true).length,
        ...summarizeApplyRecords(records),
      },
      sideEffects: {
        cleanupAuditWritten: records.some(record =>
          record.replayed !== true && record.resultStatusId !== RESULT_STATUS_IDS.NOT_FOUND
        ),
        learningWritten: false,
      },
    };
  }
}

export {
  POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_APPLY_MAX_RECORDS,
  POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_APPLY_VERSION,
  RESULT_STATUS_IDS,
  normalizeFreshRuntimeReplayAudit,
  normalizeClassificationIds,
};
