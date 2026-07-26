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
  PolicyAuthorizedOutcomeTransactionExecutor,
} from '../../services/policyAuthorizedOutcomeTransactionExecutor.mjs';
import {
  buildPolicyLearningGuardInput,
  buildPolicyLearningIntakeEvent,
} from '../../services/policyLearningIntakeContract.mjs';
import {
  buildPolicyLearningDecision,
} from '../../services/policyLearningGuard.mjs';
import {
  policyManualCorrectionLearningService,
} from '../../services/policyManualCorrectionLearning.mjs';

function manualAdmission() {
  return policyManualCorrectionLearningService.build({
    classification: { id: 42, tmdbId: 872, mediaType: 'movie' },
    destination: { libraryId: 8, libraryName: 'Animated Movies' },
    finalOutcomeRecorded: true,
    sourceEventId: 'classification_correction:991',
    actorId: 'operator-7',
  });
}

function lockedState(overrides = {}) {
  return {
    ok: true,
    classification: { id: '42', tmdbId: '872', mediaType: 'movie' },
    destination: { id: '8', name: 'Animated Movies', mediaType: 'movie', active: true },
    currentState: {
      classificationId: '42',
      sourceEventId: 'classification_correction:991',
      destinationLibraryId: '8',
      destinationLibraryName: 'Animated Movies',
      locked: true,
    },
    ...overrides,
  };
}

function authorization(overrides = {}) {
  return {
    actorTypeId: 'operator',
    actorId: 'operator-7',
    revalidated: true,
    canRecordOutcome: true,
    canWriteLearning: true,
    authorizedSourceIds: ['manual_classification_change'],
    ...overrides,
  };
}

function claimedReceipt() {
  return {
    statusId: 'claimed',
    accepted: true,
    reasonId: 'authorized_outcome_source_event_claimed',
    receipt: { id: '71', finalOutcomeStatusId: 'resolved', persistenceStatusId: 'ready' },
  };
}

function createExecutor(overrides = {}) {
  const client = { query: jest.fn() };
  const db = {
    withTransaction: jest.fn(async work => work(client)),
  };
  const lockExecutionState = jest.fn().mockResolvedValue(lockedState());
  const revalidateAuthorization = jest.fn().mockResolvedValue(authorization());
  const claimReceipt = jest.fn().mockResolvedValue(claimedReceipt());
  const persistFinalOutcome = jest.fn().mockResolvedValue({
    operationId: 'record_final_outcome',
    persisted: true,
    reasonId: 'authorized_outcome_execution_final_outcome_persisted',
  });
  const writeExactItemMemory = jest.fn().mockResolvedValue({
    operationId: 'write_exact_item_memory',
    persisted: true,
    reasonId: 'authorized_outcome_execution_exact_item_memory_persisted',
  });
  const dependencies = {
    db,
    lockExecutionState,
    revalidateAuthorization,
    claimReceipt,
    persistFinalOutcome,
    writeExactItemMemory,
    ...overrides,
  };
  const service = new PolicyAuthorizedOutcomeTransactionExecutor(dependencies);

  return {
    client,
    db,
    service,
    ...dependencies,
  };
}

describe('PolicyAuthorizedOutcomeTransactionExecutor', () => {
  test('claims, projects, and writes only the admitted exact-item operation in one transaction', async () => {
    const {
      service,
      db,
      client,
      revalidateAuthorization,
      claimReceipt,
      persistFinalOutcome,
      writeExactItemMemory,
    } = createExecutor();
    const admission = manualAdmission();

    const result = await service.execute({
      intake: admission.intake,
      learningDecision: admission.decision,
      authorizationContext: { opaque: 'operator-session-context' },
    });

    expect(result).toEqual(expect.objectContaining({
      statusId: 'applied',
      applied: true,
      receipt: expect.objectContaining({ id: '71' }),
      operations: expect.objectContaining({
        finalOutcome: expect.objectContaining({ persisted: true }),
        learning: expect.objectContaining({ operationId: 'write_exact_item_memory' }),
        profileRefresh: null,
      }),
    }));
    expect(db.withTransaction).toHaveBeenCalledTimes(1);
    expect(revalidateAuthorization).toHaveBeenCalledWith(expect.objectContaining({
      client,
      authorizationContext: { opaque: 'operator-session-context' },
      executionState: expect.objectContaining({ ok: true }),
    }));
    expect(claimReceipt).toHaveBeenCalledWith(expect.objectContaining({ client }));
    expect(persistFinalOutcome).toHaveBeenCalledWith(expect.objectContaining({ client }));
    expect(writeExactItemMemory).toHaveBeenCalledWith(expect.objectContaining({ client }));
    expect(JSON.stringify(result)).not.toContain('operator-session-context');
  });

  test('uses a caller-owned transaction client without opening a nested transaction', async () => {
    const { service, db, client } = createExecutor();
    const admission = manualAdmission();

    const result = await service.execute({
      client,
      intake: admission.intake,
      learningDecision: admission.decision,
    });

    expect(result).toMatchObject({ statusId: 'applied', applied: true });
    expect(db.withTransaction).not.toHaveBeenCalled();
  });

  test('validates intake when a caller-owned transaction invokes the shared execution path', async () => {
    const { service, client, lockExecutionState } = createExecutor();

    const result = await service.executeWithinTransaction({
      client,
      intake: {},
      learningDecision: {},
    });

    expect(result).toMatchObject({ statusId: 'blocked', accepted: false });
    expect(result.reasonCodes).toContain('authorized_outcome_execution_invalid_intake');
    expect(lockExecutionState).not.toHaveBeenCalled();
  });

  test('returns an exact replay without executing outcome or learning writers', async () => {
    const { service, claimReceipt, persistFinalOutcome, writeExactItemMemory } = createExecutor({
      claimReceipt: jest.fn().mockResolvedValue({
        statusId: 'replayed',
        accepted: true,
        reasonId: 'authorized_outcome_source_event_replayed',
        receipt: { id: '71', finalOutcomeStatusId: 'resolved', persistenceStatusId: 'ready' },
      }),
    });
    const admission = manualAdmission();

    const result = await service.execute({
      intake: admission.intake,
      learningDecision: admission.decision,
    });

    expect(result).toMatchObject({ statusId: 'replayed', replayed: true, applied: false });
    expect(claimReceipt).toHaveBeenCalledTimes(1);
    expect(persistFinalOutcome).not.toHaveBeenCalled();
    expect(writeExactItemMemory).not.toHaveBeenCalled();
  });

  test('rejects a source-event mismatch without executing writers', async () => {
    const { service, persistFinalOutcome, writeExactItemMemory } = createExecutor({
      claimReceipt: jest.fn().mockResolvedValue({
        statusId: 'source_event_mismatch',
        accepted: false,
        reasonId: 'authorized_outcome_source_event_payload_mismatch',
        receipt: { id: '71' },
      }),
    });
    const admission = manualAdmission();

    const result = await service.execute({
      intake: admission.intake,
      learningDecision: admission.decision,
    });

    expect(result).toMatchObject({ statusId: 'source_event_mismatch', accepted: false });
    expect(persistFinalOutcome).not.toHaveBeenCalled();
    expect(writeExactItemMemory).not.toHaveBeenCalled();
  });

  test('blocks state drift or authorization loss before it claims a receipt', async () => {
    const { service, claimReceipt, revalidateAuthorization } = createExecutor({
      revalidateAuthorization: jest.fn().mockResolvedValue(authorization({ canRecordOutcome: false })),
    });
    const admission = manualAdmission();

    const result = await service.execute({
      intake: admission.intake,
      learningDecision: admission.decision,
    });

    expect(result).toMatchObject({ statusId: 'blocked', accepted: false });
    expect(result.reasonCodes).toContain('authorized_persistence_outcome_not_authorized');
    expect(revalidateAuthorization).toHaveBeenCalledTimes(1);
    expect(claimReceipt).not.toHaveBeenCalled();
  });

  test('propagates writer failure so the caller-owned transaction rolls back the receipt', async () => {
    const { service, writeExactItemMemory } = createExecutor({
      persistFinalOutcome: jest.fn().mockRejectedValue(new Error('outcome writer unavailable')),
    });
    const admission = manualAdmission();

    await expect(service.execute({
      intake: admission.intake,
      learningDecision: admission.decision,
    })).rejects.toThrow('outcome writer unavailable');
    expect(writeExactItemMemory).not.toHaveBeenCalled();
  });

  test('fails closed for an approved writer that does not exist yet', async () => {
    const intake = buildPolicyLearningIntakeEvent({
      sourceId: 'manual_classification_change',
      sourceEventId: 'classification_correction:991',
      actorId: 'operator-7',
      itemId: 42,
      answerOutcomeId: 'add_compatibility_evidence',
      question: { frameId: 'destination_fit', stale: false },
      answer: {
        label: 'Animated Movies',
        destinationLibraryId: 8,
        destinationLibraryName: 'Animated Movies',
        ambiguous: false,
      },
      candidate: {
        key: 'compatibility:animation:8',
        label: 'Animation compatibility',
        signalType: 'compatibility',
        destinationLibraryId: 8,
        destinationLibraryName: 'Animated Movies',
        evidenceCount: 2,
        evidenceSource: 'manual_correction',
      },
      finalOutcome: {
        itemId: 42,
        destinationLibraryId: 8,
        destinationLibraryName: 'Animated Movies',
        recorded: true,
      },
    });
    const learningDecision = buildPolicyLearningDecision(buildPolicyLearningGuardInput(intake));
    const { service } = createExecutor();

    await expect(service.execute({ intake, learningDecision })).rejects.toThrow(
      'authorized_outcome_execution_learning_operation_unavailable',
    );
  });
});
