/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const POLICY_MATERIAL_EXCEPTION_PRESENTATION_VERSION =
  'policy.material_exception_presentation.v1';

const POLICY_MATERIAL_EXCEPTION_IDS = Object.freeze({
  HARD_LIMIT_CONFLICT: 'hard_limit_conflict',
  ROUTING_GAP: 'routing_gap',
  REVIEW_REQUIRED: 'review_required',
  RECOVERY_IN_PROGRESS: 'recovery_in_progress',
});

const POLICY_MATERIAL_EXCEPTION_EFFECT_IDS = Object.freeze({
  BLOCK_AUTOMATIC_APPLICATION: 'block_automatic_application',
  NEEDS_ROUTING: 'needs_routing',
  REQUEST_REVIEW: 'request_review',
  INFORMATIONAL: 'informational',
});

const POLICY_MATERIAL_EXCEPTION_RISK_IDS = Object.freeze({
  VERSION_MISMATCH: 'version_mismatch',
  READY_WITH_EXCEPTIONS: 'ready_with_exceptions',
  MULTIPLE_PRIMARY_EXCEPTIONS: 'multiple_primary_exceptions',
  UNKNOWN_EXCEPTION_ID: 'unknown_exception_id',
  UNKNOWN_EFFECT_ID: 'unknown_effect_id',
  RECOVERY_NOT_INFORMATIONAL: 'recovery_not_informational',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  OPTIONAL_CONTROLS_NOT_HIDDEN_WHEN_NO_CONFLICT: 'optional_controls_not_hidden_when_no_conflict',
});

const EXCEPTION_PRIORITY = Object.freeze([
  POLICY_MATERIAL_EXCEPTION_IDS.HARD_LIMIT_CONFLICT,
  POLICY_MATERIAL_EXCEPTION_IDS.ROUTING_GAP,
  POLICY_MATERIAL_EXCEPTION_IDS.REVIEW_REQUIRED,
  POLICY_MATERIAL_EXCEPTION_IDS.RECOVERY_IN_PROGRESS,
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBoolean(value) {
  return value === true;
}

function buildException(exceptionId, effectId, summary, resolution) {
  return {
    exceptionId,
    effectId,
    summary,
    resolution: {
      actionId: normalizeString(resolution?.actionId),
      ownerId: normalizeString(resolution?.ownerId),
      sectionId: normalizeString(resolution?.sectionId) || null,
      automated: normalizeBoolean(resolution?.automated),
    },
  };
}

function evaluateHardLimitConflict(readinessState, constraintModel) {
  const stateId = normalizeString(readinessState);
  if (stateId !== 'blocked_by_hard_limit') return null;

  const controls = asArray(asObject(constraintModel).controls);
  const hardLimitControl = controls.find(control =>
    normalizeString(control.controlId) === 'hard_limit' &&
    control.canBlockAutomaticApplication === true);
  if (!hardLimitControl) return null;

  return buildException(
    POLICY_MATERIAL_EXCEPTION_IDS.HARD_LIMIT_CONFLICT,
    POLICY_MATERIAL_EXCEPTION_EFFECT_IDS.BLOCK_AUTOMATIC_APPLICATION,
    'A hard-limit constraint blocks automatic application for this destination.',
    {
      actionId: 'resolve_hard_limit',
      ownerId: 'HARD_LIMIT_CONTROL',
      sectionId: 'what_should_not_go_here',
      automated: false,
    },
  );
}

function evaluateRoutingGap(readinessState, routingAvailable) {
  const stateId = normalizeString(readinessState);
  if (stateId !== 'needs_routing' && routingAvailable !== false) return null;

  if (stateId !== 'needs_routing') return null;

  return buildException(
    POLICY_MATERIAL_EXCEPTION_IDS.ROUTING_GAP,
    POLICY_MATERIAL_EXCEPTION_EFFECT_IDS.NEEDS_ROUTING,
    'This destination has no Arr routing mapping configured.',
    {
      actionId: 'configure_routing',
      ownerId: 'LIBRARY_MAPPING',
      sectionId: 'can_this_route',
      automated: false,
    },
  );
}

function evaluateReviewRequired(readinessState) {
  const stateId = normalizeString(readinessState);
  if (stateId !== 'needs_operator_review') return null;

  return buildException(
    POLICY_MATERIAL_EXCEPTION_IDS.REVIEW_REQUIRED,
    POLICY_MATERIAL_EXCEPTION_EFFECT_IDS.REQUEST_REVIEW,
    'The server has declared a review condition for this destination.',
    {
      actionId: 'review_condition',
      ownerId: 'REVIEW_TRIGGER_CONTROL',
      sectionId: 'when_should_classifarr_ask',
      automated: false,
    },
  );
}

function evaluateRecoveryInProgress(readinessState) {
  const stateId = normalizeString(readinessState);
  if (stateId !== 'stale_profile') return null;

  return buildException(
    POLICY_MATERIAL_EXCEPTION_IDS.RECOVERY_IN_PROGRESS,
    POLICY_MATERIAL_EXCEPTION_EFFECT_IDS.INFORMATIONAL,
    'Profile evidence is being refreshed automatically. No action is required.',
    {
      actionId: 'await_automatic_recovery',
      ownerId: null,
      sectionId: null,
      automated: true,
    },
  );
}

function hasOptionalControlValues(constraintModel) {
  const controls = asArray(asObject(constraintModel).controls);
  return controls.some(control => {
    const controlId = normalizeString(control.controlId);
    return (controlId === 'avoid' || controlId === 'review_warning' || controlId === 'helpful_matches') &&
      asArray(control.values).length > 0;
  });
}

function buildPolicyMaterialExceptionPresentation({
  readinessState,
  constraintDecisionModel,
  routingAvailable = true,
} = {}) {
  const readinessStateId = normalizeString(asObject(readinessState).stateId ??
    readinessState);
  const constraintModel = asObject(constraintDecisionModel);

  const exceptions = [];
  const hardLimit = evaluateHardLimitConflict(readinessStateId, constraintModel);
  if (hardLimit) exceptions.push(hardLimit);

  const routingGap = evaluateRoutingGap(readinessStateId, routingAvailable);
  if (routingGap) exceptions.push(routingGap);

  const reviewRequired = evaluateReviewRequired(readinessStateId);
  if (reviewRequired) exceptions.push(reviewRequired);

  const recovery = evaluateRecoveryInProgress(readinessStateId);
  if (recovery) exceptions.push(recovery);

  const hasMaterialException = exceptions.length > 0 &&
    exceptions.some(exception =>
      exception.effectId !== POLICY_MATERIAL_EXCEPTION_EFFECT_IDS.INFORMATIONAL);

  const primaryException = exceptions.length > 0
    ? exceptions.slice().sort((a, b) => {
        const aIdx = EXCEPTION_PRIORITY.indexOf(a.exceptionId);
        const bIdx = EXCEPTION_PRIORITY.indexOf(b.exceptionId);
        return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
      })[0]
    : null;

  const optionalControlsHaveValues = hasOptionalControlValues(constraintModel);
  const isReadyOrInformationalOnly = !hasMaterialException;

  const presentation = {
    version: POLICY_MATERIAL_EXCEPTION_PRESENTATION_VERSION,
    hasMaterialException,
    exceptions,
    primaryExceptionId: primaryException?.exceptionId ?? null,
    primaryExceptionEffect: primaryException?.effectId ?? null,
    optionalControlsHidden: isReadyOrInformationalOnly && !optionalControlsHaveValues,
    authority: {
      displayProjection: true,
      automationDecision: false,
      policyPersistence: false,
      routingExecution: false,
    },
    sideEffects: {
      policyStorageMutated: false,
      routingWritten: false,
      learningWritten: false,
      providerAccessed: false,
      recoveryTriggered: false,
    },
  };

  presentation.validation = validatePolicyMaterialExceptionPresentation(presentation, {
    readinessStateId,
    hasMaterialException,
  });

  return presentation;
}

function validatePolicyMaterialExceptionPresentation(presentation, context = {}) {
  const normalized = asObject(presentation);
  const issues = [];

  if (normalizeString(normalized.version) !==
      POLICY_MATERIAL_EXCEPTION_PRESENTATION_VERSION) {
    issues.push({
      riskId: POLICY_MATERIAL_EXCEPTION_RISK_IDS.VERSION_MISMATCH,
      message: 'Material exception presentation must use the supported version.',
    });
  }

  const exceptions = asArray(normalized.exceptions);
  const validExceptionIds = Object.values(POLICY_MATERIAL_EXCEPTION_IDS);
  const validEffectIds = Object.values(POLICY_MATERIAL_EXCEPTION_EFFECT_IDS);

  exceptions.forEach(exception => {
    const exceptionId = normalizeString(asObject(exception).exceptionId);
    const effectId = normalizeString(asObject(exception).effectId);

    if (!validExceptionIds.includes(exceptionId)) {
      issues.push({
        riskId: POLICY_MATERIAL_EXCEPTION_RISK_IDS.UNKNOWN_EXCEPTION_ID,
        message: `Unknown material exception ID "${exceptionId}".`,
      });
    }

    if (!validEffectIds.includes(effectId)) {
      issues.push({
        riskId: POLICY_MATERIAL_EXCEPTION_RISK_IDS.UNKNOWN_EFFECT_ID,
        message: `Unknown material exception effect ID "${effectId}".`,
      });
    }

    if (exceptionId === POLICY_MATERIAL_EXCEPTION_IDS.RECOVERY_IN_PROGRESS &&
        effectId !== POLICY_MATERIAL_EXCEPTION_EFFECT_IDS.INFORMATIONAL) {
      issues.push({
        riskId: POLICY_MATERIAL_EXCEPTION_RISK_IDS.RECOVERY_NOT_INFORMATIONAL,
        message: 'Recovery-in-progress exception must be informational.',
      });
    }
  });

  const readyState = normalizeString(context.readinessStateId) === 'ready';
  if (readyState && exceptions.length > 0) {
    issues.push({
      riskId: POLICY_MATERIAL_EXCEPTION_RISK_IDS.READY_WITH_EXCEPTIONS,
      message: 'A ready destination must not carry material exceptions.',
    });
  }

  if (normalizeBoolean(normalized.hasMaterialException) && exceptions.length === 0) {
    issues.push({
      riskId: POLICY_MATERIAL_EXCEPTION_RISK_IDS.READY_WITH_EXCEPTIONS,
      message: 'hasMaterialException cannot be true when the exception list is empty.',
    });
  }

  const sideEffects = asObject(normalized.sideEffects);
  Object.entries(sideEffects).forEach(([key, value]) => {
    if (value === true) {
      issues.push({
        riskId: POLICY_MATERIAL_EXCEPTION_RISK_IDS.SIDE_EFFECT_PERFORMED,
        message: `Material exception presentation cannot perform side effect "${key}".`,
      });
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_MATERIAL_EXCEPTION_EFFECT_IDS,
  POLICY_MATERIAL_EXCEPTION_IDS,
  POLICY_MATERIAL_EXCEPTION_PRESENTATION_VERSION,
  POLICY_MATERIAL_EXCEPTION_RISK_IDS,
  buildPolicyMaterialExceptionPresentation,
  validatePolicyMaterialExceptionPresentation,
};
