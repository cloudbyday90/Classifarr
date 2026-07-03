import {
  POLICY_AUTHORING_COMPONENT_IDS,
  POLICY_AUTHORING_INTERACTION_RULE_IDS,
} from '../../services/policyAuthoringComponentSystem.mjs';
import {
  POLICY_AUTHORING_DESTINATION_QUESTION_IDS,
} from '../../services/policyAuthoringDestinationFlow.mjs';
import {
  POLICY_AUTHORING_CERTIFICATION_SEMANTIC_IDS,
  POLICY_AUTHORING_CONSTRAINT_COMMAND_IDS,
  POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS,
  POLICY_AUTHORING_CONSTRAINT_INTENT_IDS,
  POLICY_AUTHORING_CONSTRAINT_RISK_IDS,
  POLICY_AUTHORING_CONSTRAINT_SOURCE_IDS,
  buildPolicyAuthoringConstraintCommandPlan,
  getPolicyAuthoringConstraintControlRecord,
  listPolicyAuthoringConstraintControlRecords,
  normalizePolicyAuthoringConstraintCandidate,
  summarizePolicyAuthoringConstraints,
  validatePolicyAuthoringConstraintCandidate,
} from '../../services/policyAuthoringConstraints.mjs';

describe('policyAuthoringConstraints', () => {
  test('defines separated hard-limit, avoid, and review-warning controls', () => {
    expect(listPolicyAuthoringConstraintControlRecords().map(record => record.controlId)).toEqual([
      POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
      POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.AVOID,
      POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.REVIEW_WARNING,
    ]);

    expect(getPolicyAuthoringConstraintControlRecord(POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.HARD_LIMIT))
      .toEqual(expect.objectContaining({
        componentId: POLICY_AUTHORING_COMPONENT_IDS.HARD_LIMIT_CONTROL,
        questionId: POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_SHOULD_NOT_GO_HERE,
        intentId: POLICY_AUTHORING_CONSTRAINT_INTENT_IDS.BLOCKING_CONSTRAINT,
        canBlockRouting: true,
        requiresExplicitOperatorAction: true,
        learnsFromAbsence: false,
        certificationSemanticId: POLICY_AUTHORING_CERTIFICATION_SEMANTIC_IDS.MAX_ALLOWED_RATING,
      }));

    expect(getPolicyAuthoringConstraintControlRecord(POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.AVOID))
      .toEqual(expect.objectContaining({
        componentId: POLICY_AUTHORING_COMPONENT_IDS.AVOID_CONTROL,
        intentId: POLICY_AUTHORING_CONSTRAINT_INTENT_IDS.ADVISORY_AVOID,
        canBlockRouting: false,
        certificationSemanticId: POLICY_AUTHORING_CERTIFICATION_SEMANTIC_IDS.AVOID_RATING,
      }));
  });

  test('normalizes hard-limit candidates with max-rating semantics and typed command boundary', () => {
    expect(normalizePolicyAuthoringConstraintCandidate({
      controlId: POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
      sourceId: POLICY_AUTHORING_CONSTRAINT_SOURCE_IDS.OPERATOR_DECLARED,
      values: ['PG-13'],
      explicitOperatorAction: true,
    })).toEqual(expect.objectContaining({
      controlId: POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
      componentId: POLICY_AUTHORING_COMPONENT_IDS.HARD_LIMIT_CONTROL,
      commandId: POLICY_AUTHORING_CONSTRAINT_COMMAND_IDS.SET_HARD_LIMIT,
      values: ['PG-13'],
      certificationSemanticId: POLICY_AUTHORING_CERTIFICATION_SEMANTIC_IDS.MAX_ALLOWED_RATING,
      canBlockRouting: true,
      commandBoundary: 'typed_draft_commands',
    }));
  });

  test('requires explicit operator action for blocking and avoid controls', () => {
    expect(validatePolicyAuthoringConstraintCandidate({
      controlId: POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
      sourceId: POLICY_AUTHORING_CONSTRAINT_SOURCE_IDS.STARTER_TEMPLATE_SUGGESTION,
      values: ['R'],
    })).toEqual(expect.objectContaining({
      valid: false,
      riskId: POLICY_AUTHORING_CONSTRAINT_RISK_IDS.MISSING_EXPLICIT_OPERATOR_ACTION,
    }));

    expect(validatePolicyAuthoringConstraintCandidate({
      controlId: POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.AVOID,
      sourceId: POLICY_AUTHORING_CONSTRAINT_SOURCE_IDS.OPERATOR_DECLARED,
      values: ['NC-17'],
      explicitOperatorAction: true,
    })).toEqual(expect.objectContaining({
      valid: true,
      riskId: null,
    }));
  });

  test('keeps absence-based suggestions as warnings, not automatic exclusions', () => {
    expect(validatePolicyAuthoringConstraintCandidate({
      controlId: POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
      sourceId: POLICY_AUTHORING_CONSTRAINT_SOURCE_IDS.OBSERVED_ABSENCE_WARNING,
      values: ['Horror'],
      explicitOperatorAction: true,
      inferredFromAbsence: true,
    })).toEqual(expect.objectContaining({
      valid: false,
      riskId: POLICY_AUTHORING_CONSTRAINT_RISK_IDS.ABSENCE_INFERRED_HARD_LIMIT,
    }));

    expect(validatePolicyAuthoringConstraintCandidate({
      controlId: POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.AVOID,
      sourceId: POLICY_AUTHORING_CONSTRAINT_SOURCE_IDS.OBSERVED_ABSENCE_WARNING,
      values: ['Horror'],
      explicitOperatorAction: true,
      inferredFromAbsence: true,
    })).toEqual(expect.objectContaining({
      valid: false,
      riskId: POLICY_AUTHORING_CONSTRAINT_RISK_IDS.ABSENCE_INFERRED_AVOID,
    }));

    expect(validatePolicyAuthoringConstraintCandidate({
      controlId: POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.REVIEW_WARNING,
      sourceId: POLICY_AUTHORING_CONSTRAINT_SOURCE_IDS.OBSERVED_ABSENCE_WARNING,
      values: ['Horror is not represented in this destination.'],
    })).toEqual(expect.objectContaining({
      valid: true,
      riskId: null,
    }));
  });

  test('requires block examples for observed conflict hard-limit suggestions', () => {
    expect(validatePolicyAuthoringConstraintCandidate({
      controlId: POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
      sourceId: POLICY_AUTHORING_CONSTRAINT_SOURCE_IDS.OBSERVED_CONFLICT_EXAMPLE,
      values: ['R'],
      explicitOperatorAction: true,
    })).toEqual(expect.objectContaining({
      valid: false,
      riskId: POLICY_AUTHORING_CONSTRAINT_RISK_IDS.MISSING_BLOCK_EXAMPLE,
    }));

    expect(validatePolicyAuthoringConstraintCandidate({
      controlId: POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
      sourceId: POLICY_AUTHORING_CONSTRAINT_SOURCE_IDS.OBSERVED_CONFLICT_EXAMPLE,
      values: ['R'],
      explicitOperatorAction: true,
      blockExamples: ['Would block Example Movie (R).'],
    })).toEqual(expect.objectContaining({
      valid: true,
      riskId: null,
    }));
  });

  test('does not conflate max-rating hard limits with avoid-rating controls', () => {
    expect(validatePolicyAuthoringConstraintCandidate({
      controlId: POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
      sourceId: POLICY_AUTHORING_CONSTRAINT_SOURCE_IDS.OPERATOR_DECLARED,
      values: ['R'],
      explicitOperatorAction: true,
      certificationSemanticId: POLICY_AUTHORING_CERTIFICATION_SEMANTIC_IDS.AVOID_RATING,
    })).toEqual(expect.objectContaining({
      valid: false,
      riskId: POLICY_AUTHORING_CONSTRAINT_RISK_IDS.MAX_AND_AVOID_RATING_CONFLATED,
    }));

    expect(validatePolicyAuthoringConstraintCandidate({
      controlId: POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.AVOID,
      sourceId: POLICY_AUTHORING_CONSTRAINT_SOURCE_IDS.OPERATOR_DECLARED,
      values: ['R'],
      explicitOperatorAction: true,
      certificationSemanticId: POLICY_AUTHORING_CERTIFICATION_SEMANTIC_IDS.MAX_ALLOWED_RATING,
    })).toEqual(expect.objectContaining({
      valid: false,
      riskId: POLICY_AUTHORING_CONSTRAINT_RISK_IDS.MAX_AND_AVOID_RATING_CONFLATED,
    }));
  });

  test('builds typed command plans and rejects invalid candidates', () => {
    const commandPlan = buildPolicyAuthoringConstraintCommandPlan([
      {
        controlId: POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
        sourceId: POLICY_AUTHORING_CONSTRAINT_SOURCE_IDS.OPERATOR_DECLARED,
        values: ['PG-13'],
        explicitOperatorAction: true,
      },
      {
        controlId: POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.AVOID,
        sourceId: POLICY_AUTHORING_CONSTRAINT_SOURCE_IDS.OPERATOR_DECLARED,
        values: ['R'],
        explicitOperatorAction: true,
      },
      {
        controlId: POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
        sourceId: POLICY_AUTHORING_CONSTRAINT_SOURCE_IDS.OPERATOR_DECLARED,
        values: ['NC-17'],
        commandBoundary: 'raw_bridge_mutation',
        explicitOperatorAction: true,
      },
    ]);

    expect(commandPlan).toEqual(expect.objectContaining({
      commandBoundary: 'typed_draft_commands',
      interactionRuleIds: [
        POLICY_AUTHORING_INTERACTION_RULE_IDS.ADD_VALUES_THROUGH_TYPED_DRAFT_COMMANDS,
        POLICY_AUTHORING_INTERACTION_RULE_IDS.DESTRUCTIVE_OR_BLOCKING_REQUIRES_CONFIRMATION,
      ],
      commandCount: 2,
      commands: [
        expect.objectContaining({
          commandId: POLICY_AUTHORING_CONSTRAINT_COMMAND_IDS.SET_HARD_LIMIT,
          controlId: POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
          values: ['PG-13'],
          certificationSemanticId: POLICY_AUTHORING_CERTIFICATION_SEMANTIC_IDS.MAX_ALLOWED_RATING,
        }),
        expect.objectContaining({
          commandId: POLICY_AUTHORING_CONSTRAINT_COMMAND_IDS.ADD_AVOID_VALUE,
          controlId: POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.AVOID,
          values: ['R'],
          certificationSemanticId: POLICY_AUTHORING_CERTIFICATION_SEMANTIC_IDS.AVOID_RATING,
        }),
      ],
    }));

    expect(commandPlan.rejectedCandidates).toEqual([
      expect.objectContaining({
        controlId: POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
        riskId: POLICY_AUTHORING_CONSTRAINT_RISK_IDS.RAW_BRIDGE_MUTATION,
      }),
    ]);
  });

  test('fails closed for unknown controls, unknown sources, and empty values', () => {
    expect(validatePolicyAuthoringConstraintCandidate({
      controlId: 'unknown',
      sourceId: POLICY_AUTHORING_CONSTRAINT_SOURCE_IDS.OPERATOR_DECLARED,
      values: ['R'],
    })).toEqual(expect.objectContaining({
      valid: false,
      riskId: POLICY_AUTHORING_CONSTRAINT_RISK_IDS.UNKNOWN_CONTROL,
    }));

    expect(validatePolicyAuthoringConstraintCandidate({
      controlId: POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.AVOID,
      sourceId: 'legacy_absence',
      values: ['R'],
      explicitOperatorAction: true,
    })).toEqual(expect.objectContaining({
      valid: false,
      riskId: POLICY_AUTHORING_CONSTRAINT_RISK_IDS.UNKNOWN_SOURCE,
    }));

    expect(validatePolicyAuthoringConstraintCandidate({
      controlId: POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.AVOID,
      sourceId: POLICY_AUTHORING_CONSTRAINT_SOURCE_IDS.OPERATOR_DECLARED,
      values: [],
      explicitOperatorAction: true,
    })).toEqual(expect.objectContaining({
      valid: false,
      riskId: POLICY_AUTHORING_CONSTRAINT_RISK_IDS.MISSING_VALUE,
    }));
  });

  test('summarizes the hard-limit and avoid UX checkpoint', () => {
    expect(summarizePolicyAuthoringConstraints()).toEqual({
      controlCount: 3,
      blockingControlIds: [
        POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
      ],
      advisoryControlIds: [
        POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.AVOID,
        POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.REVIEW_WARNING,
      ],
      explicitOperatorActionControlIds: [
        POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
        POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.AVOID,
      ],
      absenceCanCreateConstraint: false,
      certificationSemanticIds: [
        POLICY_AUTHORING_CERTIFICATION_SEMANTIC_IDS.MAX_ALLOWED_RATING,
        POLICY_AUTHORING_CERTIFICATION_SEMANTIC_IDS.AVOID_RATING,
      ],
      commandBoundary: 'typed_draft_commands',
    });
  });
});
