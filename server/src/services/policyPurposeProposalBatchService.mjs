/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createHash } from 'node:crypto';
import * as defaultDb from '../config/database.mjs';
import {
  POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS,
  applyPolicyNativeIntentChange,
} from './policyNativeIntentChangeService.mjs';
import {
  POLICY_PURPOSE_PROPOSAL_BATCH_MAX_POLICY_COUNT,
  POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS,
  buildPolicyPurposeProposalBatchPlan,
  isExactPolicyPurposeProposalBatch,
  validatePolicyPurposeProposalBatchRequest,
} from './policyPurposeProposalBatchContract.mjs';
import {
  loadPolicyPurposeDeclarationWorklistRecords,
} from './policyPurposeDeclarationWorklistPersistence.mjs';
import {
  loadPolicyPurposeProposalBatchReplayReceipts,
} from './policyPurposeProposalBatchPersistence.mjs';

function hasTransactionBoundary(dbClient) {
  return typeof dbClient?.withTransaction === 'function';
}

function createChildIdempotencyKey(batchIdempotencyKey, policyId) {
  const digest = createHash('sha256')
    .update(`policy-purpose-proposal-batch:${batchIdempotencyKey}:${policyId}`, 'utf8')
    .digest('hex');
  return `purposeproposal_${digest}`;
}

function hasCompleteReplay(receipts, candidatePolicyIds, childKeys) {
  if (!Array.isArray(receipts) || receipts.length !== childKeys.length) return false;
  const expectedKeysByPolicyId = new Map(candidatePolicyIds.map((policyId, index) => [
    policyId,
    childKeys[index],
  ]));
  return receipts.every(receipt => expectedKeysByPolicyId.get(receipt?.policyId) === receipt?.idempotencyKey);
}

function buildApplyResult({ statusId, policyCount = 0, replayed = false } = {}) {
  const applied = statusId === POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS.APPLIED ||
    statusId === POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS.REPLAYED;
  return {
    version: 'policy_purpose_proposal_batch_apply.v1',
    statusId,
    policyCount,
    replayed: replayed === true,
    rawPurposeRulesExposed: false,
    sideEffects: {
      policyStorageMutated: statusId === POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS.APPLIED,
      routingWritten: false,
      learningWritten: false,
      providerAccessed: false,
      semanticSelectionAffected: false,
      databaseWritten: statusId === POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS.APPLIED,
    },
    retry: {
      mode: 'durable_per_policy_receipts',
      replayed: replayed === true,
      receiptPersisted: applied,
      idempotencyKeyExposed: false,
    },
  };
}

class PurposeProposalBatchAbort extends Error {
  constructor(statusId) {
    super(statusId);
    this.statusId = statusId;
  }
}

/**
 * A small, purpose-specific coordinator. It reuses the mature individual
 * revision-checking writer through a transaction facade, so all child changes
 * share one outer transaction and either all commit or all roll back.
 */
export class PolicyPurposeProposalBatchService {
  constructor({
    db = defaultDb,
    loadRecords = loadPolicyPurposeDeclarationWorklistRecords,
    loadReplayReceipts = loadPolicyPurposeProposalBatchReplayReceipts,
    applyChange = applyPolicyNativeIntentChange,
    buildPlan = buildPolicyPurposeProposalBatchPlan,
  } = {}) {
    this.db = db;
    this.loadRecords = loadRecords;
    this.loadReplayReceipts = loadReplayReceipts;
    this.applyChange = applyChange;
    this.buildPlan = buildPlan;
  }

  async loadPlan(dbClient) {
    const loaded = await this.loadRecords({
      db: dbClient,
      limit: POLICY_PURPOSE_PROPOSAL_BATCH_MAX_POLICY_COUNT + 1,
    });
    const records = Array.isArray(loaded) ? loaded : [];
    return this.buildPlan({
      records: records.slice(0, POLICY_PURPOSE_PROPOSAL_BATCH_MAX_POLICY_COUNT),
      truncated: records.length > POLICY_PURPOSE_PROPOSAL_BATCH_MAX_POLICY_COUNT,
    });
  }

  async getProposal({ dbClient = this.db } = {}) {
    const plan = await this.loadPlan(dbClient);
    return plan.presentation;
  }

  async applyProposal({
    dbClient = this.db,
    actorId,
    actorRole,
    idempotencyKey,
    request,
    now = new Date(),
  } = {}) {
    const normalizedRequest = validatePolicyPurposeProposalBatchRequest(request);
    if (!normalizedRequest.valid) {
      return buildApplyResult({ statusId: POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS.REQUEST_INVALID });
    }
    if (!hasTransactionBoundary(dbClient)) {
      return buildApplyResult({ statusId: POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS.TRANSACTION_UNAVAILABLE });
    }

    const childKeys = normalizedRequest.candidatePolicyIds.map(policyId => (
      createChildIdempotencyKey(idempotencyKey, policyId)
    ));

    try {
      return await dbClient.withTransaction(async client => {
        const receipts = await this.loadReplayReceipts({
          client,
          actorId,
          idempotencyKeys: childKeys,
        });
        if (hasCompleteReplay(receipts, normalizedRequest.candidatePolicyIds, childKeys)) {
          return buildApplyResult({
            statusId: POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS.REPLAYED,
            policyCount: childKeys.length,
            replayed: true,
          });
        }
        if (receipts.length > 0) {
          throw new PurposeProposalBatchAbort(
            POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS.REPLAY_INCOMPLETE,
          );
        }

        const plan = await this.loadPlan(client);
        if (!isExactPolicyPurposeProposalBatch(plan, normalizedRequest)) {
          throw new PurposeProposalBatchAbort(
            POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS.PROPOSAL_STALE,
          );
        }

        const transactionFacade = { withTransaction: work => work(client) };
        for (const [index, candidate] of plan.candidates.entries()) {
          const result = await this.applyChange({
            dbClient: transactionFacade,
            policyId: candidate.policyId,
            expectedRevision: candidate.revision,
            actorId,
            actorRole,
            idempotencyKey: childKeys[index],
            changeCommands: [candidate.command],
            now,
          });
          if (result?.statusId !== POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.APPLIED ||
              result?.change?.replayed === true) {
            throw new PurposeProposalBatchAbort(
              POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS.PROPOSAL_STALE,
            );
          }
        }

        return buildApplyResult({
          statusId: POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS.APPLIED,
          policyCount: plan.candidates.length,
        });
      });
    } catch (error) {
      if (error instanceof PurposeProposalBatchAbort) {
        return buildApplyResult({ statusId: error.statusId });
      }
      return buildApplyResult({ statusId: POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS.FAILED_ROLLED_BACK });
    }
  }
}

export const policyPurposeProposalBatchService = new PolicyPurposeProposalBatchService();

export { createChildIdempotencyKey };
