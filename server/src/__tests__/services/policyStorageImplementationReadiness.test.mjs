import {
  POLICY_STORAGE_IMPLEMENTATION_COMPONENTS,
} from '../../services/policyStorageCompletionCheckpoint.mjs';
import {
  POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS,
  POLICY_STORAGE_IMPLEMENTATION_READINESS_STATUS_IDS,
  buildPolicyStorageImplementationReadiness,
  validatePolicyStorageImplementationReadiness,
} from '../../services/policyStorageImplementationReadiness.mjs';
import {
  buildPolicyStorageClosureValidationEvidenceFixture,
} from './policyStorageClosureValidationEvidenceFixture.mjs';

const COMPONENT_IDS = POLICY_STORAGE_IMPLEMENTATION_COMPONENTS
  .map(component => component.componentId);

function componentEvidence(overrides = {}) {
  return POLICY_STORAGE_IMPLEMENTATION_COMPONENTS.map(component => ({
    componentId: component.componentId,
    label: component.label,
    implemented: true,
    designDocPresent: true,
    contractEvidencePresent: true,
    testEvidencePresent: true,
    changelogEntryPresent: true,
    ...overrides[component.componentId],
  }));
}

function readinessInputs(overrides = {}) {
  return {
    expectedComponents: POLICY_STORAGE_IMPLEMENTATION_COMPONENTS,
    componentEvidence: componentEvidence(),
    roadmapEvidence: {
      componentSequenceIds: COMPONENT_IDS,
      implementationStatusComponentIds: COMPONENT_IDS,
    },
    validationEvidence: buildPolicyStorageClosureValidationEvidenceFixture(),
    changelogEvidence: {
      updated: true,
      componentIds: COMPONENT_IDS,
    },
    ...overrides,
  };
}

describe('policyStorageImplementationReadiness', () => {
  test('reports source implementation readiness without an installation completion audit', () => {
    const readiness = buildPolicyStorageImplementationReadiness(readinessInputs());

    expect(readiness.statusId).toBe(POLICY_STORAGE_IMPLEMENTATION_READINESS_STATUS_IDS.READY);
    expect(readiness.ready).toBe(true);
    expect(readiness.validation.ok).toBe(true);
    expect(readiness).not.toHaveProperty('completionAuditArtifact');
    expect(readiness).not.toHaveProperty('instanceCutover');
    expect(JSON.stringify(readiness)).not.toContain('policyId');
    expect(readiness.nextStep).toEqual(expect.objectContaining({
      stepId: 'review_instance_cutover',
    }));
  });

  test('blocks source readiness for missing source evidence rather than any installation state', () => {
    const readiness = buildPolicyStorageImplementationReadiness(readinessInputs({
      componentEvidence: componentEvidence({
        native_schema_contract: {
          implemented: false,
          designDocPresent: false,
          contractEvidencePresent: false,
          testEvidencePresent: false,
        },
      }),
      roadmapEvidence: {
        componentSequenceIds: COMPONENT_IDS.slice(1),
        implementationStatusComponentIds: COMPONENT_IDS,
      },
      validationEvidence: {},
      changelogEvidence: {
        updated: false,
        componentIds: [],
      },
    }));

    expect(readiness.ready).toBe(false);
    expect(readiness.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.COMPONENT_NOT_IMPLEMENTED,
      POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.ROADMAP_SEQUENCE_INCOMPLETE,
      POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.FOCUSED_VALIDATION_MISSING,
      POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.CHANGELOG_ENTRY_MISSING,
    ]));
    expect(readiness.nextStep.stepId).toBe('resolve_implementation_evidence');
  });

  test('fails closed when expected component coverage is omitted', () => {
    const readiness = buildPolicyStorageImplementationReadiness();

    expect(readiness.ready).toBe(false);
    expect(readiness.statusId)
      .toBe(POLICY_STORAGE_IMPLEMENTATION_READINESS_STATUS_IDS.BLOCKED_BY_COMPONENT_COVERAGE);
    expect(readiness.risks.map(risk => risk.riskId)).toContain(
      POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.MISSING_EXPECTED_COMPONENTS
    );
  });

  test('rejects altered readiness output and side effects', () => {
    const validation = validatePolicyStorageImplementationReadiness({
      statusId: POLICY_STORAGE_IMPLEMENTATION_READINESS_STATUS_IDS.READY,
      ready: true,
      riskCount: 1,
      risks: [],
      sideEffects: {
        filesWritten: true,
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.RISK_COUNT_MISMATCH,
      POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS.SIDE_EFFECT_PERFORMED,
    ]));
  });
});
