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

import {
  POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_STATUS_IDS,
  POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_VERSION,
  validatePolicyLibraryRebuildLegacyFinalRemovalPlan,
} from './policyLibraryRebuildLegacyFinalRemovalPlan.mjs';
import {
  POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_STATUS_IDS,
  POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_VERSION,
  validatePolicyLibraryRebuildLegacyRemovalInventory,
} from './policyLibraryRebuildLegacyRemovalInventory.mjs';

const POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_VERSION =
  'policy.library_rebuild_legacy_global_release_retirement_gate.v1';
const POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_STATE_VERSION =
  'policy.library_rebuild_legacy_global_release_state.v1';

const POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_STATUS_IDS = Object.freeze({
  READY_FOR_REPOSITORY_RETIREMENT_PROPOSAL: 'ready_for_repository_retirement_proposal',
  BLOCKED_BY_EVIDENCE_BOUNDARY: 'blocked_by_evidence_boundary',
  BLOCKED_BY_POLICY_INVENTORY: 'blocked_by_policy_inventory',
  BLOCKED_BY_FINAL_REMOVAL_PLAN: 'blocked_by_final_removal_plan',
  BLOCKED_BY_REMOVAL_INVENTORY: 'blocked_by_removal_inventory',
});

const POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_RISK_IDS = Object.freeze({
  EVIDENCE_BOUNDARY_UNAVAILABLE: 'evidence_boundary_unavailable',
  ENABLED_POLICY_INVENTORY_EMPTY: 'enabled_policy_inventory_empty',
  ENABLED_POLICY_CONTEXT_INVALID: 'enabled_policy_context_invalid',
  DUPLICATE_ENABLED_POLICY: 'duplicate_enabled_policy',
  FINAL_REMOVAL_PLAN_MISSING: 'final_removal_plan_missing',
  FINAL_REMOVAL_PLAN_UNEXPECTED: 'final_removal_plan_unexpected',
  FINAL_REMOVAL_PLAN_INVALID: 'final_removal_plan_invalid',
  FINAL_REMOVAL_PLAN_NOT_READY: 'final_removal_plan_not_ready',
  FINAL_REMOVAL_PLAN_POLICY_MISMATCH: 'final_removal_plan_policy_mismatch',
  FINAL_REMOVAL_PLAN_INVENTORY_MISMATCH: 'final_removal_plan_inventory_mismatch',
  REMOVAL_INVENTORY_INVALID: 'removal_inventory_invalid',
  UNSAFE_GATE_OUTPUT: 'unsafe_gate_output',
});

const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizePositiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function normalizeIsoDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeFingerprint(value) {
  return typeof value === 'string' && SHA256_FINGERPRINT_PATTERN.test(value)
    ? value
    : null;
}

function sha256(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function addRisk(risks, riskId) {
  if (!risks.some(risk => risk.riskId === riskId)) {
    risks.push({ riskId });
  }
}

function normalizePolicyContext(value = {}) {
  const policy = asObject(value);
  const policyId = normalizePositiveInteger(policy.policyId ?? policy.policy_id ?? policy.id);
  const libraryId = normalizePositiveInteger(policy.libraryId ?? policy.library_id);

  return policyId && libraryId ? { policyId, libraryId } : null;
}

function normalizePolicyInventory(policyInventory = []) {
  return asArray(policyInventory).map(normalizePolicyContext);
}

function summarizeRemovalInventory(value = {}) {
  const inventory = asObject(value);

  return {
    version: typeof inventory.version === 'string' ? inventory.version : null,
    statusId: typeof inventory.statusId === 'string' ? inventory.statusId : null,
    candidateCount: Number.isInteger(inventory.candidateCount) ? inventory.candidateCount : null,
    inventoryFingerprint: normalizeFingerprint(inventory.inventoryFingerprint),
    validationOk: inventory.validation?.ok === true || inventory.validationOk === true,
  };
}

function summarizeFinalRemovalPlan(value = {}) {
  const plan = asObject(value);
  const policy = normalizePolicyContext(plan.policy);
  const inventory = summarizeRemovalInventory(plan.removalInventory);

  return {
    policy,
    version: typeof plan.version === 'string' ? plan.version : null,
    statusId: typeof plan.statusId === 'string' ? plan.statusId : null,
    readyForGlobalReleaseRetirementGate:
      plan.readyForGlobalReleaseRetirementGate === true,
    validationOk: plan.validation?.ok === true,
    riskCount: Number.isInteger(plan.riskCount) ? plan.riskCount : null,
    removalInventory: inventory,
  };
}

function policyKey(policy) {
  return policy ? `${policy.policyId}:${policy.libraryId}` : null;
}

function buildReleaseState({ policies, plans, removalInventory }) {
  const policyContexts = policies
    .filter(Boolean)
    .map(policy => ({ policyId: policy.policyId, libraryId: policy.libraryId }))
    .sort((left, right) => left.policyId - right.policyId || left.libraryId - right.libraryId);
  const planContexts = plans
    .map(plan => ({
      policyId: plan.policy?.policyId || null,
      libraryId: plan.policy?.libraryId || null,
      version: plan.version,
      statusId: plan.statusId,
      readyForGlobalReleaseRetirementGate: plan.readyForGlobalReleaseRetirementGate,
      validationOk: plan.validationOk,
      riskCount: plan.riskCount,
      removalInventory: plan.removalInventory,
    }))
    .sort((left, right) => (left.policyId || 0) - (right.policyId || 0) ||
      (left.libraryId || 0) - (right.libraryId || 0));
  const policyInventoryFingerprint = sha256(policyContexts);
  const finalRemovalPlanFingerprint = sha256(planContexts);
  const releaseStateFingerprint = buildReleaseStateFingerprint({
    policyInventoryFingerprint,
    finalRemovalPlanFingerprint,
    removalInventory,
  });

  return {
    version: POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_STATE_VERSION,
    enabledPolicyCount: policyContexts.length,
    policyInventoryFingerprint,
    finalRemovalPlanFingerprint,
    removalInventory,
    releaseStateFingerprint,
  };
}

function buildReleaseStateFingerprint({
  policyInventoryFingerprint = null,
  finalRemovalPlanFingerprint = null,
  removalInventory = null,
} = {}) {
  return sha256({
    version: POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_STATE_VERSION,
    policyInventoryFingerprint,
    finalRemovalPlanFingerprint,
    removalInventory,
  });
}

function inventoryIsReady(inventory) {
  return inventory.version === POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_VERSION &&
    inventory.statusId === POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_STATUS_IDS.READY &&
    inventory.candidateCount !== null && inventory.candidateCount > 0 &&
    Boolean(inventory.inventoryFingerprint) && inventory.validationOk === true;
}

function finalPlanMatchesContext(plan, policy, removalInventory) {
  return plan.policy?.policyId === policy.policyId &&
    plan.policy?.libraryId === policy.libraryId &&
    plan.version === POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_VERSION &&
    plan.statusId === POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_STATUS_IDS
      .READY_FOR_GLOBAL_RELEASE_RETIREMENT_GATE &&
    plan.readyForGlobalReleaseRetirementGate === true &&
    plan.validationOk === true &&
    plan.removalInventory.version === removalInventory.version &&
    plan.removalInventory.statusId === removalInventory.statusId &&
    plan.removalInventory.candidateCount === removalInventory.candidateCount &&
    plan.removalInventory.inventoryFingerprint === removalInventory.inventoryFingerprint &&
    plan.removalInventory.validationOk === true;
}

function determineStatusId(risks) {
  const riskIds = new Set(risks.map(risk => risk.riskId));

  if (riskIds.has(POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_RISK_IDS
    .EVIDENCE_BOUNDARY_UNAVAILABLE)) {
    return POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_STATUS_IDS
      .BLOCKED_BY_EVIDENCE_BOUNDARY;
  }

  if ([
    POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_RISK_IDS
      .ENABLED_POLICY_INVENTORY_EMPTY,
    POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_RISK_IDS
      .ENABLED_POLICY_CONTEXT_INVALID,
    POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_RISK_IDS
      .DUPLICATE_ENABLED_POLICY,
  ].some(riskId => riskIds.has(riskId))) {
    return POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_STATUS_IDS
      .BLOCKED_BY_POLICY_INVENTORY;
  }

  if (riskIds.has(POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_RISK_IDS
    .REMOVAL_INVENTORY_INVALID)) {
    return POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_STATUS_IDS
      .BLOCKED_BY_REMOVAL_INVENTORY;
  }

  if (risks.length > 0) {
    return POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_STATUS_IDS
      .BLOCKED_BY_FINAL_REMOVAL_PLAN;
  }

  return POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_STATUS_IDS
    .READY_FOR_REPOSITORY_RETIREMENT_PROPOSAL;
}

function buildPolicyLibraryRebuildLegacyGlobalReleaseRetirementGate({
  policyInventory = [],
  finalRemovalPlans = [],
  removalInventory = null,
  evidenceBoundaryAvailable = true,
  now = new Date(),
} = {}) {
  const evaluatedAt = normalizeIsoDate(now) || new Date().toISOString();
  const sourcePolicies = asArray(policyInventory);
  const policies = normalizePolicyInventory(sourcePolicies);
  const plans = asArray(finalRemovalPlans).map(summarizeFinalRemovalPlan);
  const inventory = summarizeRemovalInventory(removalInventory);
  const removalInventoryValidation = validatePolicyLibraryRebuildLegacyRemovalInventory(removalInventory);
  const risks = [];

  if (evidenceBoundaryAvailable !== true) {
    addRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_RISK_IDS
      .EVIDENCE_BOUNDARY_UNAVAILABLE);
  }
  if (sourcePolicies.length === 0) {
    addRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_RISK_IDS
      .ENABLED_POLICY_INVENTORY_EMPTY);
  }
  if (policies.some(policy => !policy)) {
    addRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_RISK_IDS
      .ENABLED_POLICY_CONTEXT_INVALID);
  }

  const validPolicies = policies.filter(Boolean);
  const policyKeys = new Set();
  validPolicies.forEach(policy => {
    const key = policyKey(policy);
    if (policyKeys.has(key)) {
      addRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_RISK_IDS
        .DUPLICATE_ENABLED_POLICY);
    }
    policyKeys.add(key);
  });

  if (!inventoryIsReady(inventory) || !removalInventoryValidation.ok) {
    addRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_RISK_IDS
      .REMOVAL_INVENTORY_INVALID);
  }

  const plansByPolicyKey = new Map();
  plans.forEach(plan => {
    const key = policyKey(plan.policy);
    if (!key || plansByPolicyKey.has(key)) {
      addRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_RISK_IDS
        .FINAL_REMOVAL_PLAN_UNEXPECTED);
      return;
    }
    plansByPolicyKey.set(key, plan);
  });

  validPolicies.forEach(policy => {
    const key = policyKey(policy);
    const plan = plansByPolicyKey.get(key);
    if (!plan) {
      addRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_RISK_IDS
        .FINAL_REMOVAL_PLAN_MISSING);
      return;
    }

    const originalPlan = asArray(finalRemovalPlans).find(candidate => {
      const candidatePolicy = normalizePolicyContext(asObject(candidate).policy);
      return policyKey(candidatePolicy) === key;
    });
    if (!validatePolicyLibraryRebuildLegacyFinalRemovalPlan(originalPlan).ok ||
        plan.validationOk !== true) {
      addRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_RISK_IDS
        .FINAL_REMOVAL_PLAN_INVALID);
    }
    if (plan.statusId !== POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_STATUS_IDS
      .READY_FOR_GLOBAL_RELEASE_RETIREMENT_GATE ||
      plan.readyForGlobalReleaseRetirementGate !== true) {
      addRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_RISK_IDS
        .FINAL_REMOVAL_PLAN_NOT_READY);
    }
    if (plan.policy?.policyId !== policy.policyId || plan.policy?.libraryId !== policy.libraryId) {
      addRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_RISK_IDS
        .FINAL_REMOVAL_PLAN_POLICY_MISMATCH);
    }
    if (!finalPlanMatchesContext(plan, policy, inventory)) {
      addRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_RISK_IDS
        .FINAL_REMOVAL_PLAN_INVENTORY_MISMATCH);
    }
  });

  plansByPolicyKey.forEach((_, key) => {
    if (!policyKeys.has(key)) {
      addRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_RISK_IDS
        .FINAL_REMOVAL_PLAN_UNEXPECTED);
    }
  });

  const statusId = determineStatusId(risks);
  const readyForRepositoryRetirementProposal = statusId ===
    POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_STATUS_IDS
      .READY_FOR_REPOSITORY_RETIREMENT_PROPOSAL;
  const releaseState = buildReleaseState({
    policies: validPolicies,
    plans,
    removalInventory: inventory,
  });
  const gate = {
    version: POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_VERSION,
    statusId,
    evaluatedAt,
    readyForRepositoryRetirementProposal,
    policyPlans: {
      enabledPolicyCount: validPolicies.length,
      evaluatedPlanCount: plans.length,
      readyPlanCount: plans.filter(plan => plan.readyForGlobalReleaseRetirementGate === true &&
        plan.validationOk === true).length,
      blockedPlanCount: plans.filter(plan => plan.readyForGlobalReleaseRetirementGate !== true ||
        plan.validationOk !== true).length,
    },
    releaseState,
    retirementDecision: {
      decisionKindId: 'repository_legacy_path_retirement_proposal',
      candidateCount: inventory.candidateCount,
      inventoryFingerprint: inventory.inventoryFingerprint,
      releaseStateFingerprint: releaseState.releaseStateFingerprint,
      candidatePathsExposed: false,
      executionAuthorized: false,
      repositoryMutationAuthorized: false,
      runtimeDeletionAuthorized: false,
      requiresRepositoryReview: true,
      requiresSeparateControlledRemovalTask: true,
    },
    riskCount: risks.length,
    risks,
    sideEffects: {
      databaseRead: false,
      releaseStatePersisted: false,
      repositoryModified: false,
      legacyPathsDeleted: false,
      legacyPathsHidden: false,
      legacyPathsArchived: false,
      routingWritten: false,
      browserControlsRendered: false,
    },
    nextStep: readyForRepositoryRetirementProposal
      ? {
        stepId: 'library_rebuild_legacy_path_repository_retirement_proposal',
        label: 'Library Rebuild Legacy-Path Repository Retirement Proposal',
      }
      : {
        stepId: 'library_rebuild_legacy_path_global_release_retirement_gate_recheck',
        label: 'Recheck Library Rebuild Legacy-Path Global Release Retirement Gate',
      },
  };

  return {
    ...gate,
    validation: validatePolicyLibraryRebuildLegacyGlobalReleaseRetirementGate(gate),
  };
}

function validatePolicyLibraryRebuildLegacyGlobalReleaseRetirementGate(gate = {}) {
  const result = asObject(gate);
  const risks = asArray(result.risks);
  const expectedStatusId = determineStatusId(risks);
  const ready = expectedStatusId === POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_STATUS_IDS
    .READY_FOR_REPOSITORY_RETIREMENT_PROPOSAL;
  const sideEffects = asObject(result.sideEffects);
  const decision = asObject(result.retirementDecision);
  const releaseState = asObject(result.releaseState);
  const planCounts = asObject(result.policyPlans);
  const issues = [];

  if (result.version !== POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_VERSION ||
      !Object.values(POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_STATUS_IDS)
        .includes(result.statusId) || !normalizeIsoDate(result.evaluatedAt) ||
      result.riskCount !== risks.length || result.statusId !== expectedStatusId ||
      result.readyForRepositoryRetirementProposal !== ready) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_RISK_IDS
        .UNSAFE_GATE_OUTPUT,
    });
  }

  if (!Number.isInteger(planCounts.enabledPolicyCount) || planCounts.enabledPolicyCount < 0 ||
      !Number.isInteger(planCounts.evaluatedPlanCount) || planCounts.evaluatedPlanCount < 0 ||
      !Number.isInteger(planCounts.readyPlanCount) || planCounts.readyPlanCount < 0 ||
      !Number.isInteger(planCounts.blockedPlanCount) || planCounts.blockedPlanCount < 0 ||
      planCounts.readyPlanCount + planCounts.blockedPlanCount !== planCounts.evaluatedPlanCount ||
      releaseState.version !== POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_STATE_VERSION ||
      releaseState.enabledPolicyCount !== planCounts.enabledPolicyCount ||
      !normalizeFingerprint(releaseState.policyInventoryFingerprint) ||
      !normalizeFingerprint(releaseState.finalRemovalPlanFingerprint) ||
      !normalizeFingerprint(releaseState.releaseStateFingerprint) ||
      releaseState.releaseStateFingerprint !== buildReleaseStateFingerprint({
        policyInventoryFingerprint: releaseState.policyInventoryFingerprint,
        finalRemovalPlanFingerprint: releaseState.finalRemovalPlanFingerprint,
        removalInventory: releaseState.removalInventory,
      })) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_RISK_IDS
        .UNSAFE_GATE_OUTPUT,
    });
  }

  if (decision.decisionKindId !== 'repository_legacy_path_retirement_proposal' ||
      decision.candidatePathsExposed !== false || decision.executionAuthorized !== false ||
      decision.repositoryMutationAuthorized !== false || decision.runtimeDeletionAuthorized !== false ||
      decision.requiresRepositoryReview !== true ||
      decision.requiresSeparateControlledRemovalTask !== true ||
      !normalizeFingerprint(decision.inventoryFingerprint) ||
      !normalizeFingerprint(decision.releaseStateFingerprint) ||
      decision.releaseStateFingerprint !== releaseState.releaseStateFingerprint ||
      sideEffects.releaseStatePersisted !== false || sideEffects.repositoryModified !== false ||
      sideEffects.legacyPathsDeleted !== false || sideEffects.legacyPathsHidden !== false ||
      sideEffects.legacyPathsArchived !== false || sideEffects.routingWritten !== false ||
      sideEffects.browserControlsRendered !== false ||
      ![true, false].includes(sideEffects.databaseRead) ||
      Object.hasOwn(result, 'policyInventory') || Object.hasOwn(result, 'finalRemovalPlans') ||
      Object.hasOwn(result, 'candidates') || Object.hasOwn(result, 'artifacts') ||
      Object.hasOwn(result, 'evidence')) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_RISK_IDS
        .UNSAFE_GATE_OUTPUT,
    });
  }

  if (ready && (planCounts.enabledPolicyCount < 1 ||
      planCounts.evaluatedPlanCount !== planCounts.enabledPolicyCount ||
      planCounts.readyPlanCount !== planCounts.enabledPolicyCount ||
      planCounts.blockedPlanCount !== 0 ||
      releaseState.removalInventory?.version !== POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_VERSION ||
      releaseState.removalInventory?.statusId !== POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_STATUS_IDS
        .READY || releaseState.removalInventory?.candidateCount < 1 ||
      releaseState.removalInventory?.validationOk !== true ||
      decision.candidateCount !== releaseState.removalInventory?.candidateCount ||
      decision.inventoryFingerprint !== releaseState.removalInventory?.inventoryFingerprint)) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_RISK_IDS
        .UNSAFE_GATE_OUTPUT,
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_RISK_IDS,
  POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_STATUS_IDS,
  POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_VERSION,
  POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_STATE_VERSION,
  buildPolicyLibraryRebuildLegacyGlobalReleaseRetirementGate,
  validatePolicyLibraryRebuildLegacyGlobalReleaseRetirementGate,
};
