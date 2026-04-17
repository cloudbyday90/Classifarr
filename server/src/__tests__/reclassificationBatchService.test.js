/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

'use strict';

jest.mock('../config/database', () => ({
  query: jest.fn(),
  pool: { connect: jest.fn() }
}));
jest.mock('../services/reclassificationService', () => ({
  previewReclassification: jest.fn(),
  executeReclassification: jest.fn()
}));
jest.mock('../utils/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
  }))
}));

const db = require('../config/database');
const reclassificationService = require('../services/reclassificationService');
const svc = require('../services/reclassificationBatchService');

const BATCH_ROW = {
  id: 1, status: 'pending', total_items: 2, completed_items: 0,
  failed_items: 0, skipped_items: 0, paused_at_item: null, error_message: null
};
const ITEM_ROWS = [
  { id: 10, batch_id: 1, classification_id: 100, target_library_id: 5, execution_order: 1, status: 'pending', title: 'Movie A' },
  { id: 11, batch_id: 1, classification_id: 101, target_library_id: 5, execution_order: 2, status: 'pending', title: 'Movie B' }
];

function mockGetBatchStatus() {
  // Two db.query calls for getBatchStatus
  db.query
    .mockResolvedValueOnce({ rows: [BATCH_ROW] })
    .mockResolvedValueOnce({ rows: ITEM_ROWS });
}

const makeClient = () => {
  const client = { query: jest.fn(), release: jest.fn() };
  client.query.mockResolvedValue({ rows: [] });
  return client;
};

beforeEach(() => {
  db.query.mockReset();
  db.pool.connect.mockReset();
  reclassificationService.previewReclassification.mockReset();
  reclassificationService.executeReclassification.mockReset();
  jest.restoreAllMocks();
  svc.initialized = true; // skip ensureTables in most tests
});

// ---------------------------------------------------------------------------
// ensureTables
// ---------------------------------------------------------------------------

describe('ensureTables', () => {
  test('runs 4 CREATE queries and sets initialized=true', async () => {
    svc.initialized = false;
    db.query.mockResolvedValue({ rows: [] });
    await svc.ensureTables();
    expect(db.query).toHaveBeenCalledTimes(4);
    expect(svc.initialized).toBe(true);
  });

  test('is idempotent — skips when already initialized', async () => {
    svc.initialized = true;
    await svc.ensureTables();
    expect(db.query).not.toHaveBeenCalled();
  });

  test('throws and leaves initialized=false on error', async () => {
    svc.initialized = false;
    db.query.mockRejectedValueOnce(new Error('DB error'));
    await expect(svc.ensureTables()).rejects.toThrow('DB error');
    expect(svc.initialized).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createBatch
// ---------------------------------------------------------------------------

describe('createBatch', () => {
  test('throws when items array is empty', async () => {
    await expect(svc.createBatch([])).rejects.toThrow('Items array is required and must not be empty');
    await expect(svc.createBatch(null)).rejects.toThrow('Items array is required and must not be empty');
  });

  test('creates batch and items via transaction', async () => {
    const client = makeClient();
    client.query
      .mockResolvedValueOnce({ rows: [] })   // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // INSERT batch
      .mockResolvedValueOnce({ rows: [] })   // INSERT item 1
      .mockResolvedValueOnce({ rows: [] })   // COMMIT
    db.pool.connect.mockResolvedValueOnce(client);
    mockGetBatchStatus();

    await svc.createBatch([{ classificationId: 100, targetLibraryId: 5 }]);

    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  test('rolls back and re-throws on error', async () => {
    const client = makeClient();
    client.query
      .mockResolvedValueOnce({ rows: [] })   // BEGIN
      .mockRejectedValueOnce(new Error('insert failed')); // INSERT batch
    db.pool.connect.mockResolvedValueOnce(client);

    await expect(svc.createBatch([{ classificationId: 1, targetLibraryId: 2 }])).rejects.toThrow('insert failed');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  test('respects pauseOnError and createdBy options', async () => {
    const client = makeClient();
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 2 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    db.pool.connect.mockResolvedValueOnce(client);
    mockGetBatchStatus();

    await svc.createBatch([{ classificationId: 1, targetLibraryId: 2 }], { pauseOnError: false, createdBy: 'admin' });

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO reclassification_batches'),
      expect.arrayContaining([false, 'admin'])
    );
  });
});

// ---------------------------------------------------------------------------
// getBatchStatus
// ---------------------------------------------------------------------------

describe('getBatchStatus', () => {
  test('throws when batch not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(svc.getBatchStatus(99)).rejects.toThrow('Batch not found');
  });

  test('returns batch with progress calculation', async () => {
    const batchRow = { ...BATCH_ROW, total_items: 10, completed_items: 5, failed_items: 2, skipped_items: 1 };
    db.query
      .mockResolvedValueOnce({ rows: [batchRow] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await svc.getBatchStatus(1);
    expect(result.progress.total).toBe(10);
    expect(result.progress.completed).toBe(5);
    expect(result.progress.failed).toBe(2);
    expect(result.progress.skipped).toBe(1);
    expect(result.progress.remaining).toBe(2);
    expect(result.progress.percentage).toBe(50);
  });

  test('returns 0% when total_items is 0', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ ...BATCH_ROW, total_items: 0, completed_items: 0 }] })
      .mockResolvedValueOnce({ rows: [] });
    const result = await svc.getBatchStatus(1);
    expect(result.progress.percentage).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getBatchProgress
// ---------------------------------------------------------------------------

describe('getBatchProgress', () => {
  test('throws when batch not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(svc.getBatchProgress(99)).rejects.toThrow('Batch not found');
  });

  test('returns lightweight progress', async () => {
    const row = { id: 1, status: 'executing', total_items: 4, completed_items: 2, failed_items: 0, skipped_items: 0, paused_at_item: null, error_message: null };
    db.query.mockResolvedValueOnce({ rows: [row] });
    const result = await svc.getBatchProgress(1);
    expect(result.batchId).toBe(1);
    expect(result.status).toBe('executing');
    expect(result.progress.percentage).toBe(50);
    expect(result.progress.remaining).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// validateBatch
// ---------------------------------------------------------------------------

describe('validateBatch', () => {
  test('sets batch to validated when all items pass', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] }) // UPDATE to validating
      .mockResolvedValueOnce({ rows: [ITEM_ROWS[0]] }) // SELECT items
      .mockResolvedValueOnce({ rows: [] }) // UPDATE item
      .mockResolvedValueOnce({ rows: [] }) // UPDATE batch to validated
    reclassificationService.previewReclassification.mockResolvedValueOnce({ canProceed: true, warning: null });
    mockGetBatchStatus();

    await svc.validateBatch(1);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("reclassification_batches"),
      expect.arrayContaining(['validated', 1])
    );
  });

  test('sets batch to validation_failed when any item is invalid', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] }) // UPDATE to validating
      .mockResolvedValueOnce({ rows: [ITEM_ROWS[0]] }) // SELECT items
      .mockResolvedValueOnce({ rows: [] }) // UPDATE item
      .mockResolvedValueOnce({ rows: [] }) // UPDATE batch
    reclassificationService.previewReclassification.mockResolvedValueOnce({ canProceed: false, warning: 'Cannot proceed' });
    mockGetBatchStatus();

    await svc.validateBatch(1);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("reclassification_batches"),
      expect.arrayContaining(['validation_failed', 1])
    );
  });

  test('marks item as invalid when previewReclassification throws', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [ITEM_ROWS[0]] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    reclassificationService.previewReclassification.mockRejectedValueOnce(new Error('Preview error'));
    mockGetBatchStatus();

    await svc.validateBatch(1);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("'invalid'"),
      expect.arrayContaining(['Preview error'])
    );
  });
});

// ---------------------------------------------------------------------------
// executeBatch
// ---------------------------------------------------------------------------

describe('executeBatch', () => {
  test('throws when batch not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(svc.executeBatch(99)).rejects.toThrow('Batch not found');
  });

  test('completes items successfully and sets status=completed', async () => {
    const batch = { ...BATCH_ROW, completed_items: 0, failed_items: 0, pause_on_error: false, created_by: 'user' };
    const item = { ...ITEM_ROWS[0], status: 'validated' };
    db.query
      .mockResolvedValueOnce({ rows: [batch] })     // SELECT batch
      .mockResolvedValueOnce({ rows: [] })           // UPDATE to executing
      .mockResolvedValueOnce({ rows: [item] })       // SELECT items
      .mockResolvedValueOnce({ rows: [] })           // UPDATE item to executing
      .mockResolvedValueOnce({ rows: [] })           // UPDATE item to completed
      .mockResolvedValueOnce({ rows: [] })           // UPDATE batch completedCount
      .mockResolvedValueOnce({ rows: [] });          // UPDATE batch to completed

    reclassificationService.executeReclassification.mockResolvedValueOnce({ success: true });
    mockGetBatchStatus();

    await svc.executeBatch(1);
    expect(reclassificationService.executeReclassification).toHaveBeenCalledWith(
      expect.objectContaining({ classificationId: item.classification_id })
    );
  });

  test('pauses batch on error when pause_on_error=true', async () => {
    const batch = { ...BATCH_ROW, completed_items: 0, failed_items: 0, pause_on_error: true, created_by: 'user' };
    const item = { ...ITEM_ROWS[0], status: 'validated' };
    db.query
      .mockResolvedValueOnce({ rows: [batch] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [item] })
      .mockResolvedValueOnce({ rows: [] })   // UPDATE to executing
      .mockResolvedValueOnce({ rows: [] })   // UPDATE to failed
      .mockResolvedValueOnce({ rows: [] })   // UPDATE failedCount
      .mockResolvedValueOnce({ rows: [] });  // UPDATE to paused
    reclassificationService.executeReclassification.mockRejectedValueOnce(new Error('exec error'));
    mockGetBatchStatus();

    await svc.executeBatch(1);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("'paused'"),
      expect.arrayContaining(['exec error'])
    );
  });

  test('continues on error when pause_on_error=false', async () => {
    const batch = { ...BATCH_ROW, completed_items: 0, failed_items: 0, pause_on_error: false, created_by: 'user' };
    const item = { ...ITEM_ROWS[0], status: 'validated' };
    db.query
      .mockResolvedValueOnce({ rows: [batch] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [item] })
      .mockResolvedValueOnce({ rows: [] })   // UPDATE to executing
      .mockResolvedValueOnce({ rows: [] })   // UPDATE to failed
      .mockResolvedValueOnce({ rows: [] })   // UPDATE failedCount
      .mockResolvedValueOnce({ rows: [] });  // UPDATE batch to completed (all processed)
    reclassificationService.executeReclassification.mockRejectedValueOnce(new Error('non-fatal'));
    mockGetBatchStatus();

    await svc.executeBatch(1);
    // Should reach UPDATE batch to 'completed', no 'paused' update
    const calls = db.query.mock.calls.map(c => c[0]);
    expect(calls.some(sql => typeof sql === 'string' && sql.includes("'completed'"))).toBe(true);
    expect(calls.some(sql => typeof sql === 'string' && sql.includes("'paused'"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// pauseBatch / cancelBatch / skipItem / retryItem
// ---------------------------------------------------------------------------

describe('pauseBatch', () => {
  test('updates status and returns getBatchStatus', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // UPDATE
    mockGetBatchStatus();
    const result = await svc.pauseBatch(1);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("'paused'"),
      [1]
    );
    expect(result.progress).toBeDefined();
  });
});

describe('cancelBatch', () => {
  test('cancels pending items and batch', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })  // UPDATE items
      .mockResolvedValueOnce({ rows: [] }); // UPDATE batch
    mockGetBatchStatus();
    await svc.cancelBatch(1);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("'cancelled'"),
      [1]
    );
  });
});

describe('skipItem', () => {
  test('marks item as skipped and increments count', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })  // UPDATE item
      .mockResolvedValueOnce({ rows: [] }); // UPDATE skipped count
    mockGetBatchStatus();
    await svc.skipItem(1, 10);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("'skipped'"),
      [10, 1]
    );
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('skipped_items'),
      [1]
    );
  });
});

describe('retryItem', () => {
  test('resets item to validated status', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // UPDATE
    mockGetBatchStatus();
    await svc.retryItem(1, 10);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("'validated'"),
      [10, 1]
    );
  });
});

// ---------------------------------------------------------------------------
// listBatches
// ---------------------------------------------------------------------------

describe('listBatches', () => {
  test('returns batches with progress', async () => {
    const rows = [{ ...BATCH_ROW, total_items: 5, completed_items: 5, failed_items: 0, skipped_items: 0 }];
    db.query.mockResolvedValueOnce({ rows });
    const result = await svc.listBatches(10);
    expect(result).toHaveLength(1);
    expect(result[0].progress.percentage).toBe(100);
  });

  test('uses default limit of 20', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await svc.listBatches();
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT'),
      [20]
    );
  });
});
