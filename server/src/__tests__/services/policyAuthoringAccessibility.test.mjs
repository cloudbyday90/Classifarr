import {
  POLICY_AUTHORING_COMPONENT_IDS,
  listPolicyAuthoringTargetComponents,
} from '../../services/policyAuthoringComponentSystem.mjs';
import {
  POLICY_AUTHORING_ACCESSIBILITY_RISK_IDS,
  POLICY_AUTHORING_ACCESSIBILITY_RULE_IDS,
  POLICY_AUTHORING_ACCESSIBILITY_SURFACE_IDS,
  buildPolicyAuthoringAccessibilityAudit,
  getPolicyAuthoringAccessibilitySurface,
  listPolicyAuthoringAccessibilitySurfaces,
  summarizePolicyAuthoringAccessibility,
  validatePolicyAuthoringAccessibilitySurface,
} from '../../services/policyAuthoringAccessibility.mjs';

describe('policyAuthoringAccessibility', () => {
  test('defines accessibility and decision-load surfaces for every policy authoring component', () => {
    const surfaces = listPolicyAuthoringAccessibilitySurfaces();

    expect(surfaces.map(surface => surface.id)).toEqual([
      POLICY_AUTHORING_ACCESSIBILITY_SURFACE_IDS.DESTINATION_CONTEXT,
      POLICY_AUTHORING_ACCESSIBILITY_SURFACE_IDS.OBSERVED_PROFILE,
      POLICY_AUTHORING_ACCESSIBILITY_SURFACE_IDS.INTENT_SIGNAL_PICKER,
      POLICY_AUTHORING_ACCESSIBILITY_SURFACE_IDS.INTENT_SIGNAL_CHIP_LIST,
      POLICY_AUTHORING_ACCESSIBILITY_SURFACE_IDS.HARD_LIMITS,
      POLICY_AUTHORING_ACCESSIBILITY_SURFACE_IDS.AVOID,
      POLICY_AUTHORING_ACCESSIBILITY_SURFACE_IDS.REVIEW_TRIGGERS,
      POLICY_AUTHORING_ACCESSIBILITY_SURFACE_IDS.READINESS_NEXT_ACTION,
      POLICY_AUTHORING_ACCESSIBILITY_SURFACE_IDS.STARTER_TEMPLATE_SUGGESTION,
    ]);

    expect(new Set(surfaces.map(surface => surface.componentId))).toEqual(
      new Set(listPolicyAuthoringTargetComponents().map(component => component.id)),
    );
  });

  test('pins normal workflow surfaces to one primary action', () => {
    const normalPathSurfaces = listPolicyAuthoringAccessibilitySurfaces()
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
    expect(getPolicyAuthoringAccessibilitySurface(
      POLICY_AUTHORING_ACCESSIBILITY_SURFACE_IDS.INTENT_SIGNAL_PICKER,
    )).toEqual(expect.objectContaining({
      componentId: POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
      disabledReasonRequired: true,
      multiSelectStateRequired: true,
    }));

    expect(getPolicyAuthoringAccessibilitySurface(
      POLICY_AUTHORING_ACCESSIBILITY_SURFACE_IDS.INTENT_SIGNAL_CHIP_LIST,
    )).toEqual(expect.objectContaining({
      componentId: POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_CHIP_LIST,
      chipRemoveNameRequired: true,
    }));
  });

  test('keeps readiness as one next action instead of several competing cards', () => {
    const readiness = getPolicyAuthoringAccessibilitySurface(
      POLICY_AUTHORING_ACCESSIBILITY_SURFACE_IDS.READINESS_NEXT_ACTION,
    );

    expect(readiness).toEqual(expect.objectContaining({
      componentId: POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_EMPTY_STATE_NOTICE,
      singleNextActionRequired: true,
      maxPrimaryActions: 1,
    }));

    expect(validatePolicyAuthoringAccessibilitySurface(readiness)).toEqual(expect.objectContaining({
      ok: true,
      requiredRuleIds: expect.arrayContaining([
        POLICY_AUTHORING_ACCESSIBILITY_RULE_IDS.SINGLE_NEXT_ACTION,
      ]),
    }));
  });

  test('audits the default policy authoring accessibility contract', () => {
    expect(buildPolicyAuthoringAccessibilityAudit()).toEqual(expect.objectContaining({
      ok: true,
      checkedSurfaceCount: listPolicyAuthoringAccessibilitySurfaces().length,
      coveredComponentCount: listPolicyAuthoringTargetComponents().length,
      uncoveredComponentIds: [],
      issueCount: 0,
    }));
  });

  test('fails surfaces that overload normal workflow decision load', () => {
    const invalidSurface = {
      ...getPolicyAuthoringAccessibilitySurface(
        POLICY_AUTHORING_ACCESSIBILITY_SURFACE_IDS.READINESS_NEXT_ACTION,
      ),
      label: 'Provider gate replay parity',
      helperText: 'Use internal diagnostic scoring weight details.',
      maxPrimaryActions: 3,
      warningConceptIds: [
        'readiness_issue',
        'readiness_issue',
      ],
      providedRuleIds: [
        POLICY_AUTHORING_ACCESSIBILITY_RULE_IDS.ACCESSIBLE_NAME,
        POLICY_AUTHORING_ACCESSIBILITY_RULE_IDS.HELPER_TEXT,
      ],
    };

    expect(validatePolicyAuthoringAccessibilitySurface(invalidSurface).issues.map(issue => issue.riskId))
      .toEqual(expect.arrayContaining([
        POLICY_AUTHORING_ACCESSIBILITY_RISK_IDS.TOO_MANY_PRIMARY_ACTIONS,
        POLICY_AUTHORING_ACCESSIBILITY_RISK_IDS.MISSING_SINGLE_NEXT_ACTION,
        POLICY_AUTHORING_ACCESSIBILITY_RISK_IDS.DUPLICATE_WARNING_CONCEPT,
        POLICY_AUTHORING_ACCESSIBILITY_RISK_IDS.INTERNAL_DIAGNOSTIC_NORMAL_PATH,
      ]));
  });

  test('fails custom controls without accessible state and removal rules', () => {
    const invalidSurface = {
      ...getPolicyAuthoringAccessibilitySurface(
        POLICY_AUTHORING_ACCESSIBILITY_SURFACE_IDS.INTENT_SIGNAL_CHIP_LIST,
      ),
      providedRuleIds: [
        POLICY_AUTHORING_ACCESSIBILITY_RULE_IDS.ACCESSIBLE_NAME,
        POLICY_AUTHORING_ACCESSIBILITY_RULE_IDS.HELPER_TEXT,
        POLICY_AUTHORING_ACCESSIBILITY_RULE_IDS.KEYBOARD_OPERABLE,
      ],
    };

    expect(validatePolicyAuthoringAccessibilitySurface(invalidSurface).issues.map(issue => issue.riskId))
      .toContain(POLICY_AUTHORING_ACCESSIBILITY_RISK_IDS.MISSING_CHIP_REMOVE_NAME);
  });

  test('summarizes the decision-load target for later Vue implementation', () => {
    expect(summarizePolicyAuthoringAccessibility()).toEqual(expect.objectContaining({
      surfaceCount: listPolicyAuthoringAccessibilitySurfaces().length,
      maxNormalPathPrimaryActions: 1,
      multiSelectSurfaceIds: expect.arrayContaining([
        POLICY_AUTHORING_ACCESSIBILITY_SURFACE_IDS.INTENT_SIGNAL_PICKER,
        POLICY_AUTHORING_ACCESSIBILITY_SURFACE_IDS.AVOID,
        POLICY_AUTHORING_ACCESSIBILITY_SURFACE_IDS.REVIEW_TRIGGERS,
      ]),
      disabledReasonSurfaceIds: expect.arrayContaining([
        POLICY_AUTHORING_ACCESSIBILITY_SURFACE_IDS.INTENT_SIGNAL_PICKER,
        POLICY_AUTHORING_ACCESSIBILITY_SURFACE_IDS.HARD_LIMITS,
      ]),
    }));
  });

  test('exposes immutable records and handles unknown surfaces', () => {
    const surfaces = listPolicyAuthoringAccessibilitySurfaces();

    expect(Object.isFrozen(surfaces)).toBe(true);
    expect(Object.isFrozen(surfaces[0])).toBe(true);
    expect(getPolicyAuthoringAccessibilitySurface('unknown')).toBeNull();
    expect(validatePolicyAuthoringAccessibilitySurface({
      id: 'unknown',
      componentId: 'unknown_component',
    }).issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_AUTHORING_ACCESSIBILITY_RISK_IDS.UNKNOWN_SURFACE,
      POLICY_AUTHORING_ACCESSIBILITY_RISK_IDS.UNKNOWN_COMPONENT,
    ]));
  });
});
