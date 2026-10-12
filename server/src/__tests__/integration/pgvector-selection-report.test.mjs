/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { getPool } from './setup.mjs';
import { recordPgvectorSelection } from '../../services/pgvectorSelectionRecorder.mjs';
import { readPgvectorStatus } from '../../services/pgvectorStatus.mjs';
import { PGVECTOR_REPORT_KEY } from '../../services/pgvectorSelectionReport.mjs';

describe('pgvector report PostgreSQL persistence', () => {
  test('atomically records a report, detects an older writer, and rolls back a rejected bulk update', async () => {
    const db = await getPool().connect();
    try {
      await db.query('BEGIN');
      // Session-local shadow table: no shared fixture settings are changed.
      await db.query('CREATE TEMP TABLE settings (key text PRIMARY KEY, value text, updated_at timestamptz DEFAULT now()) ON COMMIT DROP');
      const input = { db, reporterId: randomUUID(), cpu: { hasAvx: true, hasAvx2: true }, environment: {
        CLASSIFARR_PGVECTOR_BUILD: 'multi', CLASSIFARR_PGVECTOR_VARIANT_SELECTED: 'generic',
        CLASSIFARR_PGVECTOR_SELECTION_SOURCE: 'embedded_entrypoint', CLASSIFARR_PGVECTOR_SELECTION_REASON: 'staging_disabled',
        CLASSIFARR_PGVECTOR_SELECTION_AT: new Date().toISOString(),
      } };
      const { report } = await recordPgvectorSelection(input);
      expect((await readPgvectorStatus(db, { reporterId: input.reporterId })).pgvectorSelection).toEqual({ status: 'current_process', report });
      expect((await db.query('SELECT count(*)::int AS count FROM settings')).rows[0].count).toBe(6);
      await db.query("UPDATE settings SET value = 'avx2' WHERE key = 'avx_guard_pgvector_selected'");
      expect((await readPgvectorStatus(db, { reporterId: input.reporterId })).pgvectorSelection.status).toBe('settings_changed');
      await db.query("ALTER TABLE settings ADD CONSTRAINT reject_report CHECK (key <> 'avx_guard_selection_report_v1') NOT VALID");
      await db.query('SAVEPOINT reject_write');
      await expect(recordPgvectorSelection(input)).rejects.toMatchObject({ code: '23514' });
      await db.query('ROLLBACK TO SAVEPOINT reject_write');
      const after = await db.query('SELECT key, value FROM settings');
      const values = new Map(after.rows.map(row => [row.key, row.value]));
      expect(values.get('avx_guard_pgvector_selected')).toBe('avx2');
      expect(JSON.parse(values.get(PGVECTOR_REPORT_KEY))).toEqual(report);
    } finally {
      await db.query('ROLLBACK');
      db.release();
    }
  });
});
