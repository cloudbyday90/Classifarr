/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createPgvectorSelectionReport, presentPgvectorSelection, normalizePgvectorTimestamp,
  PGVECTOR_REPORT_KEY } from '../services/pgvectorSelectionReport.mjs';
import { recordPgvectorSelection } from '../services/pgvectorSelectionRecorder.mjs';
import { readPgvectorStatus } from '../services/pgvectorStatus.mjs';
import { checkPgvectorStartupReport } from '../../../scripts/check-pgvector-startup-report.mjs';

const reporterId = '12345678-1234-4567-8123-123456789abc';
const now = new Date('2026-10-12T15:00:00.000Z');
const databaseStartedAt = new Date('2026-10-12T14:59:00.000Z');
const environment = { CLASSIFARR_PGVECTOR_BUILD: 'multi', CLASSIFARR_PGVECTOR_VARIANT_SELECTED: 'generic',
  CLASSIFARR_PGVECTOR_SELECTION_SOURCE: 'embedded_entrypoint', CLASSIFARR_PGVECTOR_SELECTION_REASON: 'staging_disabled',
  CLASSIFARR_PGVECTOR_SELECTION_AT: '2026-10-12T14:58:00Z' };
const input = { environment, cpu: { hasAvx: true, hasAvx2: true }, reporterId, now, databaseStartedAt };
const report = createPgvectorSelectionReport(input);
const context = { reporterId, now, databaseStartedAt };

describe('pgvector startup report boundary', () => {
  test.each(['classifarr:latest', undefined, 'sha256:abc'])('image rehearsal rejects mutable or invalid identity %p before Docker access', async image => {
    await expect(checkPgvectorStartupReport(image)).rejects.toThrow();
  });
  test('retains a bounded report without paths, hosts, credentials or extra environment values', () => {
    const actual = createPgvectorSelectionReport({ ...input, environment: { ...environment, POSTGRES_PASSWORD: 'secret', POSTGRES_HOST: 'private' } });
    expect(actual).toEqual(report);
    expect(JSON.stringify(actual).length).toBeLessThan(2048);
    expect(presentPgvectorSelection(JSON.stringify({ ...actual, token: 'secret' }), context)).toEqual({ status: 'current_process', report });
  });
  test.each(['staging_disabled', 'staging_invalid', 'generic_build', 'cpu_unknown', 'cpu_no_avx',
    'optimized_binary_unavailable', 'staging_target_unsafe', 'staging_failed', 'variant_binaries_missing'])('preserves reported reason %s', reason => {
    const actual = createPgvectorSelectionReport({ ...input, environment: { ...environment, CLASSIFARR_PGVECTOR_SELECTION_REASON: reason } });
    expect(actual.reason).toBe(reason);
    expect(presentPgvectorSelection(JSON.stringify(actual), context).status).toBe('current_process');
  });
  test('records optimized staging only for an optimized variant', () => {
    const env = { ...environment, CLASSIFARR_PGVECTOR_SELECTION_REASON: 'optimized_staged' };
    expect(createPgvectorSelectionReport({ ...input, environment: env }).reason).toBe('unknown');
    const actual = createPgvectorSelectionReport({ ...input, environment: { ...env, CLASSIFARR_PGVECTOR_VARIANT_SELECTED: 'avx2' } });
    expect(actual.reason).toBe('optimized_staged');
    expect(presentPgvectorSelection(JSON.stringify(actual), context).status).toBe('current_process');
  });
  test('does not invent embedded scope or binary values for older/native starts', () => {
    expect(createPgvectorSelectionReport({ ...input, environment: {} })).toMatchObject({
      databaseScope: 'unverified', reason: 'unknown', selectedAt: null, build: 'unknown', selectedVariant: 'unknown',
    });
  });
  test.each([null, undefined, '', 'private\nvalue', '2026-02-30T00:00:00Z', '2026-10-12', new Date(NaN)])('rejects invalid timestamp %p', value => {
    expect(normalizePgvectorTimestamp(value)).toBeNull();
  });
  test.each([{}, { reason: 'secret' }, { reporterId: 'private-host' }, { schemaVersion: 2 },
    { recordedAt: '2026-10-13T15:00:00.000Z' }, { selectedAt: '2026-10-12T15:01:00.000Z' },
    { cpuAvx: true }, { build: 'path/to/binary' }, { databaseStartedAt: 'broken' },
    { databaseScope: 'unverified', reason: 'staging_disabled' }, { selectedVariant: 'avx2' },
  ])('rejects unsupported or inconsistent stored fields %p', fields => {
    const raw = Object.keys(fields).length ? { ...report, ...fields } : {};
    expect(presentPgvectorSelection(JSON.stringify(raw), context)).toEqual({ status: 'invalid', report: null });
  });
  test.each(['{', 'x'.repeat(2049), 'null', '[]'])('handles corrupt/oversized JSON', raw => {
    expect(presentPgvectorSelection(raw, context)).toEqual({ status: 'invalid', report: null });
  });
  test('distinguishes missing, other-process, changed-database and unavailable context', () => {
    expect(presentPgvectorSelection(undefined, context).status).toBe('legacy');
    const raw = JSON.stringify(report);
    expect(presentPgvectorSelection(raw, { ...context, reporterId: 'different' }).status).toBe('other_process');
    expect(presentPgvectorSelection(raw, { ...context, databaseStartedAt: now }).status).toBe('database_changed');
    expect(presentPgvectorSelection(raw, { ...context, databaseStartedAt: null }).status).toBe('unavailable');
    expect(presentPgvectorSelection(JSON.stringify({ ...report, databaseStartedAt: null }), context).status).toBe('unavailable');
  });
});

describe('pgvector recording and shared status reader', () => {
  function database() {
    return { query: jest.fn().mockResolvedValueOnce({ rows: [{ started_at: databaseStartedAt }] }).mockResolvedValue({ rows: [] }) };
  }
  test('writes six keys atomically and shares sanitized evidence with both status consumers', async () => {
    const db = database();
    expect(await recordPgvectorSelection({ ...input, db })).toEqual({ action: 'recorded', report });
    expect(db.query).toHaveBeenCalledTimes(2);
    const [sql, [keys, values]] = db.query.mock.calls[1];
    expect(sql).toContain('unnest($1::text[], $2::text[])');
    expect(sql).toContain('ON CONFLICT (key) DO UPDATE');
    expect(keys).toHaveLength(6);
    expect(keys).toContain(PGVECTOR_REPORT_KEY);
    const rows = keys.map((key, i) => ({ key, value: values[i], database_started_at: databaseStartedAt }));
    db.query.mockResolvedValue({ rows });
    const result = await readPgvectorStatus(db, context);
    expect(result.pgvectorSelection).toEqual({ status: 'current_process', report });
    expect(result.pgvectorVariant).toBe('generic');
    expect(result.lastChecked).toBe(now.toISOString());
    rows.find(row => row.key === 'avx_guard_cpu_avx').value = 'false';
    expect((await readPgvectorStatus(db, context)).pgvectorSelection.status).toBe('settings_changed');
  });
  test('context failure can persist only an unverified database run', async () => {
    const db = { query: jest.fn().mockRejectedValueOnce(new Error('context')).mockResolvedValue({ rows: [] }) };
    const actual = await recordPgvectorSelection({ ...input, db });
    expect(actual.action).toBe('recorded');
    expect(actual.report.databaseStartedAt).toBeNull();
    expect(presentPgvectorSelection(JSON.stringify(actual.report), context).status).toBe('unavailable');
  });
  test('missing table cannot claim a recorded report; other persistence failures propagate', async () => {
    const db = database();
    db.query.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: '42P01' }));
    expect(await recordPgvectorSelection({ ...input, db })).toEqual({ action: 'unavailable', report: null });
    db.query.mockRejectedValue(new Error('write failed'));
    await expect(recordPgvectorSelection({ ...input, db })).rejects.toThrow('write failed');
  });
});
