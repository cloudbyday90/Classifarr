import {
  validatePolicyStorageClosureValidationEvidenceIntegrity,
} from './policyStorageClosureValidationEvidenceIntegrity.mjs';

const POLICY_STORAGE_IMPLEMENTATION_READINESS_VERSION =
  'policy.storage_implementation_readiness.v1';

const POLICY_STORAGE_IMPLEMENTATION_READINESS_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED_BY_COMPONENT_COVERAGE: 'blocked_by_component_coverage',
  BLOCKED_BY_ROADMAP_EVIDENCE: 'blocked_by_roadmap_evidence',
  BLOCKED_BY_VALIDATION: 'blocked_by_validation',
  BLOCKED_BY_CHANGELOG: 'blocked_by_changelog',
});

const POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS = Object.freeze({
  MISSING_EXPECTED_COMPONENTS: 'missing_expected_components',
  MISSING_COMPONENT_EVIDENCE: 'missing_component_evidence',
  COMPONENT_NOT_IMPLEMENTED: 'component_not_implemented',
  COMPONENT_MISSING_DESIGN_DOC: 'component_missing_design_doc',
  COMPONENT_MISSING_CONTRACT_EVIDENCE: 'component_missing_contract_evidence',
  COMPONENT_MISSING_TEST_EVIDENCE: 'component_missing_test_evidence',
  ROADMAP_SEQUENCE_INCOMPLETE: 'roadmap_sequence_incomplete',
  ROADMAP_IMPLEMENTATION_STATUS_INCOMPLETE: 'roadmap_implementation_status_incomplete',
  FOCUSED_VALIDATION_MISSING: 'focused_validation_missing',
  FOCUSED_VALIDATION_FAILED: 'focused_validation_failed',
  LINT_VALIDATION_MISSING: 'lint_validation_missing',
  LINT_VALIDATION_FAILED: 'lint_validation_failed',
  MARKDOWN_VALIDATION_MISSING: 'markdown_validation_missing',
  MARKDOWN_VALIDATION_FAILED: 'markdown_validation_failed',
  FULL_VALIDATION_MISSING: 'full_validation_missing',
  FULL_VALIDATION_FAILED: 'full_validation_failed',
  VALIDATION_EVIDENCE_ARTIFACT_INTEGRITY_FAILED:
    'validation_evidence_artifact_integrity_failed',
  CHANGELOG_ENTRY_MISSING: 'changelog_entry_missing',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  RISK_COUNT_MISMATCH: 'risk_count_mismatch',
  READY_STATE_MISMATCH: 'ready_state_mismatch',
  UNKNOWN_STATUS: 'unknown_status',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeComponentId(value = '') {
  return String(value || '').trim().toLowerCase();
}

function buildRisk(riskId, message, metadata = {}) {
  return {
    riskId,
    message,
    ...metadata,
  };
}

function getEvidenceComponentId(component = {}) {
  return normalizeComponentId(component.componentId);
}

function getComponentEvidenceByComponentId(componentEvidence = []) {
  return new Map(asArray(componentEvidence)
    .map(component => [getEvidenceComponentId(component), component]));
}

function evaluateComponentCoverage({
  expectedComponents = [],
  componentEvidence = [],
} = {}) {
  const risks = [];
  const normalizedExpectedComponents = asArray(expectedComponents)
    .filter(component => normalizeComponentId(component?.componentId));

  if (normalizedExpectedComponents.length === 0) {
    risks.push(buildRisk(
      POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.MISSING_EXPECTED_COMPONENTS,
      'Policy storage implementation readiness requires explicit expected components.'
    ));
  }

  const evidenceByComponentId = getComponentEvidenceByComponentId(componentEvidence);
  const components = normalizedExpectedComponents.map(expected => {
    const componentId = normalizeComponentId(expected.componentId);
    const evidence = evidenceByComponentId.get(componentId);

    if (!evidence) {
      risks.push(buildRisk(
        POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.MISSING_COMPONENT_EVIDENCE,
        'Policy storage implementation readiness requires evidence for every expected component.',
        {
          componentId,
          label: expected.label,
        }
      ));

      return {
        componentId,
        label: expected.label,
        implemented: false,
        designDocPresent: false,
        contractEvidencePresent: false,
        testEvidencePresent: false,
        changelogEntryPresent: false,
      };
    }

    if (evidence.implemented !== true) {
      risks.push(buildRisk(
        POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.COMPONENT_NOT_IMPLEMENTED,
        'Policy storage implementation evidence must mark the component as implemented.',
        { componentId, label: expected.label }
      ));
    }

    if (evidence.designDocPresent !== true) {
      risks.push(buildRisk(
        POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.COMPONENT_MISSING_DESIGN_DOC,
        'Policy storage implementation evidence must include a design/outcome document.',
        { componentId, label: expected.label }
      ));
    }

    if (evidence.contractEvidencePresent !== true) {
      risks.push(buildRisk(
        POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.COMPONENT_MISSING_CONTRACT_EVIDENCE,
        'Policy storage implementation evidence must include service, route, migration, or wiring contract evidence.',
        { componentId, label: expected.label }
      ));
    }

    if (evidence.testEvidencePresent !== true) {
      risks.push(buildRisk(
        POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.COMPONENT_MISSING_TEST_EVIDENCE,
        'Policy storage implementation evidence must include focused test evidence.',
        { componentId, label: expected.label }
      ));
    }

    return {
      componentId,
      label: evidence.label || expected.label,
      implemented: evidence.implemented === true,
      designDocPresent: evidence.designDocPresent === true,
      contractEvidencePresent: evidence.contractEvidencePresent === true,
      testEvidencePresent: evidence.testEvidencePresent === true,
      changelogEntryPresent: evidence.changelogEntryPresent === true,
    };
  });

  return {
    expectedCount: normalizedExpectedComponents.length,
    providedCount: evidenceByComponentId.size,
    implementedCount: components.filter(component => component.implemented).length,
    documentedCount: components.filter(component => component.designDocPresent).length,
    contractEvidenceCount:
      components.filter(component => component.contractEvidencePresent).length,
    testEvidenceCount: components.filter(component => component.testEvidencePresent).length,
    components,
    risks,
  };
}

function evaluateRoadmapEvidence({
  roadmapEvidence = {},
  expectedComponents = [],
} = {}) {
  const expectedComponentIds = asArray(expectedComponents)
    .map(component => normalizeComponentId(component?.componentId))
    .filter(Boolean);
  const sequenceComponentIds = asArray(roadmapEvidence.componentSequenceIds)
    .map(normalizeComponentId);
  const implementationStatusComponentIds = asArray(roadmapEvidence.implementationStatusComponentIds)
    .map(normalizeComponentId);
  const missingSequenceComponentIds = expectedComponentIds
    .filter(componentId => !sequenceComponentIds.includes(componentId));
  const missingImplementationStatusComponentIds = expectedComponentIds
    .filter(componentId => !implementationStatusComponentIds.includes(componentId));
  const risks = [];

  if (missingSequenceComponentIds.length > 0) {
    risks.push(buildRisk(
      POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.ROADMAP_SEQUENCE_INCOMPLETE,
      'Policy storage roadmap work sequence must include every expected component.',
      { missingComponentIds: missingSequenceComponentIds }
    ));
  }

  if (missingImplementationStatusComponentIds.length > 0) {
    risks.push(buildRisk(
      POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS
        .ROADMAP_IMPLEMENTATION_STATUS_INCOMPLETE,
      'Policy storage roadmap implementation status must include every expected component.',
      { missingComponentIds: missingImplementationStatusComponentIds }
    ));
  }

  return {
    sequenceCount: sequenceComponentIds.length,
    implementationStatusCount: implementationStatusComponentIds.length,
    missingSequenceComponentIds,
    missingImplementationStatusComponentIds,
    risks,
  };
}

function evaluateValidationEvidence(validationEvidence = {}) {
  const checks = [
    {
      key: 'focused',
      missingRiskId: POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.FOCUSED_VALIDATION_MISSING,
      failedRiskId: POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.FOCUSED_VALIDATION_FAILED,
      missingMessage:
        'Policy storage implementation readiness requires focused validation evidence.',
      failedMessage: 'Policy storage focused validation failed.',
    },
    {
      key: 'lint',
      missingRiskId: POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.LINT_VALIDATION_MISSING,
      failedRiskId: POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.LINT_VALIDATION_FAILED,
      missingMessage: 'Policy storage implementation readiness requires lint validation evidence.',
      failedMessage: 'Policy storage lint validation failed.',
    },
    {
      key: 'markdown',
      missingRiskId: POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.MARKDOWN_VALIDATION_MISSING,
      failedRiskId: POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.MARKDOWN_VALIDATION_FAILED,
      missingMessage: 'Policy storage implementation readiness requires Markdown validation evidence.',
      failedMessage: 'Policy storage Markdown validation failed.',
    },
    {
      key: 'full',
      missingRiskId: POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.FULL_VALIDATION_MISSING,
      failedRiskId: POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.FULL_VALIDATION_FAILED,
      missingMessage: 'Policy storage implementation readiness requires full server validation evidence.',
      failedMessage: 'Policy storage full validation failed.',
    },
  ];

  return checks.flatMap(check => {
    const evidence = validationEvidence[check.key];

    if (!evidence) {
      return [buildRisk(check.missingRiskId, check.missingMessage)];
    }

    if (evidence.passed !== true) {
      return [buildRisk(check.failedRiskId, check.failedMessage, {
        command: evidence.command || null,
        message: evidence.message || null,
      })];
    }

    return [];
  });
}

function evaluateValidationEvidenceArtifact(validationIntegrity = {}) {
  if (validationIntegrity.ok === true) {
    return [];
  }

  return [buildRisk(
    POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS
      .VALIDATION_EVIDENCE_ARTIFACT_INTEGRITY_FAILED,
    'Policy storage implementation readiness requires fingerprint-valid, replay-verified validation evidence.',
    {
      issueCount: validationIntegrity.issueCount ?? null,
      issueRiskIds: asArray(validationIntegrity.issues).map(issue => issue.riskId),
    }
  )];
}

function evaluateChangelogEvidence({
  componentCoverage = {},
  changelogEvidence = {},
} = {}) {
  const coveredComponentIds = asArray(changelogEvidence.componentIds)
    .map(normalizeComponentId);
  const missingComponentIds = asArray(componentCoverage.components)
    .filter(component => !coveredComponentIds.includes(component.componentId))
    .map(component => component.componentId);
  const risks = [];

  if (changelogEvidence.updated !== true || missingComponentIds.length > 0) {
    risks.push(buildRisk(
      POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.CHANGELOG_ENTRY_MISSING,
      'Policy storage implementation readiness requires changelog coverage for every expected component.',
      { missingComponentIds }
    ));
  }

  return {
    updated: changelogEvidence.updated === true,
    coveredComponentIds,
    missingComponentIds,
    risks,
  };
}

function determineStatusId(risks = []) {
  if (risks.some(risk => [
    POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.MISSING_EXPECTED_COMPONENTS,
    POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.MISSING_COMPONENT_EVIDENCE,
    POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.COMPONENT_NOT_IMPLEMENTED,
    POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.COMPONENT_MISSING_DESIGN_DOC,
    POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.COMPONENT_MISSING_CONTRACT_EVIDENCE,
    POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.COMPONENT_MISSING_TEST_EVIDENCE,
  ].includes(risk.riskId))) {
    return POLICY_STORAGE_IMPLEMENTATION_READINESS_STATUS_IDS.BLOCKED_BY_COMPONENT_COVERAGE;
  }

  if (risks.some(risk => [
    POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.ROADMAP_SEQUENCE_INCOMPLETE,
    POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS
      .ROADMAP_IMPLEMENTATION_STATUS_INCOMPLETE,
  ].includes(risk.riskId))) {
    return POLICY_STORAGE_IMPLEMENTATION_READINESS_STATUS_IDS.BLOCKED_BY_ROADMAP_EVIDENCE;
  }

  if (risks.some(risk => [
    POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS
      .VALIDATION_EVIDENCE_ARTIFACT_INTEGRITY_FAILED,
    POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.FOCUSED_VALIDATION_MISSING,
    POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.FOCUSED_VALIDATION_FAILED,
    POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.LINT_VALIDATION_MISSING,
    POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.LINT_VALIDATION_FAILED,
    POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.MARKDOWN_VALIDATION_MISSING,
    POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.MARKDOWN_VALIDATION_FAILED,
    POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.FULL_VALIDATION_MISSING,
    POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.FULL_VALIDATION_FAILED,
  ].includes(risk.riskId))) {
    return POLICY_STORAGE_IMPLEMENTATION_READINESS_STATUS_IDS.BLOCKED_BY_VALIDATION;
  }

  if (risks.some(risk => (
    risk.riskId === POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.CHANGELOG_ENTRY_MISSING
  ))) {
    return POLICY_STORAGE_IMPLEMENTATION_READINESS_STATUS_IDS.BLOCKED_BY_CHANGELOG;
  }

  return POLICY_STORAGE_IMPLEMENTATION_READINESS_STATUS_IDS.READY;
}

function normalizeSideEffects(sideEffects = {}) {
  return {
    filesWritten: sideEffects.filesWritten === true,
    storageChanged: sideEffects.storageChanged === true,
    gitCommandsRun: sideEffects.gitCommandsRun === true,
    commandsExecuted: sideEffects.commandsExecuted === true,
  };
}

function buildPolicyStorageImplementationReadiness({
  expectedComponents = [],
  componentEvidence = [],
  roadmapEvidence = {},
  validationEvidence = {},
  changelogEvidence = {},
  sideEffects = {},
} = {}) {
  const componentCoverage = evaluateComponentCoverage({
    expectedComponents,
    componentEvidence,
  });
  const roadmap = evaluateRoadmapEvidence({
    roadmapEvidence,
    expectedComponents,
  });
  const validationIntegrity =
    validatePolicyStorageClosureValidationEvidenceIntegrity({ validationEvidence });
  const verifiedValidationEvidence = validationIntegrity.ok
    ? validationIntegrity.evidence
    : validationEvidence;
  const changelog = evaluateChangelogEvidence({
    componentCoverage,
    changelogEvidence,
  });
  const risks = [
    ...componentCoverage.risks,
    ...roadmap.risks,
    ...evaluateValidationEvidenceArtifact(validationIntegrity),
    ...evaluateValidationEvidence(verifiedValidationEvidence),
    ...changelog.risks,
  ];
  const ready = risks.length === 0;
  const readiness = {
    version: POLICY_STORAGE_IMPLEMENTATION_READINESS_VERSION,
    statusId: determineStatusId(risks),
    ready,
    componentCoverage,
    roadmapEvidence: roadmap,
    validationEvidence: {
      focused: verifiedValidationEvidence.focused || null,
      lint: verifiedValidationEvidence.lint || null,
      markdown: verifiedValidationEvidence.markdown || null,
      full: verifiedValidationEvidence.full || null,
    },
    validationEvidenceIntegrity: {
      ok: validationIntegrity.ok,
      issueCount: validationIntegrity.issueCount,
      artifactFingerprint: validationIntegrity.artifactFingerprint,
    },
    changelogEvidence: changelog,
    riskCount: risks.length,
    risks,
    sideEffects: normalizeSideEffects(sideEffects),
    nextStep: ready
      ? {
        stepId: 'review_instance_cutover',
        label: 'Review Instance Cutover',
        reason:
          'Source implementation evidence is ready. Any compatibility removal remains a separately evaluated active-installation decision.',
      }
      : {
        stepId: 'resolve_implementation_evidence',
        label: 'Resolve Implementation Evidence',
        reason:
          'Source implementation evidence must be complete before an active-installation cutover can be evaluated.',
      },
  };

  return {
    ...readiness,
    validation: validatePolicyStorageImplementationReadiness(readiness),
  };
}

function validatePolicyStorageImplementationReadiness(readiness = {}) {
  const issues = [];

  if (!Object.values(POLICY_STORAGE_IMPLEMENTATION_READINESS_STATUS_IDS)
    .includes(readiness.statusId)) {
    issues.push(buildRisk(
      POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.UNKNOWN_STATUS,
      'Policy storage implementation readiness status must be known.'
    ));
  }

  if (readiness.riskCount !== asArray(readiness.risks).length) {
    issues.push(buildRisk(
      POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.RISK_COUNT_MISMATCH,
      'Policy storage implementation readiness risk count must match risk list length.'
    ));
  }

  if (readiness.ready !== (asArray(readiness.risks).length === 0)) {
    issues.push(buildRisk(
      POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.READY_STATE_MISMATCH,
      'Policy storage implementation readiness flag must match its risk list.'
    ));
  }

  Object.entries(readiness.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.SIDE_EFFECT_PERFORMED,
        `Policy storage implementation readiness cannot perform side effect "${key}".`
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
  POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS,
  POLICY_STORAGE_IMPLEMENTATION_READINESS_STATUS_IDS,
  POLICY_STORAGE_IMPLEMENTATION_READINESS_VERSION,
  buildPolicyStorageImplementationReadiness,
  evaluateChangelogEvidence,
  evaluateComponentCoverage,
  evaluateRoadmapEvidence,
  validatePolicyStorageImplementationReadiness,
};
