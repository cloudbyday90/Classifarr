import {
  POLICY_AUTHORING_WORKFLOW_ROLE_IDS,
} from '../../services/policyAuthoringWorkflowInventory.mjs';
import {
  POLICY_AUTHORING_DESTINATION_EMPTY_STATE_IDS,
  POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS,
  POLICY_AUTHORING_DESTINATION_FORBIDDEN_MECHANIC_IDS,
  POLICY_AUTHORING_DESTINATION_NEXT_ACTION_IDS,
  POLICY_AUTHORING_DESTINATION_QUESTION_IDS,
  POLICY_AUTHORING_DESTINATION_RISK_IDS,
  getPolicyAuthoringDestinationEmptyState,
  getPolicyAuthoringDestinationFlowStep,
  getPolicyAuthoringDestinationQuestion,
  listPolicyAuthoringDestinationEmptyStates,
  listPolicyAuthoringDestinationFlowSteps,
  listPolicyAuthoringDestinationForbiddenMechanics,
  listPolicyAuthoringDestinationQuestions,
  summarizePolicyAuthoringDestinationFlow,
  validatePolicyAuthoringDestinationFlowSequence,
  validatePolicyAuthoringEmptyStateNextAction,
  validatePolicyAuthoringForbiddenMechanic,
  validatePolicyAuthoringStarterTemplatePlacement,
} from '../../services/policyAuthoringDestinationFlow.mjs';

describe('policyAuthoringDestinationFlow', () => {
  test('defines the ordered policy-authoring destination workflow', () => {
    expect(listPolicyAuthoringDestinationFlowSteps().map(step => step.id)).toEqual([
      POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.SELECT_LIBRARY,
      POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.REVIEW_OBSERVED_DESTINATION,
      POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.ACCEPT_OR_EDIT_DECLARED_INTENT,
      POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.CONFIRM_HARD_LIMITS,
      POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.CONFIRM_ROUTING_READINESS,
      POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.SAVE_OR_DEFER,
    ]);

    expect(listPolicyAuthoringDestinationFlowSteps().map(step => step.order)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(getPolicyAuthoringDestinationFlowStep(POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.REVIEW_OBSERVED_DESTINATION))
      .toEqual(expect.objectContaining({
        roleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.DESTINATION_CONTEXT,
        primaryQuestionId: POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_BELONGS_HERE,
        requiredNextActionIds: expect.arrayContaining([
          POLICY_AUTHORING_DESTINATION_NEXT_ACTION_IDS.AWAIT_AUTOMATIC_PROFILE_RECOVERY,
        ]),
        allowsStarterTemplates: false,
        allowsAdvancedMechanics: false,
      }));
  });

  test('validates required workflow steps and order', () => {
    const orderedStepIds = listPolicyAuthoringDestinationFlowSteps().map(step => step.id);

    expect(validatePolicyAuthoringDestinationFlowSequence(orderedStepIds)).toEqual({
      valid: true,
      riskId: null,
      missingStepIds: [],
      unknownStepIds: [],
      reason: 'Destination-first flow sequence matches the policy-authoring destination-flow contract.',
    });

    expect(validatePolicyAuthoringDestinationFlowSequence(orderedStepIds.slice(1))).toEqual(expect.objectContaining({
      valid: false,
      riskId: POLICY_AUTHORING_DESTINATION_RISK_IDS.MISSING_STEP,
      missingStepIds: [
        POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.SELECT_LIBRARY,
      ],
    }));

    expect(validatePolicyAuthoringDestinationFlowSequence([
      POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.REVIEW_OBSERVED_DESTINATION,
      POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.SELECT_LIBRARY,
      POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.ACCEPT_OR_EDIT_DECLARED_INTENT,
      POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.CONFIRM_HARD_LIMITS,
      POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.CONFIRM_ROUTING_READINESS,
      POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.SAVE_OR_DEFER,
    ])).toEqual(expect.objectContaining({
      valid: false,
      riskId: POLICY_AUTHORING_DESTINATION_RISK_IDS.WRONG_STEP_ORDER,
    }));
  });

  test('defines destination questions that replace generic policy mechanics', () => {
    expect(listPolicyAuthoringDestinationQuestions().map(question => question.label)).toEqual([
      'What belongs here?',
      'What should not go here?',
      'What helps but should not decide alone?',
      'When should Classifarr ask?',
      'Can this route?',
    ]);

    expect(getPolicyAuthoringDestinationQuestion(POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_BELONGS_HERE))
      .toEqual(expect.objectContaining({
        intentField: 'belongs_here',
        acceptsObservedEvidence: true,
        requiresExplicitAcceptance: true,
      }));

    expect(getPolicyAuthoringDestinationQuestion(POLICY_AUTHORING_DESTINATION_QUESTION_IDS.CAN_THIS_ROUTE))
      .toEqual(expect.objectContaining({
        intentField: 'routing_readiness',
        requiresExplicitAcceptance: false,
      }));
  });

  test('keeps starter templates behind destination context', () => {
    expect(validatePolicyAuthoringStarterTemplatePlacement(
      POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.ACCEPT_OR_EDIT_DECLARED_INTENT
    )).toEqual({
      valid: true,
      riskId: null,
      reason: 'Starter-template placement stays behind destination context.',
    });

    expect(listPolicyAuthoringDestinationFlowSteps()
      .filter(step => step.allowsStarterTemplates)
      .map(step => step.id)).toEqual([
      POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.ACCEPT_OR_EDIT_DECLARED_INTENT,
    ]);

    expect(validatePolicyAuthoringStarterTemplatePlacement('unknown')).toEqual({
      valid: false,
      riskId: POLICY_AUTHORING_DESTINATION_RISK_IDS.UNKNOWN_FLOW_ARTIFACT,
      reason: 'Unknown destination-first flow step.',
    });
  });

  test('defines empty states with operator next actions instead of internals', () => {
    expect(listPolicyAuthoringDestinationEmptyStates()).toEqual([
      expect.objectContaining({
        id: POLICY_AUTHORING_DESTINATION_EMPTY_STATE_IDS.NEW_LIBRARY,
        nextActionId: POLICY_AUTHORING_DESTINATION_NEXT_ACTION_IDS.ADD_DECLARED_INTENT,
        internalDetailsAllowed: false,
      }),
      expect.objectContaining({
        id: POLICY_AUTHORING_DESTINATION_EMPTY_STATE_IDS.SPARSE_LIBRARY,
        nextActionId: POLICY_AUTHORING_DESTINATION_NEXT_ACTION_IDS.ADD_DECLARED_INTENT,
        internalDetailsAllowed: false,
      }),
      expect.objectContaining({
        id: POLICY_AUTHORING_DESTINATION_EMPTY_STATE_IDS.UNMAPPED_LIBRARY,
        nextActionId: POLICY_AUTHORING_DESTINATION_NEXT_ACTION_IDS.MAP_ROUTING_DESTINATION,
        internalDetailsAllowed: false,
      }),
    ]);

    for (const emptyState of listPolicyAuthoringDestinationEmptyStates()) {
      expect(validatePolicyAuthoringEmptyStateNextAction(emptyState.id)).toEqual({
        valid: true,
        riskId: null,
        reason: 'Empty state has a bounded operator next action.',
      });
    }

    expect(getPolicyAuthoringDestinationEmptyState(POLICY_AUTHORING_DESTINATION_EMPTY_STATE_IDS.UNMAPPED_LIBRARY))
      .toEqual(expect.objectContaining({
        label: 'Unmapped library',
        nextActionId: POLICY_AUTHORING_DESTINATION_NEXT_ACTION_IDS.MAP_ROUTING_DESTINATION,
      }));
  });

  test('declares normal-flow forbidden mechanics', () => {
    expect(listPolicyAuthoringDestinationForbiddenMechanics().map(mechanic => mechanic.id)).toEqual([
      POLICY_AUTHORING_DESTINATION_FORBIDDEN_MECHANIC_IDS.STARTER_TEMPLATE_FIRST,
      POLICY_AUTHORING_DESTINATION_FORBIDDEN_MECHANIC_IDS.RAW_SCORING_WEIGHTS,
      POLICY_AUTHORING_DESTINATION_FORBIDDEN_MECHANIC_IDS.REPLAY_OR_PROVIDER_DIAGNOSTICS,
      POLICY_AUTHORING_DESTINATION_FORBIDDEN_MECHANIC_IDS.LEGACY_PRESET_INTERNALS,
      POLICY_AUTHORING_DESTINATION_FORBIDDEN_MECHANIC_IDS.RAW_BRIDGE_STORAGE,
    ]);

    expect(validatePolicyAuthoringForbiddenMechanic(POLICY_AUTHORING_DESTINATION_FORBIDDEN_MECHANIC_IDS.RAW_SCORING_WEIGHTS))
      .toEqual({
        valid: false,
        riskId: POLICY_AUTHORING_DESTINATION_RISK_IDS.INTERNAL_MECHANIC_IN_NORMAL_FLOW,
        reason: 'Raw scoring weights make operators tune internals instead of declaring destination intent.',
      });
  });

  test('summarizes the destination-first contract without advanced mechanics', () => {
    expect(summarizePolicyAuthoringDestinationFlow()).toEqual({
      stepCount: 6,
      questionCount: 5,
      emptyStateCount: 3,
      forbiddenMechanicCount: 5,
      stepIds: [
        POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.SELECT_LIBRARY,
        POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.REVIEW_OBSERVED_DESTINATION,
        POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.ACCEPT_OR_EDIT_DECLARED_INTENT,
        POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.CONFIRM_HARD_LIMITS,
        POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.CONFIRM_ROUTING_READINESS,
        POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.SAVE_OR_DEFER,
      ],
      questionIds: [
        POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_BELONGS_HERE,
        POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_SHOULD_NOT_GO_HERE,
        POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_HELPS_BUT_DOES_NOT_DECIDE,
        POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHEN_SHOULD_CLASSIFARR_ASK,
        POLICY_AUTHORING_DESTINATION_QUESTION_IDS.CAN_THIS_ROUTE,
      ],
      emptyStateIds: [
        POLICY_AUTHORING_DESTINATION_EMPTY_STATE_IDS.NEW_LIBRARY,
        POLICY_AUTHORING_DESTINATION_EMPTY_STATE_IDS.SPARSE_LIBRARY,
        POLICY_AUTHORING_DESTINATION_EMPTY_STATE_IDS.UNMAPPED_LIBRARY,
      ],
      forbiddenMechanicIds: [
        POLICY_AUTHORING_DESTINATION_FORBIDDEN_MECHANIC_IDS.STARTER_TEMPLATE_FIRST,
        POLICY_AUTHORING_DESTINATION_FORBIDDEN_MECHANIC_IDS.RAW_SCORING_WEIGHTS,
        POLICY_AUTHORING_DESTINATION_FORBIDDEN_MECHANIC_IDS.REPLAY_OR_PROVIDER_DIAGNOSTICS,
        POLICY_AUTHORING_DESTINATION_FORBIDDEN_MECHANIC_IDS.LEGACY_PRESET_INTERNALS,
        POLICY_AUTHORING_DESTINATION_FORBIDDEN_MECHANIC_IDS.RAW_BRIDGE_STORAGE,
      ],
      templateStepIds: [
        POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.ACCEPT_OR_EDIT_DECLARED_INTENT,
      ],
      advancedMechanicStepIds: [],
      destinationContextBeforeTemplates: true,
      normalFlowExposesAdvancedMechanics: false,
    });
  });

  test('returns null or failed validation for unknown flow artifacts', () => {
    expect(getPolicyAuthoringDestinationFlowStep('unknown')).toBeNull();
    expect(getPolicyAuthoringDestinationQuestion('unknown')).toBeNull();
    expect(getPolicyAuthoringDestinationEmptyState('unknown')).toBeNull();
    expect(validatePolicyAuthoringEmptyStateNextAction('unknown')).toEqual({
      valid: false,
      riskId: POLICY_AUTHORING_DESTINATION_RISK_IDS.UNKNOWN_FLOW_ARTIFACT,
      reason: 'Unknown destination-first empty state.',
    });
    expect(validatePolicyAuthoringForbiddenMechanic('unknown')).toEqual({
      valid: false,
      riskId: POLICY_AUTHORING_DESTINATION_RISK_IDS.UNKNOWN_FLOW_ARTIFACT,
      reason: 'Unknown destination-first forbidden mechanic.',
    });
  });

  test('exposes immutable flow records', () => {
    const steps = listPolicyAuthoringDestinationFlowSteps();
    const questions = listPolicyAuthoringDestinationQuestions();

    expect(Object.isFrozen(steps)).toBe(true);
    expect(Object.isFrozen(steps[0])).toBe(true);
    expect(Object.isFrozen(steps[0].requiredNextActionIds)).toBe(true);
    expect(Object.isFrozen(questions[0])).toBe(true);
  });
});
