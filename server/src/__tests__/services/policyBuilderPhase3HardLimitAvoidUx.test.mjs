import {
  POLICY_AUTHORING_COMPONENT_IDS,
  POLICY_AUTHORING_INTERACTION_RULE_IDS,
} from '../../services/policyAuthoringComponentSystem.mjs';
import {
  POLICY_AUTHORING_DESTINATION_QUESTION_IDS,
} from '../../services/policyAuthoringDestinationFlow.mjs';
import {
  PHASE_3R_CERTIFICATION_SEMANTIC_IDS,
  PHASE_3R_CONSTRAINT_COMMAND_IDS,
  PHASE_3R_CONSTRAINT_CONTROL_IDS,
  PHASE_3R_CONSTRAINT_INTENT_IDS,
  PHASE_3R_CONSTRAINT_RISK_IDS,
  PHASE_3R_CONSTRAINT_SOURCE_IDS,
  buildPhase3RConstraintCommandPlan,
  getPhase3RConstraintControlRecord,
  listPhase3RConstraintControlRecords,
  normalizePhase3RConstraintCandidate,
  summarizePhase3RHardLimitAvoidUx,
  validatePhase3RConstraintCandidate,
} from '../../services/policyBuilderPhase3HardLimitAvoidUx.mjs';

describe('policyBuilderPhase3HardLimitAvoidUx', () => {
  test('defines separated hard-limit, avoid, and review-warning controls', () => {
    expect(listPhase3RConstraintControlRecords().map(record => record.controlId)).toEqual([
      PHASE_3R_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
      PHASE_3R_CONSTRAINT_CONTROL_IDS.AVOID,
      PHASE_3R_CONSTRAINT_CONTROL_IDS.REVIEW_WARNING,
    ]);

    expect(getPhase3RConstraintControlRecord(PHASE_3R_CONSTRAINT_CONTROL_IDS.HARD_LIMIT))
      .toEqual(expect.objectContaining({
        componentId: POLICY_AUTHORING_COMPONENT_IDS.HARD_LIMIT_CONTROL,
        questionId: POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_SHOULD_NOT_GO_HERE,
        intentId: PHASE_3R_CONSTRAINT_INTENT_IDS.BLOCKING_CONSTRAINT,
        canBlockRouting: true,
        requiresExplicitOperatorAction: true,
        learnsFromAbsence: false,
        certificationSemanticId: PHASE_3R_CERTIFICATION_SEMANTIC_IDS.MAX_ALLOWED_RATING,
      }));

    expect(getPhase3RConstraintControlRecord(PHASE_3R_CONSTRAINT_CONTROL_IDS.AVOID))
      .toEqual(expect.objectContaining({
        componentId: POLICY_AUTHORING_COMPONENT_IDS.AVOID_CONTROL,
        intentId: PHASE_3R_CONSTRAINT_INTENT_IDS.ADVISORY_AVOID,
        canBlockRouting: false,
        certificationSemanticId: PHASE_3R_CERTIFICATION_SEMANTIC_IDS.AVOID_RATING,
      }));
  });

  test('normalizes hard-limit candidates with max-rating semantics and typed command boundary', () => {
    expect(normalizePhase3RConstraintCandidate({
      controlId: PHASE_3R_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
      sourceId: PHASE_3R_CONSTRAINT_SOURCE_IDS.OPERATOR_DECLARED,
      values: ['PG-13'],
      explicitOperatorAction: true,
    })).toEqual(expect.objectContaining({
      controlId: PHASE_3R_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
      componentId: POLICY_AUTHORING_COMPONENT_IDS.HARD_LIMIT_CONTROL,
      commandId: PHASE_3R_CONSTRAINT_COMMAND_IDS.SET_HARD_LIMIT,
      values: ['PG-13'],
      certificationSemanticId: PHASE_3R_CERTIFICATION_SEMANTIC_IDS.MAX_ALLOWED_RATING,
      canBlockRouting: true,
      commandBoundary: 'typed_draft_commands',
    }));
  });

  test('requires explicit operator action for blocking and avoid controls', () => {
    expect(validatePhase3RConstraintCandidate({
      controlId: PHASE_3R_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
      sourceId: PHASE_3R_CONSTRAINT_SOURCE_IDS.STARTER_TEMPLATE_SUGGESTION,
      values: ['R'],
    })).toEqual(expect.objectContaining({
      valid: false,
      riskId: PHASE_3R_CONSTRAINT_RISK_IDS.MISSING_EXPLICIT_OPERATOR_ACTION,
    }));

    expect(validatePhase3RConstraintCandidate({
      controlId: PHASE_3R_CONSTRAINT_CONTROL_IDS.AVOID,
      sourceId: PHASE_3R_CONSTRAINT_SOURCE_IDS.OPERATOR_DECLARED,
      values: ['NC-17'],
      explicitOperatorAction: true,
    })).toEqual(expect.objectContaining({
      valid: true,
      riskId: null,
    }));
  });

  test('keeps absence-based suggestions as warnings, not automatic exclusions', () => {
    expect(validatePhase3RConstraintCandidate({
      controlId: PHASE_3R_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
      sourceId: PHASE_3R_CONSTRAINT_SOURCE_IDS.OBSERVED_ABSENCE_WARNING,
      values: ['Horror'],
      explicitOperatorAction: true,
      inferredFromAbsence: true,
    })).toEqual(expect.objectContaining({
      valid: false,
      riskId: PHASE_3R_CONSTRAINT_RISK_IDS.ABSENCE_INFERRED_HARD_LIMIT,
    }));

    expect(validatePhase3RConstraintCandidate({
      controlId: PHASE_3R_CONSTRAINT_CONTROL_IDS.AVOID,
      sourceId: PHASE_3R_CONSTRAINT_SOURCE_IDS.OBSERVED_ABSENCE_WARNING,
      values: ['Horror'],
      explicitOperatorAction: true,
      inferredFromAbsence: true,
    })).toEqual(expect.objectContaining({
      valid: false,
      riskId: PHASE_3R_CONSTRAINT_RISK_IDS.ABSENCE_INFERRED_AVOID,
    }));

    expect(validatePhase3RConstraintCandidate({
      controlId: PHASE_3R_CONSTRAINT_CONTROL_IDS.REVIEW_WARNING,
      sourceId: PHASE_3R_CONSTRAINT_SOURCE_IDS.OBSERVED_ABSENCE_WARNING,
      values: ['Horror is not represented in this destination.'],
    })).toEqual(expect.objectContaining({
      valid: true,
      riskId: null,
    }));
  });

  test('requires block examples for observed conflict hard-limit suggestions', () => {
    expect(validatePhase3RConstraintCandidate({
      controlId: PHASE_3R_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
      sourceId: PHASE_3R_CONSTRAINT_SOURCE_IDS.OBSERVED_CONFLICT_EXAMPLE,
      values: ['R'],
      explicitOperatorAction: true,
    })).toEqual(expect.objectContaining({
      valid: false,
      riskId: PHASE_3R_CONSTRAINT_RISK_IDS.MISSING_BLOCK_EXAMPLE,
    }));

    expect(validatePhase3RConstraintCandidate({
      controlId: PHASE_3R_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
      sourceId: PHASE_3R_CONSTRAINT_SOURCE_IDS.OBSERVED_CONFLICT_EXAMPLE,
      values: ['R'],
      explicitOperatorAction: true,
      blockExamples: ['Would block Example Movie (R).'],
    })).toEqual(expect.objectContaining({
      valid: true,
      riskId: null,
    }));
  });

  test('does not conflate max-rating hard limits with avoid-rating controls', () => {
    expect(validatePhase3RConstraintCandidate({
      controlId: PHASE_3R_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
      sourceId: PHASE_3R_CONSTRAINT_SOURCE_IDS.OPERATOR_DECLARED,
      values: ['R'],
      explicitOperatorAction: true,
      certificationSemanticId: PHASE_3R_CERTIFICATION_SEMANTIC_IDS.AVOID_RATING,
    })).toEqual(expect.objectContaining({
      valid: false,
      riskId: PHASE_3R_CONSTRAINT_RISK_IDS.MAX_AND_AVOID_RATING_CONFLATED,
    }));

    expect(validatePhase3RConstraintCandidate({
      controlId: PHASE_3R_CONSTRAINT_CONTROL_IDS.AVOID,
      sourceId: PHASE_3R_CONSTRAINT_SOURCE_IDS.OPERATOR_DECLARED,
      values: ['R'],
      explicitOperatorAction: true,
      certificationSemanticId: PHASE_3R_CERTIFICATION_SEMANTIC_IDS.MAX_ALLOWED_RATING,
    })).toEqual(expect.objectContaining({
      valid: false,
      riskId: PHASE_3R_CONSTRAINT_RISK_IDS.MAX_AND_AVOID_RATING_CONFLATED,
    }));
  });

  test('builds typed command plans and rejects invalid candidates', () => {
    const commandPlan = buildPhase3RConstraintCommandPlan([
      {
        controlId: PHASE_3R_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
        sourceId: PHASE_3R_CONSTRAINT_SOURCE_IDS.OPERATOR_DECLARED,
        values: ['PG-13'],
        explicitOperatorAction: true,
      },
      {
        controlId: PHASE_3R_CONSTRAINT_CONTROL_IDS.AVOID,
        sourceId: PHASE_3R_CONSTRAINT_SOURCE_IDS.OPERATOR_DECLARED,
        values: ['R'],
        explicitOperatorAction: true,
      },
      {
        controlId: PHASE_3R_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
        sourceId: PHASE_3R_CONSTRAINT_SOURCE_IDS.OPERATOR_DECLARED,
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
          commandId: PHASE_3R_CONSTRAINT_COMMAND_IDS.SET_HARD_LIMIT,
          controlId: PHASE_3R_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
          values: ['PG-13'],
          certificationSemanticId: PHASE_3R_CERTIFICATION_SEMANTIC_IDS.MAX_ALLOWED_RATING,
        }),
        expect.objectContaining({
          commandId: PHASE_3R_CONSTRAINT_COMMAND_IDS.ADD_AVOID_VALUE,
          controlId: PHASE_3R_CONSTRAINT_CONTROL_IDS.AVOID,
          values: ['R'],
          certificationSemanticId: PHASE_3R_CERTIFICATION_SEMANTIC_IDS.AVOID_RATING,
        }),
      ],
    }));

    expect(commandPlan.rejectedCandidates).toEqual([
      expect.objectContaining({
        controlId: PHASE_3R_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
        riskId: PHASE_3R_CONSTRAINT_RISK_IDS.RAW_BRIDGE_MUTATION,
      }),
    ]);
  });

  test('fails closed for unknown controls, unknown sources, and empty values', () => {
    expect(validatePhase3RConstraintCandidate({
      controlId: 'unknown',
      sourceId: PHASE_3R_CONSTRAINT_SOURCE_IDS.OPERATOR_DECLARED,
      values: ['R'],
    })).toEqual(expect.objectContaining({
      valid: false,
      riskId: PHASE_3R_CONSTRAINT_RISK_IDS.UNKNOWN_CONTROL,
    }));

    expect(validatePhase3RConstraintCandidate({
      controlId: PHASE_3R_CONSTRAINT_CONTROL_IDS.AVOID,
      sourceId: 'legacy_absence',
      values: ['R'],
      explicitOperatorAction: true,
    })).toEqual(expect.objectContaining({
      valid: false,
      riskId: PHASE_3R_CONSTRAINT_RISK_IDS.UNKNOWN_SOURCE,
    }));

    expect(validatePhase3RConstraintCandidate({
      controlId: PHASE_3R_CONSTRAINT_CONTROL_IDS.AVOID,
      sourceId: PHASE_3R_CONSTRAINT_SOURCE_IDS.OPERATOR_DECLARED,
      values: [],
      explicitOperatorAction: true,
    })).toEqual(expect.objectContaining({
      valid: false,
      riskId: PHASE_3R_CONSTRAINT_RISK_IDS.MISSING_VALUE,
    }));
  });

  test('summarizes the hard-limit and avoid UX checkpoint', () => {
    expect(summarizePhase3RHardLimitAvoidUx()).toEqual({
      controlCount: 3,
      blockingControlIds: [
        PHASE_3R_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
      ],
      advisoryControlIds: [
        PHASE_3R_CONSTRAINT_CONTROL_IDS.AVOID,
        PHASE_3R_CONSTRAINT_CONTROL_IDS.REVIEW_WARNING,
      ],
      explicitOperatorActionControlIds: [
        PHASE_3R_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
        PHASE_3R_CONSTRAINT_CONTROL_IDS.AVOID,
      ],
      absenceCanCreateConstraint: false,
      certificationSemanticIds: [
        PHASE_3R_CERTIFICATION_SEMANTIC_IDS.MAX_ALLOWED_RATING,
        PHASE_3R_CERTIFICATION_SEMANTIC_IDS.AVOID_RATING,
      ],
      commandBoundary: 'typed_draft_commands',
    });
  });
});
