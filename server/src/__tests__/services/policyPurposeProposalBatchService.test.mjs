/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import {
  POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS,
} from '../../services/policyNativeIntentChangeService.mjs';
import {
  POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS,
} from '../../services/policyPurposeProposalBatchContract.mjs';
import {
  PolicyPurposeProposalBatchService,
  createChildIdempotencyKey,
} from '../../services/policyPurposeProposalBatchService.mjs';

function profileRecord(policyId, revision) {
  return {
    policy_id: policyId,
    policy_name: `Policy ${policyId}`,
    library_id: policyId + 100,
    library_name: `Library ${policyId}`,
    library_media_type: 'movie',
    intent_version: revision,
    purpose_rules: [{
      signal_type: 'genres',
      operator: 'require_any',
      values: { require_any: [`hidden-${policyId}`] },
      constraint_mode: 'advisory',
      semantics: 'identity',
      source: 'media_server_library_profile',
      inference_state: 'inferred',
    }],
  };
}

function createService({ records = [profileRecord(7, 2), profileRecord(9, 3)], applyChange } = {}) {
  const client = { query: jest.fn() };
  const db = { withTransaction: jest.fn(async work => work(client)) };
  const loadRecords = jest.fn().mockResolvedValue(records);
  const loadReplayReceipts = jest.fn().mockResolvedValue([]);
  const writer = applyChange || jest.fn().mockResolvedValue({
    statusId: POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.APPLIED,
    change: { replayed: false },
  });
  return {
    client,
    db,
    loadRecords,
    loadReplayReceipts,
    applyChange: writer,
    service: new PolicyPurposeProposalBatchService({
      db,
      loadRecords,
      loadReplayReceipts,
      applyChange: writer,
    }),
  };
}

describe('PolicyPurposeProposalBatchService', () => {
  test('applies the exact current compatible proposal set through one transaction boundary', async () => {
    const fixture = createService();
    const proposal = await fixture.service.getProposal();

    const result = await fixture.service.applyProposal({
      actorId: 4,
      actorRole: 'admin',
      idempotencyKey: 'b'.repeat(32),
      request: {
        proposal_fingerprint: proposal.proposalFingerprint,
        candidate_policy_ids: proposal.action.candidatePolicyIds,
      },
    });

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS.APPLIED,
      policyCount: 2,
      rawPurposeRulesExposed: false,
      sideEffects: expect.objectContaining({ policyStorageMutated: true, routingWritten: false }),
    }));
    expect(fixture.db.withTransaction).toHaveBeenCalledTimes(1);
    expect(fixture.loadReplayReceipts).toHaveBeenCalledWith(expect.objectContaining({
      client: fixture.client,
      actorId: 4,
      idempotencyKeys: expect.arrayContaining([expect.stringMatching(/^purposeproposal_/u)]),
    }));
    expect(fixture.applyChange).toHaveBeenCalledTimes(2);
    expect(fixture.applyChange.mock.calls.map(([argument]) => argument.policyId)).toEqual([7, 9]);
    expect(fixture.applyChange.mock.calls[0][0]).toEqual(expect.objectContaining({
      expectedRevision: 2,
      actorId: 4,
      actorRole: 'admin',
      changeCommands: [expect.objectContaining({ command_id: 'update_purpose' })],
      dbClient: expect.objectContaining({ withTransaction: expect.any(Function) }),
    }));
  });

  test('does not write when the proposal fingerprint or complete candidate list is stale', async () => {
    const fixture = createService();
    const result = await fixture.service.applyProposal({
      actorId: 4,
      actorRole: 'admin',
      idempotencyKey: 'b'.repeat(32),
      request: {
        proposal_fingerprint: `sha256:${'c'.repeat(64)}`,
        candidate_policy_ids: [7, 9],
      },
    });

    expect(result.statusId).toBe(POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS.PROPOSAL_STALE);
    expect(fixture.applyChange).not.toHaveBeenCalled();
  });

  test('returns a durable replay without running the writer again', async () => {
    const fixture = createService();
    const proposal = await fixture.service.getProposal();
    fixture.loadReplayReceipts.mockResolvedValueOnce([
      { policyId: 7, idempotencyKey: createChildIdempotencyKey('b'.repeat(32), 7) },
      { policyId: 9, idempotencyKey: createChildIdempotencyKey('b'.repeat(32), 9) },
    ]);

    const result = await fixture.service.applyProposal({
      actorId: 4,
      actorRole: 'admin',
      idempotencyKey: 'b'.repeat(32),
      request: {
        proposal_fingerprint: proposal.proposalFingerprint,
        candidate_policy_ids: proposal.action.candidatePolicyIds,
      },
    });

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS.REPLAYED,
      replayed: true,
      policyCount: 2,
    }));
    expect(fixture.applyChange).not.toHaveBeenCalled();
  });

  test('aborts the batch when one child writer cannot apply its revision', async () => {
    const applyChange = jest.fn()
      .mockResolvedValueOnce({
        statusId: POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.APPLIED,
        change: { replayed: false },
      })
      .mockResolvedValueOnce({
        statusId: POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.STALE_REVISION,
        change: { replayed: false },
      });
    const fixture = createService({ applyChange });
    const proposal = await fixture.service.getProposal();

    const result = await fixture.service.applyProposal({
      actorId: 4,
      actorRole: 'admin',
      idempotencyKey: 'b'.repeat(32),
      request: {
        proposal_fingerprint: proposal.proposalFingerprint,
        candidate_policy_ids: proposal.action.candidatePolicyIds,
      },
    });

    expect(result.statusId).toBe(POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS.PROPOSAL_STALE);
    expect(applyChange).toHaveBeenCalledTimes(2);
  });
});
