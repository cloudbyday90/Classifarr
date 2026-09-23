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

test('prospective mode reads frozen events only, without inventory reconstruction or providers', async () => {
  const queries = [], close = jest.fn();
  const load = async () => ({ close, withTransaction: callback => callback({ query: async (sql, params) => {
    queries.push({ sql, params }); return { rows: [] };
  } }) });
  const result = await runInventoryOutcomeCalibration({ argv: ['--prospective', '--since', '2026-01-01T00:00:00Z',
    '--until', '2026-02-01T00:00:00Z'], load });
  expect(result).toMatchObject({ status: 'awaiting_eligible_outcomes', providerCalls: 0,
    window: { since: '2026-01-01T00:00:00.000Z', until: '2026-02-01T00:00:00.000Z' } });
  expect(queries[0].sql).toContain('READ ONLY');
  expect(queries.at(-1).sql).toContain('policy_feedback_sources');
  expect(queries.at(-1).params).toEqual(['2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z']);
  expect(queries.some(query => query.sql.includes('FROM media_server_items'))).toBe(false);
  expect(close).toHaveBeenCalledTimes(1);
});

test.each([
  ['--prospective', '--size', '100'], ['--prospective', '--folds', '3'],
  ['--seed', 'test', '--since', '2026-01-01'], ['--prospective', '--since', 'bad'],
  ['--prospective', '--since', '2026-02-01', '--until', '2026-01-01'],
  ['--prospective', '--until', '2999-01-01'],
])('rejects mismatched mode or invalid window before connecting: %j', async (...argv) => {
  const load = jest.fn();
  await expect(runInventoryOutcomeCalibration({ argv, load })).rejects.toThrow('inventory_outcome_');
  expect(load).not.toHaveBeenCalled();
});
