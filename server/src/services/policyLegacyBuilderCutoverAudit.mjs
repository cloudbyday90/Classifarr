/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/* eslint-disable security/detect-non-literal-fs-filename -- The audit recursively reads only the fixed client source root declared below. */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const POLICY_COMPONENTS_ROOT = resolve(REPO_ROOT, 'client/src/components/policies');

const POLICY_LEGACY_BUILDER_CUTOVER_AUDIT_VERSION =
  'policy.legacy_builder_cutover_audit.v1';

const POLICY_LEGACY_BUILDER_CUTOVER_AUDIT_RISK_IDS = Object.freeze({
  RETIRED_COMPONENT_REINTRODUCED: 'retired_component_reintroduced',
  ALERT_IN_POLICY_AUTHORING: 'alert_in_policy_authoring',
  RESET_RECREATE_IN_NORMAL_PATH: 'reset_recreate_in_normal_path',
  RECONCILIATION_LINK_IN_NORMAL_PATH: 'reconciliation_link_in_normal_path',
  SECOND_CREATE_ENTRY: 'second_create_entry',
  RAW_THRESHOLD_CONTROLS: 'raw_threshold_controls',
  MIGRATION_VERIFIER_VISIBILITY: 'migration_verifier_visibility',
  MISSING_COMPATIBILITY_OWNER: 'missing_compatibility_owner',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  VERSION_MISMATCH: 'version_mismatch',
});

const RETIRED_DIAGNOSTIC_ARTIFACTS = Object.freeze([
  'client/src/components/policies/PolicyIntentImpactPreviewCard.vue',
  'client/src/components/policies/PolicyIntentReplayPreviewCard.vue',
  'client/src/composables/usePolicyIntentImpactPreview.js',
  'client/src/composables/usePolicyIntentReplayPreview.js',
  'client/src/utils/policyIntentImpactPreview.js',
  'client/src/utils/policyIntentReplayPreview.js',
  'server/src/services/policyIntentImpactPreview.mjs',
  'server/src/services/policyIntentReplayPreview.mjs',
  'server/src/routes/policiesRouteMigrationVerifier.mjs',
]);

const PROHIBITED_PATTERNS = Object.freeze([
  {
    pattern: /\balert\s*\(/u,
    riskId: POLICY_LEGACY_BUILDER_CUTOVER_AUDIT_RISK_IDS.ALERT_IN_POLICY_AUTHORING,
    message: 'Browser alert() must not appear in policy authoring components.',
  },
  {
    pattern: /reset(?:Existing)?Policy|reset_policy|resetPolicy/u,
    riskId: POLICY_LEGACY_BUILDER_CUTOVER_AUDIT_RISK_IDS.RESET_RECREATE_IN_NORMAL_PATH,
    message: 'Reset/recreate control must not appear in normal policy authoring.',
  },
  {
    pattern: /\/api\/policies\/reconciliation|reconciliation-maintenance/u,
    riskId: POLICY_LEGACY_BUILDER_CUTOVER_AUDIT_RISK_IDS.RECONCILIATION_LINK_IN_NORMAL_PATH,
    message: 'Reconciliation maintenance must not appear as a normal authoring link.',
  },
  {
    pattern: /showMigrationVerifierPanels/u,
    riskId: POLICY_LEGACY_BUILDER_CUTOVER_AUDIT_RISK_IDS.MIGRATION_VERIFIER_VISIBILITY,
    message: 'Retired migration verifier visibility prop must not reappear.',
  },
  {
    pattern: /decisionThreshold|combinationMode|presetWeights/u,
    riskId: POLICY_LEGACY_BUILDER_CUTOVER_AUDIT_RISK_IDS.RAW_THRESHOLD_CONTROLS,
    message: 'Raw threshold, combination-mode, or preset-weight controls must not appear in normal authoring components.',
  },
]);

const COMPATIBILITY_ARTIFACT_OWNERS = Object.freeze([
  {
    path: 'client/src/components/policies/PolicyCompatibilityMaintenanceSurface.vue',
    ownerTaskId: 'compatibility_deletion_gate',
    deletionCriterion: 'Compatibility path deletion gate',
  },
  {
    path: 'client/src/components/policies/PolicyIntentEditor.vue',
    ownerTaskId: 'compatibility_deletion_gate',
    deletionCriterion: 'Compatibility path deletion gate',
  },
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function listVueFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) return listVueFiles(entryPath);
    return entry.isFile() && entry.name.endsWith('.vue') ? [entryPath] : [];
  });
}

function readSource(path) {
  try {
    return readFileSync(resolve(REPO_ROOT, path), 'utf8');
  } catch {
    return null;
  }
}

function buildIssue(riskId, message, path = null) {
  return {
    riskId,
    message,
    ...(path ? { path } : {}),
  };
}

function checkRetiredArtifacts(exists = existsSync) {
  const issues = [];
  const verified = [];

  RETIRED_DIAGNOSTIC_ARTIFACTS.forEach(path => {
    const artifactExists = exists(resolve(REPO_ROOT, path));
    verified.push({ path, exists: artifactExists });
    if (artifactExists) {
      issues.push(buildIssue(
        POLICY_LEGACY_BUILDER_CUTOVER_AUDIT_RISK_IDS.RETIRED_COMPONENT_REINTRODUCED,
        'Retired diagnostic component must remain absent from the repository.',
        path,
      ));
    }
  });

  return { issues, verified };
}

function checkProhibitedPatterns({
  vueFiles = listVueFiles(POLICY_COMPONENTS_ROOT),
  sourceReader = readSource,
} = {}) {
  const issues = [];

  asArray(vueFiles).forEach(filePath => {
    const relativePath = normalizeString(relative(REPO_ROOT, filePath))
      .replaceAll('\\', '/');
    const source = sourceReader(relativePath);
    if (source === null) return;

    PROHIBITED_PATTERNS.forEach(({ pattern, riskId, message }) => {
      if (pattern.test(source)) {
        issues.push(buildIssue(riskId, message, relativePath));
      }
    });
  });

  return issues;
}

function checkCompatibilityOwners(exists = existsSync) {
  const issues = [];

  COMPATIBILITY_ARTIFACT_OWNERS.forEach(artifact => {
    const artifactExists = exists(resolve(REPO_ROOT, artifact.path));
    if (artifactExists && !artifact.ownerTaskId) {
      issues.push(buildIssue(
        POLICY_LEGACY_BUILDER_CUTOVER_AUDIT_RISK_IDS.MISSING_COMPATIBILITY_OWNER,
        'Compatibility artifact must carry an explicit compatibility deletion owner.',
        artifact.path,
      ));
    }
  });

  return issues;
}

function buildPolicyLegacyBuilderCutoverAudit({
  exists = existsSync,
  vueFiles,
  sourceReader,
} = {}) {
  const issues = [];

  const retiredResult = checkRetiredArtifacts(exists);
  issues.push(...retiredResult.issues);

  const patternIssues = checkProhibitedPatterns({ vueFiles, sourceReader });
  issues.push(...patternIssues);

  const compatibilityIssues = checkCompatibilityOwners(exists);
  issues.push(...compatibilityIssues);

  const audit = {
    version: POLICY_LEGACY_BUILDER_CUTOVER_AUDIT_VERSION,
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
    retiredArtifactCount: RETIRED_DIAGNOSTIC_ARTIFACTS.length,
    retiredArtifactsVerified: retiredResult.verified,
    prohibitedPatternCount: PROHIBITED_PATTERNS.length,
    compatibilityArtifactCount: COMPATIBILITY_ARTIFACT_OWNERS.length,
    sideEffects: {
      filesDeleted: false,
      filesArchived: false,
      routesRemoved: false,
      testsRemoved: false,
      sourceMutated: false,
    },
    nextStep: issues.length === 0
      ? {
        stepId: 'accessibility_responsive_e2e_tests',
        label: 'Accessibility, responsive behavior, and end-to-end workflow tests',
      }
      : {
        stepId: 'resolve_cutover_violations',
        label: 'Resolve legacy builder cutover violations',
      },
  };

  return audit;
}

export {
  POLICY_LEGACY_BUILDER_CUTOVER_AUDIT_RISK_IDS,
  POLICY_LEGACY_BUILDER_CUTOVER_AUDIT_VERSION,
  RETIRED_DIAGNOSTIC_ARTIFACTS,
  buildPolicyLegacyBuilderCutoverAudit,
};
