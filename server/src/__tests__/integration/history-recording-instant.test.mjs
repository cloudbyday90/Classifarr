/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFileSync } from 'node:fs';
import { test, expect, beforeEach, afterEach } from '@jest/globals';
import { getPool } from './setup.mjs';
import { EVIDENCE_COVERAGE_SQL } from '../../services/evidenceCoverageQuery.mjs';
import { buildEvidenceCoverage } from '../../services/evidenceCoverageService.mjs';

const migration = readFileSync(new URL('../../../../database/migrations/20260907_030000_add_history_recording_instant.sql', import.meta.url), 'utf8');
let client;
beforeEach(async () => { client = await getPool().connect(); await client.query('BEGIN'); });
afterEach(async () => { await client.query('ROLLBACK'); client.release(); });
const insert = `INSERT INTO classification_history(title,media_type,method,status)
    VALUES('PRIVATE recording instant','movie','ai_analysis','pending') RETURNING id,recorded_at`;

test('populated upgrade leaves legacy dates unchanged and unknown without rewriting the table', async () => {
    // Only this disposable suite database is changed; rollback restores the migrated schema.
    await client.query('DROP TRIGGER preserve_history_recording_instant ON public.classification_history');
    await client.query('DROP FUNCTION public.preserve_history_recording_instant()');
    await client.query('ALTER TABLE public.classification_history DROP COLUMN recorded_at');
    const id = (await client.query(insert.replace(',recorded_at', ''))).rows[0].id;
    await client.query("UPDATE classification_history SET created_at='2026-11-01 01:30:00' WHERE id=$1", [id]);
    const before = (await client.query("SELECT created_at::text,pg_relation_filenode('classification_history') node FROM classification_history WHERE id=$1", [id])).rows[0];
    await client.query(migration);
    const after = (await client.query("SELECT recorded_at,created_at::text,pg_relation_filenode('classification_history') node FROM classification_history WHERE id=$1", [id])).rows[0];
    expect(after).toEqual({ ...before, recorded_at: null });
    expect((await client.query(insert)).rows[0].recorded_at).toBeInstanceOf(Date);
    const coverage = buildEvidenceCoverage((await client.query(EVIDENCE_COVERAGE_SQL, [200])).rows[0]);
    expect(coverage.recording_time_coverage).toEqual({ events: 2, recorded_events: 1, unknown_events: 1 });
    expect(coverage.provenance_trend.timestamp_basis).toBe('stored_database_calendar');
    expect(JSON.stringify(coverage.recording_time_coverage)).not.toMatch(/PRIVATE|created_at|title/);
});

test('default is the INSERT statement start, after a transaction has already begun', async () => {
    await client.query('SELECT pg_sleep(0.01)');
    const row = (await client.query(`${insert},
        recorded_at=statement_timestamp() AS statement_time,
        recorded_at>transaction_timestamp() AS after_transaction`)).rows[0];
    expect(row).toMatchObject({ statement_time: true, after_transaction: true });
});

test('offsets distinguish a repeated DST hour and represent the same instants in every session zone', async () => {
    await client.query(`INSERT INTO classification_history(title,media_type,method,status,recorded_at)
        VALUES('PRIVATE first','movie','ai_analysis','pending','2026-11-01T01:30:00-04:00'),
              ('PRIVATE second','movie','ai_analysis','pending','2026-11-01T01:30:00-05:00')`);
    for (const zone of ['UTC', 'America/New_York', 'Pacific/Auckland']) {
        await client.query("SELECT set_config('TimeZone',$1,true)", [zone]);
        const rows = (await client.query('SELECT recorded_at FROM classification_history ORDER BY recorded_at')).rows;
        expect(rows.map(row => row.recorded_at.toISOString())).toEqual(['2026-11-01T05:30:00.000Z', '2026-11-01T06:30:00.000Z']);
    }
});

test.each([null, '2026-09-07T12:00:00Z'])('resolution and same-value updates preserve instant %s', async instant => {
    const id = (await client.query(`INSERT INTO classification_history(title,media_type,method,status,recorded_at)
        VALUES('PRIVATE preserved','movie','ai_analysis','pending',$1) RETURNING id`, [instant])).rows[0].id;
    await client.query("UPDATE classification_history SET status='pending_retry',method='manual_classification',recorded_at=recorded_at WHERE id=$1", [id]);
    const row = (await client.query('SELECT recorded_at,status,method FROM classification_history WHERE id=$1', [id])).rows[0];
    expect(row).toMatchObject({ status: 'pending_retry', method: 'manual_classification' });
    expect(row.recorded_at?.toISOString() ?? null).toBe(instant ? new Date(instant).toISOString() : null);
    for (const replacement of [null, '2026-09-08T12:00:00Z']) {
        if (instant === replacement) continue;
        await client.query('SAVEPOINT reject_update');
        await expect(client.query('UPDATE classification_history SET recorded_at=$1 WHERE id=$2', [replacement, id]))
            .rejects.toMatchObject({ code: '23514', message: 'History recording instant cannot be changed' });
        await client.query('ROLLBACK TO SAVEPOINT reject_update');
    }
});

test.each(['infinity', '-infinity'])('rejects non-finite inserted instant %s', async instant => {
    await expect(client.query(`INSERT INTO classification_history(title,media_type,method,status,recorded_at)
        VALUES('PRIVATE invalid','movie','ai_analysis','pending',$1)`, [instant]))
        .rejects.toMatchObject({ code: '23514', constraint: 'classification_history_recorded_at_finite' });
});

test('the guard sees changes made by a BEFORE UPDATE trigger even when the SQL omits recorded_at', async () => {
    const id = (await client.query(insert)).rows[0].id;
    await client.query(`CREATE FUNCTION pg_temp.rewrite_recorded_at() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN NEW.recorded_at := NULL; RETURN NEW; END; $$;
        CREATE TRIGGER fixture_rewrite BEFORE UPDATE ON public.classification_history
        FOR EACH ROW EXECUTE FUNCTION pg_temp.rewrite_recorded_at()`);
    await expect(client.query("UPDATE classification_history SET status='pending_retry' WHERE id=$1", [id]))
        .rejects.toMatchObject({ code: '23514', message: 'History recording instant cannot be changed' });
});
