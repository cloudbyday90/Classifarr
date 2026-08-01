/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS,
} from './policyCompatibilityDeletionExecutionActions.mjs';
import {
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_STATUS_IDS,
  validatePolicyCompatibilityRetirementCandidatePlanProjection,
} from './policyCompatibilityRetirementCandidatePlanProjection.mjs';
import {
  POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_TARGET_KIND_IDS,
} from './policyCompatibilityRetirementExecutionManifestTargets.mjs';

const POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_VERSION =
  'policy.compatibility_retirement_candidate_taxonomy.v1';

const POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_STATUS_IDS = Object.freeze({
  TAXONOMY_READY: 'taxonomy_ready',
  BLOCKED_BY_CANDIDATE: 'blocked_by_candidate',
  BLOCKED_BY_TAXONOMY: 'blocked_by_taxonomy',
  BLOCKED_BY_SIDE_EFFECT: 'blocked_by_side_effect',
});

const POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_CATEGORY_IDS = Object.freeze({
  COMPATIBILITY_COMPONENT_FILES: 'compatibility_component_files',
  POLICY_BUILDER_MODAL_LEGACY_BRANCH: 'policy_builder_modal_legacy_branch',
  COMPATIBILITY_DEDICATED_TEST_FILES: 'compatibility_dedicated_test_files',
  COMPATIBILITY_NAMED_TEST_SCOPES: 'compatibility_named_test_scopes',
});

const POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_RISK_IDS = Object.freeze({
  CANDIDATE_MISSING: 'candidate_missing',
  CANDIDATE_NOT_READY: 'candidate_not_ready',
  CANDIDATE_NOT_READ_ONLY: 'candidate_not_read_only',
  CANDIDATE_AUTHORIZES_DELETION: 'candidate_authorizes_deletion',
  CANDIDATE_VALIDATION_FAILED: 'candidate_validation_failed',
  CATEGORY_UNKNOWN: 'category_unknown',
  CATEGORY_DUPLICATE: 'category_duplicate',
  CATEGORY_ACTION_MISMATCH: 'category_action_mismatch',
  CATEGORY_TARGET_MISSING: 'category_target_missing',
  CATEGORY_TARGET_DUPLICATE: 'category_target_duplicate',
  CANDIDATE_TARGET_MISSING: 'candidate_target_missing',
  CANDIDATE_TARGET_AMBIGUOUS: 'candidate_target_ambiguous',
  NAMED_SCOPE_INVALID: 'named_scope_invalid',
  TARGET_COUNT_MISMATCH: 'target_count_mismatch',
  TAXONOMY_NOT_READ_ONLY: 'taxonomy_not_read_only',
  TAXONOMY_AUTHORIZES_DELETION: 'taxonomy_authorizes_deletion',
  TAXONOMY_MANIFEST_WRITTEN: 'taxonomy_manifest_written',
  TAXONOMY_READY_STATE_MISMATCH: 'taxonomy_ready_state_mismatch',
  ISSUE_COUNT_MISMATCH: 'issue_count_mismatch',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
});

const CATEGORY_DEFINITIONS = Object.freeze([
  {
    categoryId:
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_CATEGORY_IDS
        .COMPATIBILITY_COMPONENT_FILES,
    label: 'Retiring compatibility component files',
    actionId: POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.DELETE_FILE,
    kindId: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_TARGET_KIND_IDS.CODE_PATH,
    paths: Object.freeze([
      'client/src/components/policies/PolicyCompatibilityMaintenanceSurface.vue',
      'client/src/components/policies/PolicyIntentEditor.vue',
      'client/src/components/policies/PolicyPresetMigrationNotice.vue',
    ]),
    deletionIntent:
      'Delete retired compatibility-only component files after their native workflow successors and release gates are satisfied.',
  },
  {
    categoryId:
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_CATEGORY_IDS
        .POLICY_BUILDER_MODAL_LEGACY_BRANCH,
    label: 'Policy Builder legacy compatibility branch',
    actionId: POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.REPLACE_CODE_PATH,
    kindId: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_TARGET_KIND_IDS.CODE_PATH,
    paths: Object.freeze([
      'client/src/components/policies/PolicyBuilderModal.vue',
    ]),
    deletionIntent:
      'Remove the legacy-edit compatibility branch while retaining the native Policy Builder workflow.',
  },
  {
    categoryId:
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_CATEGORY_IDS
        .COMPATIBILITY_DEDICATED_TEST_FILES,
    label: 'Dedicated compatibility test files',
    actionId: POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.REMOVE_TEST,
    kindId: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_TARGET_KIND_IDS.TEST_FILE,
    paths: Object.freeze([
      'client/src/__tests__/PolicyCompatibilityMaintenanceSurface.test.js',
      'client/src/__tests__/PolicyPresetMigrationNotice.test.js',
    ]),
    deletionIntent:
      'Remove dedicated compatibility test files only after their native successor coverage and release gates are satisfied.',
  },
  {
    categoryId:
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_CATEGORY_IDS
        .COMPATIBILITY_NAMED_TEST_SCOPES,
    label: 'Retiring compatibility-only named test scopes',
    actionId:
      POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.REMOVE_NAMED_TEST_SCOPE,
    kindId: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_TARGET_KIND_IDS.NAMED_TEST_SCOPE,
    paths: Object.freeze([
      'client/src/__tests__/PolicyBuilderModal.test.js',
      'client/src/__tests__/PolicyIntentEditor.test.js',
    ]),
    deletionIntent:
      'Remove only exact compatibility assertions from shared native test files; never delete the retained test files.',
  },
]);

const POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_CATEGORY_ACTION_IDS =
  Object.freeze(Object.fromEntries(CATEGORY_DEFINITIONS.map(definition => [
    definition.categoryId,
    definition.actionId,
  ])));

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePath(value) {
  return cleanString(value).replace(/\\/g, '/').toLowerCase();
}

function uniqueStrings(values) {
  return [...new Set(asArray(values).map(cleanString).filter(Boolean))].sort();
}

function buildRisk(riskId, message, metadata = {}) {
  return { riskId, message, ...metadata };
}

function buildSideEffects(sideEffects = {}) {
  return {
    filesDeleted: sideEffects.filesDeleted === true,
    testsDeleted: sideEffects.testsDeleted === true,
    sourceFilesRewritten: sideEffects.sourceFilesRewritten === true,
    storageChanged: sideEffects.storageChanged === true,
    executionManifestWritten: sideEffects.executionManifestWritten === true,
  };
}

function hasSideEffects(sideEffects = {}) {
  return Object.values(sideEffects).some(Boolean);
}

function buildPolicyCompatibilityRetirementCandidateTargetKey(target = {}) {
  return JSON.stringify({
    kindId: cleanString(target.kindId),
    actionId: cleanString(target.actionId),
    path: normalizePath(target.path),
    componentPath: normalizePath(target.componentPath),
    dependencyIds: uniqueStrings(target.dependencyIds),
    sourceTextFragments: uniqueStrings(target.sourceTextFragments),
    testNameFragments: uniqueStrings(target.testNameFragments),
  });
}

function normalizeTarget(target = {}) {
  const kindId = cleanString(target.kindId) || null;

  return {
    kindId,
    actionId: cleanString(target.actionId) || null,
    path: cleanString(target.path) || null,
    componentPath: cleanString(target.componentPath) || null,
    dependencyIds: uniqueStrings(target.dependencyIds),
    sourceTextFragments: uniqueStrings(target.sourceTextFragments),
    testNameFragments: uniqueStrings(target.testNameFragments),
    wholeFileDeletion: kindId ===
      POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_TARGET_KIND_IDS.NAMED_TEST_SCOPE
      ? target.wholeFileDeletion === undefined || target.wholeFileDeletion === null
        ? false
        : target.wholeFileDeletion === false
          ? false
          : true
      : null,
  };
}

function validateCandidateProjection(candidateProjection) {
  const issues = [];

  if (!candidateProjection || typeof candidateProjection !== 'object') {
    return [buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_RISK_IDS.CANDIDATE_MISSING,
      'Candidate taxonomy reconciliation requires a source-backed candidate-plan projection.',
    )];
  }

  if (candidateProjection.statusId !==
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_STATUS_IDS
        .CANDIDATE_PLAN_READY || candidateProjection.candidatePlanReady !== true) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_RISK_IDS.CANDIDATE_NOT_READY,
      'Candidate taxonomy reconciliation requires a ready candidate projection.',
      { statusId: candidateProjection.statusId || null },
    ));
  }

  if (candidateProjection.readOnly !== true) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_RISK_IDS.CANDIDATE_NOT_READ_ONLY,
      'Candidate taxonomy reconciliation requires a read-only candidate projection.',
    ));
  }

  if (candidateProjection.deletionAuthorized !== false) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_RISK_IDS
        .CANDIDATE_AUTHORIZES_DELETION,
      'Candidate taxonomy reconciliation cannot accept a candidate that authorizes deletion.',
    ));
  }

  const candidateValidation = validatePolicyCompatibilityRetirementCandidatePlanProjection(
    candidateProjection,
  );
  if (!candidateValidation.ok || candidateProjection.validation?.ok !== true) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_RISK_IDS
        .CANDIDATE_VALIDATION_FAILED,
      'Candidate taxonomy reconciliation requires a structurally valid candidate projection.',
      { issueCount: candidateValidation.issueCount },
    ));
  }

  return issues;
}

function targetMatchesCategory(target, category) {
  return target.kindId === category.kindId &&
    target.actionId === category.actionId &&
    category.paths.some(path => normalizePath(path) === normalizePath(target.path));
}

function buildCategories(candidateTargetEntries = []) {
  return CATEGORY_DEFINITIONS.map(definition => {
    const targets = asArray(candidateTargetEntries)
      .filter(target => targetMatchesCategory(target, definition))
      .map(normalizeTarget);

    return {
      categoryId: definition.categoryId,
      label: definition.label,
      actionId: definition.actionId,
      kindId: definition.kindId,
      paths: uniqueStrings(targets.map(target => target.path)),
      deletionIntent: definition.deletionIntent,
      targetCount: targets.length,
      targets,
    };
  });
}

function buildTaxonomyIssues(categories = [], candidateTargetEntries = []) {
  const issues = [];
  const seenCategoryIds = new Set();
  const targetCategoryIds = new Map();

  asArray(categories).forEach(category => {
    const categoryId = cleanString(category.categoryId);
    const definition = CATEGORY_DEFINITIONS.find(item => item.categoryId === categoryId);

    if (!definition) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_RISK_IDS.CATEGORY_UNKNOWN,
        'Candidate taxonomy reconciliation only accepts declared category identifiers.',
        { categoryId: categoryId || null },
      ));
      return;
    }

    if (seenCategoryIds.has(categoryId)) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_RISK_IDS.CATEGORY_DUPLICATE,
        'Candidate taxonomy reconciliation requires each category exactly once.',
        { categoryId },
      ));
    }
    seenCategoryIds.add(categoryId);

    if (category.actionId !== definition.actionId || category.kindId !== definition.kindId) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_RISK_IDS
          .CATEGORY_ACTION_MISMATCH,
        'Candidate taxonomy categories must retain their declared action and target kind.',
        {
          categoryId,
          expectedActionId: definition.actionId,
          expectedKindId: definition.kindId,
        },
      ));
    }

    const categoryTargetKeys = new Set();
    asArray(category.targets).forEach(target => {
      const normalizedTarget = normalizeTarget(target);
      const targetKey = buildPolicyCompatibilityRetirementCandidateTargetKey(normalizedTarget);

      if (categoryTargetKeys.has(targetKey)) {
        issues.push(buildRisk(
          POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_RISK_IDS
            .CATEGORY_TARGET_DUPLICATE,
          'Candidate taxonomy categories cannot repeat a target identity.',
          { categoryId, target: normalizedTarget },
        ));
      }
      categoryTargetKeys.add(targetKey);

      if (!targetMatchesCategory(normalizedTarget, definition)) {
        issues.push(buildRisk(
          POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_RISK_IDS
            .CATEGORY_TARGET_MISSING,
          'Candidate taxonomy categories can contain only declared source-backed target paths and actions.',
          { categoryId, target: normalizedTarget },
        ));
      }

      if (normalizedTarget.kindId ===
          POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_TARGET_KIND_IDS.NAMED_TEST_SCOPE &&
          (
            normalizedTarget.wholeFileDeletion !== false ||
            normalizedTarget.sourceTextFragments.length === 0 ||
            normalizedTarget.testNameFragments.length === 0
          )) {
        issues.push(buildRisk(
          POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_RISK_IDS.NAMED_SCOPE_INVALID,
          'Named-scope taxonomy targets require exact source and test-name fragments and must prohibit whole-file deletion.',
          { categoryId, target: normalizedTarget },
        ));
      }

      const matchingCategories = targetCategoryIds.get(targetKey) || [];
      matchingCategories.push(categoryId);
      targetCategoryIds.set(targetKey, matchingCategories);
    });
  });

  CATEGORY_DEFINITIONS.forEach(definition => {
    if (!seenCategoryIds.has(definition.categoryId)) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_RISK_IDS.CATEGORY_UNKNOWN,
        'Candidate taxonomy reconciliation requires every declared category.',
        { categoryId: definition.categoryId },
      ));
    }
  });

  asArray(candidateTargetEntries).forEach(candidate => {
    const targetKey = buildPolicyCompatibilityRetirementCandidateTargetKey(candidate);
    const matchingCategoryIds = uniqueStrings(targetCategoryIds.get(targetKey));

    if (matchingCategoryIds.length === 0) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_RISK_IDS
          .CANDIDATE_TARGET_MISSING,
        'Every projected candidate target requires one exact taxonomy target.',
        { candidate: normalizeTarget(candidate) },
      ));
    } else if (matchingCategoryIds.length > 1) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_RISK_IDS
          .CANDIDATE_TARGET_AMBIGUOUS,
        'Projected candidate targets cannot map to more than one taxonomy category.',
        { candidate: normalizeTarget(candidate), categoryIds: matchingCategoryIds },
      ));
    }
  });

  return issues;
}

function determineStatusId({ candidateIssues, taxonomyIssues, sideEffects }) {
  if (hasSideEffects(sideEffects)) {
    return POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_STATUS_IDS
      .BLOCKED_BY_SIDE_EFFECT;
  }

  if (candidateIssues.length > 0) {
    return POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_STATUS_IDS
      .BLOCKED_BY_CANDIDATE;
  }

  if (taxonomyIssues.length > 0) {
    return POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_STATUS_IDS
      .BLOCKED_BY_TAXONOMY;
  }

  return POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_STATUS_IDS.TAXONOMY_READY;
}

function buildPolicyCompatibilityRetirementCandidateTaxonomy({
  candidateProjection = null,
  sideEffects = {},
} = {}) {
  const normalizedSideEffects = buildSideEffects(sideEffects);
  const candidateIssues = validateCandidateProjection(candidateProjection);
  const candidateTargetEntries = candidateIssues.length === 0
    ? asArray(candidateProjection.candidateTargetEntries)
    : [];
  const categories = candidateIssues.length === 0
    ? buildCategories(candidateTargetEntries)
    : [];
  const taxonomyIssues = candidateIssues.length === 0
    ? buildTaxonomyIssues(categories, candidateTargetEntries)
    : [];
  const issues = [...candidateIssues, ...taxonomyIssues];

  if (hasSideEffects(normalizedSideEffects)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_RISK_IDS.SIDE_EFFECT_PERFORMED,
      'Candidate taxonomy reconciliation cannot delete files, rewrite source, change storage, or write an execution manifest.',
    ));
  }

  const statusId = determineStatusId({
    candidateIssues,
    taxonomyIssues,
    sideEffects: normalizedSideEffects,
  });
  const taxonomy = {
    version: POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_VERSION,
    statusId,
    taxonomyReady: statusId ===
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_STATUS_IDS.TAXONOMY_READY,
    readOnly: true,
    deletionAuthorized: false,
    executionManifestWritten: false,
    candidate: {
      targetCount: candidateTargetEntries.length,
      targetKeys: candidateTargetEntries
        .map(buildPolicyCompatibilityRetirementCandidateTargetKey)
        .sort(),
    },
    categoryCount: categories.length,
    targetCount: categories.reduce((count, category) => count + category.targetCount, 0),
    categories,
    sideEffects: normalizedSideEffects,
    issueCount: issues.length,
    issues,
    nextStep: {
      stepId: 'compatibility_retirement_candidate_plan_assembly',
      label: 'Compatibility Retirement Candidate Plan Assembly',
      reason: 'The source-backed taxonomy can now bind every candidate to one exact action-owned category without approval or execution.',
    },
  };

  return {
    ...taxonomy,
    validation: validatePolicyCompatibilityRetirementCandidateTaxonomy(taxonomy),
  };
}

function validatePolicyCompatibilityRetirementCandidateTaxonomy(taxonomy = {}) {
  const issues = [];
  const categories = asArray(taxonomy.categories);
  const targets = categories.flatMap(category => asArray(category.targets));

  if (taxonomy.version !== POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_VERSION) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_RISK_IDS.CATEGORY_UNKNOWN,
      'Candidate taxonomy reconciliation requires the recognized taxonomy version.',
    ));
  }

  if (taxonomy.readOnly !== true) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_RISK_IDS.TAXONOMY_NOT_READ_ONLY,
      'Candidate taxonomy reconciliation must remain read-only.',
    ));
  }

  if (taxonomy.deletionAuthorized !== false) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_RISK_IDS
        .TAXONOMY_AUTHORIZES_DELETION,
      'Candidate taxonomy reconciliation cannot authorize deletion.',
    ));
  }

  if (taxonomy.executionManifestWritten !== false) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_RISK_IDS
        .TAXONOMY_MANIFEST_WRITTEN,
      'Candidate taxonomy reconciliation cannot write an execution manifest.',
    ));
  }

  const taxonomyIssues = buildTaxonomyIssues(categories, targets);
  issues.push(...taxonomyIssues);

  const taxonomyTargetKeys = targets
    .map(buildPolicyCompatibilityRetirementCandidateTargetKey)
    .sort();
  const declaredCandidateTargetKeys = uniqueStrings(taxonomy.candidate?.targetKeys);
  if (taxonomy.targetCount !== targets.length ||
      taxonomy.candidate?.targetCount !== targets.length ||
      taxonomy.categoryCount !== categories.length ||
      JSON.stringify(taxonomyTargetKeys) !== JSON.stringify(declaredCandidateTargetKeys)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_RISK_IDS.TARGET_COUNT_MISMATCH,
      'Candidate taxonomy counts and target keys must match the complete exact target set.',
    ));
  }

  const shouldBeReady = taxonomy.statusId ===
    POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_STATUS_IDS.TAXONOMY_READY &&
    taxonomy.issueCount === 0 && issues.length === 0;
  if (taxonomy.taxonomyReady !== shouldBeReady) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_RISK_IDS
        .TAXONOMY_READY_STATE_MISMATCH,
      'Candidate taxonomy readiness must match its status and findings.',
    ));
  }

  if (taxonomy.issueCount !== asArray(taxonomy.issues).length) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_RISK_IDS.ISSUE_COUNT_MISMATCH,
      'Candidate taxonomy issue count must match its issue list.',
    ));
  }

  Object.entries(taxonomy.sideEffects || {}).forEach(([sideEffectId, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_RISK_IDS.SIDE_EFFECT_PERFORMED,
        'Candidate taxonomy reconciliation cannot perform side effects.',
        { sideEffectId },
      ));
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_CATEGORY_ACTION_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_CATEGORY_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_RISK_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_STATUS_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_VERSION,
  buildPolicyCompatibilityRetirementCandidateTargetKey,
  buildPolicyCompatibilityRetirementCandidateTaxonomy,
  validatePolicyCompatibilityRetirementCandidateTaxonomy,
};
