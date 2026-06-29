import {
  POLICY_BUILDER_BOUNDARY_CATEGORIES,
  POLICY_BUILDER_BOUNDARY_RISK_IDS,
} from '../../services/policyBuilderPhase1BoundaryInventory.mjs';
import {
  MODAL_ALLOWED_RESPONSIBILITY_IDS,
  MODAL_EXTRACTION_TARGET_IDS,
  MODAL_ORCHESTRATION_DECISION_IDS,
  MODAL_PROHIBITED_RESPONSIBILITY_IDS,
  buildPolicyBuilderModalBoundarySummary,
  evaluateModalResponsibilitySet,
  getModalAllowedResponsibility,
  getModalExtractionTarget,
  getModalProhibitedResponsibility,
  isModalResponsibilityAllowed,
  isModalResponsibilityProhibited,
  listModalAllowedResponsibilities,
  listModalExtractionTargets,
  listModalProhibitedResponsibilities,
} from '../../services/policyBuilderModalOrchestrationContract.mjs';

describe('policyBuilderModalOrchestrationContract', () => {
  test('defines the allowed modal responsibilities from Phase 1R.2', () => {
    expect(listModalAllowedResponsibilities().map(item => item.id)).toEqual([
      MODAL_ALLOWED_RESPONSIBILITY_IDS.OPEN_CLOSE_LIFECYCLE,
      MODAL_ALLOWED_RESPONSIBILITY_IDS.SAVE_CANCEL_ACTIONS,
      MODAL_ALLOWED_RESPONSIBILITY_IDS.CHILD_COMPONENT_COMPOSITION,
      MODAL_ALLOWED_RESPONSIBILITY_IDS.LOADING_ERROR_PRESENTATION,
      MODAL_ALLOWED_RESPONSIBILITY_IDS.COMMAND_ROUTING_TO_COMPOSABLES,
    ]);

    listModalAllowedResponsibilities().forEach(item => {
      expect(item.modalMayOwn).toEqual(expect.any(String));
      expect(item.guardrail).toEqual(expect.any(String));
    });
  });

  test('defines prohibited responsibilities that keep the modal non-authoritative', () => {
    expect(listModalProhibitedResponsibilities().map(item => item.id)).toEqual([
      MODAL_PROHIBITED_RESPONSIBILITY_IDS.EVIDENCE_GENERATION,
      MODAL_PROHIBITED_RESPONSIBILITY_IDS.INTENT_INFERENCE,
      MODAL_PROHIBITED_RESPONSIBILITY_IDS.LEARNING_DECISIONS,
      MODAL_PROHIBITED_RESPONSIBILITY_IDS.READINESS_DECISIONS,
      MODAL_PROHIBITED_RESPONSIBILITY_IDS.MIGRATION_PARITY_DECISIONS,
      MODAL_PROHIBITED_RESPONSIBILITY_IDS.RAW_LEGACY_PAYLOAD_MUTATION,
    ]);

    expect(getModalProhibitedResponsibility(MODAL_PROHIBITED_RESPONSIBILITY_IDS.LEARNING_DECISIONS))
      .toEqual(expect.objectContaining({
        reason: expect.stringContaining('server learning guard'),
      }));
    expect(getModalProhibitedResponsibility(MODAL_PROHIBITED_RESPONSIBILITY_IDS.RAW_LEGACY_PAYLOAD_MUTATION))
      .toEqual(expect.objectContaining({
        reason: expect.stringContaining('compatibility bridge'),
      }));
  });

  test('evaluates proposed modal responsibility sets fail-closed', () => {
    expect(evaluateModalResponsibilitySet([
      MODAL_ALLOWED_RESPONSIBILITY_IDS.OPEN_CLOSE_LIFECYCLE,
      MODAL_ALLOWED_RESPONSIBILITY_IDS.SAVE_CANCEL_ACTIONS,
    ])).toEqual({
      valid: true,
      allowedIds: [
        MODAL_ALLOWED_RESPONSIBILITY_IDS.OPEN_CLOSE_LIFECYCLE,
        MODAL_ALLOWED_RESPONSIBILITY_IDS.SAVE_CANCEL_ACTIONS,
      ],
      prohibitedIds: [],
      unknownIds: [],
    });

    expect(evaluateModalResponsibilitySet([
      MODAL_ALLOWED_RESPONSIBILITY_IDS.CHILD_COMPONENT_COMPOSITION,
      MODAL_PROHIBITED_RESPONSIBILITY_IDS.READINESS_DECISIONS,
      'unexpected_modal_logic',
    ])).toEqual({
      valid: false,
      allowedIds: [
        MODAL_ALLOWED_RESPONSIBILITY_IDS.CHILD_COMPONENT_COMPOSITION,
      ],
      prohibitedIds: [
        MODAL_PROHIBITED_RESPONSIBILITY_IDS.READINESS_DECISIONS,
      ],
      unknownIds: [
        'unexpected_modal_logic',
      ],
    });
  });

  test('identifies the current modal extraction targets', () => {
    expect(listModalExtractionTargets().map(target => target.id)).toEqual([
      MODAL_EXTRACTION_TARGET_IDS.DIAGNOSTIC_PREVIEW_SURFACES,
      MODAL_EXTRACTION_TARGET_IDS.ADVANCED_SCORING_CONTROLS,
      MODAL_EXTRACTION_TARGET_IDS.SUMMARY_VIEW_PROJECTION,
      MODAL_EXTRACTION_TARGET_IDS.LEGACY_COMMAND_ADAPTERS,
      MODAL_EXTRACTION_TARGET_IDS.SAVE_FAILURE_NOTIFICATION,
    ]);

    expect(getModalExtractionTarget(MODAL_EXTRACTION_TARGET_IDS.DIAGNOSTIC_PREVIEW_SURFACES))
      .toEqual(expect.objectContaining({
        targetDecisionId: MODAL_ORCHESTRATION_DECISION_IDS.RECLASSIFY_OR_DELETE_AFTER_PHASE_6R,
        targetPhase: '6R',
        relatedRiskIds: [
          POLICY_BUILDER_BOUNDARY_RISK_IDS.DIAGNOSTIC_PRODUCT_SURFACE,
          POLICY_BUILDER_BOUNDARY_RISK_IDS.CLIENT_ENGINE_LOGIC,
        ],
      }));
  });

  test('marks summary and save failure work as Phase 1R.2 extraction targets', () => {
    expect(getModalExtractionTarget(MODAL_EXTRACTION_TARGET_IDS.SUMMARY_VIEW_PROJECTION))
      .toEqual(expect.objectContaining({
        targetDecisionId: MODAL_ORCHESTRATION_DECISION_IDS.MOVE_TO_COMPOSABLE,
        targetPhase: '1R.2',
      }));

    expect(getModalExtractionTarget(MODAL_EXTRACTION_TARGET_IDS.SAVE_FAILURE_NOTIFICATION))
      .toEqual(expect.objectContaining({
        targetDecisionId: MODAL_ORCHESTRATION_DECISION_IDS.MOVE_TO_PRESENTATION_COMPONENT,
        targetPhase: '1R.2',
      }));
  });

  test('summarizes the modal as UI orchestration with explicit boundaries', () => {
    expect(buildPolicyBuilderModalBoundarySummary()).toEqual({
      path: 'client/src/components/policies/PolicyBuilderModal.vue',
      category: POLICY_BUILDER_BOUNDARY_CATEGORIES.UI_ORCHESTRATION,
      expectedCategory: POLICY_BUILDER_BOUNDARY_CATEGORIES.UI_ORCHESTRATION,
      mixedBoundary: true,
      allowedResponsibilityIds: [
        MODAL_ALLOWED_RESPONSIBILITY_IDS.OPEN_CLOSE_LIFECYCLE,
        MODAL_ALLOWED_RESPONSIBILITY_IDS.SAVE_CANCEL_ACTIONS,
        MODAL_ALLOWED_RESPONSIBILITY_IDS.CHILD_COMPONENT_COMPOSITION,
        MODAL_ALLOWED_RESPONSIBILITY_IDS.LOADING_ERROR_PRESENTATION,
        MODAL_ALLOWED_RESPONSIBILITY_IDS.COMMAND_ROUTING_TO_COMPOSABLES,
      ],
      prohibitedResponsibilityIds: [
        MODAL_PROHIBITED_RESPONSIBILITY_IDS.EVIDENCE_GENERATION,
        MODAL_PROHIBITED_RESPONSIBILITY_IDS.INTENT_INFERENCE,
        MODAL_PROHIBITED_RESPONSIBILITY_IDS.LEARNING_DECISIONS,
        MODAL_PROHIBITED_RESPONSIBILITY_IDS.READINESS_DECISIONS,
        MODAL_PROHIBITED_RESPONSIBILITY_IDS.MIGRATION_PARITY_DECISIONS,
        MODAL_PROHIBITED_RESPONSIBILITY_IDS.RAW_LEGACY_PAYLOAD_MUTATION,
      ],
      extractionTargetIds: [
        MODAL_EXTRACTION_TARGET_IDS.DIAGNOSTIC_PREVIEW_SURFACES,
        MODAL_EXTRACTION_TARGET_IDS.ADVANCED_SCORING_CONTROLS,
        MODAL_EXTRACTION_TARGET_IDS.SUMMARY_VIEW_PROJECTION,
        MODAL_EXTRACTION_TARGET_IDS.LEGACY_COMMAND_ADAPTERS,
        MODAL_EXTRACTION_TARGET_IDS.SAVE_FAILURE_NOTIFICATION,
      ],
    });
  });

  test('exposes immutable modal orchestration records', () => {
    const allowed = listModalAllowedResponsibilities();
    const prohibited = listModalProhibitedResponsibilities();
    const targets = listModalExtractionTargets();

    expect(Object.isFrozen(allowed)).toBe(true);
    expect(Object.isFrozen(allowed[0])).toBe(true);
    expect(Object.isFrozen(prohibited)).toBe(true);
    expect(Object.isFrozen(prohibited[0])).toBe(true);
    expect(Object.isFrozen(targets)).toBe(true);
    expect(Object.isFrozen(targets[0])).toBe(true);
    expect(Object.isFrozen(targets[0].relatedRiskIds)).toBe(true);
  });

  test('returns false or null for unknown modal responsibility records', () => {
    expect(getModalAllowedResponsibility('unknown')).toBeNull();
    expect(getModalProhibitedResponsibility('unknown')).toBeNull();
    expect(getModalExtractionTarget('unknown')).toBeNull();
    expect(isModalResponsibilityAllowed('unknown')).toBe(false);
    expect(isModalResponsibilityProhibited('unknown')).toBe(false);
  });
});
