/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
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
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_STATUS_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_VERSION,
  buildPolicyCompatibilityRetirementCandidateTargetKey,
  buildPolicyCompatibilityRetirementCandidateTaxonomy,
  validatePolicyCompatibilityRetirementCandidateTaxonomy,
} from './policyCompatibilityRetirementCandidateTaxonomy.mjs';

const POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_VERSION =
  'policy.compatibility_retirement_candidate_plan_assembly_gate.v2';

const POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_STATUS_IDS = Object.freeze({
  ASSEMBLY_READY: 'assembly_ready',
  BLOCKED_BY_CANDIDATE: 'blocked_by_candidate',
  BLOCKED_BY_GATE_MODEL: 'blocked_by_gate_model',
  BLOCKED_BY_TAXONOMY: 'blocked_by_taxonomy',
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
  TAXONOMY_MISSING: 'taxonomy_missing',
  TAXONOMY_VERSION_UNKNOWN: 'taxonomy_version_unknown',
  TAXONOMY_NOT_READY: 'taxonomy_not_ready',
  TAXONOMY_NOT_READ_ONLY: 'taxonomy_not_read_only',
  TAXONOMY_AUTHORIZES_DELETION: 'taxonomy_authorizes_deletion',
  TAXONOMY_VALIDATION_FAILED: 'taxonomy_validation_failed',
  TAXONOMY_CANDIDATE_MISMATCH: 'taxonomy_candidate_mismatch',
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

    if (!getPolicyCompatibilityDeletionCategoryActionId(categoryId)) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
          .GATE_CATEGORY_UNKNOWN,
        'Candidate-plan assembly only accepts deletion-gate categories with a centrally owned action.',
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

function validateCategoryTaxonomy({ categoryTaxonomy, candidateTargetEntries }) {
  const issues = [];

  if (!categoryTaxonomy || typeof categoryTaxonomy !== 'object') {
    return [buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS.TAXONOMY_MISSING,
      'Candidate-plan assembly requires a source-backed candidate taxonomy.',
    )];
  }

  if (categoryTaxonomy.version !== POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_VERSION) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
        .TAXONOMY_VERSION_UNKNOWN,
      'Candidate-plan assembly requires the recognized candidate taxonomy version.',
      { version: categoryTaxonomy.version || null },
    ));
  }

  if (categoryTaxonomy.statusId !==
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_STATUS_IDS.TAXONOMY_READY ||
      categoryTaxonomy.taxonomyReady !== true) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
        .TAXONOMY_NOT_READY,
      'Candidate-plan assembly requires a ready candidate taxonomy.',
      { statusId: categoryTaxonomy.statusId || null },
    ));
  }

  if (categoryTaxonomy.readOnly !== true) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
        .TAXONOMY_NOT_READ_ONLY,
      'Candidate-plan assembly requires a read-only candidate taxonomy.',
    ));
  }

  if (categoryTaxonomy.deletionAuthorized !== false) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
        .TAXONOMY_AUTHORIZES_DELETION,
      'Candidate-plan assembly cannot accept a taxonomy that authorizes deletion.',
    ));
  }

  const taxonomyValidation = validatePolicyCompatibilityRetirementCandidateTaxonomy(
    categoryTaxonomy,
  );
  if (!taxonomyValidation.ok || categoryTaxonomy.validation?.ok !== true) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
        .TAXONOMY_VALIDATION_FAILED,
      'Candidate-plan assembly requires a structurally valid candidate taxonomy.',
      { issueCount: taxonomyValidation.issueCount },
    ));
  }

  const candidateTargetKeys = asArray(candidateTargetEntries)
    .map(buildPolicyCompatibilityRetirementCandidateTargetKey)
    .sort();
  const taxonomyTargetKeys = asArray(categoryTaxonomy.candidate?.targetKeys).slice().sort();
  if (JSON.stringify(candidateTargetKeys) !== JSON.stringify(taxonomyTargetKeys) ||
      categoryTaxonomy.candidate?.targetCount !== candidateTargetKeys.length) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
        .TAXONOMY_CANDIDATE_MISMATCH,
      'Candidate-plan assembly requires the taxonomy to bind exactly the current candidate target set.',
    ));
  }

  return issues;
}

function mapCandidateToCategory(candidate, categories = []) {
  const candidateTargetKey = buildPolicyCompatibilityRetirementCandidateTargetKey(candidate);
  const matches = asArray(categories)
    .flatMap(category => {
      const target = asArray(category.targets).find(item => (
        buildPolicyCompatibilityRetirementCandidateTargetKey(item) === candidateTargetKey
      ));
      if (!target) return [];

      return [{
        categoryId: cleanString(category.categoryId),
        expectedActionId: getPolicyCompatibilityDeletionCategoryActionId(category.categoryId),
        matchedFields: [
          'kind_id',
          'action_id',
          'path',
          'component_path',
          'dependency_ids',
          'source_text_fragments',
          'test_name_fragments',
        ],
        matchedPaths: uniqueStrings([target.path, candidate.path]),
      }];
    })
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

function determineStatusId({
  candidateIssues,
  gateModelIssues,
  taxonomyIssues,
  mappingIssues,
  sideEffects,
}) {
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

  if (taxonomyIssues.length > 0) {
    return POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_STATUS_IDS
      .BLOCKED_BY_TAXONOMY;
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
  categoryTaxonomy = candidateProjection
    ? buildPolicyCompatibilityRetirementCandidateTaxonomy({ candidateProjection })
    : null,
  sideEffects = {},
} = {}) {
  const normalizedSideEffects = buildSideEffects(sideEffects);
  const candidateIssues = validateCandidateProjection(candidateProjection);
  const gateModelIssues = validateGateModel(deletionGatePlan);
  const candidateTargetEntries = candidateIssues.length === 0
    ? asArray(candidateProjection.candidateTargetEntries)
    : [];
  const taxonomyIssues = candidateIssues.length === 0
    ? validateCategoryTaxonomy({ categoryTaxonomy, candidateTargetEntries })
    : [];
  const mappings = candidateIssues.length === 0 && gateModelIssues.length === 0 &&
      taxonomyIssues.length === 0
    ? candidateTargetEntries.map(candidate => mapCandidateToCategory(
      candidate,
      categoryTaxonomy.categories,
    ))
    : [];
  const mappingIssues = candidateIssues.length === 0 && gateModelIssues.length === 0 &&
      taxonomyIssues.length === 0
    ? buildMappingIssues(mappings)
    : [];
  const issues = [
    ...candidateIssues,
    ...gateModelIssues,
    ...taxonomyIssues,
    ...mappingIssues,
  ];

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
    taxonomyIssues,
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
    categoryTaxonomy: {
      version: categoryTaxonomy?.version || null,
      statusId: categoryTaxonomy?.statusId || null,
      validationOk: categoryTaxonomy?.validation?.ok === true,
      taxonomyReady: categoryTaxonomy?.taxonomyReady === true,
      categoryCount: categoryTaxonomy?.categoryCount ?? null,
      targetCount: categoryTaxonomy?.targetCount ?? null,
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
      stepId: 'compatibility_retirement_assembly_handoff_audit',
      label: 'Compatibility Retirement Assembly Handoff Audit',
      reason: 'The source-backed taxonomy now maps every candidate; audit the read-only handoff to the existing release, approval, and execution gates before creating another artifact.',
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
