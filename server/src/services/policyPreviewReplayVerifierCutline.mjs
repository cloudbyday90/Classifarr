/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const POLICY_PREVIEW_REPLAY_VERIFIER_CUTLINE_VERSION =
  'policy.preview_replay_verifier_cutline.v1';

const POLICY_PREVIEW_REPLAY_VERIFIER_DISPOSITION_IDS = Object.freeze({
  SERVER_CONTRACT_VERIFIER: 'server_contract_verifier',
  MIGRATION_PARITY_VERIFIER: 'migration_parity_verifier',
  EVIDENCE_REDUCER_CANDIDATE: 'evidence_reducer_candidate',
  DELETE_WITH_OLD_UI_SURFACE: 'delete_with_old_ui_surface',
});

const POLICY_PREVIEW_REPLAY_VERIFIER_SIDE_EFFECT_PROFILE_IDS = Object.freeze({
  NONE: 'none',
  BOUNDED_READ: 'bounded_read',
  VERIFICATION_RECEIPT_ONLY: 'verification_receipt_only',
});

const POLICY_PREVIEW_REPLAY_VERIFIER_CUTLINE_RISK_IDS = Object.freeze({
  UNKNOWN_DISPOSITION: 'unknown_disposition',
  UNKNOWN_SIDE_EFFECT_PROFILE: 'unknown_side_effect_profile',
  SOURCE_PATH_NOT_FOUND: 'source_path_not_found',
  RETIRED_SOURCE_REINTRODUCED: 'retired_source_reintroduced',
  NORMAL_WORKFLOW_SURFACE: 'normal_workflow_surface',
  BROWSER_SURFACE_EXPOSED: 'browser_surface_exposed',
  HTTP_SURFACE_EXPOSED: 'http_surface_exposed',
  RAW_OR_UNBOUNDED_OUTPUT: 'raw_or_unbounded_output',
  UNSAFE_SIDE_EFFECT_PROFILE: 'unsafe_side_effect_profile',
  MISSING_PURPOSE: 'missing_purpose',
  MISSING_EXIT_CRITERIA: 'missing_exit_criteria',
  MISSING_RETIREMENT_EVIDENCE: 'missing_retirement_evidence',
  MISSING_REQUIRED_DISPOSITION: 'missing_required_disposition',
});

const POLICY_PREVIEW_REPLAY_VERIFIER_EXIT_CRITERION_IDS = Object.freeze({
  PHASE_8R_MIGRATION_PARITY_PROVEN: 'phase_8r_migration_parity_proven',
  NATIVE_STORAGE_CUTOVER_COMPLETE: 'native_storage_cutover_complete',
  ROLLBACK_RETENTION_WINDOW_EXPIRED: 'rollback_retention_window_expired',
  NO_ACTIVE_REBUILD_BINDING: 'no_active_rebuild_binding',
  RUNTIME_EVIDENCE_REPLACEMENT_ACCEPTED: 'runtime_evidence_replacement_accepted',
});

const DISPOSITION_IDS = Object.freeze(
  Object.values(POLICY_PREVIEW_REPLAY_VERIFIER_DISPOSITION_IDS)
);
const SIDE_EFFECT_PROFILE_IDS = Object.freeze(
  Object.values(POLICY_PREVIEW_REPLAY_VERIFIER_SIDE_EFFECT_PROFILE_IDS)
);
const REQUIRED_DISPOSITION_IDS = Object.freeze([
  POLICY_PREVIEW_REPLAY_VERIFIER_DISPOSITION_IDS.SERVER_CONTRACT_VERIFIER,
  POLICY_PREVIEW_REPLAY_VERIFIER_DISPOSITION_IDS.MIGRATION_PARITY_VERIFIER,
  POLICY_PREVIEW_REPLAY_VERIFIER_DISPOSITION_IDS.EVIDENCE_REDUCER_CANDIDATE,
  POLICY_PREVIEW_REPLAY_VERIFIER_DISPOSITION_IDS.DELETE_WITH_OLD_UI_SURFACE,
]);
const MIGRATION_EXIT_CRITERIA = Object.freeze([
  POLICY_PREVIEW_REPLAY_VERIFIER_EXIT_CRITERION_IDS.PHASE_8R_MIGRATION_PARITY_PROVEN,
  POLICY_PREVIEW_REPLAY_VERIFIER_EXIT_CRITERION_IDS.NATIVE_STORAGE_CUTOVER_COMPLETE,
  POLICY_PREVIEW_REPLAY_VERIFIER_EXIT_CRITERION_IDS.ROLLBACK_RETENTION_WINDOW_EXPIRED,
  POLICY_PREVIEW_REPLAY_VERIFIER_EXIT_CRITERION_IDS.NO_ACTIVE_REBUILD_BINDING,
]);

const ACTIVE_VERIFIER_ARTIFACTS = Object.freeze([
  {
    path: 'server/src/services/policyMigrationPreviewContract.mjs',
    dispositionId: POLICY_PREVIEW_REPLAY_VERIFIER_DISPOSITION_IDS.SERVER_CONTRACT_VERIFIER,
    purpose: 'Build and audit a bounded, side-effect-free migration difference contract.',
    sideEffectProfileId: POLICY_PREVIEW_REPLAY_VERIFIER_SIDE_EFFECT_PROFILE_IDS.NONE,
    exitCriterionIds: MIGRATION_EXIT_CRITERIA,
  },
  {
    path: 'server/src/services/policyMigrationGeneratedIntentOutcome.mjs',
    dispositionId: POLICY_PREVIEW_REPLAY_VERIFIER_DISPOSITION_IDS.EVIDENCE_REDUCER_CANDIDATE,
    purpose: 'Reduce an accepted rebuild proposal to the small outcome shape required by migration comparison.',
    sideEffectProfileId: POLICY_PREVIEW_REPLAY_VERIFIER_SIDE_EFFECT_PROFILE_IDS.NONE,
    exitCriterionIds: [
      POLICY_PREVIEW_REPLAY_VERIFIER_EXIT_CRITERION_IDS.PHASE_8R_MIGRATION_PARITY_PROVEN,
      POLICY_PREVIEW_REPLAY_VERIFIER_EXIT_CRITERION_IDS.RUNTIME_EVIDENCE_REPLACEMENT_ACCEPTED,
    ],
  },
  {
    path: 'server/src/services/policyMigrationRepresentativeClassificationSource.mjs',
    dispositionId: POLICY_PREVIEW_REPLAY_VERIFIER_DISPOSITION_IDS.MIGRATION_PARITY_VERIFIER,
    purpose: 'Collect a deterministic, policy-scoped, bounded representative source from persisted outcomes.',
    sideEffectProfileId: POLICY_PREVIEW_REPLAY_VERIFIER_SIDE_EFFECT_PROFILE_IDS.BOUNDED_READ,
    exitCriterionIds: MIGRATION_EXIT_CRITERIA,
  },
  {
    path: 'server/src/services/policyMigrationVerifierRollback.mjs',
    dispositionId: POLICY_PREVIEW_REPLAY_VERIFIER_DISPOSITION_IDS.MIGRATION_PARITY_VERIFIER,
    purpose: 'Compare accepted rebuild behavior with the representative source before rollback evidence can proceed.',
    sideEffectProfileId: POLICY_PREVIEW_REPLAY_VERIFIER_SIDE_EFFECT_PROFILE_IDS.NONE,
    exitCriterionIds: MIGRATION_EXIT_CRITERIA,
  },
  {
    path: 'server/src/services/policyMigrationVerificationCoordinator.mjs',
    dispositionId: POLICY_PREVIEW_REPLAY_VERIFIER_DISPOSITION_IDS.MIGRATION_PARITY_VERIFIER,
    purpose: 'Coordinate the accepted transition, bounded source, and audited comparison without authoring policy state.',
    sideEffectProfileId: POLICY_PREVIEW_REPLAY_VERIFIER_SIDE_EFFECT_PROFILE_IDS.BOUNDED_READ,
    exitCriterionIds: MIGRATION_EXIT_CRITERIA,
  },
  {
    path: 'server/src/services/policyMigrationVerificationRunContract.mjs',
    dispositionId: POLICY_PREVIEW_REPLAY_VERIFIER_DISPOSITION_IDS.MIGRATION_PARITY_VERIFIER,
    purpose: 'Sanitize a verified comparison into a bounded, fingerprinted migration receipt.',
    sideEffectProfileId: POLICY_PREVIEW_REPLAY_VERIFIER_SIDE_EFFECT_PROFILE_IDS.NONE,
    exitCriterionIds: MIGRATION_EXIT_CRITERIA,
  },
  {
    path: 'server/src/services/policyMigrationVerificationRunHandoff.mjs',
    dispositionId: POLICY_PREVIEW_REPLAY_VERIFIER_DISPOSITION_IDS.MIGRATION_PARITY_VERIFIER,
    purpose: 'Persist only an audited migration-verification receipt through the transaction boundary.',
    sideEffectProfileId:
      POLICY_PREVIEW_REPLAY_VERIFIER_SIDE_EFFECT_PROFILE_IDS.VERIFICATION_RECEIPT_ONLY,
    exitCriterionIds: MIGRATION_EXIT_CRITERIA,
  },
  {
    path: 'server/src/services/policyMigrationVerificationRunRepository.mjs',
    dispositionId: POLICY_PREVIEW_REPLAY_VERIFIER_DISPOSITION_IDS.MIGRATION_PARITY_VERIFIER,
    purpose: 'Claim an idempotent migration-verification receipt without writing policy or routing state.',
    sideEffectProfileId:
      POLICY_PREVIEW_REPLAY_VERIFIER_SIDE_EFFECT_PROFILE_IDS.VERIFICATION_RECEIPT_ONLY,
    exitCriterionIds: MIGRATION_EXIT_CRITERIA,
  },
  {
    path: 'server/src/services/policyLibraryRebuildVerificationRunBinding.mjs',
    dispositionId: POLICY_PREVIEW_REPLAY_VERIFIER_DISPOSITION_IDS.MIGRATION_PARITY_VERIFIER,
    purpose: 'Bind rollback evidence to a current, zero-difference verified receipt before cutover.',
    sideEffectProfileId: POLICY_PREVIEW_REPLAY_VERIFIER_SIDE_EFFECT_PROFILE_IDS.BOUNDED_READ,
    exitCriterionIds: MIGRATION_EXIT_CRITERIA,
  },
]);

const RETIRED_DIAGNOSTIC_ARTIFACTS = Object.freeze([
  'server/src/services/policyIntentImpactPreview.mjs',
  'server/src/services/policyIntentReplayPreview.mjs',
  'server/src/routes/policiesRouteMigrationVerifier.mjs',
  'client/src/components/policies/PolicyIntentImpactPreviewCard.vue',
  'client/src/components/policies/PolicyIntentReplayPreviewCard.vue',
  'client/src/composables/usePolicyIntentImpactPreview.js',
  'client/src/composables/usePolicyIntentReplayPreview.js',
  'client/src/utils/policyIntentImpactPreview.js',
  'client/src/utils/policyIntentReplayPreview.js',
].map(path => Object.freeze({
  path,
  dispositionId: POLICY_PREVIEW_REPLAY_VERIFIER_DISPOSITION_IDS.DELETE_WITH_OLD_UI_SURFACE,
  purpose: 'Retired legacy preview/replay diagnostic surface with no current authoring or migration role.',
  sideEffectProfileId: POLICY_PREVIEW_REPLAY_VERIFIER_SIDE_EFFECT_PROFILE_IDS.NONE,
  exitCriterionIds: [],
  retirementEvidencePath: 'docs/architecture/policy-migration-diagnostic-ui-removal.md',
})));

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cloneArtifact(artifact = {}) {
  return {
    path: normalizeString(artifact.path),
    dispositionId: normalizeString(artifact.dispositionId),
    purpose: normalizeString(artifact.purpose),
    sideEffectProfileId: normalizeString(artifact.sideEffectProfileId),
    exitCriterionIds: asArray(artifact.exitCriterionIds)
      .map(normalizeString)
      .filter(Boolean),
    retirementEvidencePath: normalizeString(artifact.retirementEvidencePath) || null,
    normalWorkflowSurface: artifact.normalWorkflowSurface === true,
    browserReachable: artifact.browserReachable === true,
    httpExposed: artifact.httpExposed === true,
    rawPayloadAllowed: artifact.rawPayloadAllowed === true,
    outputBounded: artifact.outputBounded !== false,
  };
}

function listPolicyPreviewReplayVerifierArtifacts() {
  return [
    ...ACTIVE_VERIFIER_ARTIFACTS,
    ...RETIRED_DIAGNOSTIC_ARTIFACTS,
  ].map(cloneArtifact);
}

function sourceExists(path, exists = existsSync) {
  return exists(resolve(REPO_ROOT, path));
}

function buildIssue(riskId, message, path = null) {
  return {
    riskId,
    message,
    ...(path ? { path } : {}),
  };
}

function validatePolicyPreviewReplayVerifierArtifact({ artifact = {}, exists = existsSync } = {}) {
  const normalized = cloneArtifact(artifact);
  const issues = [];
  const isRetired = normalized.dispositionId ===
    POLICY_PREVIEW_REPLAY_VERIFIER_DISPOSITION_IDS.DELETE_WITH_OLD_UI_SURFACE;
  const allowedSideEffects = isRetired || normalized.dispositionId ===
    POLICY_PREVIEW_REPLAY_VERIFIER_DISPOSITION_IDS.MIGRATION_PARITY_VERIFIER
    ? [
      POLICY_PREVIEW_REPLAY_VERIFIER_SIDE_EFFECT_PROFILE_IDS.NONE,
      POLICY_PREVIEW_REPLAY_VERIFIER_SIDE_EFFECT_PROFILE_IDS.BOUNDED_READ,
      POLICY_PREVIEW_REPLAY_VERIFIER_SIDE_EFFECT_PROFILE_IDS.VERIFICATION_RECEIPT_ONLY,
    ]
    : [POLICY_PREVIEW_REPLAY_VERIFIER_SIDE_EFFECT_PROFILE_IDS.NONE];

  if (!DISPOSITION_IDS.includes(normalized.dispositionId)) {
    issues.push(buildIssue(
      POLICY_PREVIEW_REPLAY_VERIFIER_CUTLINE_RISK_IDS.UNKNOWN_DISPOSITION,
      'Preview/replay verifier artifacts must use a supported disposition.',
      normalized.path,
    ));
  }

  if (!SIDE_EFFECT_PROFILE_IDS.includes(normalized.sideEffectProfileId)) {
    issues.push(buildIssue(
      POLICY_PREVIEW_REPLAY_VERIFIER_CUTLINE_RISK_IDS.UNKNOWN_SIDE_EFFECT_PROFILE,
      'Preview/replay verifier artifacts must declare a supported side-effect profile.',
      normalized.path,
    ));
  } else if (!allowedSideEffects.includes(normalized.sideEffectProfileId)) {
    issues.push(buildIssue(
      POLICY_PREVIEW_REPLAY_VERIFIER_CUTLINE_RISK_IDS.UNSAFE_SIDE_EFFECT_PROFILE,
      'Only migration-parity verifiers may perform bounded reads or persist a verification receipt.',
      normalized.path,
    ));
  }

  const artifactSourceExists = Boolean(normalized.path) && sourceExists(normalized.path, exists);
  if (!normalized.path || (isRetired ? artifactSourceExists : !artifactSourceExists)) {
    issues.push(buildIssue(
      isRetired
        ? POLICY_PREVIEW_REPLAY_VERIFIER_CUTLINE_RISK_IDS.RETIRED_SOURCE_REINTRODUCED
        : POLICY_PREVIEW_REPLAY_VERIFIER_CUTLINE_RISK_IDS.SOURCE_PATH_NOT_FOUND,
      isRetired
        ? 'Retired preview/replay diagnostics must remain absent from the repository.'
        : 'Active preview/replay verifier artifacts must remain present and inventoried.',
      normalized.path,
    ));
  }

  if (!normalized.purpose) {
    issues.push(buildIssue(
      POLICY_PREVIEW_REPLAY_VERIFIER_CUTLINE_RISK_IDS.MISSING_PURPOSE,
      'Preview/replay verifier artifacts must state their bounded purpose.',
      normalized.path,
    ));
  }

  if (normalized.normalWorkflowSurface) {
    issues.push(buildIssue(
      POLICY_PREVIEW_REPLAY_VERIFIER_CUTLINE_RISK_IDS.NORMAL_WORKFLOW_SURFACE,
      'Preview/replay verifier artifacts cannot be part of normal policy authoring.',
      normalized.path,
    ));
  }

  if (normalized.browserReachable) {
    issues.push(buildIssue(
      POLICY_PREVIEW_REPLAY_VERIFIER_CUTLINE_RISK_IDS.BROWSER_SURFACE_EXPOSED,
      'Preview/replay verifier artifacts cannot be browser reachable.',
      normalized.path,
    ));
  }

  if (normalized.httpExposed) {
    issues.push(buildIssue(
      POLICY_PREVIEW_REPLAY_VERIFIER_CUTLINE_RISK_IDS.HTTP_SURFACE_EXPOSED,
      'Preview/replay verifier artifacts cannot expose a dedicated HTTP diagnostic endpoint.',
      normalized.path,
    ));
  }

  if (normalized.rawPayloadAllowed || !normalized.outputBounded) {
    issues.push(buildIssue(
      POLICY_PREVIEW_REPLAY_VERIFIER_CUTLINE_RISK_IDS.RAW_OR_UNBOUNDED_OUTPUT,
      'Preview/replay verifier artifacts must suppress raw payloads and keep emitted output bounded.',
      normalized.path,
    ));
  }

  if (isRetired) {
    if (!normalized.retirementEvidencePath) {
      issues.push(buildIssue(
        POLICY_PREVIEW_REPLAY_VERIFIER_CUTLINE_RISK_IDS.MISSING_RETIREMENT_EVIDENCE,
        'Retired preview/replay diagnostics must retain an architecture retirement record.',
        normalized.path,
      ));
    }
  } else if (normalized.exitCriterionIds.length === 0) {
    issues.push(buildIssue(
      POLICY_PREVIEW_REPLAY_VERIFIER_CUTLINE_RISK_IDS.MISSING_EXIT_CRITERIA,
      'Active preview/replay verifier artifacts must define their future deletion or promotion criteria.',
      normalized.path,
    ));
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
    artifact: normalized,
  };
}

function buildPolicyPreviewReplayVerifierCutlineAudit({
  artifacts = listPolicyPreviewReplayVerifierArtifacts(),
  exists = existsSync,
} = {}) {
  const normalizedArtifacts = asArray(artifacts).map(cloneArtifact);
  const artifactAudits = normalizedArtifacts.map(artifact =>
    validatePolicyPreviewReplayVerifierArtifact({ artifact, exists })
  );
  const issues = artifactAudits.flatMap(audit => audit.issues);
  const byDisposition = Object.fromEntries(DISPOSITION_IDS.map(dispositionId => [
    dispositionId,
    normalizedArtifacts.filter(artifact => artifact.dispositionId === dispositionId).length,
  ]));

  REQUIRED_DISPOSITION_IDS.forEach(dispositionId => {
    if (byDisposition[dispositionId] === 0) {
      issues.push(buildIssue(
        POLICY_PREVIEW_REPLAY_VERIFIER_CUTLINE_RISK_IDS.MISSING_REQUIRED_DISPOSITION,
        `Preview/replay verifier cutline must inventory at least one ${dispositionId} artifact.`,
      ));
    }
  });

  const activeArtifactCount = normalizedArtifacts.filter(artifact =>
    artifact.dispositionId !==
      POLICY_PREVIEW_REPLAY_VERIFIER_DISPOSITION_IDS.DELETE_WITH_OLD_UI_SURFACE
  ).length;

  return {
    version: POLICY_PREVIEW_REPLAY_VERIFIER_CUTLINE_VERSION,
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
    artifactCount: normalizedArtifacts.length,
    activeArtifactCount,
    retiredArtifactCount: normalizedArtifacts.length - activeArtifactCount,
    byDisposition,
    artifacts: normalizedArtifacts,
    nextStep: issues.length === 0
      ? {
        stepId: 'retained_migration_boundary_and_receipt_handoff',
        label: 'Verify the retained migration boundary and receipt handoff',
      }
      : null,
  };
}

export {
  POLICY_PREVIEW_REPLAY_VERIFIER_CUTLINE_RISK_IDS,
  POLICY_PREVIEW_REPLAY_VERIFIER_CUTLINE_VERSION,
  POLICY_PREVIEW_REPLAY_VERIFIER_DISPOSITION_IDS,
  POLICY_PREVIEW_REPLAY_VERIFIER_EXIT_CRITERION_IDS,
  POLICY_PREVIEW_REPLAY_VERIFIER_SIDE_EFFECT_PROFILE_IDS,
  buildPolicyPreviewReplayVerifierCutlineAudit,
  listPolicyPreviewReplayVerifierArtifacts,
  validatePolicyPreviewReplayVerifierArtifact,
};
