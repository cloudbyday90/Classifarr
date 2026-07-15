/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as defaultDb from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import {
  buildPolicyIntentMigrationCandidateReport,
} from './policyIntentMigrationCandidateReport.mjs';
import {
  buildPolicyPostUpgradeDryRun,
  loadPolicyPostUpgradeCandidateInputs,
} from './policyPostUpgradeDryRun.mjs';
import {
  applyPolicyPostUpgradeApplyGate,
} from './policyPostUpgradeApplyGate.mjs';
import {
  nativeIntentReconciliationStateService as defaultStateService,
} from './nativeIntentReconciliationStateService.mjs';

const NATIVE_INTENT_RECONCILIATION_CANDIDATE_SCAN_SIZE = 100;
const logger = createLogger('NativeIntentReconciliationExecutionService');

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function toSafeCandidate(candidate = {}) {
  const policyId = Number(candidate.policyId);
  if (!Number.isInteger(policyId) || policyId <= 0) return null;

  return {
    policyId,
    statusId: candidate.statusId,
    canConvert: candidate.canConvert === true,
    reasonIds: asArray(candidate.reasons)
      .map(reason => reason?.reasonId)
      .filter(reasonId => typeof reasonId === 'string'),
    intentContract: {
      schemaVersion: candidate.intentContract?.schemaVersion,
      source: candidate.intentContract?.source,
      inferenceState: candidate.intentContract?.inferenceState,
      valid: candidate.intentContract?.valid === true,
      errorCount: candidate.intentContract?.errorCount,
      warningCount: candidate.intentContract?.warningCount,
      unsupportedSignalCount: candidate.intentContract?.unsupportedSignalCount,
    },
    authorityEligibility: candidate.authorityEligibility
      ? {
        stateId: candidate.authorityEligibility.stateId,
        integrityStatusId: candidate.authorityEligibility.integrityStatusId,
        activeIntentCount: candidate.authorityEligibility.activeIntentCount,
      }
      : undefined,
  };
}

function toSafeConversionSteps(workflow = {}, selectedPolicyIds = []) {
  const selected = new Set(asArray(selectedPolicyIds).map(policyId => Number(policyId)));

  return asArray(workflow.steps)
    .filter(step => selected.has(Number(step?.policyId)))
    .map(step => ({
      policyId: Number(step.policyId),
      statusId: step.statusId,
      reasons: asArray(step.reasons).map(reason => ({ reasonId: reason?.reasonId })),
    }));
}

function mergeCandidates(...candidateLists) {
  const byPolicyId = new Map();
  candidateLists.flatMap(asArray).forEach(candidate => {
    if (candidate?.policyId) {
      byPolicyId.set(candidate.policyId, candidate);
    }
  });
  return [...byPolicyId.values()].sort((left, right) => left.policyId - right.policyId);
}

function mergeOutcomeOverrides(...overrideLists) {
  const byPolicyId = new Map();
  overrideLists.flatMap(asArray).forEach(override => {
    if (override?.policyId) {
      byPolicyId.set(override.policyId, override);
    }
  });
  return [...byPolicyId.values()].sort((left, right) => left.policyId - right.policyId);
}

export class NativeIntentReconciliationExecutionService {
  constructor({
    dbClient = defaultDb,
    stateService = defaultStateService,
    loggerInstance = logger,
    now = () => new Date(),
    loadCandidateInputs = loadPolicyPostUpgradeCandidateInputs,
    buildCandidateReport = buildPolicyIntentMigrationCandidateReport,
    buildDryRun = buildPolicyPostUpgradeDryRun,
    applyGate = applyPolicyPostUpgradeApplyGate,
  } = {}) {
    this.dbClient = dbClient;
    this.stateService = stateService;
    this.logger = loggerInstance;
    this.now = now;
    this.loadCandidateInputs = loadCandidateInputs;
    this.buildCandidateReport = buildCandidateReport;
    this.buildDryRun = buildDryRun;
    this.applyGate = applyGate;
  }

  async run({
    dbClient = this.dbClient,
    maxPolicies = 10,
    now = this.now(),
    actorId = null,
    action = null,
    executionDeadlineAt = null,
  } = {}) {
    const evaluatedAt = normalizeTimestamp(now);
    const { policies, activeIntentIntegrityReport } = await this.loadCandidateInputs({
      dbClient,
      maxPolicies: NATIVE_INTENT_RECONCILIATION_CANDIDATE_SCAN_SIZE,
      unconvertedOnly: true,
      excludeRevertedPolicies: true,
      prioritizeReconciliationEligibility: true,
    });
    const candidateReport = this.buildCandidateReport({
      policies,
      maxPolicies: NATIVE_INTENT_RECONCILIATION_CANDIDATE_SCAN_SIZE,
      activeIntentIntegrityReport,
    });
    const safeCandidates = asArray(candidateReport.candidates)
      .map(toSafeCandidate)
      .filter(Boolean);
    const plan = await this.stateService.plan({
      candidates: safeCandidates,
      maxPolicies,
      evaluatedAt,
      dbClient,
    });

    await this.stateService.persist({ ...plan, dbClient });

    const dryRun = this.buildDryRun({
      policies,
      candidateReport,
      maxPolicies: NATIVE_INTENT_RECONCILIATION_CANDIDATE_SCAN_SIZE,
      selectedPolicyIds: plan.selectedPolicyIds,
      activeIntentIntegrityReport,
      action,
      now: evaluatedAt,
    });
    const applyGate = await this.applyGate({
      dbClient,
      dryRun,
      policies,
      now: evaluatedAt,
      actorId,
      executionDeadlineAt,
    });
    const conversionSteps = toSafeConversionSteps(
      dryRun.conversionWorkflow,
      plan.selectedPolicyIds,
    );
    const resolved = this.stateService.resolveApplyOutcomes({
      applyGate,
      selectedCandidates: plan.selectedCandidates,
      persistedStates: plan.persistedStates,
      conversionSteps,
      evaluatedAt,
    });
    let statePersistence = null;

    try {
      statePersistence = await this.stateService.persist({ ...resolved, dbClient });
    } catch {
      statePersistence = {
        statusId: 'failed',
        reasonId: 'state_write_failed',
        rawPayloadExposed: false,
      };
      this.logger.error('Native intent reconciliation state write failed after apply', {
        statusId: applyGate.statusId || 'unknown',
        failureCategory: 'state_write',
      });
    }

    return {
      ...applyGate,
      reconciliationCandidates: mergeCandidates(
        plan.ledgerCandidates,
        plan.selectedCandidates,
      ),
      reconciliationOutcomeOverrides: mergeOutcomeOverrides(
        plan.outcomeOverrides,
        resolved.outcomeOverrides,
      ),
      reconciliationSteps: conversionSteps,
      reconciliationSelection: {
        selectedPolicyCount: plan.counts.selectedPolicyCount,
        deferredPolicyCount: plan.counts.deferredPolicyCount,
        quarantinedPolicyCount: plan.counts.quarantinedPolicyCount || 0,
        discoveredPolicyCount: safeCandidates.length,
        rawPayloadExposed: false,
      },
      reconciliationState: statePersistence,
    };
  }
}

export const nativeIntentReconciliationExecutionService =
  new NativeIntentReconciliationExecutionService();

export {
  NATIVE_INTENT_RECONCILIATION_CANDIDATE_SCAN_SIZE,
};
