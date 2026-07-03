import {
  POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS,
  POLICY_AUTHORING_DESTINATION_QUESTION_IDS,
} from '../../services/policyAuthoringDestinationFlow.mjs';
import {
  PHASE_3R_ACCESSIBILITY_RULE_IDS,
  PHASE_3R_COMPONENT_DECISION_IDS,
  PHASE_3R_COMPONENT_IDS,
  PHASE_3R_COMPONENT_RISK_IDS,
  PHASE_3R_INTERACTION_RULE_IDS,
  PHASE_3R_OPTION_SOURCE_IDS,
  PHASE_3R_PRIMITIVE_IDS,
  getPhase3ROptionSourceRecord,
  getPhase3RPrimitiveDecision,
  getPhase3RTargetComponent,
  listPhase3RAccessibilityRules,
  listPhase3RInteractionRules,
  listPhase3ROptionSourceRecords,
  listPhase3RPrimitiveDecisions,
  listPhase3RTargetComponents,
  summarizePhase3RComponentSystem,
  validatePhase3RComponentAccessibility,
  validatePhase3RComponentInteraction,
  validatePhase3RComponentVocabulary,
  validatePhase3ROptionSource,
} from '../../services/policyBuilderPhase3ComponentSystem.mjs';

describe('policyBuilderPhase3ComponentSystem', () => {
  test('defines the Phase 3R.3 target component vocabulary', () => {
    expect(listPhase3RTargetComponents().map(component => component.label)).toEqual([
      'DestinationContextCard',
      'ObservedProfileSummary',
      'IntentSignalPicker',
      'IntentSignalChipList',
      'HardLimitControl',
      'AvoidControl',
      'ReviewTriggerControl',
      'ReadinessNextActionCard',
      'StarterTemplateSuggestion',
      'MigrationVerifierPanel',
    ]);

    expect(getPhase3RTargetComponent(PHASE_3R_COMPONENT_IDS.DESTINATION_CONTEXT_CARD))
      .toEqual(expect.objectContaining({
        flowStepId: POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.SELECT_LIBRARY,
        normalPath: true,
        acceptsObservedEvidence: true,
      }));

    expect(getPhase3RTargetComponent(PHASE_3R_COMPONENT_IDS.INTENT_SIGNAL_PICKER))
      .toEqual(expect.objectContaining({
        flowStepId: POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.ACCEPT_OR_EDIT_DECLARED_INTENT,
        questionId: POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_BELONGS_HERE,
        defaultMultiSelect: true,
        commandBoundaryRequired: true,
      }));
  });

  test('classifies current primitive decisions against target components', () => {
    expect(listPhase3RPrimitiveDecisions().map(decision => decision.primitiveId)).toEqual([
      PHASE_3R_PRIMITIVE_IDS.MODAL_AND_SECTION_CONTAINER,
      PHASE_3R_PRIMITIVE_IDS.SUMMARY_AND_READINESS_CARD,
      PHASE_3R_PRIMITIVE_IDS.WARNING_AND_NEXT_ACTION_MESSAGE,
      PHASE_3R_PRIMITIVE_IDS.OPTION_SELECT,
      PHASE_3R_PRIMITIVE_IDS.MULTI_SELECT_AND_CHIP_CONTROL,
      PHASE_3R_PRIMITIVE_IDS.ACTION_BUTTON,
      PHASE_3R_PRIMITIVE_IDS.OBSERVED_PROFILE_SUGGESTION_ROW,
      PHASE_3R_PRIMITIVE_IDS.EMPTY_LOADING_ERROR_STATE,
      PHASE_3R_PRIMITIVE_IDS.TEMPLATE_DETAIL_AND_MECHANICS_SURFACE,
    ]);

    expect(getPhase3RPrimitiveDecision(PHASE_3R_PRIMITIVE_IDS.TEMPLATE_DETAIL_AND_MECHANICS_SURFACE))
      .toEqual(expect.objectContaining({
        decisionId: PHASE_3R_COMPONENT_DECISION_IDS.DELETE_FROM_NORMAL_PATH,
        normalPath: false,
        targetComponentIds: [
          PHASE_3R_COMPONENT_IDS.STARTER_TEMPLATE_SUGGESTION,
          PHASE_3R_COMPONENT_IDS.MIGRATION_VERIFIER_PANEL,
        ],
      }));
  });

  test('keeps observed option sources as suggestions until explicit acceptance', () => {
    expect(listPhase3ROptionSourceRecords().map(source => source.id)).toEqual([
      PHASE_3R_OPTION_SOURCE_IDS.OBSERVED_IN_LIBRARY,
      PHASE_3R_OPTION_SOURCE_IDS.SUGGESTED_FROM_OBSERVED_PROFILE,
      PHASE_3R_OPTION_SOURCE_IDS.SUGGESTED_FROM_STARTER_TEMPLATE,
      PHASE_3R_OPTION_SOURCE_IDS.COMMON_STATIC_OPTION,
      PHASE_3R_OPTION_SOURCE_IDS.OPERATOR_ADDED_CUSTOM,
      PHASE_3R_OPTION_SOURCE_IDS.ALREADY_DECLARED,
      PHASE_3R_OPTION_SOURCE_IDS.UNAVAILABLE_CONFLICTING_INTENT,
    ]);

    for (const source of listPhase3ROptionSourceRecords()) {
      expect(source.canAutoDeclare).toBe(false);
      expect(validatePhase3ROptionSource(source.id)).toEqual({
        valid: true,
        riskId: null,
        reason: 'Option source is explicit and cannot auto-declare intent.',
      });
    }

    expect(getPhase3ROptionSourceRecord(PHASE_3R_OPTION_SOURCE_IDS.ALREADY_DECLARED))
      .toEqual(expect.objectContaining({
        selectable: false,
        requiresExplanation: true,
      }));
  });

  test('defines interaction rules for typed commands and explained disabled states', () => {
    expect(listPhase3RInteractionRules().map(rule => rule.id)).toEqual([
      PHASE_3R_INTERACTION_RULE_IDS.ADD_VALUES_THROUGH_TYPED_DRAFT_COMMANDS,
      PHASE_3R_INTERACTION_RULE_IDS.REMOVE_VALUES_THROUGH_TYPED_DRAFT_COMMANDS,
      PHASE_3R_INTERACTION_RULE_IDS.DISABLED_CHOICES_EXPLAIN_REASON,
      PHASE_3R_INTERACTION_RULE_IDS.DESTRUCTIVE_OR_BLOCKING_REQUIRES_CONFIRMATION,
      PHASE_3R_INTERACTION_RULE_IDS.READINESS_LINKS_TO_RESOLVING_COMPONENT,
      PHASE_3R_INTERACTION_RULE_IDS.OBSERVED_VALUES_REQUIRE_EXPLICIT_ACCEPTANCE,
    ]);

    expect(validatePhase3RComponentInteraction(PHASE_3R_COMPONENT_IDS.INTENT_SIGNAL_PICKER))
      .toEqual(expect.objectContaining({
        valid: true,
        riskId: null,
        requiredRuleIds: expect.arrayContaining([
          PHASE_3R_INTERACTION_RULE_IDS.ADD_VALUES_THROUGH_TYPED_DRAFT_COMMANDS,
          PHASE_3R_INTERACTION_RULE_IDS.DISABLED_CHOICES_EXPLAIN_REASON,
          PHASE_3R_INTERACTION_RULE_IDS.OBSERVED_VALUES_REQUIRE_EXPLICIT_ACCEPTANCE,
        ]),
      }));

    expect(validatePhase3RComponentInteraction(PHASE_3R_COMPONENT_IDS.READINESS_NEXT_ACTION_CARD))
      .toEqual(expect.objectContaining({
        valid: true,
        requiredRuleIds: [
          PHASE_3R_INTERACTION_RULE_IDS.READINESS_LINKS_TO_RESOLVING_COMPONENT,
        ],
      }));
  });

  test('defines component-level accessibility requirements', () => {
    expect(listPhase3RAccessibilityRules().map(rule => rule.id)).toEqual([
      PHASE_3R_ACCESSIBILITY_RULE_IDS.KEYBOARD_OPERABLE,
      PHASE_3R_ACCESSIBILITY_RULE_IDS.VISIBLE_LABEL_AND_DESCRIPTION,
      PHASE_3R_ACCESSIBILITY_RULE_IDS.MULTI_SELECT_STATE_ANNOUNCED,
      PHASE_3R_ACCESSIBILITY_RULE_IDS.FOCUS_VISIBLE_AND_NOT_OBSCURED,
      PHASE_3R_ACCESSIBILITY_RULE_IDS.TARGET_SIZE_MINIMUM,
      PHASE_3R_ACCESSIBILITY_RULE_IDS.ERROR_AND_DISABLED_REASON_PROGRAMMATIC,
    ]);

    expect(validatePhase3RComponentAccessibility(PHASE_3R_COMPONENT_IDS.INTENT_SIGNAL_PICKER))
      .toEqual(expect.objectContaining({
        valid: true,
        riskId: null,
        ruleIds: expect.arrayContaining([
          PHASE_3R_ACCESSIBILITY_RULE_IDS.KEYBOARD_OPERABLE,
          PHASE_3R_ACCESSIBILITY_RULE_IDS.VISIBLE_LABEL_AND_DESCRIPTION,
          PHASE_3R_ACCESSIBILITY_RULE_IDS.MULTI_SELECT_STATE_ANNOUNCED,
          PHASE_3R_ACCESSIBILITY_RULE_IDS.FOCUS_VISIBLE_AND_NOT_OBSCURED,
          PHASE_3R_ACCESSIBILITY_RULE_IDS.TARGET_SIZE_MINIMUM,
          PHASE_3R_ACCESSIBILITY_RULE_IDS.ERROR_AND_DISABLED_REASON_PROGRAMMATIC,
        ]),
      }));
  });

  test('summarizes the component system without putting verifier panels in the normal path', () => {
    expect(summarizePhase3RComponentSystem()).toEqual({
      targetComponentCount: 10,
      primitiveDecisionCount: 9,
      optionSourceCount: 7,
      interactionRuleCount: 6,
      accessibilityRuleCount: 6,
      normalPathComponentIds: [
        PHASE_3R_COMPONENT_IDS.DESTINATION_CONTEXT_CARD,
        PHASE_3R_COMPONENT_IDS.OBSERVED_PROFILE_SUMMARY,
        PHASE_3R_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
        PHASE_3R_COMPONENT_IDS.INTENT_SIGNAL_CHIP_LIST,
        PHASE_3R_COMPONENT_IDS.HARD_LIMIT_CONTROL,
        PHASE_3R_COMPONENT_IDS.AVOID_CONTROL,
        PHASE_3R_COMPONENT_IDS.REVIEW_TRIGGER_CONTROL,
        PHASE_3R_COMPONENT_IDS.READINESS_NEXT_ACTION_CARD,
      ],
      supportOnlyComponentIds: [
        PHASE_3R_COMPONENT_IDS.STARTER_TEMPLATE_SUGGESTION,
        PHASE_3R_COMPONENT_IDS.MIGRATION_VERIFIER_PANEL,
      ],
      multiSelectDefaultComponentIds: [
        PHASE_3R_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
        PHASE_3R_COMPONENT_IDS.INTENT_SIGNAL_CHIP_LIST,
        PHASE_3R_COMPONENT_IDS.AVOID_CONTROL,
        PHASE_3R_COMPONENT_IDS.REVIEW_TRIGGER_CONTROL,
      ],
      commandBoundaryComponentIds: [
        PHASE_3R_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
        PHASE_3R_COMPONENT_IDS.INTENT_SIGNAL_CHIP_LIST,
        PHASE_3R_COMPONENT_IDS.HARD_LIMIT_CONTROL,
        PHASE_3R_COMPONENT_IDS.AVOID_CONTROL,
        PHASE_3R_COMPONENT_IDS.REVIEW_TRIGGER_CONTROL,
        PHASE_3R_COMPONENT_IDS.STARTER_TEMPLATE_SUGGESTION,
      ],
      observedEvidenceComponentIds: [
        PHASE_3R_COMPONENT_IDS.DESTINATION_CONTEXT_CARD,
        PHASE_3R_COMPONENT_IDS.OBSERVED_PROFILE_SUMMARY,
        PHASE_3R_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
      ],
    });
  });

  test('fails closed for unknown component, primitive, and option identifiers', () => {
    expect(validatePhase3RComponentVocabulary([
      PHASE_3R_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
      'unknown',
    ])).toEqual({
      valid: false,
      riskId: PHASE_3R_COMPONENT_RISK_IDS.UNKNOWN_COMPONENT,
      unknownComponentIds: ['unknown'],
    });
    expect(getPhase3RTargetComponent('unknown')).toBeNull();
    expect(getPhase3RPrimitiveDecision('unknown')).toBeNull();
    expect(getPhase3ROptionSourceRecord('unknown')).toBeNull();
    expect(validatePhase3ROptionSource('unknown')).toEqual({
      valid: false,
      riskId: PHASE_3R_COMPONENT_RISK_IDS.UNKNOWN_OPTION_SOURCE,
      reason: 'Unknown Phase 3R option source.',
    });
  });

  test('exposes immutable records', () => {
    const components = listPhase3RTargetComponents();
    const decisions = listPhase3RPrimitiveDecisions();

    expect(Object.isFrozen(components)).toBe(true);
    expect(Object.isFrozen(components[0])).toBe(true);
    expect(Object.isFrozen(decisions[0].targetComponentIds)).toBe(true);
  });
});
