/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';

import {
  POLICY_RUNTIME_DESTINATION_EVIDENCE_COMMAND_STATUS_IDS,
  PolicyRuntimeDestinationEvidenceCommandError,
  PolicyRuntimeDestinationEvidenceCommandService,
} from '../../services/policyRuntimeDestinationEvidenceCommandService.mjs';

function lockedState() {
  return {
    ok: true,
    classification: { id: '42' },
    destination: { id: '8', name: 'Anime Movies' },
    resolution: { contractFingerprint: 'a'.repeat(22), finalOutcomeRecorded: true },
    currentState: { locked: true },
  };
}

function admittedEvidence() {
  return {
    ok: true,
    statusId: 'ready',
    reasonCodes: [],
    provenance: { nativeIntentId: '33', profileFreshness: { stale: false } },
  };
}

function readyAdmission() {
  return {
    ok: true,
    statusId: 'ready',
    audit: { ok: true },
    reasonCodes: ['runtime_destination_evidence_admitted'],
    references: { tierId: 'identity_evidence' },
    intake: { sourceId: 'operator_confirmation' },
    decision: { learning: { tierId: 'identity_evidence' } },
  };
}

function createService(overrides = {}) {
  const client = { query: jest.fn() };
  const db = { withTransaction: jest.fn(async work => work(client)) };
  const lockExecutionState = jest.fn().mockResolvedValue(lockedState());
  const buildProvenance = jest.fn().mockResolvedValue(admittedEvidence());
  const admissionService = { build: jest.fn().mockReturnValue(readyAdmission()) };
  const executor = {
    execute: jest.fn().mockResolvedValue({
      applied: true,
      replayed: false,
      statusId: 'applied',
      reasonCodes: ['authorized_outcome_source_event_claimed'],
    }),
  };
  const service = new PolicyRuntimeDestinationEvidenceCommandService({
    db,
    lockExecutionState,
    buildProvenance,
    admissionService,
    executor,
    ...overrides,
  });

  return { client, db, lockExecutionState, buildProvenance, admissionService, executor, service };
}

describe('PolicyRuntimeDestinationEvidenceCommandService', () => {
  test('uses the caller transaction and passes only admitted server-derived data to the executor', async () => {
    const { client, db, lockExecutionState, buildProvenance, admissionService, executor, service } =
      createService();

    const result = await service.execute({
      classificationId: 42,
      actorId: 'operator-7',
      authorizationContext: { authenticated: true },
    });

    expect(result).toMatchObject({
      statusId: POLICY_RUNTIME_DESTINATION_EVIDENCE_COMMAND_STATUS_IDS.APPLIED,
      admission: { tierId: 'identity_evidence' },
      provenance: { nativeIntentId: '33', profileStale: false },
    });
    expect(db.withTransaction).toHaveBeenCalledTimes(1);
    expect(lockExecutionState).toHaveBeenCalledWith({ client, classificationId: 42 });
    expect(buildProvenance).toHaveBeenCalledWith(expect.objectContaining({
      client,
      executionState: lockedState(),
    }));
    expect(admissionService.build).toHaveBeenCalledWith({
      executionState: lockedState(),
      provenance: admittedEvidence(),
      actorId: 'operator-7',
    });
    expect(executor.execute).toHaveBeenCalledWith({
      client,
      intake: readyAdmission().intake,
      learningDecision: readyAdmission().decision,
      authorizationContext: { authenticated: true },
    });
  });

  test('treats invalid state or a blocked admission as a side-effect-free no-op', async () => {
    const blockedState = createService({
      lockExecutionState: jest.fn().mockResolvedValue({
        ok: false,
        reasonId: 'runtime_exact_item_memory_classification_state_invalid',
      }),
    });
    const blockedAdmission = createService({
      admissionService: {
        build: jest.fn().mockReturnValue({
          ...readyAdmission(),
          ok: false,
          statusId: 'blocked',
          audit: { ok: true },
          reasonCodes: ['runtime_destination_evidence_candidate_invalid'],
        }),
      },
    });

    await expect(blockedState.service.execute({ classificationId: 42 })).resolves.toMatchObject({
      statusId: POLICY_RUNTIME_DESTINATION_EVIDENCE_COMMAND_STATUS_IDS.NOT_ADMITTED,
      execution: null,
    });
    await expect(blockedAdmission.service.execute({ classificationId: 42 })).resolves.toMatchObject({
      statusId: POLICY_RUNTIME_DESTINATION_EVIDENCE_COMMAND_STATUS_IDS.NOT_ADMITTED,
      reasonCodes: ['runtime_destination_evidence_candidate_invalid'],
      execution: null,
    });
    expect(blockedState.buildProvenance).not.toHaveBeenCalled();
    expect(blockedState.executor.execute).not.toHaveBeenCalled();
    expect(blockedAdmission.executor.execute).not.toHaveBeenCalled();
  });

  test('fails the owning transaction when an admitted executor cannot complete', async () => {
    const { service } = createService({
      executor: {
        execute: jest.fn().mockResolvedValue({
          applied: false,
          replayed: false,
          statusId: 'blocked',
          reasonCodes: ['authorized_outcome_command_blocked'],
        }),
      },
    });

    await expect(service.execute({ classificationId: 42 })).rejects.toEqual(expect.objectContaining({
      name: PolicyRuntimeDestinationEvidenceCommandError.name,
      reasonId: 'runtime_destination_evidence_execution_blocked',
    }));
  });
});
