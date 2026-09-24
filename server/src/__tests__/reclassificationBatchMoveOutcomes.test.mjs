/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { bindBatchMove, completeBatchMove } from '../services/reclassificationBatchMoveOutcomes.mjs';
import { historyMoveRecoverySql } from '../services/reclassificationMoveReadModel.mjs';

const operation = { id: 'reference', classification_id: 3, target_library_id: 4 };
test('standalone reservation does not require batch tables', async () => {
  const client = { query: jest.fn() };
  await bindBatchMove(client, operation, null);
  expect(client.query).not.toHaveBeenCalled();
});
test('binding validates exact identities and execution state with parameters', async () => {
  const client = { query: jest.fn().mockResolvedValue({ rows: [{ id: 2 }] }) };
  await bindBatchMove(client, operation, 2);
  expect(client.query).toHaveBeenCalledWith(expect.stringContaining("item.status = 'executing'"), ['reference', 2, 3, 4]);
  client.query.mockResolvedValue({ rows: [] });
  await expect(bindBatchMove(client, operation, 2)).rejects.toMatchObject({ code: 'move_batch_changed' });
});
test('completion is safe before the first batch is created', async () => {
  const client = { query: jest.fn().mockResolvedValue({ rows: [{ relation: null }] }) };
  await completeBatchMove(client, operation);
  expect(client.query).toHaveBeenCalledTimes(1);
});
test('completion requires the exact durable reference and never changes paused/cancelled batch intent', async () => {
  const client = { query: jest.fn().mockResolvedValue({ rows: [{ relation: 'reclassification_batch_items' }] }) };
  await completeBatchMove(client, operation);
  expect(client.query).toHaveBeenLastCalledWith(expect.stringContaining("execution_result->>'moveOperationId' = $1"), ['reference', 3, 4]);
  const sql = client.query.mock.calls[1][0];
  expect(sql).toContain("status IN ('executing', 'failed', 'validated')");
  expect(sql).not.toContain('UPDATE reclassification_batches');
});
test('history selects only safe summary fields for one exact classification', () => {
  expect(historyMoveRecoverySql).toContain('move.classification_id = ch.id');
  expect(historyMoveRecoverySql).toContain('LIMIT 1');
  expect(historyMoveRecoverySql).not.toMatch(/plan|resource_key|corrected_by|SELECT \*/);
});
