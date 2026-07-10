import {
  POLICY_BUILDER_BOUNDARY_CATEGORIES,
  POLICY_BUILDER_BOUNDARY_RISK_IDS,
} from '../../services/policyBuilderBoundaryInventory.mjs';
import {
  MODAL_ALLOWED_RESPONSIBILITY_IDS,
  MODAL_EVENT_PAYLOAD_AUTHORITY_IDS,
  MODAL_EXTRACTION_TARGET_IDS,
  MODAL_ORCHESTRATION_AUDIT_RISK_IDS,
  MODAL_ORCHESTRATION_DECISION_IDS,
  MODAL_PROHIBITED_RESPONSIBILITY_IDS,
  MODAL_PUBLIC_EVENT_IDS,
  MODAL_TOUCHPOINT_IDS,
  buildPolicyBuilderModalPublicEventAudit,
  buildPolicyBuilderModalOrchestrationAudit,
  buildPolicyBuilderModalBoundarySummary,
  evaluateModalResponsibilitySet,
  getModalAllowedResponsibility,
  getModalExtractionTarget,
  getModalProhibitedResponsibility,
  getModalPublicEvent,
  getModalTouchpoint,
  isModalResponsibilityAllowed,
  isModalResponsibilityProhibited,
  listModalAllowedResponsibilities,
  listModalExtractionTargets,
  listModalProhibitedResponsibilities,
  listModalPublicEvents,
  listModalTouchpoints,
  validateModalPublicEvent,
} from '../../services/policyBuilderModalOrchestrationContract.mjs';

describe('policyBuilderModalOrchestrationContract', () => {
  test('defines the allowed modal orchestration responsibilities', () => {
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
        targetDecisionId: MODAL_ORCHESTRATION_DECISION_IDS.RECLASSIFY_OR_DELETE_AFTER_ENGINE_CUTLINE,
        targetPhase: 'engine_cutline',
        relatedRiskIds: [
          POLICY_BUILDER_BOUNDARY_RISK_IDS.DIAGNOSTIC_PRODUCT_SURFACE,
          POLICY_BUILDER_BOUNDARY_RISK_IDS.CLIENT_ENGINE_LOGIC,
        ],
      }));
  });

  test('marks summary and save failure work as modal orchestration extraction targets', () => {
    expect(getModalExtractionTarget(MODAL_EXTRACTION_TARGET_IDS.SUMMARY_VIEW_PROJECTION))
      .toEqual(expect.objectContaining({
        targetDecisionId: MODAL_ORCHESTRATION_DECISION_IDS.MOVE_TO_COMPOSABLE,
        targetPhase: 'modal_orchestration',
      }));

    expect(getModalExtractionTarget(MODAL_EXTRACTION_TARGET_IDS.SAVE_FAILURE_NOTIFICATION))
      .toEqual(expect.objectContaining({
        targetDecisionId: MODAL_ORCHESTRATION_DECISION_IDS.MOVE_TO_PRESENTATION_COMPONENT,
        targetPhase: 'modal_orchestration',
      }));
  });

  test('tracks current modal touchpoints against allowed responsibilities', () => {
    expect(listModalTouchpoints().map(touchpoint => touchpoint.id)).toEqual([
      MODAL_TOUCHPOINT_IDS.MODEL_VALUE_BINDING,
      MODAL_TOUCHPOINT_IDS.SAVE_PAYLOAD_DELEGATION,
      MODAL_TOUCHPOINT_IDS.DRAFT_SIGNAL_COMMAND_ROUTING,
      MODAL_TOUCHPOINT_IDS.PROFILE_REFRESH_COMMAND_ROUTING,
      MODAL_TOUCHPOINT_IDS.DIAGNOSTIC_PREVIEW_COMPOSITION,
      MODAL_TOUCHPOINT_IDS.ADVANCED_SCORING_COMPOSITION,
      MODAL_TOUCHPOINT_IDS.SUMMARY_VIEW_PROJECTION,
      MODAL_TOUCHPOINT_IDS.LEGACY_TEMPLATE_COMMAND_ADAPTERS,
      MODAL_TOUCHPOINT_IDS.SAVE_FAILURE_BROWSER_ALERT,
    ]);

    expect(getModalTouchpoint(MODAL_TOUCHPOINT_IDS.MODEL_VALUE_BINDING))
      .toEqual(expect.objectContaining({
        responsibilityId: MODAL_ALLOWED_RESPONSIBILITY_IDS.OPEN_CLOSE_LIFECYCLE,
        decisionId: MODAL_ORCHESTRATION_DECISION_IDS.KEEP_IN_MODAL,
      }));
  });

  test('maps transitional modal touchpoints to extraction targets', () => {
    expect(getModalTouchpoint(MODAL_TOUCHPOINT_IDS.DIAGNOSTIC_PREVIEW_COMPOSITION))
      .toEqual(expect.objectContaining({
        extractionTargetId: MODAL_EXTRACTION_TARGET_IDS.DIAGNOSTIC_PREVIEW_SURFACES,
        decisionId: MODAL_ORCHESTRATION_DECISION_IDS.RECLASSIFY_OR_DELETE_AFTER_ENGINE_CUTLINE,
      }));
    expect(getModalTouchpoint(MODAL_TOUCHPOINT_IDS.SAVE_FAILURE_BROWSER_ALERT))
      .toEqual(expect.objectContaining({
        extractionTargetId: MODAL_EXTRACTION_TARGET_IDS.SAVE_FAILURE_NOTIFICATION,
        decisionId: MODAL_ORCHESTRATION_DECISION_IDS.MOVE_TO_PRESENTATION_COMPONENT,
      }));
  });

  test('defines public modal events as orchestration-only outputs', () => {
    expect(listModalPublicEvents().map(event => event.id)).toEqual([
      MODAL_PUBLIC_EVENT_IDS.UPDATE_MODEL_VALUE,
      MODAL_PUBLIC_EVENT_IDS.SAVE,
      MODAL_PUBLIC_EVENT_IDS.CLOSE,
    ]);

    expect(getModalPublicEvent(MODAL_PUBLIC_EVENT_IDS.UPDATE_MODEL_VALUE))
      .toEqual(expect.objectContaining({
        responsibilityId: MODAL_ALLOWED_RESPONSIBILITY_IDS.OPEN_CLOSE_LIFECYCLE,
        payloadAuthorityId: MODAL_EVENT_PAYLOAD_AUTHORITY_IDS.VIEW_STATE,
        payloadShape: 'boolean',
        validatorExpected: true,
      }));

    expect(getModalPublicEvent(MODAL_PUBLIC_EVENT_IDS.SAVE))
      .toEqual(expect.objectContaining({
        responsibilityId: MODAL_ALLOWED_RESPONSIBILITY_IDS.SAVE_CANCEL_ACTIONS,
        payloadAuthorityId: MODAL_EVENT_PAYLOAD_AUTHORITY_IDS.DELEGATED_SAVE_PAYLOAD,
        validatorExpected: true,
      }));

    expect(getModalPublicEvent(MODAL_PUBLIC_EVENT_IDS.CLOSE))
      .toEqual(expect.objectContaining({
        payloadAuthorityId: MODAL_EVENT_PAYLOAD_AUTHORITY_IDS.NO_PAYLOAD,
        payloadShape: 'none',
      }));
  });

  test('audits modal public events fail-closed', () => {
    expect(buildPolicyBuilderModalPublicEventAudit()).toEqual(expect.objectContaining({
      ok: true,
      checkedCount: listModalPublicEvents().length,
      issues: [],
    }));

    const result = validateModalPublicEvent({
      id: MODAL_PUBLIC_EVENT_IDS.SAVE,
      responsibilityId: MODAL_PROHIBITED_RESPONSIBILITY_IDS.EVIDENCE_GENERATION,
      payloadAuthorityId: MODAL_EVENT_PAYLOAD_AUTHORITY_IDS.VIEW_STATE,
      validatorExpected: false,
    });

    expect(result.ok).toBe(false);
    expect(result.issues.map(issue => issue.riskId)).toEqual([
      MODAL_ORCHESTRATION_AUDIT_RISK_IDS.INVALID_EVENT_RESPONSIBILITY,
      MODAL_ORCHESTRATION_AUDIT_RISK_IDS.EVENT_PAYLOAD_NOT_DELEGATED,
      MODAL_ORCHESTRATION_AUDIT_RISK_IDS.INVALID_EVENT_VALIDATOR_EXPECTATION,
    ]);
  });

  test('audits modal orchestration touchpoints fail-closed', () => {
    expect(buildPolicyBuilderModalOrchestrationAudit()).toEqual(expect.objectContaining({
      ok: true,
      checkedCount: listModalTouchpoints().length,
      publicEventAudit: expect.objectContaining({
        ok: true,
      }),
      extractionTouchpointIds: [
        MODAL_TOUCHPOINT_IDS.DIAGNOSTIC_PREVIEW_COMPOSITION,
        MODAL_TOUCHPOINT_IDS.ADVANCED_SCORING_COMPOSITION,
        MODAL_TOUCHPOINT_IDS.SUMMARY_VIEW_PROJECTION,
        MODAL_TOUCHPOINT_IDS.LEGACY_TEMPLATE_COMMAND_ADAPTERS,
        MODAL_TOUCHPOINT_IDS.SAVE_FAILURE_BROWSER_ALERT,
      ],
      issues: [],
    }));

    const audit = buildPolicyBuilderModalOrchestrationAudit([
      {
        id: 'new_modal_logic',
        responsibilityId: MODAL_PROHIBITED_RESPONSIBILITY_IDS.LEARNING_DECISIONS,
        extractionTargetId: 'missing_target',
      },
    ]);

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: MODAL_ORCHESTRATION_AUDIT_RISK_IDS.UNKNOWN_TOUCHPOINT,
        touchpointId: 'new_modal_logic',
      }),
      expect.objectContaining({
        riskId: MODAL_ORCHESTRATION_AUDIT_RISK_IDS.PROHIBITED_RESPONSIBILITY,
        responsibilityId: MODAL_PROHIBITED_RESPONSIBILITY_IDS.LEARNING_DECISIONS,
      }),
      expect.objectContaining({
        riskId: MODAL_ORCHESTRATION_AUDIT_RISK_IDS.UNMAPPED_EXTRACTION_TARGET,
        extractionTargetId: 'missing_target',
      }),
    ]));
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
      publicEventIds: [
        MODAL_PUBLIC_EVENT_IDS.UPDATE_MODEL_VALUE,
        MODAL_PUBLIC_EVENT_IDS.SAVE,
        MODAL_PUBLIC_EVENT_IDS.CLOSE,
      ],
      touchpointIds: [
        MODAL_TOUCHPOINT_IDS.MODEL_VALUE_BINDING,
        MODAL_TOUCHPOINT_IDS.SAVE_PAYLOAD_DELEGATION,
        MODAL_TOUCHPOINT_IDS.DRAFT_SIGNAL_COMMAND_ROUTING,
        MODAL_TOUCHPOINT_IDS.PROFILE_REFRESH_COMMAND_ROUTING,
        MODAL_TOUCHPOINT_IDS.DIAGNOSTIC_PREVIEW_COMPOSITION,
        MODAL_TOUCHPOINT_IDS.ADVANCED_SCORING_COMPOSITION,
        MODAL_TOUCHPOINT_IDS.SUMMARY_VIEW_PROJECTION,
        MODAL_TOUCHPOINT_IDS.LEGACY_TEMPLATE_COMMAND_ADAPTERS,
        MODAL_TOUCHPOINT_IDS.SAVE_FAILURE_BROWSER_ALERT,
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
    expect(Object.isFrozen(listModalTouchpoints())).toBe(true);
    expect(Object.isFrozen(listModalTouchpoints()[0])).toBe(true);
    expect(Object.isFrozen(listModalPublicEvents())).toBe(true);
    expect(Object.isFrozen(listModalPublicEvents()[0])).toBe(true);
  });

  test('returns false or null for unknown modal responsibility records', () => {
    expect(getModalAllowedResponsibility('unknown')).toBeNull();
    expect(getModalProhibitedResponsibility('unknown')).toBeNull();
    expect(getModalExtractionTarget('unknown')).toBeNull();
    expect(getModalTouchpoint('unknown')).toBeNull();
    expect(getModalPublicEvent('unknown')).toBeNull();
    expect(isModalResponsibilityAllowed('unknown')).toBe(false);
    expect(isModalResponsibilityProhibited('unknown')).toBe(false);
  });
});
