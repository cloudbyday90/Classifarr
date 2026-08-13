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
const {
  PolicyRuntimeHistoricRouteSafetyRefreshRecentReceiptDiscoveryService,
} = await import('../../services/policyRuntimeHistoricRouteSafetyRefreshRecentReceiptDiscoveryService.mjs');

const RECEIPT_ID = '4b8d027d-8daf-4186-a9f8-89df6f69c95e';
const RECENT_RECEIPT_ID = '6c5a0839-0ae0-44a7-b3c4-18f413b58b13';
const OTHER_ACTOR_RECEIPT_ID = 'f2b35b42-15af-4b42-b3c4-18f413b58b13';

describe('historic route-safety refresh receipt reconciliation integration', () => {
  let pool;
  let receiptRepository;
  let reconciliationService;
  let recentReceiptDiscoveryService;

  beforeAll(() => {
    pool = getPool();
    receiptRepository = new PolicyRuntimeHistoricRouteSafetyRefreshReceiptRepository({ db });
    reconciliationService = new PolicyRuntimeHistoricRouteSafetyRefreshReceiptReconciliationService({
      db,
      receiptRepository,
    });
    recentReceiptDiscoveryService = new PolicyRuntimeHistoricRouteSafetyRefreshRecentReceiptDiscoveryService({
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

    const report = await reconciliationService.run({ receiptId: RECEIPT_ID, actorId: 'user:1' });

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

  test('treats another administrator receipt as unavailable instead of trusting its UUID', async () => {
    await receiptRepository.createReceipt({
      receiptId: RECEIPT_ID,
      actorId: 'user:1',
      classificationIds: [41],
    });
    await receiptRepository.finalizeReceipt({
      receiptId: RECEIPT_ID,
      records: [{
        classificationId: 41,
        resultStatusId: 'skipped',
        reasonId: 'not_found',
      }],
    });

    await expect(reconciliationService.run({
      receiptId: RECEIPT_ID,
      actorId: 'user:2',
    })).rejects.toMatchObject({
      name: 'NotFoundError',
      statusCode: 404,
      code: 'historic_route_safety_refresh_receipt_not_found',
    });
  });

  test('discovers only the latest in-window receipt for the authenticated actor', async () => {
    await receiptRepository.createReceipt({
      receiptId: RECEIPT_ID,
      actorId: 'user:1',
      classificationIds: [41],
    });
    await pool.query(
      `UPDATE policy_runtime_historic_route_safety_refresh_receipts
       SET created_at = NOW() - INTERVAL '2 hours'
       WHERE receipt_id = $1::uuid`,
      [RECEIPT_ID],
    );
    await receiptRepository.createReceipt({
      receiptId: OTHER_ACTOR_RECEIPT_ID,
      actorId: 'user:2',
      classificationIds: [42],
    });
    await receiptRepository.createReceipt({
      receiptId: RECENT_RECEIPT_ID,
      actorId: 'user:1',
      classificationIds: [43],
    });

    await expect(recentReceiptDiscoveryService.run({ actorId: 'user:1' })).resolves.toMatchObject({
      mode: 'read_only',
      recentReceipt: { retryReceipt: RECENT_RECEIPT_ID },
    });
    await expect(recentReceiptDiscoveryService.run({ actorId: 'user:3' })).resolves.toMatchObject({
      recentReceipt: null,
    });
  });
});
