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
  POLICY_AUTHORIZED_OUTCOME_RECEIPT_CLAIM_STATUS_IDS,
  claimPolicyAuthorizedOutcomeSourceEventReceipt,
  createPolicyAuthorizedOutcomeSourceEventReceiptRecord,
} from '../../services/policyAuthorizedOutcomeReceiptRepository.mjs';
import {
  buildPolicyAuthorizedOutcomePersistenceCommand,
} from '../../services/policyAuthorizedOutcomePersistenceCommand.mjs';
import {
  policyManualCorrectionLearningService,
} from '../../services/policyManualCorrectionLearning.mjs';

function admittedCommand(overrides = {}) {
  const admission = policyManualCorrectionLearningService.build({
    classification: { id: 42, tmdbId: 872, mediaType: 'movie' },
    destination: { libraryId: 8, libraryName: 'Animated Movies' },
    finalOutcomeRecorded: true,
    sourceEventId: 'classification_correction:991',
    actorId: 'operator-7',
  });

  return buildPolicyAuthorizedOutcomePersistenceCommand({
    intake: admission.intake,
    learningDecision: admission.decision,
    authorization: {
      actorTypeId: 'operator',
      actorId: 'operator-7',
      revalidated: true,
      canRecordOutcome: true,
      canWriteLearning: true,
      authorizedSourceIds: ['manual_classification_change'],
    },
    currentState: {
      classificationId: 42,
      sourceEventId: 'classification_correction:991',
      destinationLibraryId: 8,
      destinationLibraryName: 'Animated Movies',
      locked: true,
    },
    ...overrides,
  });
}

function receiptRow(overrides = {}) {
  return {
    id: '71',
    receipt_version: 1,
    source_id: 'manual_classification_change',
    source_event_id: 'classification_correction:991',
    command_fingerprint: 'a'.repeat(64),
    classification_id: '42',
    destination_library_id: '8',
    final_outcome_status_id: 'resolved',
    persistence_status_id: 'ready',
    learning_tier_id: 'exact_item_memory',
    created_at: '2026-07-26T12:00:00.000Z',
    ...overrides,
  };
}

describe('policyAuthorizedOutcomeReceiptRepository', () => {
  test('builds a deterministic compact receipt record without actor or raw payload data', () => {
    const command = admittedCommand();
    const record = createPolicyAuthorizedOutcomeSourceEventReceiptRecord(command);
    const changedCommand = {
      ...command,
      operations: {
        ...command.operations,
        learning: {
          ...command.operations.learning,
          candidate: {
            ...command.operations.learning.candidate,
            key: 'manual_correction:42:movie:999',
          },
        },
      },
    };
    const changedRecord = createPolicyAuthorizedOutcomeSourceEventReceiptRecord(changedCommand);

    expect(record).toEqual(expect.objectContaining({
      sourceId: 'manual_classification_change',
      sourceEventId: 'classification_correction:991',
      classificationId: '42',
      destinationLibraryId: '8',
      finalOutcomeStatusId: 'resolved',
      persistenceStatusId: 'ready',
      learningTierId: 'exact_item_memory',
      commandFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
    expect(record).not.toHaveProperty('actorId');
    expect(record).not.toHaveProperty('candidate');
    expect(record).not.toHaveProperty('reasonCodes');
    expect(changedRecord.commandFingerprint).not.toBe(record.commandFingerprint);
  });

  test('requires a transaction client and rejects commands that are not admitted', async () => {
    await expect(claimPolicyAuthorizedOutcomeSourceEventReceipt({
      command: admittedCommand(),
    })).rejects.toThrow('caller-owned transaction client');

    await expect(claimPolicyAuthorizedOutcomeSourceEventReceipt({
      client: { query: jest.fn() },
      command: {
        ...admittedCommand(),
        ok: false,
      },
    })).rejects.toThrow('admitted authorized persistence command');
  });

  test('claims a new source event through a parameterized insert without an update path', async () => {
    const command = admittedCommand();
    const expectedRecord = createPolicyAuthorizedOutcomeSourceEventReceiptRecord(command);
    const client = {
      query: jest.fn().mockResolvedValue({
        rows: [receiptRow({ command_fingerprint: expectedRecord.commandFingerprint })],
      }),
    };

    const result = await claimPolicyAuthorizedOutcomeSourceEventReceipt({ client, command });

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_AUTHORIZED_OUTCOME_RECEIPT_CLAIM_STATUS_IDS.CLAIMED,
      claimed: true,
      replayed: false,
      accepted: true,
      receipt: expect.objectContaining({ id: '71' }),
    }));
    const [statement, values] = client.query.mock.calls[0];
    expect(statement).toContain('ON CONFLICT (source_id, source_event_id) DO NOTHING');
    expect(statement).not.toContain('DO UPDATE');
    expect(values).toEqual(expect.arrayContaining([
      'manual_classification_change',
      'classification_correction:991',
      expectedRecord.commandFingerprint,
      '42',
    ]));
  });

  test('returns the original receipt when a source event is replayed exactly', async () => {
    const command = admittedCommand();
    const expectedRecord = createPolicyAuthorizedOutcomeSourceEventReceiptRecord(command);
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [receiptRow({ command_fingerprint: expectedRecord.commandFingerprint })],
        }),
    };

    const result = await claimPolicyAuthorizedOutcomeSourceEventReceipt({ client, command });

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_AUTHORIZED_OUTCOME_RECEIPT_CLAIM_STATUS_IDS.REPLAYED,
      claimed: false,
      replayed: true,
      accepted: true,
    }));
    expect(client.query.mock.calls[1][0]).toContain(
      'FROM policy_authorized_outcome_source_event_receipts',
    );
  });

  test('rejects a reused source event whose authorized command semantics differ', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [receiptRow()] }),
    };

    const result = await claimPolicyAuthorizedOutcomeSourceEventReceipt({
      client,
      command: admittedCommand(),
    });

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_AUTHORIZED_OUTCOME_RECEIPT_CLAIM_STATUS_IDS.SOURCE_EVENT_MISMATCH,
      claimed: false,
      replayed: false,
      accepted: false,
      reasonId: 'authorized_outcome_source_event_payload_mismatch',
    }));
  });
});
