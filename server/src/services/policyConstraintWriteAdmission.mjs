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
  buildPolicyConstraintDecisionModel,
  buildPolicyConstraintDecisionModelAudit,
} from './policyConstraintDecisionModel.mjs';
import {
  buildPolicyConstraintValueEligibility,
  buildPolicyConstraintValueEligibilityAudit,
  isPolicyConstraintValueEligible,
  POLICY_CONSTRAINT_VALUE_ELIGIBILITY_STATUS_IDS,
} from './policyConstraintValueEligibility.mjs';
import {
  POLICY_CONSTRAINT_WRITE_ADMISSION_REQUEST_VERSION,
  POLICY_CONSTRAINT_WRITE_ADMISSION_RISK_IDS,
  POLICY_CONSTRAINT_WRITE_ADMISSION_STATUS_IDS,
  POLICY_CONSTRAINT_WRITE_ADMISSION_VERSION,
  asObject,
  buildPolicyConstraintWriteAdmissionAuthority,
  buildPolicyConstraintWriteAdmissionIssue,
  buildPolicyConstraintWriteAdmissionResult,
  buildPolicyConstraintWriteAdmissionSideEffects,
  normalizeActor,
  normalizeLibrary,
  normalizePositiveInteger,
  validatePolicyConstraintWriteAdmissionRequest,
} from './policyConstraintWriteAdmissionContract.mjs';

function buildServerDerivedCommand({ command, decisionControl }) {
  return {
    commandId: decisionControl.draftCommandId,
    controlId: decisionControl.controlId,
    intentId: decisionControl.intentId,
    decisionEffectId: decisionControl.decisionEffectId,
    certificationSemanticId: decisionControl.certificationSemanticId,
    values: [command.values[0]],
    sourceId: 'operator_declared',
    explicitOperatorAction: true,
    inferredFromAbsence: false,
  };
}

function commandMatchesServerDerivedSemantics({ command, decisionControl }) {
  const expected = buildServerDerivedCommand({ command, decisionControl });

  return command.commandId === expected.commandId &&
    command.controlId === expected.controlId &&
    command.intentId === expected.intentId &&
    command.decisionEffectId === expected.decisionEffectId &&
    command.certificationSemanticId === expected.certificationSemanticId &&
    command.sourceId === expected.sourceId &&
    command.explicitOperatorAction === expected.explicitOperatorAction &&
    command.inferredFromAbsence === expected.inferredFromAbsence;
}

function deriveConstraintProjections({ library } = {}) {
  const decisionModel = buildPolicyConstraintDecisionModel();
  const valueEligibility = buildPolicyConstraintValueEligibility({ library });
  const decisionAudit = buildPolicyConstraintDecisionModelAudit(decisionModel);
  const eligibilityAudit = buildPolicyConstraintValueEligibilityAudit(
    valueEligibility,
    { library },
  );

  return {
    decisionModel,
    valueEligibility,
    decisionAudit,
    eligibilityAudit,
  };
}

function admitPolicyConstraintWrite({ payload, actor, library } = {}) {
  const requestValidation = validatePolicyConstraintWriteAdmissionRequest(payload);
  const normalizedLibrary = normalizeLibrary(library);
  if (!requestValidation.ok) {
    return buildPolicyConstraintWriteAdmissionResult({
      statusId: POLICY_CONSTRAINT_WRITE_ADMISSION_STATUS_IDS.INVALID_REQUEST,
      ok: false,
      library: normalizedLibrary,
      issue: buildPolicyConstraintWriteAdmissionIssue(
        POLICY_CONSTRAINT_WRITE_ADMISSION_RISK_IDS.INVALID_REQUEST,
        'Constraint write admission request is invalid.',
      ),
    });
  }

  const normalizedActor = normalizeActor(actor);
  if (
    normalizedActor.authenticated !== true ||
    normalizedActor.id === null ||
    normalizedActor.role !== 'admin'
  ) {
    return buildPolicyConstraintWriteAdmissionResult({
      statusId: POLICY_CONSTRAINT_WRITE_ADMISSION_STATUS_IDS.UNAUTHORIZED_ACTOR,
      ok: false,
      library: normalizedLibrary,
      issue: buildPolicyConstraintWriteAdmissionIssue(
        POLICY_CONSTRAINT_WRITE_ADMISSION_RISK_IDS.UNAUTHORIZED_ACTOR,
        'Constraint write admission requires an authenticated administrator.',
      ),
    });
  }

  if (normalizedLibrary.id === null) {
    return buildPolicyConstraintWriteAdmissionResult({
      statusId: POLICY_CONSTRAINT_WRITE_ADMISSION_STATUS_IDS.INVALID_LIBRARY_CONTEXT,
      ok: false,
      library: normalizedLibrary,
      issue: buildPolicyConstraintWriteAdmissionIssue(
        POLICY_CONSTRAINT_WRITE_ADMISSION_RISK_IDS.INVALID_LIBRARY_CONTEXT,
        'Constraint write admission requires an active server-owned library.',
      ),
    });
  }

  const {
    decisionModel,
    valueEligibility,
    decisionAudit,
    eligibilityAudit,
  } = deriveConstraintProjections({ library: normalizedLibrary });
  if (!decisionAudit.ok) {
    return buildPolicyConstraintWriteAdmissionResult({
      statusId: POLICY_CONSTRAINT_WRITE_ADMISSION_STATUS_IDS.CONTRACT_UNAVAILABLE,
      ok: false,
      library: normalizedLibrary,
      issue: buildPolicyConstraintWriteAdmissionIssue(
        POLICY_CONSTRAINT_WRITE_ADMISSION_RISK_IDS.DECISION_MODEL_UNAVAILABLE,
        'Constraint admission is temporarily unavailable.',
      ),
    });
  }

  if (!eligibilityAudit.ok) {
    return buildPolicyConstraintWriteAdmissionResult({
      statusId: POLICY_CONSTRAINT_WRITE_ADMISSION_STATUS_IDS.CONTRACT_UNAVAILABLE,
      ok: false,
      library: normalizedLibrary,
      issue: buildPolicyConstraintWriteAdmissionIssue(
        POLICY_CONSTRAINT_WRITE_ADMISSION_RISK_IDS.VALUE_ELIGIBILITY_UNAVAILABLE,
        'Constraint admission is temporarily unavailable.',
      ),
    });
  }

  if (valueEligibility.statusId !== POLICY_CONSTRAINT_VALUE_ELIGIBILITY_STATUS_IDS.READY) {
    return buildPolicyConstraintWriteAdmissionResult({
      statusId: POLICY_CONSTRAINT_WRITE_ADMISSION_STATUS_IDS.UNSUPPORTED_LIBRARY_MEDIA_TYPE,
      ok: false,
      library: normalizedLibrary,
      issue: buildPolicyConstraintWriteAdmissionIssue(
        POLICY_CONSTRAINT_WRITE_ADMISSION_RISK_IDS.UNSUPPORTED_LIBRARY_MEDIA_TYPE,
        'Constraint admission is unavailable for this library media type.',
      ),
    });
  }

  const command = requestValidation.request.command;
  const decisionControl = decisionModel.controls.find(
    control => control.controlId === command.controlId,
  );
  if (!decisionControl || !commandMatchesServerDerivedSemantics({ command, decisionControl })) {
    return buildPolicyConstraintWriteAdmissionResult({
      statusId: POLICY_CONSTRAINT_WRITE_ADMISSION_STATUS_IDS.COMMAND_NOT_ELIGIBLE,
      ok: false,
      library: normalizedLibrary,
      issue: buildPolicyConstraintWriteAdmissionIssue(
        POLICY_CONSTRAINT_WRITE_ADMISSION_RISK_IDS.COMMAND_SEMANTICS_MISMATCH,
        'Constraint command does not match the active server-owned control semantics.',
      ),
    });
  }

  if (!isPolicyConstraintValueEligible({
    projection: valueEligibility,
    controlId: command.controlId,
    value: command.values[0],
  })) {
    return buildPolicyConstraintWriteAdmissionResult({
      statusId: POLICY_CONSTRAINT_WRITE_ADMISSION_STATUS_IDS.COMMAND_NOT_ELIGIBLE,
      ok: false,
      library: normalizedLibrary,
      issue: buildPolicyConstraintWriteAdmissionIssue(
        POLICY_CONSTRAINT_WRITE_ADMISSION_RISK_IDS.COMMAND_VALUE_NOT_ELIGIBLE,
        'Constraint command value is not eligible for the active library.',
      ),
    });
  }

  return buildPolicyConstraintWriteAdmissionResult({
    statusId: POLICY_CONSTRAINT_WRITE_ADMISSION_STATUS_IDS.ADMITTED,
    ok: true,
    library: normalizedLibrary,
    admittedCommand: buildServerDerivedCommand({ command, decisionControl }),
  });
}

function buildPolicyConstraintWriteAdmissionAudit(result = {}) {
  const source = asObject(result);
  const issues = [];
  const expectedAuthority = buildPolicyConstraintWriteAdmissionAuthority();
  const expectedSideEffects = buildPolicyConstraintWriteAdmissionSideEffects();
  const validStatus = Object.values(POLICY_CONSTRAINT_WRITE_ADMISSION_STATUS_IDS)
    .includes(source.statusId);

  if (source.version !== POLICY_CONSTRAINT_WRITE_ADMISSION_VERSION || !validStatus) {
    issues.push(buildPolicyConstraintWriteAdmissionIssue(
      POLICY_CONSTRAINT_WRITE_ADMISSION_RISK_IDS.INVALID_ADMISSION_RESULT,
      'Constraint write admission result must use a known contract version and status.',
    ));
  }

  if (source.issueCount !== (Array.isArray(source.issues) ? source.issues.length : 0)) {
    issues.push(buildPolicyConstraintWriteAdmissionIssue(
      POLICY_CONSTRAINT_WRITE_ADMISSION_RISK_IDS.INVALID_ADMISSION_RESULT,
      'Constraint write admission issue count must match the returned issues.',
    ));
  }

  if (JSON.stringify(source.authority) !== JSON.stringify(expectedAuthority)) {
    issues.push(buildPolicyConstraintWriteAdmissionIssue(
      POLICY_CONSTRAINT_WRITE_ADMISSION_RISK_IDS.INVALID_ADMISSION_RESULT,
      'Constraint write admission must retain its non-persistent authority boundary.',
    ));
  }

  if (JSON.stringify(source.sideEffects) !== JSON.stringify(expectedSideEffects)) {
    issues.push(buildPolicyConstraintWriteAdmissionIssue(
      POLICY_CONSTRAINT_WRITE_ADMISSION_RISK_IDS.UNSAFE_SIDE_EFFECT,
      'Constraint write admission must not mutate policy, routing, runtime, learning, or provider state.',
    ));
  }

  if (source.rawPayloadExposed !== false) {
    issues.push(buildPolicyConstraintWriteAdmissionIssue(
      POLICY_CONSTRAINT_WRITE_ADMISSION_RISK_IDS.INVALID_ADMISSION_RESULT,
      'Constraint write admission must not expose raw request payloads.',
    ));
  }

  if (Object.prototype.hasOwnProperty.call(source, 'nextStep')) {
    issues.push(buildPolicyConstraintWriteAdmissionIssue(
      POLICY_CONSTRAINT_WRITE_ADMISSION_RISK_IDS.NORMAL_WORKFLOW_HANDOFF_EXPOSED,
      'Constraint write admission must not expose a normal-workflow next action.',
    ));
  }

  if (source.ok === true) {
    const command = asObject(source.admittedCommand);
    const resultLibrary = asObject(source.library);
    const auditLibrary = {
      id: normalizePositiveInteger(resultLibrary.id),
      media_type: resultLibrary.mediaTypeFamilyId,
    };
    const auditDecisionModel = buildPolicyConstraintDecisionModel();
    const auditValueEligibility = buildPolicyConstraintValueEligibility({ library: auditLibrary });
    const auditDecisionControl = auditDecisionModel.controls.find(
      control => control.controlId === command.controlId,
    );
    if (
      source.statusId !== POLICY_CONSTRAINT_WRITE_ADMISSION_STATUS_IDS.ADMITTED ||
      auditLibrary.id === null ||
      auditValueEligibility.statusId !== POLICY_CONSTRAINT_VALUE_ELIGIBILITY_STATUS_IDS.READY ||
      !command.commandId ||
      !command.controlId ||
      !Array.isArray(command.values) ||
      command.values.length !== 1 ||
      !auditDecisionControl ||
      !commandMatchesServerDerivedSemantics({ command, decisionControl: auditDecisionControl }) ||
      !isPolicyConstraintValueEligible({
        projection: auditValueEligibility,
        controlId: command.controlId,
        value: command.values[0],
      })
    ) {
      issues.push(buildPolicyConstraintWriteAdmissionIssue(
        POLICY_CONSTRAINT_WRITE_ADMISSION_RISK_IDS.INVALID_ADMISSION_RESULT,
        'Admitted constraint commands require one normalized command with no storage authority.',
      ));
    }
  } else if (source.admittedCommand !== null) {
    issues.push(buildPolicyConstraintWriteAdmissionIssue(
      POLICY_CONSTRAINT_WRITE_ADMISSION_RISK_IDS.INVALID_ADMISSION_RESULT,
      'Rejected constraint admissions cannot expose an admitted command.',
    ));
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_CONSTRAINT_WRITE_ADMISSION_REQUEST_VERSION,
  POLICY_CONSTRAINT_WRITE_ADMISSION_RISK_IDS,
  POLICY_CONSTRAINT_WRITE_ADMISSION_STATUS_IDS,
  POLICY_CONSTRAINT_WRITE_ADMISSION_VERSION,
  admitPolicyConstraintWrite,
  buildPolicyConstraintWriteAdmissionAudit,
  deriveConstraintProjections,
  validatePolicyConstraintWriteAdmissionRequest,
};
