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
  admitPolicyConstraintWrite,
  buildPolicyConstraintWriteAdmissionAudit,
  POLICY_CONSTRAINT_WRITE_ADMISSION_REQUEST_VERSION,
  POLICY_CONSTRAINT_WRITE_ADMISSION_RISK_IDS,
  POLICY_CONSTRAINT_WRITE_ADMISSION_STATUS_IDS,
  POLICY_CONSTRAINT_WRITE_ADMISSION_VERSION,
  validatePolicyConstraintWriteAdmissionRequest,
} from '../../services/policyConstraintWriteAdmission.mjs';

function buildPayload(command = {}) {
  return {
    version: POLICY_CONSTRAINT_WRITE_ADMISSION_REQUEST_VERSION,
    command: {
      commandId: 'set_hard_limit',
      controlId: 'hard_limit',
      intentId: 'blocking_constraint',
      decisionEffectId: 'block_automatic_application',
      certificationSemanticId: 'max_allowed_rating',
      values: ['PG-13'],
      sourceId: 'operator_declared',
      explicitOperatorAction: true,
      inferredFromAbsence: false,
      ...command,
    },
  };
}

function buildActor(overrides = {}) {
  return {
    id: 42,
    role: 'admin',
    authenticated: true,
    ...overrides,
  };
}

describe('policyConstraintWriteAdmission', () => {
  test('rederives and admits one eligible explicit command without persistence authority', () => {
    const result = admitPolicyConstraintWrite({
      payload: buildPayload(),
      actor: buildActor(),
      library: { id: 6, media_type: 'movie' },
    });

    expect(result).toEqual(expect.objectContaining({
      version: POLICY_CONSTRAINT_WRITE_ADMISSION_VERSION,
      ok: true,
      statusId: POLICY_CONSTRAINT_WRITE_ADMISSION_STATUS_IDS.ADMITTED,
      issueCount: 0,
      issues: [],
      library: { id: 6, mediaTypeFamilyId: 'movie' },
      admittedCommand: {
        commandId: 'set_hard_limit',
        controlId: 'hard_limit',
        intentId: 'blocking_constraint',
        decisionEffectId: 'block_automatic_application',
        certificationSemanticId: 'max_allowed_rating',
        values: ['PG-13'],
        sourceId: 'operator_declared',
        explicitOperatorAction: true,
        inferredFromAbsence: false,
      },
      authority: {
        serverAdmission: true,
        clientCommandAuthoritative: false,
        policyPersistence: false,
        runtimeDecision: false,
        routingExecution: false,
        learningMutation: false,
      },
      sideEffects: {
        libraryContextRead: true,
        policyStorageMutated: false,
        runtimeDecisionExecuted: false,
        routingExecuted: false,
        learningMutated: false,
        liveMediaServerLookupPerformed: false,
        liveProviderLookupPerformed: false,
        providerQuotaRead: false,
      },
      rawPayloadExposed: false,
      nextStep: expect.objectContaining({ stepId: 'native_constraint_storage' }),
    }));
    expect(buildPolicyConstraintWriteAdmissionAudit(result)).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
    });
  });

  test('rejects a command whose client-provided semantics do not match the server-derived control', () => {
    const result = admitPolicyConstraintWrite({
      payload: buildPayload({ decisionEffectId: 'reduce_confidence' }),
      actor: buildActor(),
      library: { id: 6, media_type: 'movie' },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_CONSTRAINT_WRITE_ADMISSION_STATUS_IDS.COMMAND_NOT_ELIGIBLE,
      admittedCommand: null,
      nextStep: null,
      rawPayloadExposed: false,
    }));
    expect(result.issues).toEqual([expect.objectContaining({
      riskId: POLICY_CONSTRAINT_WRITE_ADMISSION_RISK_IDS.COMMAND_SEMANTICS_MISMATCH,
    })]);
  });

  test('fails closed for values that do not belong to the active library media type', () => {
    const result = admitPolicyConstraintWrite({
      payload: buildPayload({ values: ['TV-14'] }),
      actor: buildActor(),
      library: { id: 6, media_type: 'movie' },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_CONSTRAINT_WRITE_ADMISSION_STATUS_IDS.COMMAND_NOT_ELIGIBLE,
      admittedCommand: null,
    }));
    expect(result.issues).toEqual([expect.objectContaining({
      riskId: POLICY_CONSTRAINT_WRITE_ADMISSION_RISK_IDS.COMMAND_VALUE_NOT_ELIGIBLE,
    })]);
  });

  test('rejects unexpected fields and non-admin actors before a command can be admitted', () => {
    const invalidRequest = validatePolicyConstraintWriteAdmissionRequest({
      ...buildPayload(),
      policyId: 44,
    });
    expect(invalidRequest.ok).toBe(false);

    const invalidResult = admitPolicyConstraintWrite({
      payload: { ...buildPayload(), policyId: 44 },
      actor: buildActor(),
      library: { id: 6, media_type: 'movie' },
    });
    expect(invalidResult.statusId).toBe(
      POLICY_CONSTRAINT_WRITE_ADMISSION_STATUS_IDS.INVALID_REQUEST,
    );

    const unauthorizedResult = admitPolicyConstraintWrite({
      payload: buildPayload(),
      actor: buildActor({ role: 'operator' }),
      library: { id: 6, media_type: 'movie' },
    });
    expect(unauthorizedResult.statusId).toBe(
      POLICY_CONSTRAINT_WRITE_ADMISSION_STATUS_IDS.UNAUTHORIZED_ACTOR,
    );
    expect(unauthorizedResult.issues).toEqual([expect.objectContaining({
      riskId: POLICY_CONSTRAINT_WRITE_ADMISSION_RISK_IDS.UNAUTHORIZED_ACTOR,
    })]);
  });

  test('does not construct a generic constraint control for an unsupported library type', () => {
    const result = admitPolicyConstraintWrite({
      payload: buildPayload(),
      actor: buildActor(),
      library: { id: 6, media_type: 'music' },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_CONSTRAINT_WRITE_ADMISSION_STATUS_IDS.UNSUPPORTED_LIBRARY_MEDIA_TYPE,
      library: { id: 6, mediaTypeFamilyId: null },
      admittedCommand: null,
    }));
  });

  test('requires an active library identity in addition to a supported media type', () => {
    const result = admitPolicyConstraintWrite({
      payload: buildPayload(),
      actor: buildActor(),
      library: { media_type: 'movie' },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_CONSTRAINT_WRITE_ADMISSION_STATUS_IDS.INVALID_LIBRARY_CONTEXT,
      admittedCommand: null,
    }));
    expect(result.issues).toEqual([expect.objectContaining({
      riskId: POLICY_CONSTRAINT_WRITE_ADMISSION_RISK_IDS.INVALID_LIBRARY_CONTEXT,
    })]);
  });

  test('audit detects a result that claims persistence or returns an admitted command after rejection', () => {
    const result = admitPolicyConstraintWrite({
      payload: buildPayload(),
      actor: buildActor(),
      library: { id: 6, media_type: 'movie' },
    });
    const tampered = JSON.parse(JSON.stringify(result));
    tampered.sideEffects.policyStorageMutated = true;
    tampered.ok = false;
    tampered.statusId = POLICY_CONSTRAINT_WRITE_ADMISSION_STATUS_IDS.COMMAND_NOT_ELIGIBLE;
    tampered.nextStep = null;

    const audit = buildPolicyConstraintWriteAdmissionAudit(tampered);
    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_CONSTRAINT_WRITE_ADMISSION_RISK_IDS.UNSAFE_SIDE_EFFECT,
      }),
      expect.objectContaining({
        riskId: POLICY_CONSTRAINT_WRITE_ADMISSION_RISK_IDS.INVALID_ADMISSION_RESULT,
      }),
    ]));
  });

  test('audit rejects a tampered admitted command even when its surrounding result claims success', () => {
    const result = admitPolicyConstraintWrite({
      payload: buildPayload(),
      actor: buildActor(),
      library: { id: 6, media_type: 'movie' },
    });
    const tampered = JSON.parse(JSON.stringify(result));
    tampered.admittedCommand.decisionEffectId = 'reduce_confidence';

    const audit = buildPolicyConstraintWriteAdmissionAudit(tampered);
    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual([expect.objectContaining({
      riskId: POLICY_CONSTRAINT_WRITE_ADMISSION_RISK_IDS.INVALID_ADMISSION_RESULT,
    })]);
  });
});
