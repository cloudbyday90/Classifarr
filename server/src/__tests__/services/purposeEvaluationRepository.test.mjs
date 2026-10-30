/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, jest } from '@jest/globals';
import { createPurposeEvaluationRepository } from '../../services/purposeEvaluationRepository.mjs';
import { purposeEvaluationReport } from '../fixtures/automaticPurposeFixture.mjs';

function setup() {
  const client = { query: jest.fn(async sql => ({ rowCount: 1, rows: sql.startsWith('SELECT date_trunc') ? [{ observed_at: new Date('2026-10-29T12:00:00Z') }] :
    sql.includes('bool_and') ? [{ installed: true }] : sql.startsWith('WITH authorized') ? [{ input: null, events: 0, payload_bytes: '0' }] :
      sql.includes('readiness') ? [{ readiness: 'ready' }] : [] })) };
  const database = { withTransaction: jest.fn(callback => callback(client)) };
  return { client, database, repository: createPurposeEvaluationRepository(database) };
}
test('automatic source read is coherent, bounded and separate from optional private context', async () => {
  const { repository, client, database } = setup(); await repository.assertIdle();
  expect(await repository.readSnapshot()).toMatchObject({ observedAt: '2026-10-29T12:00:00.000Z', inputs: { rows: [] } });
  expect(database.withTransaction.mock.calls.every(([, options]) => options.signal && options.readOnly && options.isolationLevel === 'repeatable_read')).toBe(true);
  expect(client.query.mock.calls.some(([sql]) => sql.startsWith('WITH requested'))).toBe(false);
});
test('missing sources are unavailable and cannot become an empty successful report', async () => {
  const { repository, client } = setup(), original = client.query.getMockImplementation();
  client.query.mockImplementation(sql => sql.includes('bool_and') ? { rows: [{ installed: false }] } : original(sql));
  await expect(repository.readSnapshot()).rejects.toThrow('sources_unavailable');
  expect(client.query.mock.calls.some(([sql]) => sql.startsWith('WITH authorized'))).toBe(false);
});
test('publication rejects private/invalid data and aborts before committing a cancelled write', async () => {
  const { repository, client, database } = setup(), report = purposeEvaluationReport();
  expect(() => repository.save('PRIVATE', report, report.window.until)).toThrow('invalid_report');
  expect(() => repository.fail('PRIVATE')).toThrow('invalid_failure'); expect(database.withTransaction).not.toHaveBeenCalled();
  const controller = new AbortController(), original = client.query.getMockImplementation();
  client.query.mockImplementation(sql => { if (sql.startsWith('INSERT')) controller.abort(); return original(sql); });
  await expect(repository.save('a'.repeat(64), report, report.window.until, controller.signal)).rejects.toThrow();
});
