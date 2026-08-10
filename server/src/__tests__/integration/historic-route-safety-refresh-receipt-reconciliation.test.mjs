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
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const {
  PolicyRuntimeHistoricRouteSafetyRefreshReceiptRepository,
} = await import('../../services/policyRuntimeHistoricRouteSafetyRefreshReceiptRepository.mjs');
const {
  PolicyRuntimeHistoricRouteSafetyRefreshReceiptReconciliationService,
} = await import('../../services/policyRuntimeHistoricRouteSafetyRefreshReceiptReconciliationService.mjs');

const RECEIPT_ID = '4b8d027d-8daf-4186-a9f8-89df6f69c95e';

describe('historic route-safety refresh receipt reconciliation integration', () => {
  let pool;
  let receiptRepository;
  let reconciliationService;

  beforeAll(() => {
    pool = getPool();
    receiptRepository = new PolicyRuntimeHistoricRouteSafetyRefreshReceiptRepository({ db });
    reconciliationService = new PolicyRuntimeHistoricRouteSafetyRefreshReceiptReconciliationService({
      db,
      receiptRepository,
    });
  });

  beforeEach(async () => {
    await pool.query(`
      TRUNCATE TABLE
        policy_runtime_historic_route_safety_refresh_receipt_items,
        policy_runtime_historic_route_safety_refresh_receipts,
        task_queue,
        classification_history
      RESTART IDENTITY CASCADE
    `);
  });

  test('reconciles a queued receipt through bounded replacement lineage without exposing metadata', async () => {
    const sourceInsert = await pool.query(
      `INSERT INTO classification_history (title, year, media_type, method, status, metadata)
       VALUES ('Receipt Source', 2026, 'movie', 'signal_calculation', 'reclassified', '{}'::jsonb)
       RETURNING id`,
    );
    const sourceClassificationId = sourceInsert.rows[0].id;
    const successorInsert = await pool.query(
      `INSERT INTO classification_history (title, year, media_type, method, status, metadata)
       VALUES ('Receipt Successor', 2026, 'movie', 'signal_calculation', 'routed',
               '{"internal":"must-not-be-returned"}'::jsonb)
       RETURNING id`,
    );
    const successorClassificationId = successorInsert.rows[0].id;
    await pool.query(
      `UPDATE classification_history
       SET metadata = jsonb_build_object(
           'classification_details',
           jsonb_build_object(
             'outcome_link',
           jsonb_build_object('replacement_classification_id', $2::bigint)
         )
       )
       WHERE id = $1`,
      [sourceClassificationId, successorClassificationId],
    );
    const taskInsert = await pool.query(
      `INSERT INTO task_queue (task_type, payload, status, source)
       VALUES ('classification', '{}'::jsonb, 'completed', 'integration')
       RETURNING id`,
    );

    await receiptRepository.createReceipt({
      receiptId: RECEIPT_ID,
      actorId: 'user:1',
      classificationIds: [sourceClassificationId],
    });
    await db.withTransaction(client => receiptRepository.markRetryQueued({
      client,
      receiptId: RECEIPT_ID,
      classificationId: sourceClassificationId,
      retryTaskId: taskInsert.rows[0].id,
    }));
    await receiptRepository.finalizeReceipt({
      receiptId: RECEIPT_ID,
      records: [{
        classificationId: sourceClassificationId,
        resultStatusId: 'queued',
        reasonId: 'queued_for_current_runtime_evaluation',
      }],
    });

    const report = await reconciliationService.run({ receiptId: RECEIPT_ID });

    expect(report.receipt).toEqual(expect.objectContaining({
      retryReceipt: RECEIPT_ID,
      executionStatusId: 'finalized',
      requestedRecordCount: 1,
    }));
    expect(report.records).toEqual([{
      classificationId: sourceClassificationId,
      executionStatusId: 'queued',
      executionReasonId: 'queued_for_current_runtime_evaluation',
      reconciliationStatusId: 'runtime_routed',
    }]);
    expect(report.summary).toMatchObject({ queued: 1, runtimeFinal: 1 });
    expect(JSON.stringify(report)).not.toContain('must-not-be-returned');
    expect(report.records[0]).not.toHaveProperty('retryTaskId');
    expect(report.records[0]).not.toHaveProperty('currentClassificationId');
  });
});
