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
  POLICY_AUTHORING_CONSTRAINT_COMMAND_IDS,
  POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS,
  getPolicyAuthoringConstraintControlRecord,
} from './policyAuthoringConstraints.mjs';

const POLICY_CONSTRAINT_DECISION_MODEL_VERSION = 'policy.constraint_decision_model.v1';

const POLICY_CONSTRAINT_DECISION_EFFECT_IDS = Object.freeze({
  BLOCK_AUTOMATIC_APPLICATION: 'block_automatic_application',
  REDUCE_CONFIDENCE: 'reduce_confidence',
  REQUEST_REVIEW: 'request_review',
});

const POLICY_CONSTRAINT_DECISION_ABSENCE_BEHAVIOR_IDS = Object.freeze({
  NOT_A_DECLARATION_SOURCE: 'not_a_declaration_source',
  REVIEW_WARNING_ONLY: 'review_warning_only',
});

const POLICY_CONSTRAINT_DECISION_MODEL_RISK_IDS = Object.freeze({
  INVALID_VERSION: 'invalid_version',
  INVALID_AUTHORITY: 'invalid_authority',
  INVALID_RAW_PAYLOAD_BOUNDARY: 'invalid_raw_payload_boundary',
  INVALID_CONTROL_COUNT: 'invalid_control_count',
  UNKNOWN_CONTROL: 'unknown_control',
  INVALID_CONTROL_SHAPE: 'invalid_control_shape',
  INVALID_DECISION_EFFECT: 'invalid_decision_effect',
  INVALID_OBSERVED_ABSENCE_BEHAVIOR: 'invalid_observed_absence_behavior',
  INVALID_CERTIFICATION_SEMANTIC: 'invalid_certification_semantic',
  UNEXPECTED_PROPERTY: 'unexpected_property',
});

const MODEL_PROPERTY_IDS = new Set([
  'version',
  'authority',
  'controls',
  'rawPayloadExposed',
]);

const AUTHORITY_PROPERTY_IDS = new Set([
  'displayProjection',
  'automationDecision',
  'policyPersistence',
  'routingExecution',
  'runtimeDecision',
  'clientCanInferConstraintMeaning',
]);

const CONTROL_PROPERTY_IDS = new Set([
  'controlId',
  'intentId',
  'label',
  'questionId',
  'description',
  'draftCommandId',
  'decisionEffectId',
  'requiresExplicitOperatorAction',
  'observedAbsenceBehaviorId',
  'certificationSemanticId',
  'canBlockAutomaticApplication',
]);

const CONTROL_DECISION_DEFINITIONS = Object.freeze({
  [POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.HARD_LIMIT]: Object.freeze({
    decisionEffectId: POLICY_CONSTRAINT_DECISION_EFFECT_IDS.BLOCK_AUTOMATIC_APPLICATION,
    observedAbsenceBehaviorId: POLICY_CONSTRAINT_DECISION_ABSENCE_BEHAVIOR_IDS.NOT_A_DECLARATION_SOURCE,
    canBlockAutomaticApplication: true,
  }),
  [POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.AVOID]: Object.freeze({
    decisionEffectId: POLICY_CONSTRAINT_DECISION_EFFECT_IDS.REDUCE_CONFIDENCE,
    observedAbsenceBehaviorId: POLICY_CONSTRAINT_DECISION_ABSENCE_BEHAVIOR_IDS.NOT_A_DECLARATION_SOURCE,
    canBlockAutomaticApplication: false,
  }),
  [POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.REVIEW_WARNING]: Object.freeze({
    decisionEffectId: POLICY_CONSTRAINT_DECISION_EFFECT_IDS.REQUEST_REVIEW,
    observedAbsenceBehaviorId: POLICY_CONSTRAINT_DECISION_ABSENCE_BEHAVIOR_IDS.REVIEW_WARNING_ONLY,
    canBlockAutomaticApplication: false,
  }),
});

const CONTROL_IDS = Object.freeze(Object.keys(CONTROL_DECISION_DEFINITIONS));

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);
  Object.values(value).forEach(item => deepFreeze(item));
  return value;
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyProperties(value, allowedProperties) {
  return isPlainObject(value) && Object.keys(value).every(property => allowedProperties.has(property));
}

function buildPolicyConstraintDecisionControl(controlId) {
  const source = getPolicyAuthoringConstraintControlRecord(controlId);
  const definition = CONTROL_DECISION_DEFINITIONS[controlId];

  if (!source || !definition) {
    throw new Error(`Unsupported policy constraint decision control: ${controlId}`);
  }

  return {
    controlId,
    intentId: source.intentId,
    label: source.visibleLabel,
    questionId: source.questionId,
    description: source.operatorCopy,
    draftCommandId: source.commandId,
    decisionEffectId: definition.decisionEffectId,
    requiresExplicitOperatorAction: source.requiresExplicitOperatorAction,
    observedAbsenceBehaviorId: definition.observedAbsenceBehaviorId,
    certificationSemanticId: source.certificationSemanticId,
    canBlockAutomaticApplication: definition.canBlockAutomaticApplication,
  };
}

function buildPolicyConstraintDecisionModel() {
  return deepFreeze({
    version: POLICY_CONSTRAINT_DECISION_MODEL_VERSION,
    authority: {
      displayProjection: true,
      automationDecision: false,
      policyPersistence: false,
      routingExecution: false,
      runtimeDecision: false,
      clientCanInferConstraintMeaning: false,
    },
    controls: CONTROL_IDS.map(buildPolicyConstraintDecisionControl),
    rawPayloadExposed: false,
  });
}

function buildPolicyConstraintDecisionModelAudit(model = {}) {
  const issues = [];

  if (!hasOnlyProperties(model, MODEL_PROPERTY_IDS)) {
    issues.push({
      riskId: POLICY_CONSTRAINT_DECISION_MODEL_RISK_IDS.UNEXPECTED_PROPERTY,
      message: 'Constraint decision models must expose only the approved display fields.',
    });
  }

  if (model?.version !== POLICY_CONSTRAINT_DECISION_MODEL_VERSION) {
    issues.push({
      riskId: POLICY_CONSTRAINT_DECISION_MODEL_RISK_IDS.INVALID_VERSION,
      message: 'Constraint decision models must use the current version.',
    });
  }

  const authority = model?.authority;
  if (
    !hasOnlyProperties(authority, AUTHORITY_PROPERTY_IDS) ||
    authority.displayProjection !== true ||
    authority.automationDecision !== false ||
    authority.policyPersistence !== false ||
    authority.routingExecution !== false ||
    authority.runtimeDecision !== false ||
    authority.clientCanInferConstraintMeaning !== false
  ) {
    issues.push({
      riskId: POLICY_CONSTRAINT_DECISION_MODEL_RISK_IDS.INVALID_AUTHORITY,
      message: 'Constraint decision models must remain server-owned display projections.',
    });
  }

  if (model?.rawPayloadExposed !== false) {
    issues.push({
      riskId: POLICY_CONSTRAINT_DECISION_MODEL_RISK_IDS.INVALID_RAW_PAYLOAD_BOUNDARY,
      message: 'Constraint decision models must not expose raw evidence or input payloads.',
    });
  }

  const controls = Array.isArray(model?.controls) ? model.controls : [];
  if (controls.length !== CONTROL_IDS.length) {
    issues.push({
      riskId: POLICY_CONSTRAINT_DECISION_MODEL_RISK_IDS.INVALID_CONTROL_COUNT,
      message: 'Constraint decision models must expose each supported control exactly once.',
    });
  }

  const observedControlIds = new Set();
  controls.forEach((control) => {
    const controlId = control?.controlId;
    if (!CONTROL_IDS.includes(controlId) || observedControlIds.has(controlId)) {
      issues.push({
        riskId: POLICY_CONSTRAINT_DECISION_MODEL_RISK_IDS.UNKNOWN_CONTROL,
        controlId: controlId || null,
        message: 'Constraint decision models must use known, non-duplicated controls.',
      });
      return;
    }
    observedControlIds.add(controlId);

    const expected = buildPolicyConstraintDecisionControl(controlId);
    if (!hasOnlyProperties(control, CONTROL_PROPERTY_IDS)) {
      issues.push({
        riskId: POLICY_CONSTRAINT_DECISION_MODEL_RISK_IDS.UNEXPECTED_PROPERTY,
        controlId,
        message: 'Constraint decision controls must expose only approved display fields.',
      });
    }

    if (
      control.intentId !== expected.intentId ||
      control.label !== expected.label ||
      control.questionId !== expected.questionId ||
      control.description !== expected.description ||
      control.draftCommandId !== expected.draftCommandId ||
      control.requiresExplicitOperatorAction !== expected.requiresExplicitOperatorAction ||
      control.canBlockAutomaticApplication !== expected.canBlockAutomaticApplication
    ) {
      issues.push({
        riskId: POLICY_CONSTRAINT_DECISION_MODEL_RISK_IDS.INVALID_CONTROL_SHAPE,
        controlId,
        message: 'Constraint decision control metadata must remain server-owned and exact.',
      });
    }

    if (!Object.values(POLICY_AUTHORING_CONSTRAINT_COMMAND_IDS).includes(control.draftCommandId)) {
      issues.push({
        riskId: POLICY_CONSTRAINT_DECISION_MODEL_RISK_IDS.INVALID_CONTROL_SHAPE,
        controlId,
        message: 'Constraint decision controls must retain an approved typed draft command.',
      });
    }

    if (control.decisionEffectId !== expected.decisionEffectId) {
      issues.push({
        riskId: POLICY_CONSTRAINT_DECISION_MODEL_RISK_IDS.INVALID_DECISION_EFFECT,
        controlId,
        message: 'Constraint decision controls must retain their declared decision effect.',
      });
    }

    if (control.observedAbsenceBehaviorId !== expected.observedAbsenceBehaviorId) {
      issues.push({
        riskId: POLICY_CONSTRAINT_DECISION_MODEL_RISK_IDS.INVALID_OBSERVED_ABSENCE_BEHAVIOR,
        controlId,
        message: 'Observed absence must remain non-declarative or review-warning-only.',
      });
    }

    if (control.certificationSemanticId !== expected.certificationSemanticId) {
      issues.push({
        riskId: POLICY_CONSTRAINT_DECISION_MODEL_RISK_IDS.INVALID_CERTIFICATION_SEMANTIC,
        controlId,
        message: 'Constraint decision controls must retain separate certification semantics.',
      });
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

const policyConstraintDecisionModel = buildPolicyConstraintDecisionModel();

export {
  POLICY_CONSTRAINT_DECISION_ABSENCE_BEHAVIOR_IDS,
  POLICY_CONSTRAINT_DECISION_EFFECT_IDS,
  POLICY_CONSTRAINT_DECISION_MODEL_RISK_IDS,
  POLICY_CONSTRAINT_DECISION_MODEL_VERSION,
  buildPolicyConstraintDecisionModel,
  buildPolicyConstraintDecisionModelAudit,
  policyConstraintDecisionModel,
};
