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
  PolicyRuntimeHistoricRouteSafetyRefreshReceiptReconciliationService,
  buildHistoricRouteSafetyRefreshReceiptReconciliationReport,
  deriveHistoricRouteSafetyRefreshReconciliationStatus,
} from '../../services/policyRuntimeHistoricRouteSafetyRefreshReceiptReconciliationService.mjs';

const RECEIPT_ID = '4b8d027d-8daf-4186-a9f8-89df6f69c95e';

function createDb() {
  const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
  return {
    client,
    db: {
      withTransaction: jest.fn(async callback => callback(client)),
    },
  };
}

describe('PolicyRuntimeHistoricRouteSafetyRefreshReceiptReconciliationService', () => {
  test.each([
    [{ execution_status: 'requested' }, 'execution_incomplete'],
    [{ execution_status: 'skipped' }, 'not_queued'],
    [{ execution_status: 'failed' }, 'retry_failed'],
    [{ execution_status: 'queued', source_record_found: true, source_status: 'reclassified', queue_status: 'pending', lineage_depth: 0 }, 'queue_pending'],
    [{ execution_status: 'queued', source_record_found: true, source_status: 'reclassified', queue_status: 'processing', lineage_depth: 0 }, 'queue_processing'],
    [{ execution_status: 'queued', source_record_found: true, source_status: 'reclassified', queue_status: 'failed', lineage_depth: 0 }, 'queue_failed'],
    [{ execution_status: 'queued', source_record_found: true, source_status: 'reclassified', runtime_status: 'awaiting_decision', lineage_depth: 1 }, 'runtime_awaiting_decision'],
    [{ execution_status: 'queued', source_record_found: true, source_status: 'reclassified', runtime_status: 'routed', lineage_depth: 2 }, 'runtime_routed'],
    [{ execution_status: 'queued', source_record_found: true, source_status: 'reclassified', queue_status: 'completed', lineage_depth: 0 }, 'current_runtime_not_observed'],
    [{ execution_status: 'queued', source_record_found: false }, 'source_record_unavailable'],
  ])('derives %s as a fixed safe reconciliation status', (item, expected) => {
    expect(deriveHistoricRouteSafetyRefreshReconciliationStatus(item)).toBe(expected);
  });

  test('uses a repeatable-read, read-only snapshot and returns no raw runtime data', async () => {
    const { db, client } = createDb();
    const receiptRepository = {
      loadReceipt: jest.fn().mockResolvedValue({
        receipt: {
          receipt_id: RECEIPT_ID,
          requested_record_count: 2,
          created_at: '2026-08-10T12:00:00.000Z',
          execution_finalized_at: '2026-08-10T12:01:00.000Z',
        },
        items: [
          {
            classification_id: 41,
            execution_status: 'queued',
            reason_id: 'queued_for_current_runtime_evaluation',
            source_record_found: true,
            source_status: 'reclassified',
            runtime_classification_id: 66,
            runtime_status: 'routed',
            lineage_depth: 1,
            raw_metadata: '{"must_not":"appear"}',
          },
          {
            classification_id: 42,
            execution_status: 'skipped',
            reason_id: 'duplicate_pending_task',
            source_record_found: true,
            source_status: 'awaiting_decision',
          },
        ],
      }),
    };
    const service = new PolicyRuntimeHistoricRouteSafetyRefreshReceiptReconciliationService({ db, receiptRepository });

    const result = await service.run({ receiptId: RECEIPT_ID });

    expect(client.query).toHaveBeenCalledWith('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    expect(receiptRepository.loadReceipt).toHaveBeenCalledWith(client, { receiptId: RECEIPT_ID });
    expect(result).toEqual(expect.objectContaining({
      mode: 'read_only',
      receipt: expect.objectContaining({
        retryReceipt: RECEIPT_ID,
        executionStatusId: 'finalized',
        requestedRecordCount: 2,
      }),
      records: [
        {
          classificationId: 41,
          executionStatusId: 'queued',
          executionReasonId: 'queued_for_current_runtime_evaluation',
          reconciliationStatusId: 'runtime_routed',
        },
        {
          classificationId: 42,
          executionStatusId: 'skipped',
          executionReasonId: 'duplicate_pending_task',
          reconciliationStatusId: 'not_queued',
        },
      ],
    }));
    expect(JSON.stringify(result)).not.toContain('must_not');
    expect(Object.isFrozen(result)).toBe(true);
  });

  test('rejects malformed receipt IDs before opening a transaction', async () => {
    const { db } = createDb();
    const service = new PolicyRuntimeHistoricRouteSafetyRefreshReceiptReconciliationService({
      db,
      receiptRepository: { loadReceipt: jest.fn() },
    });

    await expect(service.run({ receiptId: '../receipt' })).rejects.toMatchObject({
      name: 'ValidationError',
      statusCode: 400,
    });
    expect(db.withTransaction).not.toHaveBeenCalled();
  });

  test('reports an unknown receipt without exposing receipt lookup internals', async () => {
    const { db } = createDb();
    const service = new PolicyRuntimeHistoricRouteSafetyRefreshReceiptReconciliationService({
      db,
      receiptRepository: { loadReceipt: jest.fn().mockResolvedValue({ receipt: null, items: [] }) },
    });

    await expect(service.run({ receiptId: RECEIPT_ID })).rejects.toMatchObject({
      name: 'NotFoundError',
      statusCode: 404,
      code: 'historic_route_safety_refresh_receipt_not_found',
    });
  });

  test('summarizes bounded records without exposing source or queue identifiers', () => {
    const report = buildHistoricRouteSafetyRefreshReceiptReconciliationReport({
      receipt: { receipt_id: RECEIPT_ID, requested_record_count: 1 },
      items: [{
        classification_id: 99,
        execution_status: 'queued',
        reason_id: 'queued_for_current_runtime_evaluation',
        source_record_found: true,
        source_status: 'reclassified',
        queue_status: 'pending',
      }],
    });

    expect(report.summary).toMatchObject({ queued: 1, runtimePending: 1 });
    expect(JSON.stringify(report)).not.toContain('retry_task_id');
    expect(JSON.stringify(report)).not.toContain('runtime_classification_id');
  });
});
