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
  POLICY_MIGRATION_ARTIFACT_DECISION_IDS,
  listPolicyMigrationDeletionArtifacts,
  validateMigrationArtifact,
} from './policyMigrationDeletionPath.mjs';

const POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_VERSION =
  'policy.library_rebuild_legacy_removal_inventory.v1';

const POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED: 'blocked',
});

const POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_RISK_IDS = Object.freeze({
  NO_REMOVAL_CANDIDATES: 'no_removal_candidates',
  INVALID_REMOVAL_CANDIDATE: 'invalid_removal_candidate',
  NORMAL_WORKFLOW_CANDIDATE: 'normal_workflow_candidate',
  UNSAFE_INVENTORY_OUTPUT: 'unsafe_inventory_output',
});

const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value, maximumLength = 255) {
  return typeof value === 'string' ? value.trim().slice(0, maximumLength) : '';
}

function sha256(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function summarizeCandidate(candidate = {}) {
  return {
    path: normalizeString(candidate.path),
    owner: normalizeString(candidate.owner, 120),
    decisionId: normalizeString(candidate.decisionId, 80),
    verifierKindId: normalizeString(candidate.verifierKindId, 80),
    removalGateIds: asArray(candidate.removalGateIds)
      .map(gateId => normalizeString(gateId, 120))
      .filter(Boolean)
      .sort(),
  };
}

function buildPolicyLibraryRebuildLegacyRemovalInventory({
  artifacts = listPolicyMigrationDeletionArtifacts(),
} = {}) {
  const candidates = asArray(artifacts)
    .filter(artifact => artifact?.decisionId ===
      POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION)
    .map(summarizeCandidate)
    .sort((left, right) => left.path.localeCompare(right.path));
  const candidateIssues = candidates.flatMap(candidate => {
    const source = asArray(artifacts).find(artifact => artifact?.path === candidate.path) || {};
    const validation = validateMigrationArtifact(source);
    const issues = validation.ok
      ? []
      : [{ riskId: POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_RISK_IDS
        .INVALID_REMOVAL_CANDIDATE }];

    if (source.normalWorkflowAllowed === true) {
      issues.push({
        riskId: POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_RISK_IDS.NORMAL_WORKFLOW_CANDIDATE,
      });
    }

    return issues;
  });
  const issues = [
    ...(candidates.length === 0
      ? [{ riskId: POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_RISK_IDS.NO_REMOVAL_CANDIDATES }]
      : []),
    ...candidateIssues,
  ];
  const inventory = {
    version: POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_VERSION,
    statusId: issues.length === 0
      ? POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_STATUS_IDS.READY
      : POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_STATUS_IDS.BLOCKED,
    candidateCount: candidates.length,
    inventoryFingerprint: sha256(candidates),
    normalWorkflowAllowed: false,
    sideEffects: {
      filesDeleted: false,
      filesHidden: false,
      filesArchived: false,
      routesRemoved: false,
      browserControlsRendered: false,
    },
    riskCount: issues.length,
    risks: issues,
  };

  return {
    ...inventory,
    validation: validatePolicyLibraryRebuildLegacyRemovalInventory(inventory),
  };
}

function validatePolicyLibraryRebuildLegacyRemovalInventory(inventory = {}) {
  const result = asObject(inventory);
  const issues = [];
  const sideEffects = result.sideEffects || {};
  const validFingerprint = SHA256_FINGERPRINT_PATTERN.test(
    normalizeString(result.inventoryFingerprint, 64),
  );

  if (result.version !== POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_VERSION ||
      !Object.values(POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_STATUS_IDS)
        .includes(result.statusId) ||
      !Number.isInteger(result.candidateCount) || result.candidateCount < 0 ||
      !validFingerprint || result.riskCount !== asArray(result.risks).length) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_RISK_IDS.UNSAFE_INVENTORY_OUTPUT,
    });
  }

  if (result.normalWorkflowAllowed === true ||
      Object.values(sideEffects).some(value => value === true) ||
      Object.hasOwn(result, 'artifacts') || Object.hasOwn(result, 'candidates')) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_RISK_IDS.UNSAFE_INVENTORY_OUTPUT,
    });
  }

  const expectedStatusId = result.riskCount === 0
    ? POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_STATUS_IDS.READY
    : POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_STATUS_IDS.BLOCKED;
  if (result.statusId !== expectedStatusId) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_RISK_IDS.UNSAFE_INVENTORY_OUTPUT,
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_RISK_IDS,
  POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_STATUS_IDS,
  POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_VERSION,
  buildPolicyLibraryRebuildLegacyRemovalInventory,
  validatePolicyLibraryRebuildLegacyRemovalInventory,
};
