/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, jest } from '@jest/globals';
import { recordReadinessBackfill } from '../../services/ollamaReadinessBackfillObservation.mjs';
const config = { primary_provider: 'ollama', ollama_host: 'fixture', ollama_model: 'model', configuration_revision: 2 };
function fixture(current = config) {
  const query = jest.fn(async sql => ({ rows: sql.startsWith('SELECT') ? [current] : [] }));
  return { query, withTransaction: jest.fn(async work => work({ query })) };
}
test('records only normalized parameterized data within bounded configuration locking', async () => {
  const db = fixture();
  await recordReadinessBackfill(db, config, { status: 'deferred', reason: 'private endpoint' });
  expect(db.query.mock.calls[0][0]).toContain("transaction_timeout='5s'");
  expect(db.query.mock.calls[1][0]).toContain('FOR SHARE');
  expect(db.query.mock.calls[2][1]).toEqual([2, expect.stringMatching(/^[a-f0-9]{64}$/), 'waiting', 'unavailable']);
  expect(JSON.stringify(db.query.mock.calls)).not.toContain('private endpoint');
});
test.each([undefined, { primary_provider: 'openai' }, { ...config, configuration_revision: 3 },
  { ...config, ollama_host: 'changed' }, { ...config, ollama_verification_capability_checked_at: '2026-10-14' }])(
  'does not overwrite changed or completed config: %j', async current => {
    const db = fixture(); db.query.mockImplementation(async sql => ({ rows: sql.startsWith('SELECT') ? [current] : [] }));
    await recordReadinessBackfill(db, config, { status: 'deferred', reason: 'busy' });
    expect(db.query).toHaveBeenCalledTimes(2);
  });
test('completion may record a saved verdict, while irrelevant/ineligible observations stay inert', async () => {
  const db = fixture({ ...config, ollama_verification_capability_checked_at: '2026-10-14' });
  await recordReadinessBackfill(db, config, { status: 'completed' });
  expect(db.query.mock.calls[2][1].slice(2)).toEqual(['completed', 'completed']);
  await recordReadinessBackfill(db, config, { reason: 'already_checked' });
  await recordReadinessBackfill(db, config, { reason: 'not_applicable' });
  await recordReadinessBackfill(db, null, { status: 'completed' });
  expect(db.withTransaction).toHaveBeenCalledTimes(1);
});
