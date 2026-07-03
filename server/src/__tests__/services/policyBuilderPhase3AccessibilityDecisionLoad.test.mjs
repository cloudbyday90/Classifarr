import {
  POLICY_AUTHORING_COMPONENT_IDS,
  listPolicyAuthoringTargetComponents,
} from '../../services/policyAuthoringComponentSystem.mjs';
import {
  PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RISK_IDS,
  PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RULE_IDS,
  PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS,
  buildPhase3AccessibilityDecisionLoadAudit,
  getPhase3AccessibilityDecisionLoadSurface,
  listPhase3AccessibilityDecisionLoadSurfaces,
  summarizePhase3AccessibilityDecisionLoad,
  validatePhase3AccessibilityDecisionLoadSurface,
} from '../../services/policyBuilderPhase3AccessibilityDecisionLoad.mjs';

describe('policyBuilderPhase3AccessibilityDecisionLoad', () => {
  test('defines accessibility and decision-load surfaces for every policy authoring component', () => {
    const surfaces = listPhase3AccessibilityDecisionLoadSurfaces();

    expect(surfaces.map(surface => surface.id)).toEqual([
      PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS.DESTINATION_CONTEXT,
      PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS.OBSERVED_PROFILE,
      PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS.INTENT_SIGNAL_PICKER,
      PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS.INTENT_SIGNAL_CHIP_LIST,
      PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS.HARD_LIMITS,
      PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS.AVOID,
      PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS.REVIEW_TRIGGERS,
      PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS.READINESS_NEXT_ACTION,
      PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS.STARTER_TEMPLATE_SUGGESTION,
      PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS.MIGRATION_VERIFIER,
    ]);

    expect(new Set(surfaces.map(surface => surface.componentId))).toEqual(
      new Set(listPolicyAuthoringTargetComponents().map(component => component.id)),
    );
  });

  test('pins normal workflow surfaces to one primary action', () => {
    const normalPathSurfaces = listPhase3AccessibilityDecisionLoadSurfaces()
      .filter(surface => surface.normalPath);

    expect(normalPathSurfaces).toHaveLength(8);
    normalPathSurfaces.forEach(surface => {
      expect(surface.maxPrimaryActions).toBeLessThanOrEqual(1);
      expect(surface.keyboardOperable).toBe(true);
      expect(surface.visibleFocusRequired).toBe(true);
      expect(surface.internalDiagnosticsAllowed).toBe(false);
    });
  });

  test('requires multi-select state and disabled reasons where grouped editing can hide state', () => {
    expect(getPhase3AccessibilityDecisionLoadSurface(
      PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS.INTENT_SIGNAL_PICKER,
    )).toEqual(expect.objectContaining({
      componentId: POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
      disabledReasonRequired: true,
      multiSelectStateRequired: true,
    }));

    expect(getPhase3AccessibilityDecisionLoadSurface(
      PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS.INTENT_SIGNAL_CHIP_LIST,
    )).toEqual(expect.objectContaining({
      componentId: POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_CHIP_LIST,
      chipRemoveNameRequired: true,
    }));
  });

  test('keeps readiness as one next action instead of several competing cards', () => {
    const readiness = getPhase3AccessibilityDecisionLoadSurface(
      PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS.READINESS_NEXT_ACTION,
    );

    expect(readiness).toEqual(expect.objectContaining({
      componentId: POLICY_AUTHORING_COMPONENT_IDS.READINESS_NEXT_ACTION_CARD,
      singleNextActionRequired: true,
      maxPrimaryActions: 1,
    }));

    expect(validatePhase3AccessibilityDecisionLoadSurface(readiness)).toEqual(expect.objectContaining({
      ok: true,
      requiredRuleIds: expect.arrayContaining([
        PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RULE_IDS.SINGLE_NEXT_ACTION,
      ]),
    }));
  });

  test('audits the default Phase 3R accessibility and decision-load contract', () => {
    expect(buildPhase3AccessibilityDecisionLoadAudit()).toEqual(expect.objectContaining({
      ok: true,
      checkedSurfaceCount: listPhase3AccessibilityDecisionLoadSurfaces().length,
      coveredComponentCount: listPolicyAuthoringTargetComponents().length,
      uncoveredComponentIds: [],
      issueCount: 0,
    }));
  });

  test('fails surfaces that overload normal workflow decision load', () => {
    const invalidSurface = {
      ...getPhase3AccessibilityDecisionLoadSurface(
        PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS.READINESS_NEXT_ACTION,
      ),
      label: 'Provider gate replay parity',
      helperText: 'Use internal diagnostic scoring weight details.',
      maxPrimaryActions: 3,
      warningConceptIds: [
        'readiness_issue',
        'readiness_issue',
      ],
      providedRuleIds: [
        PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RULE_IDS.ACCESSIBLE_NAME,
        PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RULE_IDS.HELPER_TEXT,
      ],
    };

    expect(validatePhase3AccessibilityDecisionLoadSurface(invalidSurface).issues.map(issue => issue.riskId))
      .toEqual(expect.arrayContaining([
        PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RISK_IDS.TOO_MANY_PRIMARY_ACTIONS,
        PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RISK_IDS.MISSING_SINGLE_NEXT_ACTION,
        PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RISK_IDS.DUPLICATE_WARNING_CONCEPT,
        PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RISK_IDS.INTERNAL_DIAGNOSTIC_NORMAL_PATH,
      ]));
  });

  test('fails custom controls without accessible state and removal rules', () => {
    const invalidSurface = {
      ...getPhase3AccessibilityDecisionLoadSurface(
        PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS.INTENT_SIGNAL_CHIP_LIST,
      ),
      providedRuleIds: [
        PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RULE_IDS.ACCESSIBLE_NAME,
        PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RULE_IDS.HELPER_TEXT,
        PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RULE_IDS.KEYBOARD_OPERABLE,
      ],
    };

    expect(validatePhase3AccessibilityDecisionLoadSurface(invalidSurface).issues.map(issue => issue.riskId))
      .toContain(PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RISK_IDS.MISSING_CHIP_REMOVE_NAME);
  });

  test('summarizes the decision-load target for later Vue implementation', () => {
    expect(summarizePhase3AccessibilityDecisionLoad()).toEqual(expect.objectContaining({
      surfaceCount: listPhase3AccessibilityDecisionLoadSurfaces().length,
      maxNormalPathPrimaryActions: 1,
      multiSelectSurfaceIds: expect.arrayContaining([
        PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS.INTENT_SIGNAL_PICKER,
        PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS.AVOID,
        PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS.REVIEW_TRIGGERS,
      ]),
      disabledReasonSurfaceIds: expect.arrayContaining([
        PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS.INTENT_SIGNAL_PICKER,
        PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS.HARD_LIMITS,
      ]),
    }));
  });

  test('exposes immutable records and handles unknown surfaces', () => {
    const surfaces = listPhase3AccessibilityDecisionLoadSurfaces();

    expect(Object.isFrozen(surfaces)).toBe(true);
    expect(Object.isFrozen(surfaces[0])).toBe(true);
    expect(getPhase3AccessibilityDecisionLoadSurface('unknown')).toBeNull();
    expect(validatePhase3AccessibilityDecisionLoadSurface({
      id: 'unknown',
      componentId: 'unknown_component',
    }).issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RISK_IDS.UNKNOWN_SURFACE,
      PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RISK_IDS.UNKNOWN_COMPONENT,
    ]));
  });
});
