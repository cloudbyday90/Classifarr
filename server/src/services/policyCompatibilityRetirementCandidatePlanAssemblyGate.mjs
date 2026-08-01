/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  POLICY_COMPATIBILITY_DELETION_CATEGORY_IDS,
  POLICY_COMPATIBILITY_DELETION_GATES_VERSION,
  buildPolicyCompatibilityDeletionGates,
  validatePolicyCompatibilityDeletionGates,
} from './policyCompatibilityDeletionGates.mjs';
import {
  getPolicyCompatibilityDeletionCategoryActionId,
} from './policyCompatibilityDeletionCategoryAction.mjs';
import {
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_STATUS_IDS,
  validatePolicyCompatibilityRetirementCandidatePlanProjection,
} from './policyCompatibilityRetirementCandidatePlanProjection.mjs';
import {
  POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_TARGET_KIND_IDS,
} from './policyCompatibilityRetirementExecutionManifestTargets.mjs';

const POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_VERSION =
  'policy.compatibility_retirement_candidate_plan_assembly_gate.v1';

const POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_STATUS_IDS = Object.freeze({
  ASSEMBLY_READY: 'assembly_ready',
  BLOCKED_BY_CANDIDATE: 'blocked_by_candidate',
  BLOCKED_BY_GATE_MODEL: 'blocked_by_gate_model',
  BLOCKED_BY_CATEGORY_MAPPING: 'blocked_by_category_mapping',
  BLOCKED_BY_SIDE_EFFECT: 'blocked_by_side_effect',
});

const POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_MAPPING_STATUS_IDS =
  Object.freeze({
    MAPPED: 'mapped',
    CATEGORY_MISSING: 'category_missing',
    CATEGORY_AMBIGUOUS: 'category_ambiguous',
    CATEGORY_ACTION_MISMATCH: 'category_action_mismatch',
  });

const POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS =
  Object.freeze({
    CANDIDATE_MISSING: 'candidate_missing',
    CANDIDATE_NOT_READY: 'candidate_not_ready',
    CANDIDATE_NOT_READ_ONLY: 'candidate_not_read_only',
    CANDIDATE_AUTHORIZES_DELETION: 'candidate_authorizes_deletion',
    CANDIDATE_VALIDATION_FAILED: 'candidate_validation_failed',
    GATE_MODEL_MISSING: 'gate_model_missing',
    GATE_MODEL_VERSION_UNKNOWN: 'gate_model_version_unknown',
    GATE_MODEL_VALIDATION_FAILED: 'gate_model_validation_failed',
    GATE_CATEGORY_UNKNOWN: 'gate_category_unknown',
    GATE_CATEGORY_DUPLICATE: 'gate_category_duplicate',
    GATE_CATEGORY_PATH_MISSING: 'gate_category_path_missing',
    CANDIDATE_CATEGORY_MISSING: 'candidate_category_missing',
    CANDIDATE_CATEGORY_AMBIGUOUS: 'candidate_category_ambiguous',
    CANDIDATE_CATEGORY_ACTION_MISMATCH: 'candidate_category_action_mismatch',
    MAPPING_COUNT_MISMATCH: 'mapping_count_mismatch',
    ASSEMBLY_NOT_READ_ONLY: 'assembly_not_read_only',
    ASSEMBLY_AUTHORIZES_DELETION: 'assembly_authorizes_deletion',
    ASSEMBLY_MANIFEST_WRITTEN: 'assembly_manifest_written',
    ASSEMBLY_READY_STATE_MISMATCH: 'assembly_ready_state_mismatch',
    ISSUE_COUNT_MISMATCH: 'issue_count_mismatch',
    SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  });

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

function candidateIdentity(candidate = {}) {
  return {
    kindId: candidate.kindId || null,
    actionId: candidate.actionId || null,
    path: candidate.path || null,
    componentPath: candidate.componentPath || null,
    dependencyIds: uniqueStrings(candidate.dependencyIds),
    sourceTextFragments: uniqueStrings(candidate.sourceTextFragments),
    testNameFragments: uniqueStrings(candidate.testNameFragments),
  };
}

function validateCandidateProjection(candidateProjection) {
  const issues = [];

  if (!candidateProjection || typeof candidateProjection !== 'object') {
    return [buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS.CANDIDATE_MISSING,
      'Candidate-plan assembly requires a source-backed candidate-plan projection.',
    )];
  }

  if (candidateProjection.statusId !==
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_STATUS_IDS
        .CANDIDATE_PLAN_READY || candidateProjection.candidatePlanReady !== true) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
        .CANDIDATE_NOT_READY,
      'Candidate-plan assembly requires a ready candidate projection.',
      { statusId: candidateProjection.statusId || null },
    ));
  }

  if (candidateProjection.readOnly !== true) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
        .CANDIDATE_NOT_READ_ONLY,
      'Candidate-plan assembly requires a read-only candidate projection.',
    ));
  }

  if (candidateProjection.deletionAuthorized !== false) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
        .CANDIDATE_AUTHORIZES_DELETION,
      'Candidate-plan assembly cannot accept a candidate that authorizes deletion.',
    ));
  }

  const candidateValidation = validatePolicyCompatibilityRetirementCandidatePlanProjection(
    candidateProjection,
  );
  if (!candidateValidation.ok || candidateProjection.validation?.ok !== true) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
        .CANDIDATE_VALIDATION_FAILED,
      'Candidate-plan assembly requires a structurally valid candidate projection.',
      { issueCount: candidateValidation.issueCount },
    ));
  }

  return issues;
}

function validateGateModel(deletionGatePlan) {
  const issues = [];

  if (!deletionGatePlan || typeof deletionGatePlan !== 'object') {
    return [buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
        .GATE_MODEL_MISSING,
      'Candidate-plan assembly requires the existing compatibility deletion-gate model.',
    )];
  }

  if (deletionGatePlan.version !== POLICY_COMPATIBILITY_DELETION_GATES_VERSION) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
        .GATE_MODEL_VERSION_UNKNOWN,
      'Candidate-plan assembly requires the recognized deletion-gate model version.',
      { version: deletionGatePlan.version || null },
    ));
  }

  const gateValidation = validatePolicyCompatibilityDeletionGates(deletionGatePlan);
  if (!gateValidation.ok || deletionGatePlan.validation?.ok !== true) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
        .GATE_MODEL_VALIDATION_FAILED,
      'Candidate-plan assembly requires a structurally valid deletion-gate model.',
      { issueCount: gateValidation.issueCount },
    ));
  }

  const categoryIds = new Set();
  asArray(deletionGatePlan.categories).forEach(category => {
    const categoryId = cleanString(category.categoryId);

    if (!Object.values(POLICY_COMPATIBILITY_DELETION_CATEGORY_IDS).includes(categoryId)) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
          .GATE_CATEGORY_UNKNOWN,
        'Candidate-plan assembly only accepts declared deletion-gate category identifiers.',
        { categoryId: categoryId || null },
      ));
    }

    if (categoryIds.has(categoryId)) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
          .GATE_CATEGORY_DUPLICATE,
        'Candidate-plan assembly requires each deletion-gate category only once.',
        { categoryId: categoryId || null },
      ));
    }
    categoryIds.add(categoryId);

    if (uniqueStrings(category.paths).length === 0) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
          .GATE_CATEGORY_PATH_MISSING,
        'Candidate-plan assembly requires every deletion-gate category to declare exact paths.',
        { categoryId: categoryId || null },
      ));
    }
  });

  return issues;
}

function getCandidateMatchPaths(candidate = {}) {
  const retainedTestPath = [
    POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_TARGET_KIND_IDS.TEST_FILE,
    POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_TARGET_KIND_IDS.NAMED_TEST_SCOPE,
  ].includes(candidate.kindId);
  const matchPaths = [{ fieldId: 'path', path: cleanString(candidate.path) }];

  if (!retainedTestPath && cleanString(candidate.componentPath) &&
      normalizePath(candidate.componentPath) !== normalizePath(candidate.path)) {
    matchPaths.push({
      fieldId: 'component_path',
      path: cleanString(candidate.componentPath),
    });
  }

  return matchPaths.filter(match => Boolean(match.path));
}

function mapCandidateToCategory(candidate, categories = []) {
  const categoryMatches = new Map();

  getCandidateMatchPaths(candidate).forEach(match => {
    const normalizedMatchPath = normalizePath(match.path);

    asArray(categories).forEach(category => {
      const categoryPathMatches = uniqueStrings(category.paths)
        .filter(path => normalizePath(path) === normalizedMatchPath);

      if (categoryPathMatches.length === 0) return;

      const categoryId = cleanString(category.categoryId);
      const existing = categoryMatches.get(categoryId) || {
        categoryId,
        expectedActionId: getPolicyCompatibilityDeletionCategoryActionId(categoryId),
        matchedFields: [],
        matchedPaths: [],
      };
      existing.matchedFields = uniqueStrings([...existing.matchedFields, match.fieldId]);
      existing.matchedPaths = uniqueStrings([...existing.matchedPaths, ...categoryPathMatches]);
      categoryMatches.set(categoryId, existing);
    });
  });

  const matches = [...categoryMatches.values()]
    .sort((left, right) => left.categoryId.localeCompare(right.categoryId));
  const mapping = {
    candidate: candidateIdentity(candidate),
    categoryId: null,
    expectedActionId: null,
    matchedFields: [],
    matchedPaths: [],
    matchingCategoryIds: matches.map(match => match.categoryId),
    statusId: POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_MAPPING_STATUS_IDS
      .CATEGORY_MISSING,
  };

  if (matches.length === 0) return mapping;

  if (matches.length > 1) {
    return {
      ...mapping,
      statusId: POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_MAPPING_STATUS_IDS
        .CATEGORY_AMBIGUOUS,
    };
  }

  const [match] = matches;
  const actionMatches = match.expectedActionId === candidate.actionId;

  return {
    ...mapping,
    categoryId: match.categoryId,
    expectedActionId: match.expectedActionId,
    matchedFields: match.matchedFields,
    matchedPaths: match.matchedPaths,
    statusId: actionMatches
      ? POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_MAPPING_STATUS_IDS.MAPPED
      : POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_MAPPING_STATUS_IDS
        .CATEGORY_ACTION_MISMATCH,
  };
}

function buildMappingIssues(mappings = []) {
  const issues = [];

  asArray(mappings).forEach(mapping => {
    if (mapping.statusId ===
        POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_MAPPING_STATUS_IDS
          .CATEGORY_MISSING) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
          .CANDIDATE_CATEGORY_MISSING,
        'Every candidate target requires one explicit deletion-gate category mapping.',
        { candidate: mapping.candidate },
      ));
    }

    if (mapping.statusId ===
        POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_MAPPING_STATUS_IDS
          .CATEGORY_AMBIGUOUS) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
          .CANDIDATE_CATEGORY_AMBIGUOUS,
        'Candidate targets cannot map to more than one deletion-gate category.',
        {
          candidate: mapping.candidate,
          categoryIds: mapping.matchingCategoryIds,
        },
      ));
    }

    if (mapping.statusId ===
        POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_MAPPING_STATUS_IDS
          .CATEGORY_ACTION_MISMATCH) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
          .CANDIDATE_CATEGORY_ACTION_MISMATCH,
        'Candidate actions must match the action owned by their deletion-gate category.',
        {
          candidate: mapping.candidate,
          categoryId: mapping.categoryId,
          expectedActionId: mapping.expectedActionId,
        },
      ));
    }
  });

  return issues;
}

function determineStatusId({ candidateIssues, gateModelIssues, mappingIssues, sideEffects }) {
  if (hasSideEffects(sideEffects)) {
    return POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_STATUS_IDS
      .BLOCKED_BY_SIDE_EFFECT;
  }

  if (candidateIssues.length > 0) {
    return POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_STATUS_IDS
      .BLOCKED_BY_CANDIDATE;
  }

  if (gateModelIssues.length > 0) {
    return POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_STATUS_IDS
      .BLOCKED_BY_GATE_MODEL;
  }

  if (mappingIssues.length > 0) {
    return POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_STATUS_IDS
      .BLOCKED_BY_CATEGORY_MAPPING;
  }

  return POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_STATUS_IDS
    .ASSEMBLY_READY;
}

function buildPolicyCompatibilityRetirementCandidatePlanAssemblyGate({
  candidateProjection = null,
  deletionGatePlan = buildPolicyCompatibilityDeletionGates(),
  sideEffects = {},
} = {}) {
  const normalizedSideEffects = buildSideEffects(sideEffects);
  const candidateIssues = validateCandidateProjection(candidateProjection);
  const gateModelIssues = validateGateModel(deletionGatePlan);
  const candidateTargetEntries = candidateIssues.length === 0
    ? asArray(candidateProjection.candidateTargetEntries)
    : [];
  const mappings = candidateIssues.length === 0 && gateModelIssues.length === 0
    ? candidateTargetEntries.map(candidate => mapCandidateToCategory(
      candidate,
      deletionGatePlan.categories,
    ))
    : [];
  const mappingIssues = candidateIssues.length === 0 && gateModelIssues.length === 0
    ? buildMappingIssues(mappings)
    : [];
  const issues = [...candidateIssues, ...gateModelIssues, ...mappingIssues];

  if (hasSideEffects(normalizedSideEffects)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
        .SIDE_EFFECT_PERFORMED,
      'Candidate-plan assembly cannot delete files, rewrite source, change storage, or write an execution manifest.',
    ));
  }

  const statusId = determineStatusId({
    candidateIssues,
    gateModelIssues,
    mappingIssues,
    sideEffects: normalizedSideEffects,
  });
  const assembly = {
    version: POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_VERSION,
    statusId,
    assemblyReady: statusId ===
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_STATUS_IDS
        .ASSEMBLY_READY,
    readOnly: true,
    deletionAuthorized: false,
    executionManifestWritten: false,
    candidate: {
      statusId: candidateProjection?.statusId || null,
      candidatePlanReady: candidateProjection?.candidatePlanReady === true,
      validationOk: candidateProjection?.validation?.ok === true,
      targetCount: candidateTargetEntries.length,
    },
    gateModel: {
      version: deletionGatePlan?.version || null,
      statusId: deletionGatePlan?.statusId || null,
      validationOk: deletionGatePlan?.validation?.ok === true,
      readyToDelete: deletionGatePlan?.readyToDelete === true,
      categoryCount: asArray(deletionGatePlan?.categories).length,
    },
    mappingCount: mappings.length,
    mappedTargetCount: mappings.filter(mapping => mapping.statusId ===
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_MAPPING_STATUS_IDS
        .MAPPED).length,
    unresolvedTargetCount: mappings.filter(mapping => mapping.statusId !==
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_MAPPING_STATUS_IDS
        .MAPPED).length,
    mappings,
    sideEffects: normalizedSideEffects,
    issueCount: issues.length,
    issues,
    nextStep: {
      stepId: 'compatibility_deletion_category_taxonomy_reconciliation',
      label: 'Compatibility Deletion-Category Taxonomy Reconciliation',
      reason: 'Reconcile every unresolved exact candidate to one category and action without flattening named shared-test scopes into whole-file test removal.',
    },
  };

  return {
    ...assembly,
    validation: validatePolicyCompatibilityRetirementCandidatePlanAssemblyGate(assembly),
  };
}

function validatePolicyCompatibilityRetirementCandidatePlanAssemblyGate(assembly = {}) {
  const issues = [];
  const mappings = asArray(assembly.mappings);
  const hasUnresolvedMappings = mappings.some(mapping => mapping.statusId !==
    POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_MAPPING_STATUS_IDS.MAPPED);

  if (assembly.readOnly !== true) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
        .ASSEMBLY_NOT_READ_ONLY,
      'Candidate-plan assembly must remain read-only.',
    ));
  }

  if (assembly.deletionAuthorized !== false) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
        .ASSEMBLY_AUTHORIZES_DELETION,
      'Candidate-plan assembly cannot authorize deletion.',
    ));
  }

  if (assembly.executionManifestWritten !== false) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
        .ASSEMBLY_MANIFEST_WRITTEN,
      'Candidate-plan assembly cannot write an execution manifest.',
    ));
  }

  if (assembly.mappingCount !== mappings.length ||
      assembly.mappingCount !== assembly.candidate?.targetCount) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
        .MAPPING_COUNT_MISMATCH,
      'Candidate-plan assembly must produce exactly one mapping result for every candidate target.',
    ));
  }

  const shouldBeReady = assembly.statusId ===
    POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_STATUS_IDS.ASSEMBLY_READY &&
    assembly.issueCount === 0 && !hasUnresolvedMappings;
  if (assembly.assemblyReady !== shouldBeReady) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
        .ASSEMBLY_READY_STATE_MISMATCH,
      'Candidate-plan assembly readiness must match its status, findings, and mapping results.',
    ));
  }

  if (assembly.issueCount !== asArray(assembly.issues).length) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
        .ISSUE_COUNT_MISMATCH,
      'Candidate-plan assembly issue count must match its issue list.',
    ));
  }

  Object.entries(assembly.sideEffects || {}).forEach(([sideEffectId, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
          .SIDE_EFFECT_PERFORMED,
        'Candidate-plan assembly cannot perform side effects.',
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
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_STATUS_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_VERSION,
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_MAPPING_STATUS_IDS,
  buildPolicyCompatibilityRetirementCandidatePlanAssemblyGate,
  validatePolicyCompatibilityRetirementCandidatePlanAssemblyGate,
};
