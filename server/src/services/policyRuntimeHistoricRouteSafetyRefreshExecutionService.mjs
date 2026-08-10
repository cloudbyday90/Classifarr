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
  POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_MAX_RECORDS,
} from './policyRuntimeHistoricRouteSafetyRefreshInventory.mjs';
import {
  evaluateHistoricRouteSafetyRefreshEligibility,
  POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_NOT_REQUIRED_REASON_ID,
} from './policyRuntimeHistoricRouteSafetyRefreshEligibility.mjs';
import {
  PolicyRuntimeHistoricRouteSafetyRefreshReceiptRepository,
} from './policyRuntimeHistoricRouteSafetyRefreshReceiptRepository.mjs';

export const POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_EXECUTION_VERSION =
  'policy.runtime_historic_route_safety_refresh_execution.v1';

export const HISTORIC_ROUTE_SAFETY_REFRESH_EXECUTION_ROUTE =
  '/api/classification/pending/route-safety-refresh/retry';

const HISTORIC_ROUTE_SAFETY_REFRESH_TASK_SOURCE = 'historic_route_safety_refresh';
const HISTORIC_ROUTE_SAFETY_REFRESH_FOLLOWUP_SOURCE =
  'historic_route_safety_refresh_followup';
const RESULT_STATUS_IDS = Object.freeze({
  QUEUED: 'queued',
  SKIPPED: 'skipped',
  FAILED: 'failed',
});
const SAFE_SKIPPED_REASON_IDS = new Set([
  'not_found',
  'status_ineligible',
  'duplicate_pending_task',
  POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_NOT_REQUIRED_REASON_ID,
]);

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function normalizeActorId(value) {
  if (typeof value !== 'string') return 'admin';
  const actorId = value.trim();
  return /^[A-Za-z0-9:_-]{1,160}$/.test(actorId) ? actorId : 'admin';
}

function normalizeClassificationIds(value) {
  if (!Array.isArray(value) || value.length === 0 ||
      value.length > POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_MAX_RECORDS) {
    return null;
  }

  const ids = value.map(positiveInteger);
  if (ids.some(id => !id) || new Set(ids).size !== ids.length) return null;

  return ids;
}

function buildExecutionRecord(classificationId, retryResult = {}) {
  if (retryResult.queued === true) {
    return {
      classificationId,
      resultStatusId: RESULT_STATUS_IDS.QUEUED,
      reasonId: 'queued_for_current_runtime_evaluation',
    };
  }

  if (retryResult.skipped === true) {
    return {
      classificationId,
      resultStatusId: RESULT_STATUS_IDS.SKIPPED,
      reasonId: SAFE_SKIPPED_REASON_IDS.has(retryResult.reasonCode)
        ? retryResult.reasonCode
        : 'retry_not_queued',
    };
  }

  return {
    classificationId,
    resultStatusId: RESULT_STATUS_IDS.FAILED,
    reasonId: 'retry_failed',
  };
}

function summarizeRecords(records = []) {
  return records.reduce((summary, record) => {
    summary[record.resultStatusId] += 1;
    return summary;
  }, {
    [RESULT_STATUS_IDS.QUEUED]: 0,
    [RESULT_STATUS_IDS.SKIPPED]: 0,
    [RESULT_STATUS_IDS.FAILED]: 0,
  });
}

export class PolicyRuntimeHistoricRouteSafetyRefreshExecutionService {
  constructor({
    classificationRetryService,
    db,
    receiptRepository = null,
    createReceipt = randomUUID,
  } = {}) {
    if (typeof classificationRetryService?.retryClassifications !== 'function') {
      throw new TypeError('Historic route-safety refresh execution requires a classification retry service.');
    }
    if (typeof createReceipt !== 'function') {
      throw new TypeError('Historic route-safety refresh execution requires a receipt factory.');
    }
    if (!receiptRepository && (!db || typeof db.withTransaction !== 'function')) {
      throw new TypeError('Historic route-safety refresh execution requires receipt storage.');
    }
    if (receiptRepository && (
      typeof receiptRepository.createReceipt !== 'function' ||
      typeof receiptRepository.markRetryQueued !== 'function' ||
      typeof receiptRepository.finalizeReceipt !== 'function'
    )) {
      throw new TypeError('Historic route-safety refresh execution requires a complete receipt repository.');
    }

    this.classificationRetryService = classificationRetryService;
    this.createReceipt = createReceipt;
    this.receiptRepository = receiptRepository || new PolicyRuntimeHistoricRouteSafetyRefreshReceiptRepository({ db });
  }

  async run({ classificationIds, actorId = 'admin' } = {}) {
    const ids = normalizeClassificationIds(classificationIds);
    if (!ids) {
      throw new ValidationError(
        `classificationIds must contain between 1 and ${POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_MAX_RECORDS} unique positive integers.`,
      );
    }

    const retryReceipt = this.createReceipt();
    const normalizedActorId = normalizeActorId(actorId);
    await this.receiptRepository.createReceipt({
      receiptId: retryReceipt,
      actorId: normalizedActorId,
      classificationIds: ids,
    });
    const retryResult = await this.classificationRetryService.retryClassifications({
      classificationIds: ids,
      actor: normalizedActorId,
      correlationId: retryReceipt,
      taskSource: HISTORIC_ROUTE_SAFETY_REFRESH_TASK_SOURCE,
      metadataEnrichmentSource: HISTORIC_ROUTE_SAFETY_REFRESH_FOLLOWUP_SOURCE,
      route: HISTORIC_ROUTE_SAFETY_REFRESH_EXECUTION_ROUTE,
      retryEligibilityCheck: ({ classification }) => {
        const eligibility = evaluateHistoricRouteSafetyRefreshEligibility(classification);
        return {
          eligible: eligibility.eligible,
          reasonCode: eligibility.reasonId,
        };
      },
      retryReceiptRecorder: ({ client, classificationId, retryTaskId }) => (
        this.receiptRepository.markRetryQueued({
          client,
          receiptId: retryReceipt,
          classificationId,
          retryTaskId,
        })
      ),
    });
    const resultByClassificationId = new Map(
      (Array.isArray(retryResult?.results) ? retryResult.results : [])
        .map(result => [positiveInteger(result?.classificationId), result]),
    );
    const records = ids.map(classificationId => buildExecutionRecord(
      classificationId,
      resultByClassificationId.get(classificationId),
    ));
    const summary = summarizeRecords(records);
    const metadataEnrichmentTasksQueued = ids.filter(classificationId => (
      resultByClassificationId.get(classificationId)?.metadataEnrichmentQueued === true
    )).length;
    await this.receiptRepository.finalizeReceipt({ receiptId: retryReceipt, records });

    return Object.freeze({
      version: POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_EXECUTION_VERSION,
      mode: 'apply',
      retryReceipt,
      records: Object.freeze(records),
      summary: {
        requestedRecordCount: ids.length,
        ...summary,
      },
      sideEffects: {
        retryCommandsExecuted: summary[RESULT_STATUS_IDS.QUEUED] > 0,
        classificationRowsMutated: summary[RESULT_STATUS_IDS.QUEUED] > 0,
        metadataEnrichmentTasksQueued,
        routesExecuted: false,
        learningWritten: false,
      },
    });
  }
}

export {
  RESULT_STATUS_IDS as HISTORIC_ROUTE_SAFETY_REFRESH_EXECUTION_RESULT_STATUS_IDS,
  normalizeClassificationIds as normalizeHistoricRouteSafetyRefreshExecutionClassificationIds,
};
