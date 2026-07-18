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
import {
  nativeIntentReconciliationLifecycleService as defaultLifecycleService,
} from './nativeIntentReconciliationLifecycleService.mjs';
import {
  NATIVE_INTENT_RECONCILIATION_FAILURE_STAGE_IDS,
  buildNativeIntentReconciliationFailureAttribution,
  runNativeIntentReconciliationStage,
} from './nativeIntentReconciliationFailureAttribution.mjs';
import { createLibraryProfileService } from './libraryProfileService.mjs';
import { POLICY_INTENT_CONVERSION_ACTOR_SOURCE_IDS } from './policyIntentConversionWorkflow.mjs';

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
    initialization: candidate.initialization
      ? {
        mode: candidate.initialization.mode,
        sourceId: candidate.initialization.sourceId,
        statusId: candidate.initialization.statusId,
        ready: candidate.initialization.ready === true,
      }
      : undefined,
  };
}

function getProfileRefreshLibraryIds({ candidates = [], policies = [] } = {}) {
  const libraryIdByPolicyId = new Map(asArray(policies)
    .map(policy => [Number(policy?.id), Number(policy?.library_id)])
    .filter(([policyId, libraryId]) => (
      Number.isInteger(policyId) && policyId > 0 && Number.isInteger(libraryId) && libraryId > 0
    )));

  return [...new Set(asArray(candidates)
    .filter(candidate => candidate?.statusId === 'awaiting_library_profile')
    .map(candidate => libraryIdByPolicyId.get(Number(candidate?.policyId)))
    .filter(libraryId => Number.isInteger(libraryId) && libraryId > 0))];
}

async function refreshDeferredLibraryProfiles({ profileService, libraryIds = [], loggerInstance }) {
  if (!profileService || typeof profileService.generateProfile !== 'function' || libraryIds.length === 0) {
    return { attemptedCount: 0, generatedCount: 0, emptyCount: 0, failedCount: 0 };
  }

  const results = await Promise.all(libraryIds.map(async libraryId => {
    try {
      const profile = await profileService.generateProfile(libraryId);
      return profile ? 'generated' : 'empty';
    } catch {
      return 'failed';
    }
  }));
  const summary = {
    attemptedCount: libraryIds.length,
    generatedCount: results.filter(result => result === 'generated').length,
    emptyCount: results.filter(result => result === 'empty').length,
    failedCount: results.filter(result => result === 'failed').length,
  };

  loggerInstance.info('Reconciler refreshed deferred library profiles', {
    ...summary,
    rawPayloadExposed: false,
  });
  return summary;
}

function toSafeConversionSteps(workflow, selectedPolicyIds = []) {
  const selected = new Set(asArray(selectedPolicyIds).map(policyId => Number(policyId)));

  return asArray(workflow?.steps)
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

function buildLifecycleDeferredApplyGate(eligibility = {}) {
  return {
    statusId: 'deferred_by_reconciliation_lifecycle_guard',
    applied: false,
    appliedPolicyCount: 0,
    alreadyConvertedCount: 0,
    results: [],
    operatorErrorIds: [eligibility.reasonId || 'restore_validation_failed'],
    failureCategory: eligibility.reasonId || 'restore_validation_failed',
    rawPayloadExposed: false,
  };
}

function buildNoCandidateApplyGate() {
  return {
    statusId: 'evaluated',
    applied: false,
    appliedPolicyCount: 0,
    alreadyConvertedCount: 0,
    readyPolicyIds: [],
    operatorErrorIds: [],
    results: [],
    reconciliationCandidates: [],
    reconciliationOutcomeOverrides: [],
  };
}

export class NativeIntentReconciliationExecutionService {
  constructor({
    dbClient = defaultDb,
    stateService = defaultStateService,
    lifecycleService = defaultLifecycleService,
    loggerInstance = logger,
    now = () => new Date(),
    loadCandidateInputs = loadPolicyPostUpgradeCandidateInputs,
    buildCandidateReport = buildPolicyIntentMigrationCandidateReport,
    buildDryRun = buildPolicyPostUpgradeDryRun,
    applyGate = applyPolicyPostUpgradeApplyGate,
    profileService = null,
  } = {}) {
    this.dbClient = dbClient;
    this.stateService = stateService;
    this.lifecycleService = lifecycleService;
    this.logger = loggerInstance;
    this.now = now;
    this.loadCandidateInputs = loadCandidateInputs;
    this.buildCandidateReport = buildCandidateReport;
    this.buildDryRun = buildDryRun;
    this.applyGate = applyGate;
    this.profileService = profileService || createLibraryProfileService({ dbClient });
  }

  async run({
    dbClient = this.dbClient,
    maxPolicies = 10,
    now = this.now(),
    actorId = null,
    action = null,
    correlationId = null,
    executionDeadlineAt = null,
  } = {}) {
    const evaluatedAt = normalizeTimestamp(now);
    const executionEligibility = await runNativeIntentReconciliationStage({
      stageId: NATIVE_INTENT_RECONCILIATION_FAILURE_STAGE_IDS.LIFECYCLE_ELIGIBILITY,
      execute: () => this.lifecycleService.getExecutionEligibility({ dbClient }),
    });
    if (!executionEligibility.allowed) {
      const applyGate = buildLifecycleDeferredApplyGate(executionEligibility);
      return {
        ...applyGate,
        reconciliationCandidates: [],
        reconciliationOutcomeOverrides: [],
        reconciliationSteps: [],
        reconciliationSelection: {
          selectedPolicyCount: 0,
          deferredPolicyCount: 0,
          heldPolicyCount: 0,
          quarantinedPolicyCount: 0,
          discoveredPolicyCount: 0,
          rawPayloadExposed: false,
        },
        reconciliationLifecycle: executionEligibility,
        reconciliationState: {
          statusId: 'unchanged',
          upsertedCount: 0,
          deletedCount: 0,
          rawPayloadExposed: false,
        },
      };
    }
    let { policies, activeIntentIntegrityReport } = await runNativeIntentReconciliationStage({
      stageId: NATIVE_INTENT_RECONCILIATION_FAILURE_STAGE_IDS.CANDIDATE_INPUT_LOAD,
      execute: () => this.loadCandidateInputs({
        dbClient,
        maxPolicies: NATIVE_INTENT_RECONCILIATION_CANDIDATE_SCAN_SIZE,
        unconvertedOnly: true,
        excludeRevertedPolicies: false,
        prioritizeReconciliationEligibility: true,
      }),
    });
    let candidateReport = await runNativeIntentReconciliationStage({
      stageId: NATIVE_INTENT_RECONCILIATION_FAILURE_STAGE_IDS.CANDIDATE_REPORT_BUILD,
      execute: () => this.buildCandidateReport({
        policies,
        maxPolicies: NATIVE_INTENT_RECONCILIATION_CANDIDATE_SCAN_SIZE,
        activeIntentIntegrityReport,
      }),
    });
    const profileRefreshLibraryIds = getProfileRefreshLibraryIds({
      candidates: candidateReport.candidates,
      policies,
    });
    const profileRefresh = await refreshDeferredLibraryProfiles({
      profileService: this.profileService,
      libraryIds: profileRefreshLibraryIds,
      loggerInstance: this.logger,
    });
    if (profileRefresh.attemptedCount > 0) {
      ({ policies, activeIntentIntegrityReport } = await runNativeIntentReconciliationStage({
        stageId: NATIVE_INTENT_RECONCILIATION_FAILURE_STAGE_IDS.CANDIDATE_INPUT_LOAD,
        execute: () => this.loadCandidateInputs({
          dbClient,
          maxPolicies: NATIVE_INTENT_RECONCILIATION_CANDIDATE_SCAN_SIZE,
          unconvertedOnly: true,
          excludeRevertedPolicies: false,
          prioritizeReconciliationEligibility: true,
        }),
      }));
      candidateReport = await runNativeIntentReconciliationStage({
        stageId: NATIVE_INTENT_RECONCILIATION_FAILURE_STAGE_IDS.CANDIDATE_REPORT_BUILD,
        execute: () => this.buildCandidateReport({
          policies,
          maxPolicies: NATIVE_INTENT_RECONCILIATION_CANDIDATE_SCAN_SIZE,
          activeIntentIntegrityReport,
        }),
      });
    }
    const safeCandidates = asArray(candidateReport.candidates)
      .map(toSafeCandidate)
      .filter(Boolean);
    if (policies.length === 0) {
      return {
        ...buildNoCandidateApplyGate(),
        reconciliationSteps: [],
        reconciliationSelection: {
          selectedPolicyCount: 0,
          deferredPolicyCount: 0,
          heldPolicyCount: 0,
          quarantinedPolicyCount: 0,
          discoveredPolicyCount: 0,
          rawPayloadExposed: false,
        },
        reconciliationLifecycle: executionEligibility,
        reconciliationState: {
          statusId: 'unchanged',
          upsertedCount: 0,
          deletedCount: 0,
          rawPayloadExposed: false,
        },
      };
    }
    const lifecyclePlan = await runNativeIntentReconciliationStage({
      stageId: NATIVE_INTENT_RECONCILIATION_FAILURE_STAGE_IDS.LIFECYCLE_PARTITION,
      execute: () => this.lifecycleService.partitionCandidates({
        candidates: safeCandidates,
        dbClient,
      }),
    });
    const plan = await runNativeIntentReconciliationStage({
      stageId: NATIVE_INTENT_RECONCILIATION_FAILURE_STAGE_IDS.STATE_PLAN,
      execute: () => this.stateService.plan({
        candidates: lifecyclePlan.eligibleCandidates,
        maxPolicies,
        evaluatedAt,
        dbClient,
      }),
    });

    await runNativeIntentReconciliationStage({
      stageId: NATIVE_INTENT_RECONCILIATION_FAILURE_STAGE_IDS.STATE_INITIAL_PERSIST,
      execute: () => this.stateService.persist({ ...plan, dbClient }),
    });

    const dryRun = await runNativeIntentReconciliationStage({
      stageId: NATIVE_INTENT_RECONCILIATION_FAILURE_STAGE_IDS.DRY_RUN_BUILD,
      execute: () => this.buildDryRun({
        policies,
        candidateReport,
        maxPolicies: NATIVE_INTENT_RECONCILIATION_CANDIDATE_SCAN_SIZE,
        selectedPolicyIds: plan.selectedPolicyIds,
        activeIntentIntegrityReport,
        action: {
          ...(action || {}),
          actorSourceId: action?.actorSourceId ||
            POLICY_INTENT_CONVERSION_ACTOR_SOURCE_IDS.NATIVE_INTENT_RECONCILIATION,
          reasonCode: action?.reasonCode || 'native_intent_reconciliation',
        },
        now: evaluatedAt,
      }),
    });
    const applyGate = await runNativeIntentReconciliationStage({
      stageId: NATIVE_INTENT_RECONCILIATION_FAILURE_STAGE_IDS.CONVERSION_APPLY,
      execute: () => this.applyGate({
        dbClient,
        dryRun,
        policies,
        now: evaluatedAt,
        actorId,
        executionDeadlineAt,
        policyWriteGuard: ({ client, policyId }) => this.lifecycleService.assertPolicyWriteEligible({
          client,
          policyId,
        }),
      }),
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
      statePersistence = await runNativeIntentReconciliationStage({
        stageId: NATIVE_INTENT_RECONCILIATION_FAILURE_STAGE_IDS.STATE_OUTCOME_PERSIST,
        execute: () => this.stateService.persist({ ...resolved, dbClient }),
      });
    } catch (error) {
      const failure = buildNativeIntentReconciliationFailureAttribution(error);
      statePersistence = {
        statusId: 'failed',
        reasonId: failure.reasonId,
        failure: failure,
        rawPayloadExposed: false,
      };
      this.logger.error('Native intent reconciliation state write failed after apply', {
        statusId: applyGate.statusId || 'unknown',
        correlationId,
        failureStageId: failure.stageId,
        failureReasonId: failure.reasonId,
        failureCategory: failure.categoryId,
        rawPayloadExposed: false,
      }, { persistStack: false });
    }

    return {
      ...applyGate,
      reconciliationCandidates: mergeCandidates(
        lifecyclePlan.heldCandidates,
        plan.ledgerCandidates,
        plan.selectedCandidates,
      ),
      reconciliationOutcomeOverrides: mergeOutcomeOverrides(
        lifecyclePlan.outcomeOverrides,
        plan.outcomeOverrides,
        resolved.outcomeOverrides,
      ),
      reconciliationSteps: conversionSteps,
      reconciliationSelection: {
        selectedPolicyCount: plan.counts.selectedPolicyCount,
        deferredPolicyCount: plan.counts.deferredPolicyCount,
        heldPolicyCount: lifecyclePlan.heldCandidates.length,
        quarantinedPolicyCount: plan.counts.quarantinedPolicyCount || 0,
        discoveredPolicyCount: safeCandidates.length,
        profileRefresh,
        rawPayloadExposed: false,
      },
      reconciliationLifecycle: executionEligibility,
      reconciliationState: statePersistence,
    };
  }
}

export const nativeIntentReconciliationExecutionService =
  new NativeIntentReconciliationExecutionService();

export {
  NATIVE_INTENT_RECONCILIATION_CANDIDATE_SCAN_SIZE,
};
