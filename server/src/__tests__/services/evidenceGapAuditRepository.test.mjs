/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { createEvidenceGapAuditRepository } from '../../services/evidenceGapAuditRepository.mjs';
import { evidenceGapAuditFailure } from '../../services/automaticEvidenceGapAudit.mjs';
import { gapAuditReport } from '../fixtures/evidenceGapAuditFixture.mjs';

function setup() {
  const client = { query: jest.fn(async sql => ({ rowCount: 1, rows: sql.includes('observed_at') && sql.includes('transaction_timestamp')
    ? [{ observed_at: new Date('2026-10-28T12:00:00Z') }] : sql.includes('AS recorded_movie_tv_events')
      ? [{ recorded_movie_tv_events: 0 }] : sql.includes('AS payload_bytes') ? [{ input: null, captures: 0, payload_bytes: '0' }]
        : sql.includes('readiness') ? [{ readiness: 'ready' }] : [] })) };
  const database = { withTransaction: jest.fn((callback) => callback(client)) };
  return { client, database, repository: createEvidenceGapAuditRepository(database) };
}
test('source reads have bounded read-only options; empty inputs are explicit rather than omitted', async () => {
  const { repository, database } = setup();
  expect(await repository.readState()).toBeNull(); await repository.assertIdle();
  expect(await repository.readSnapshot()).toMatchObject({ inputs: { rows: [], activity: { recorded_movie_tv_events: 0 } } });
  expect(database.withTransaction.mock.calls.every(([, options]) => options.signal && options.readOnly && options.isolationLevel === 'repeatable_read')).toBe(true);
});
test.each(['ingesting', 'backfilling', 'unknown'])('idle predicate fails closed for %s', async readiness => {
  const { repository, client } = setup(); client.query.mockResolvedValue({ rows: [{ readiness }] });
  await expect(repository.assertIdle()).rejects.toThrow(readiness === 'unknown' ? 'unavailable' : 'busy');
});
test.each([{ captures: 1, payload_bytes: '0', input: null }, { captures: 5001, payload_bytes: '0', input: null },
  { captures: 1, payload_bytes: '67108865', input: null }, { captures: 0, payload_bytes: '-1', input: null }])
('malformed or over-budget transport fails closed: %j', async header => {
  const { repository, client } = setup(), original = client.query.getMockImplementation();
  client.query.mockImplementation(sql => sql.includes('AS payload_bytes') ? { rows: [header] } : original(sql));
  await expect(repository.readSnapshot()).rejects.toThrow(/evidence_gap_audit_(invalid_input|input_budget)/);
});
test('publication validates before writing; abort observed after statement rejects before transaction commit', async () => {
  const { repository, client, database } = setup(), report = gapAuditReport();
  expect(() => repository.save('PRIVATE', report, report.window.until)).toThrow('invalid_report');
  expect(() => repository.fail('PRIVATE')).toThrow('invalid_failure');
  expect(database.withTransaction).not.toHaveBeenCalled();
  const controller = new AbortController(), original = client.query.getMockImplementation();
  client.query.mockImplementation(sql => { if (sql.startsWith('INSERT')) controller.abort(); return original(sql); });
  await expect(repository.save('a'.repeat(64), report, report.window.until, controller.signal)).rejects.toThrow();
  expect(database.withTransaction.mock.calls[0]).toHaveLength(1); // cancellable write options are deliberately absent
});
test.each([
  [{ reason: 'memory_unknown' }, 'memory_unknown'], [{ message: 'evidence_gap_audit_busy' }, 'busy'],
  [{ message: 'evidence_gap_audit_input_budget' }, 'evidence_budget'], [{ code: '57014' }, 'deadline'],
  [{ name: 'AbortError' }, 'deadline'], [{ message: 'evidence_gap_audit_deadline' }, 'deadline'],
  [{ message: 'evidence_gap_audit_invalid_input' }, 'invalid_evidence'], [{ message: 'PRIVATE database error' }, 'evaluation_unavailable'],
])('failure mapping retains fixed codes only', (error, expected) => { expect(evidenceGapAuditFailure(error)).toBe(expected); });
