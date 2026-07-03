import {
  POLICY_AUTHORING_WORKFLOW_ROLE_IDS,
} from '../../services/policyAuthoringWorkflowInventory.mjs';
import {
  PHASE_3R_DESTINATION_EMPTY_STATE_IDS,
  PHASE_3R_DESTINATION_FLOW_STEP_IDS,
  PHASE_3R_DESTINATION_FORBIDDEN_MECHANIC_IDS,
  PHASE_3R_DESTINATION_NEXT_ACTION_IDS,
  PHASE_3R_DESTINATION_QUESTION_IDS,
  PHASE_3R_DESTINATION_RISK_IDS,
  getPhase3RDestinationEmptyState,
  getPhase3RDestinationFlowStep,
  getPhase3RDestinationQuestion,
  listPhase3RDestinationEmptyStates,
  listPhase3RDestinationFlowSteps,
  listPhase3RDestinationForbiddenMechanics,
  listPhase3RDestinationQuestions,
  summarizePhase3RDestinationFirstFlow,
  validatePhase3RDestinationFlowSequence,
  validatePhase3REmptyStateNextAction,
  validatePhase3RForbiddenMechanic,
  validatePhase3RStarterTemplatePlacement,
} from '../../services/policyBuilderPhase3DestinationFirstFlow.mjs';

describe('policyBuilderPhase3DestinationFirstFlow', () => {
  test('defines the ordered Phase 3R.2 destination-first workflow', () => {
    expect(listPhase3RDestinationFlowSteps().map(step => step.id)).toEqual([
      PHASE_3R_DESTINATION_FLOW_STEP_IDS.SELECT_LIBRARY,
      PHASE_3R_DESTINATION_FLOW_STEP_IDS.REVIEW_OBSERVED_DESTINATION,
      PHASE_3R_DESTINATION_FLOW_STEP_IDS.ACCEPT_OR_EDIT_DECLARED_INTENT,
      PHASE_3R_DESTINATION_FLOW_STEP_IDS.CONFIRM_HARD_LIMITS,
      PHASE_3R_DESTINATION_FLOW_STEP_IDS.CONFIRM_ROUTING_READINESS,
      PHASE_3R_DESTINATION_FLOW_STEP_IDS.SAVE_OR_DEFER,
    ]);

    expect(listPhase3RDestinationFlowSteps().map(step => step.order)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(getPhase3RDestinationFlowStep(PHASE_3R_DESTINATION_FLOW_STEP_IDS.REVIEW_OBSERVED_DESTINATION))
      .toEqual(expect.objectContaining({
        roleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.DESTINATION_CONTEXT,
        primaryQuestionId: PHASE_3R_DESTINATION_QUESTION_IDS.WHAT_BELONGS_HERE,
        allowsStarterTemplates: false,
        allowsAdvancedMechanics: false,
      }));
  });

  test('validates required workflow steps and order', () => {
    const orderedStepIds = listPhase3RDestinationFlowSteps().map(step => step.id);

    expect(validatePhase3RDestinationFlowSequence(orderedStepIds)).toEqual({
      valid: true,
      riskId: null,
      missingStepIds: [],
      unknownStepIds: [],
      reason: 'Destination-first flow sequence matches the Phase 3R.2 contract.',
    });

    expect(validatePhase3RDestinationFlowSequence(orderedStepIds.slice(1))).toEqual(expect.objectContaining({
      valid: false,
      riskId: PHASE_3R_DESTINATION_RISK_IDS.MISSING_STEP,
      missingStepIds: [
        PHASE_3R_DESTINATION_FLOW_STEP_IDS.SELECT_LIBRARY,
      ],
    }));

    expect(validatePhase3RDestinationFlowSequence([
      PHASE_3R_DESTINATION_FLOW_STEP_IDS.REVIEW_OBSERVED_DESTINATION,
      PHASE_3R_DESTINATION_FLOW_STEP_IDS.SELECT_LIBRARY,
      PHASE_3R_DESTINATION_FLOW_STEP_IDS.ACCEPT_OR_EDIT_DECLARED_INTENT,
      PHASE_3R_DESTINATION_FLOW_STEP_IDS.CONFIRM_HARD_LIMITS,
      PHASE_3R_DESTINATION_FLOW_STEP_IDS.CONFIRM_ROUTING_READINESS,
      PHASE_3R_DESTINATION_FLOW_STEP_IDS.SAVE_OR_DEFER,
    ])).toEqual(expect.objectContaining({
      valid: false,
      riskId: PHASE_3R_DESTINATION_RISK_IDS.WRONG_STEP_ORDER,
    }));
  });

  test('defines destination questions that replace generic policy mechanics', () => {
    expect(listPhase3RDestinationQuestions().map(question => question.label)).toEqual([
      'What belongs here?',
      'What should not go here?',
      'What helps but should not decide alone?',
      'When should Classifarr ask?',
      'Can this route?',
    ]);

    expect(getPhase3RDestinationQuestion(PHASE_3R_DESTINATION_QUESTION_IDS.WHAT_BELONGS_HERE))
      .toEqual(expect.objectContaining({
        intentField: 'belongs_here',
        acceptsObservedEvidence: true,
        requiresExplicitAcceptance: true,
      }));

    expect(getPhase3RDestinationQuestion(PHASE_3R_DESTINATION_QUESTION_IDS.CAN_THIS_ROUTE))
      .toEqual(expect.objectContaining({
        intentField: 'routing_readiness',
        requiresExplicitAcceptance: false,
      }));
  });

  test('keeps starter templates behind destination context', () => {
    expect(validatePhase3RStarterTemplatePlacement(
      PHASE_3R_DESTINATION_FLOW_STEP_IDS.ACCEPT_OR_EDIT_DECLARED_INTENT
    )).toEqual({
      valid: true,
      riskId: null,
      reason: 'Starter-template placement stays behind destination context.',
    });

    expect(listPhase3RDestinationFlowSteps()
      .filter(step => step.allowsStarterTemplates)
      .map(step => step.id)).toEqual([
      PHASE_3R_DESTINATION_FLOW_STEP_IDS.ACCEPT_OR_EDIT_DECLARED_INTENT,
    ]);

    expect(validatePhase3RStarterTemplatePlacement('unknown')).toEqual({
      valid: false,
      riskId: PHASE_3R_DESTINATION_RISK_IDS.UNKNOWN_FLOW_ARTIFACT,
      reason: 'Unknown destination-first flow step.',
    });
  });

  test('defines empty states with operator next actions instead of internals', () => {
    expect(listPhase3RDestinationEmptyStates()).toEqual([
      expect.objectContaining({
        id: PHASE_3R_DESTINATION_EMPTY_STATE_IDS.NEW_LIBRARY,
        nextActionId: PHASE_3R_DESTINATION_NEXT_ACTION_IDS.SYNC_MEDIA_SERVER_LIBRARY,
        internalDetailsAllowed: false,
      }),
      expect.objectContaining({
        id: PHASE_3R_DESTINATION_EMPTY_STATE_IDS.SPARSE_LIBRARY,
        nextActionId: PHASE_3R_DESTINATION_NEXT_ACTION_IDS.ADD_DECLARED_INTENT,
        internalDetailsAllowed: false,
      }),
      expect.objectContaining({
        id: PHASE_3R_DESTINATION_EMPTY_STATE_IDS.UNMAPPED_LIBRARY,
        nextActionId: PHASE_3R_DESTINATION_NEXT_ACTION_IDS.MAP_ROUTING_DESTINATION,
        internalDetailsAllowed: false,
      }),
    ]);

    for (const emptyState of listPhase3RDestinationEmptyStates()) {
      expect(validatePhase3REmptyStateNextAction(emptyState.id)).toEqual({
        valid: true,
        riskId: null,
        reason: 'Empty state has a bounded operator next action.',
      });
    }

    expect(getPhase3RDestinationEmptyState(PHASE_3R_DESTINATION_EMPTY_STATE_IDS.UNMAPPED_LIBRARY))
      .toEqual(expect.objectContaining({
        label: 'Unmapped library',
        nextActionId: PHASE_3R_DESTINATION_NEXT_ACTION_IDS.MAP_ROUTING_DESTINATION,
      }));
  });

  test('declares normal-flow forbidden mechanics', () => {
    expect(listPhase3RDestinationForbiddenMechanics().map(mechanic => mechanic.id)).toEqual([
      PHASE_3R_DESTINATION_FORBIDDEN_MECHANIC_IDS.STARTER_TEMPLATE_FIRST,
      PHASE_3R_DESTINATION_FORBIDDEN_MECHANIC_IDS.RAW_SCORING_WEIGHTS,
      PHASE_3R_DESTINATION_FORBIDDEN_MECHANIC_IDS.REPLAY_OR_PROVIDER_DIAGNOSTICS,
      PHASE_3R_DESTINATION_FORBIDDEN_MECHANIC_IDS.LEGACY_PRESET_INTERNALS,
      PHASE_3R_DESTINATION_FORBIDDEN_MECHANIC_IDS.RAW_BRIDGE_STORAGE,
    ]);

    expect(validatePhase3RForbiddenMechanic(PHASE_3R_DESTINATION_FORBIDDEN_MECHANIC_IDS.RAW_SCORING_WEIGHTS))
      .toEqual({
        valid: false,
        riskId: PHASE_3R_DESTINATION_RISK_IDS.INTERNAL_MECHANIC_IN_NORMAL_FLOW,
        reason: 'Raw scoring weights make operators tune internals instead of declaring destination intent.',
      });
  });

  test('summarizes the destination-first contract without advanced mechanics', () => {
    expect(summarizePhase3RDestinationFirstFlow()).toEqual({
      stepCount: 6,
      questionCount: 5,
      emptyStateCount: 3,
      forbiddenMechanicCount: 5,
      stepIds: [
        PHASE_3R_DESTINATION_FLOW_STEP_IDS.SELECT_LIBRARY,
        PHASE_3R_DESTINATION_FLOW_STEP_IDS.REVIEW_OBSERVED_DESTINATION,
        PHASE_3R_DESTINATION_FLOW_STEP_IDS.ACCEPT_OR_EDIT_DECLARED_INTENT,
        PHASE_3R_DESTINATION_FLOW_STEP_IDS.CONFIRM_HARD_LIMITS,
        PHASE_3R_DESTINATION_FLOW_STEP_IDS.CONFIRM_ROUTING_READINESS,
        PHASE_3R_DESTINATION_FLOW_STEP_IDS.SAVE_OR_DEFER,
      ],
      questionIds: [
        PHASE_3R_DESTINATION_QUESTION_IDS.WHAT_BELONGS_HERE,
        PHASE_3R_DESTINATION_QUESTION_IDS.WHAT_SHOULD_NOT_GO_HERE,
        PHASE_3R_DESTINATION_QUESTION_IDS.WHAT_HELPS_BUT_DOES_NOT_DECIDE,
        PHASE_3R_DESTINATION_QUESTION_IDS.WHEN_SHOULD_CLASSIFARR_ASK,
        PHASE_3R_DESTINATION_QUESTION_IDS.CAN_THIS_ROUTE,
      ],
      emptyStateIds: [
        PHASE_3R_DESTINATION_EMPTY_STATE_IDS.NEW_LIBRARY,
        PHASE_3R_DESTINATION_EMPTY_STATE_IDS.SPARSE_LIBRARY,
        PHASE_3R_DESTINATION_EMPTY_STATE_IDS.UNMAPPED_LIBRARY,
      ],
      forbiddenMechanicIds: [
        PHASE_3R_DESTINATION_FORBIDDEN_MECHANIC_IDS.STARTER_TEMPLATE_FIRST,
        PHASE_3R_DESTINATION_FORBIDDEN_MECHANIC_IDS.RAW_SCORING_WEIGHTS,
        PHASE_3R_DESTINATION_FORBIDDEN_MECHANIC_IDS.REPLAY_OR_PROVIDER_DIAGNOSTICS,
        PHASE_3R_DESTINATION_FORBIDDEN_MECHANIC_IDS.LEGACY_PRESET_INTERNALS,
        PHASE_3R_DESTINATION_FORBIDDEN_MECHANIC_IDS.RAW_BRIDGE_STORAGE,
      ],
      templateStepIds: [
        PHASE_3R_DESTINATION_FLOW_STEP_IDS.ACCEPT_OR_EDIT_DECLARED_INTENT,
      ],
      advancedMechanicStepIds: [],
      destinationContextBeforeTemplates: true,
      normalFlowExposesAdvancedMechanics: false,
    });
  });

  test('returns null or failed validation for unknown flow artifacts', () => {
    expect(getPhase3RDestinationFlowStep('unknown')).toBeNull();
    expect(getPhase3RDestinationQuestion('unknown')).toBeNull();
    expect(getPhase3RDestinationEmptyState('unknown')).toBeNull();
    expect(validatePhase3REmptyStateNextAction('unknown')).toEqual({
      valid: false,
      riskId: PHASE_3R_DESTINATION_RISK_IDS.UNKNOWN_FLOW_ARTIFACT,
      reason: 'Unknown destination-first empty state.',
    });
    expect(validatePhase3RForbiddenMechanic('unknown')).toEqual({
      valid: false,
      riskId: PHASE_3R_DESTINATION_RISK_IDS.UNKNOWN_FLOW_ARTIFACT,
      reason: 'Unknown destination-first forbidden mechanic.',
    });
  });

  test('exposes immutable flow records', () => {
    const steps = listPhase3RDestinationFlowSteps();
    const questions = listPhase3RDestinationQuestions();

    expect(Object.isFrozen(steps)).toBe(true);
    expect(Object.isFrozen(steps[0])).toBe(true);
    expect(Object.isFrozen(steps[0].requiredNextActionIds)).toBe(true);
    expect(Object.isFrozen(questions[0])).toBe(true);
  });
});
