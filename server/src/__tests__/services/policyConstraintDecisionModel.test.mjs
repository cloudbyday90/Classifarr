/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  POLICY_CONSTRAINT_DECISION_ABSENCE_BEHAVIOR_IDS,
  POLICY_CONSTRAINT_DECISION_EFFECT_IDS,
  POLICY_CONSTRAINT_DECISION_MODEL_RISK_IDS,
  POLICY_CONSTRAINT_DECISION_MODEL_VERSION,
  buildPolicyConstraintDecisionModel,
  buildPolicyConstraintDecisionModelAudit,
} from '../../services/policyConstraintDecisionModel.mjs';
import {
  POLICY_AUTHORING_CERTIFICATION_SEMANTIC_IDS,
  POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS,
} from '../../services/policyAuthoringConstraints.mjs';

function cloneModel(model) {
  return JSON.parse(JSON.stringify(model));
}

describe('policyConstraintDecisionModel', () => {
  test('projects the three server-owned constraint outcomes without inputs or runtime authority', () => {
    const model = buildPolicyConstraintDecisionModel();

    expect(model).toEqual({
      version: POLICY_CONSTRAINT_DECISION_MODEL_VERSION,
      authority: {
        displayProjection: true,
        automationDecision: false,
        policyPersistence: false,
        routingExecution: false,
        runtimeDecision: false,
        clientCanInferConstraintMeaning: false,
      },
      controls: [
        expect.objectContaining({
          controlId: POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
          decisionEffectId: POLICY_CONSTRAINT_DECISION_EFFECT_IDS.BLOCK_AUTOMATIC_APPLICATION,
          requiresExplicitOperatorAction: true,
          observedAbsenceBehaviorId:
            POLICY_CONSTRAINT_DECISION_ABSENCE_BEHAVIOR_IDS.NOT_A_DECLARATION_SOURCE,
          certificationSemanticId:
            POLICY_AUTHORING_CERTIFICATION_SEMANTIC_IDS.MAX_ALLOWED_RATING,
          canBlockAutomaticApplication: true,
        }),
        expect.objectContaining({
          controlId: POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.AVOID,
          decisionEffectId: POLICY_CONSTRAINT_DECISION_EFFECT_IDS.REDUCE_CONFIDENCE,
          requiresExplicitOperatorAction: true,
          observedAbsenceBehaviorId:
            POLICY_CONSTRAINT_DECISION_ABSENCE_BEHAVIOR_IDS.NOT_A_DECLARATION_SOURCE,
          certificationSemanticId: POLICY_AUTHORING_CERTIFICATION_SEMANTIC_IDS.AVOID_RATING,
          canBlockAutomaticApplication: false,
        }),
        expect.objectContaining({
          controlId: POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.REVIEW_WARNING,
          decisionEffectId: POLICY_CONSTRAINT_DECISION_EFFECT_IDS.REQUEST_REVIEW,
          requiresExplicitOperatorAction: false,
          observedAbsenceBehaviorId:
            POLICY_CONSTRAINT_DECISION_ABSENCE_BEHAVIOR_IDS.REVIEW_WARNING_ONLY,
          certificationSemanticId: null,
          canBlockAutomaticApplication: false,
        }),
      ],
      rawPayloadExposed: false,
    });
    expect(Object.isFrozen(model)).toBe(true);
    expect(buildPolicyConstraintDecisionModelAudit(model)).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
    });
  });

  test('fails closed when a client-facing copy attempts to escalate advisory behavior', () => {
    const model = cloneModel(buildPolicyConstraintDecisionModel());
    const avoid = model.controls.find(
      control => control.controlId === POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.AVOID,
    );
    avoid.decisionEffectId = POLICY_CONSTRAINT_DECISION_EFFECT_IDS.BLOCK_AUTOMATIC_APPLICATION;
    avoid.canBlockAutomaticApplication = true;

    expect(buildPolicyConstraintDecisionModelAudit(model).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_CONSTRAINT_DECISION_MODEL_RISK_IDS.INVALID_CONTROL_SHAPE,
          controlId: POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.AVOID,
        }),
        expect.objectContaining({
          riskId: POLICY_CONSTRAINT_DECISION_MODEL_RISK_IDS.INVALID_DECISION_EFFECT,
          controlId: POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.AVOID,
        }),
      ]),
    );
  });

  test('rejects automatic absence declarations and unapproved display fields', () => {
    const model = cloneModel(buildPolicyConstraintDecisionModel());
    const hardLimit = model.controls.find(
      control => control.controlId === POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
    );
    hardLimit.observedAbsenceBehaviorId =
      POLICY_CONSTRAINT_DECISION_ABSENCE_BEHAVIOR_IDS.REVIEW_WARNING_ONLY;
    hardLimit.values = ['PG-13'];
    model.rawPayloadExposed = true;

    expect(buildPolicyConstraintDecisionModelAudit(model).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_CONSTRAINT_DECISION_MODEL_RISK_IDS.UNEXPECTED_PROPERTY,
          controlId: POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
        }),
        expect.objectContaining({
          riskId: POLICY_CONSTRAINT_DECISION_MODEL_RISK_IDS.INVALID_OBSERVED_ABSENCE_BEHAVIOR,
          controlId: POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
        }),
        expect.objectContaining({
          riskId: POLICY_CONSTRAINT_DECISION_MODEL_RISK_IDS.INVALID_RAW_PAYLOAD_BOUNDARY,
        }),
      ]),
    );
  });
});
