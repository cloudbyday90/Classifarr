/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  PolicyRuntimeHistoricRouteSafetyRefreshReceiptRepository,
} from '../../services/policyRuntimeHistoricRouteSafetyRefreshReceiptRepository.mjs';

const RECEIPT_ID = '4b8d027d-8daf-4186-a9f8-89df6f69c95e';

function createRepository({ query } = {}) {
  const client = { query: query || jest.fn() };
  const db = { withTransaction: jest.fn(async callback => callback(client)) };
  return {
    client,
    db,
    repository: new PolicyRuntimeHistoricRouteSafetyRefreshReceiptRepository({ db }),
  };
}

describe('PolicyRuntimeHistoricRouteSafetyRefreshReceiptRepository', () => {
  test('creates an immutable bounded receipt header and selected item rows', async () => {
    const { repository, client } = createRepository({
      query: jest.fn()
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 2 }),
    });

    await repository.createReceipt({
      receiptId: RECEIPT_ID,
      actorId: 'user:7',
      classificationIds: [19, 21],
    });

    expect(client.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('policy_runtime_historic_route_safety_refresh_receipts'),
      [RECEIPT_ID, 'user:7', 2, 'policy.runtime_historic_route_safety_refresh_receipt.v1'],
    );
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('policy_runtime_historic_route_safety_refresh_receipt_items'),
      [RECEIPT_ID, [19, 21], 'requested'],
    );
  });

  test('marks a queued item on the retry transaction client and fails closed when it is absent', async () => {
    const { repository } = createRepository();
    const client = { query: jest.fn().mockResolvedValue({ rowCount: 1 }) };

    await repository.markRetryQueued({
      client,
      receiptId: RECEIPT_ID,
      classificationId: 19,
      retryTaskId: 81,
    });
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('execution_status = $3'),
      [RECEIPT_ID, 19, 'queued', 'queued_for_current_runtime_evaluation', 81, 'requested'],
    );

    client.query.mockResolvedValueOnce({ rowCount: 0 });
    await expect(repository.markRetryQueued({
      client,
      receiptId: RECEIPT_ID,
      classificationId: 19,
      retryTaskId: 81,
    })).rejects.toThrow('did not have a pending receipt item');
  });

  test('uses only primary-key receipt rows and bounded lineage traversal for reconciliation', async () => {
    const { repository, client } = createRepository({
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ receipt_id: RECEIPT_ID, requested_record_count: 1 }] })
        .mockResolvedValueOnce({ rows: [{ classification_id: 19, execution_status: 'queued' }] }),
    });

    const result = await repository.loadReceipt(client, { receiptId: RECEIPT_ID });

    expect(result.receipt.receipt_id).toBe(RECEIPT_ID);
    expect(client.query.mock.calls[1][0]).toContain('WITH RECURSIVE retry_lineage');
    expect(client.query.mock.calls[1][0]).toContain('retry_lineage.lineage_depth < 8');
    expect(client.query.mock.calls[1][0]).toContain('WHERE item.receipt_id = $1::uuid');
    expect(client.query.mock.calls[1][0]).not.toContain('SELECT metadata');
  });
});
