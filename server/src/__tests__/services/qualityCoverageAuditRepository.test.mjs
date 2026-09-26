/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { qualitySnapshot } from '../fixtures/sourcePairQualityFixture.mjs';
import { prepareSourcePairQualityProtocol } from '../../services/sourcePairQualityProtocol.mjs';
import { emptyQualityEvidence } from '../../services/qualityEvidenceContract.mjs';
import { readQualityCoverageAudit } from '../../services/qualityCoverageAuditRepository.mjs';

const columns = {
  quality_evidence_study: ['protocol_id', 'protocol', 'evidence', 'status', 'created_at', 'expires_at'],
  cached_adjudication_batch: ['batch', 'captured_at', 'expires_at'],
  automatic_source_pair_evaluation: ['cohort', 'cohort_created_at'],
  adjudication_capture_budget: ['daily_calls'],
};
const catalog = Object.entries(columns).flatMap(([table_name, names]) => names.map(column_name => ({ table_name, column_name })));
function fixture() {
  const protocol = prepareSourcePairQualityProtocol(qualitySnapshot()).protocol;
  const rows = { quality_evidence_study: [{ protocol_id: protocol.id, protocol, evidence: emptyQualityEvidence(protocol),
    status: 'active', created_at: protocol.createdAt, expires_at: '2026-10-25T12:00:00.000Z' }],
  adjudication_capture_budget: [{ daily_calls: 20 }], automatic_source_pair_evaluation: [{ cohort: protocol.cohort, cohort_created_at: protocol.createdAt }],
  cached_adjudication_batch: [{ captured_at: protocol.createdAt, expires_at: '2026-09-26T12:00:00.000Z', responses: 0 }] };
  const query = jest.fn(async sql => {
    if (sql.startsWith('SELECT transaction_timestamp')) return { rows: [{ observed_at: protocol.createdAt }] };
    if (sql.includes('information_schema.columns')) return { rows: catalog };
    return { rows: Object.entries(rows).find(([table]) => sql.includes(`FROM public.${table}`))?.[1] ?? [] };
  });
  return { rows, query, database: { withTransaction: fn => fn({ query }) } };
}

test('reads only allowlisted metadata; never calls mutating repository helpers', async () => {
  const { database, query } = fixture(), result = await readQualityCoverageAudit(database);
  expect(result).toMatchObject({ status: 'blocked_evidence', captureDailyCalls: 20, cache: { state: 'current', responses: 0 },
    storedCohortOverlap: { shared: 48, studyOnly: 0, diagnosticOnly: 0 } });
  expect(query.mock.calls.every(([sql]) => /^(SELECT|SET) /.test(sql))).toBe(true);
  const catalogCall = query.mock.calls.find(([sql]) => sql.includes('information_schema.columns'));
  expect(catalogCall[1]).toEqual([Object.keys(columns)]);
});

test.each(Object.keys(columns))('duplicate %s singleton data fails closed', async table => {
  const { database, rows } = fixture(); rows[table].push(rows[table][0]);
  await expect(readQualityCoverageAudit(database)).rejects.toThrow('quality_audit_invalid');
});

test('missing singleton rows do not cause implicit creation', async () => {
  const { database, rows } = fixture(); for (const key of Object.keys(rows)) rows[key] = [];
  expect(await readQualityCoverageAudit(database)).toMatchObject({ status: 'study_not_started', captureDailyCalls: 0 });
});

test('abort after queries rejects without returning a partially collected receipt', async () => {
  const { database, query } = fixture(), controller = new AbortController();
  const implementation = query.getMockImplementation();
  query.mockImplementation(async (...args) => {
    const result = await implementation(...args);
    if (args[0].includes('FROM public.cached_adjudication_batch')) controller.abort(new Error('cancelled'));
    return result;
  });
  await expect(readQualityCoverageAudit(database, { signal: controller.signal })).rejects.toThrow('cancelled');
});
