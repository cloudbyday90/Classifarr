/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { runInventoryOutcomeCalibration } from '../../scripts/runInventoryOutcomeCalibration.mjs';
import { jest } from '@jest/globals';

test('CLI queries one read-only bounded snapshot, returns aggregates and closes', async () => {
  const queries = [];
  const client = { query: async (sql, params) => {
    queries.push({ sql, params });
    if (sql.includes('FROM media_server_items')) return { rows: [] };
    if (sql.includes('FROM libraries')) return { rows: [] };
    if (sql.includes('FROM policy_feedback_evaluation')) return { rows: [] };
    return { rows: [] };
  } };
  const close = jest.fn();
  const load = async () => ({ withTransaction: callback => callback(client), close });
  const result = await runInventoryOutcomeCalibration({ argv: ['--seed', 'outcome-study-20260922'], load });
  expect(result).toMatchObject({ status: 'no_eligible_labels', promotionAllowed: false });
  expect(queries[0].sql).toContain('READ ONLY');
  expect(queries.some(query => query.sql.includes('policy_feedback_evaluation'))).toBe(true);
  expect(close).toHaveBeenCalledTimes(1);
});

test('CLI closes its pool when the snapshot fails', async () => {
  const close = jest.fn();
  const load = async () => ({ withTransaction: async () => { throw new Error('snapshot_failed'); }, close });
  await expect(runInventoryOutcomeCalibration({ argv: ['--seed', 'outcome-study-20260922'], load }))
    .rejects.toThrow('snapshot_failed');
  expect(close).toHaveBeenCalledTimes(1);
});
