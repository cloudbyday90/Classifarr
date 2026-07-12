import {
  POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS,
  POLICY_AUTHORING_DESTINATION_QUESTION_IDS,
} from '../../services/policyAuthoringDestinationFlow.mjs';
import {
  POLICY_AUTHORING_ACCESSIBILITY_RULE_IDS,
  POLICY_AUTHORING_COMPONENT_DECISION_IDS,
  POLICY_AUTHORING_COMPONENT_IDS,
  POLICY_AUTHORING_COMPONENT_RISK_IDS,
  POLICY_AUTHORING_INTERACTION_RULE_IDS,
  POLICY_AUTHORING_OPTION_SOURCE_IDS,
  POLICY_AUTHORING_PRIMITIVE_IDS,
  getPolicyAuthoringOptionSourceRecord,
  getPolicyAuthoringPrimitiveDecision,
  getPolicyAuthoringTargetComponent,
  listPolicyAuthoringAccessibilityRules,
  listPolicyAuthoringInteractionRules,
  listPolicyAuthoringOptionSourceRecords,
  listPolicyAuthoringPrimitiveDecisions,
  listPolicyAuthoringTargetComponents,
  summarizePolicyAuthoringComponentSystem,
  validatePolicyAuthoringComponentAccessibility,
  validatePolicyAuthoringComponentInteraction,
  validatePolicyAuthoringComponentVocabulary,
  validatePolicyAuthoringOptionSource,
} from '../../services/policyAuthoringComponentSystem.mjs';

describe('policyAuthoringComponentSystem', () => {
  test('defines the policy authoring target component vocabulary', () => {
    expect(listPolicyAuthoringTargetComponents().map(component => component.label)).toEqual([
      'DestinationContextCard',
      'ObservedProfileSummary',
      'IntentSignalPicker',
      'IntentSignalChipList',
      'HardLimitControl',
      'AvoidControl',
      'ReviewTriggerControl',
      'ReadinessNextActionCard',
      'StarterTemplateSuggestion',
    ]);

    expect(getPolicyAuthoringTargetComponent(POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_CONTEXT_CARD))
      .toEqual(expect.objectContaining({
        flowStepId: POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.SELECT_LIBRARY,
        normalPath: true,
        acceptsObservedEvidence: true,
      }));

    expect(getPolicyAuthoringTargetComponent(POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_PICKER))
      .toEqual(expect.objectContaining({
        flowStepId: POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.ACCEPT_OR_EDIT_DECLARED_INTENT,
        questionId: POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_BELONGS_HERE,
        defaultMultiSelect: true,
        commandBoundaryRequired: true,
      }));
  });

  test('classifies current primitive decisions against target components', () => {
    expect(listPolicyAuthoringPrimitiveDecisions().map(decision => decision.primitiveId)).toEqual([
      POLICY_AUTHORING_PRIMITIVE_IDS.MODAL_AND_SECTION_CONTAINER,
      POLICY_AUTHORING_PRIMITIVE_IDS.SUMMARY_AND_READINESS_CARD,
      POLICY_AUTHORING_PRIMITIVE_IDS.WARNING_AND_NEXT_ACTION_MESSAGE,
      POLICY_AUTHORING_PRIMITIVE_IDS.OPTION_SELECT,
      POLICY_AUTHORING_PRIMITIVE_IDS.MULTI_SELECT_AND_CHIP_CONTROL,
      POLICY_AUTHORING_PRIMITIVE_IDS.ACTION_BUTTON,
      POLICY_AUTHORING_PRIMITIVE_IDS.OBSERVED_PROFILE_SUGGESTION_ROW,
      POLICY_AUTHORING_PRIMITIVE_IDS.EMPTY_LOADING_ERROR_STATE,
      POLICY_AUTHORING_PRIMITIVE_IDS.TEMPLATE_DETAIL_AND_MECHANICS_SURFACE,
    ]);

    expect(getPolicyAuthoringPrimitiveDecision(POLICY_AUTHORING_PRIMITIVE_IDS.TEMPLATE_DETAIL_AND_MECHANICS_SURFACE))
      .toEqual(expect.objectContaining({
        decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.DELETE_FROM_NORMAL_PATH,
        normalPath: false,
        targetComponentIds: [
          POLICY_AUTHORING_COMPONENT_IDS.STARTER_TEMPLATE_SUGGESTION,
        ],
      }));
  });

  test('keeps observed option sources as suggestions until explicit acceptance', () => {
    expect(listPolicyAuthoringOptionSourceRecords().map(source => source.id)).toEqual([
      POLICY_AUTHORING_OPTION_SOURCE_IDS.OBSERVED_IN_LIBRARY,
      POLICY_AUTHORING_OPTION_SOURCE_IDS.SUGGESTED_FROM_OBSERVED_PROFILE,
      POLICY_AUTHORING_OPTION_SOURCE_IDS.SUGGESTED_FROM_STARTER_TEMPLATE,
      POLICY_AUTHORING_OPTION_SOURCE_IDS.COMMON_STATIC_OPTION,
      POLICY_AUTHORING_OPTION_SOURCE_IDS.OPERATOR_ADDED_CUSTOM,
      POLICY_AUTHORING_OPTION_SOURCE_IDS.ALREADY_DECLARED,
      POLICY_AUTHORING_OPTION_SOURCE_IDS.UNAVAILABLE_CONFLICTING_INTENT,
    ]);

    for (const source of listPolicyAuthoringOptionSourceRecords()) {
      expect(source.canAutoDeclare).toBe(false);
      expect(validatePolicyAuthoringOptionSource(source.id)).toEqual({
        valid: true,
        riskId: null,
        reason: 'Option source is explicit and cannot auto-declare intent.',
      });
    }

    expect(getPolicyAuthoringOptionSourceRecord(POLICY_AUTHORING_OPTION_SOURCE_IDS.ALREADY_DECLARED))
      .toEqual(expect.objectContaining({
        selectable: false,
        requiresExplanation: true,
      }));
  });

  test('defines interaction rules for typed commands and explained disabled states', () => {
    expect(listPolicyAuthoringInteractionRules().map(rule => rule.id)).toEqual([
      POLICY_AUTHORING_INTERACTION_RULE_IDS.ADD_VALUES_THROUGH_TYPED_DRAFT_COMMANDS,
      POLICY_AUTHORING_INTERACTION_RULE_IDS.REMOVE_VALUES_THROUGH_TYPED_DRAFT_COMMANDS,
      POLICY_AUTHORING_INTERACTION_RULE_IDS.DISABLED_CHOICES_EXPLAIN_REASON,
      POLICY_AUTHORING_INTERACTION_RULE_IDS.DESTRUCTIVE_OR_BLOCKING_REQUIRES_CONFIRMATION,
      POLICY_AUTHORING_INTERACTION_RULE_IDS.READINESS_LINKS_TO_RESOLVING_COMPONENT,
      POLICY_AUTHORING_INTERACTION_RULE_IDS.OBSERVED_VALUES_REQUIRE_EXPLICIT_ACCEPTANCE,
    ]);

    expect(validatePolicyAuthoringComponentInteraction(POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_PICKER))
      .toEqual(expect.objectContaining({
        valid: true,
        riskId: null,
        requiredRuleIds: expect.arrayContaining([
          POLICY_AUTHORING_INTERACTION_RULE_IDS.ADD_VALUES_THROUGH_TYPED_DRAFT_COMMANDS,
          POLICY_AUTHORING_INTERACTION_RULE_IDS.DISABLED_CHOICES_EXPLAIN_REASON,
          POLICY_AUTHORING_INTERACTION_RULE_IDS.OBSERVED_VALUES_REQUIRE_EXPLICIT_ACCEPTANCE,
        ]),
      }));

    expect(validatePolicyAuthoringComponentInteraction(POLICY_AUTHORING_COMPONENT_IDS.READINESS_NEXT_ACTION_CARD))
      .toEqual(expect.objectContaining({
        valid: true,
        requiredRuleIds: [
          POLICY_AUTHORING_INTERACTION_RULE_IDS.READINESS_LINKS_TO_RESOLVING_COMPONENT,
        ],
      }));
  });

  test('defines component-level accessibility requirements', () => {
    expect(listPolicyAuthoringAccessibilityRules().map(rule => rule.id)).toEqual([
      POLICY_AUTHORING_ACCESSIBILITY_RULE_IDS.KEYBOARD_OPERABLE,
      POLICY_AUTHORING_ACCESSIBILITY_RULE_IDS.VISIBLE_LABEL_AND_DESCRIPTION,
      POLICY_AUTHORING_ACCESSIBILITY_RULE_IDS.MULTI_SELECT_STATE_ANNOUNCED,
      POLICY_AUTHORING_ACCESSIBILITY_RULE_IDS.FOCUS_VISIBLE_AND_NOT_OBSCURED,
      POLICY_AUTHORING_ACCESSIBILITY_RULE_IDS.TARGET_SIZE_MINIMUM,
      POLICY_AUTHORING_ACCESSIBILITY_RULE_IDS.ERROR_AND_DISABLED_REASON_PROGRAMMATIC,
    ]);

    expect(validatePolicyAuthoringComponentAccessibility(POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_PICKER))
      .toEqual(expect.objectContaining({
        valid: true,
        riskId: null,
        ruleIds: expect.arrayContaining([
          POLICY_AUTHORING_ACCESSIBILITY_RULE_IDS.KEYBOARD_OPERABLE,
          POLICY_AUTHORING_ACCESSIBILITY_RULE_IDS.VISIBLE_LABEL_AND_DESCRIPTION,
          POLICY_AUTHORING_ACCESSIBILITY_RULE_IDS.MULTI_SELECT_STATE_ANNOUNCED,
          POLICY_AUTHORING_ACCESSIBILITY_RULE_IDS.FOCUS_VISIBLE_AND_NOT_OBSCURED,
          POLICY_AUTHORING_ACCESSIBILITY_RULE_IDS.TARGET_SIZE_MINIMUM,
          POLICY_AUTHORING_ACCESSIBILITY_RULE_IDS.ERROR_AND_DISABLED_REASON_PROGRAMMATIC,
        ]),
      }));
  });

  test('summarizes the component system without retired diagnostic panels', () => {
    expect(summarizePolicyAuthoringComponentSystem()).toEqual({
      targetComponentCount: 9,
      primitiveDecisionCount: 9,
      optionSourceCount: 7,
      interactionRuleCount: 6,
      accessibilityRuleCount: 6,
      normalPathComponentIds: [
        POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_CONTEXT_CARD,
        POLICY_AUTHORING_COMPONENT_IDS.OBSERVED_PROFILE_SUMMARY,
        POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
        POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_CHIP_LIST,
        POLICY_AUTHORING_COMPONENT_IDS.HARD_LIMIT_CONTROL,
        POLICY_AUTHORING_COMPONENT_IDS.AVOID_CONTROL,
        POLICY_AUTHORING_COMPONENT_IDS.REVIEW_TRIGGER_CONTROL,
        POLICY_AUTHORING_COMPONENT_IDS.READINESS_NEXT_ACTION_CARD,
      ],
      supportOnlyComponentIds: [
        POLICY_AUTHORING_COMPONENT_IDS.STARTER_TEMPLATE_SUGGESTION,
      ],
      multiSelectDefaultComponentIds: [
        POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
        POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_CHIP_LIST,
        POLICY_AUTHORING_COMPONENT_IDS.AVOID_CONTROL,
        POLICY_AUTHORING_COMPONENT_IDS.REVIEW_TRIGGER_CONTROL,
      ],
      commandBoundaryComponentIds: [
        POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
        POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_CHIP_LIST,
        POLICY_AUTHORING_COMPONENT_IDS.HARD_LIMIT_CONTROL,
        POLICY_AUTHORING_COMPONENT_IDS.AVOID_CONTROL,
        POLICY_AUTHORING_COMPONENT_IDS.REVIEW_TRIGGER_CONTROL,
        POLICY_AUTHORING_COMPONENT_IDS.STARTER_TEMPLATE_SUGGESTION,
      ],
      observedEvidenceComponentIds: [
        POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_CONTEXT_CARD,
        POLICY_AUTHORING_COMPONENT_IDS.OBSERVED_PROFILE_SUMMARY,
        POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
      ],
    });
  });

  test('fails closed for unknown component, primitive, and option identifiers', () => {
    expect(validatePolicyAuthoringComponentVocabulary([
      POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
      'unknown',
    ])).toEqual({
      valid: false,
      riskId: POLICY_AUTHORING_COMPONENT_RISK_IDS.UNKNOWN_COMPONENT,
      unknownComponentIds: ['unknown'],
    });
    expect(getPolicyAuthoringTargetComponent('unknown')).toBeNull();
    expect(getPolicyAuthoringPrimitiveDecision('unknown')).toBeNull();
    expect(getPolicyAuthoringOptionSourceRecord('unknown')).toBeNull();
    expect(validatePolicyAuthoringOptionSource('unknown')).toEqual({
      valid: false,
      riskId: POLICY_AUTHORING_COMPONENT_RISK_IDS.UNKNOWN_OPTION_SOURCE,
      reason: 'Unknown policy authoring option source.',
    });
  });

  test('exposes immutable records', () => {
    const components = listPolicyAuthoringTargetComponents();
    const decisions = listPolicyAuthoringPrimitiveDecisions();

    expect(Object.isFrozen(components)).toBe(true);
    expect(Object.isFrozen(components[0])).toBe(true);
    expect(Object.isFrozen(decisions[0].targetComponentIds)).toBe(true);
  });
});
