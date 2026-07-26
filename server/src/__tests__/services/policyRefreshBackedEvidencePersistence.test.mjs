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
  PolicyRefreshBackedEvidencePersistence,
} from '../../services/policyRefreshBackedEvidencePersistence.mjs';

function refreshCommand() {
  return {
    statusId: 'ready',
    ready: true,
    command: {
      sourceId: 'discord_pending_answer',
      sourceEventId: 'classification:42:discord:991',
      classificationId: '42',
      destinationLibraryId: '8',
      learningOperationId: 'write_compatibility_evidence',
      learningTierId: 'compatibility_evidence',
      candidateKey: 'studio:pixar',
      refreshReasonId: 'profile_refresh_required',
    },
  };
}

function outboxRecord() {
  return {
    ready: true,
    record: {
      sourceId: 'discord_pending_answer',
      sourceEventId: 'classification:42:discord:991',
      classificationId: '42',
      libraryId: '8',
      learningOperationId: 'write_compatibility_evidence',
      learningTierId: 'compatibility_evidence',
      candidateKey: 'studio:pixar',
      refreshReasonId: 'profile_refresh_required',
      sourceSystem: 'policy_authorized_profile_refresh',
    },
  };
}

function createPersistence(overrides = {}) {
  const buildRefreshCommand = jest.fn().mockReturnValue(refreshCommand());
  const buildOutboxRecord = jest.fn().mockReturnValue(outboxRecord());
  const writeCompatibilityEvidence = jest.fn().mockResolvedValue({
    operationId: 'write_compatibility_evidence',
    persisted: true,
    reasonId: 'authorized_outcome_execution_compatibility_evidence_persisted',
  });
  const writeIdentityEvidence = jest.fn();
  const outboxRepository = {
    enqueue: jest.fn().mockResolvedValue({
      replayed: false,
      outbox: { id: '91', libraryId: '8', candidateKey: 'studio:pixar' },
    }),
  };
  const dependencies = {
    buildRefreshCommand,
    buildOutboxRecord,
    writeCompatibilityEvidence,
    writeIdentityEvidence,
    outboxRepository,
    ...overrides,
  };
  const persistence = new PolicyRefreshBackedEvidencePersistence(dependencies);

  return {
    persistence,
    ...dependencies,
  };
}

describe('PolicyRefreshBackedEvidencePersistence', () => {
  test('writes admitted evidence before it appends the matching refresh record', async () => {
    const {
      persistence,
      writeCompatibilityEvidence,
      outboxRepository,
    } = createPersistence();
    const client = { query: jest.fn() };

    const result = await persistence.persist({
      client,
      command: { authorized: true },
      executionState: { locked: true },
    });

    expect(writeCompatibilityEvidence).toHaveBeenCalledWith({
      client,
      command: { authorized: true },
      executionState: { locked: true },
    });
    expect(outboxRepository.enqueue).toHaveBeenCalledWith({
      client,
      record: expect.objectContaining({ sourceEventId: 'classification:42:discord:991' }),
    });
    expect(result).toMatchObject({
      learning: { operationId: 'write_compatibility_evidence' },
      profileRefresh: {
        operationId: 'queue_profile_refresh',
        persisted: true,
        outbox: { id: '91' },
      },
    });
    expect(writeCompatibilityEvidence.mock.invocationCallOrder[0]).toBeLessThan(
      outboxRepository.enqueue.mock.invocationCallOrder[0],
    );
  });

  test('does not append refresh work when the evidence writer fails', async () => {
    const { persistence, outboxRepository } = createPersistence({
      writeCompatibilityEvidence: jest.fn().mockRejectedValue(new Error('evidence unavailable')),
    });

    await expect(persistence.persist({ client: { query: jest.fn() } })).rejects.toThrow(
      'evidence unavailable',
    );
    expect(outboxRepository.enqueue).not.toHaveBeenCalled();
  });

  test('accepts an existing append-only identity admission before it creates missing refresh work', async () => {
    const { persistence, writeIdentityEvidence, outboxRepository } = createPersistence({
      buildRefreshCommand: () => ({
        ...refreshCommand(),
        command: {
          ...refreshCommand().command,
          learningOperationId: 'write_identity_evidence',
          learningTierId: 'identity_evidence',
        },
      }),
      buildOutboxRecord: () => ({
        ...outboxRecord(),
        record: {
          ...outboxRecord().record,
          learningOperationId: 'write_identity_evidence',
          learningTierId: 'identity_evidence',
        },
      }),
      writeIdentityEvidence: jest.fn().mockResolvedValue({
        operationId: 'write_identity_evidence',
        persisted: false,
        replayed: true,
      }),
    });

    const result = await persistence.persist({ client: { query: jest.fn() } });

    expect(writeIdentityEvidence).toHaveBeenCalledTimes(1);
    expect(outboxRepository.enqueue).toHaveBeenCalledTimes(1);
    expect(result.profileRefresh.outbox.id).toBe('91');
  });
});
