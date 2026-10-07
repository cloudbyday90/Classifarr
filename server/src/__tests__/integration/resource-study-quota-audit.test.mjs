/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeAll, beforeEach, expect, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { installStudyQuotaAudit, assertStudyQuotaAudit } from '../helpers/studyQuotaAudit.mjs';
import { reserveOmdbQuota } from '../../services/omdbQuotaStore.mjs';

const db = createIntegrationDatabaseModuleMock();
beforeAll(() => installStudyQuotaAudit(db));
beforeEach(async () => {
  await db.query('TRUNCATE omdb_config,study_omdb_quota_audit RESTART IDENTITY');
  await db.query(`INSERT INTO omdb_config(api_key,is_active,daily_limit,requests_today,last_reset_date)
    VALUES ('synthetic-quota-audit',true,1000,0,'2026-10-06')`);
});

// Explicit boundary test only: HTTP study clocks/cooldowns remain real and unchanged.
const atInstant = instant => ({ withTransaction: work => db.withTransaction(client => work({
  query: (sql, params) => sql.includes('statement_timestamp()')
    ? client.query(sql.replace('statement_timestamp()', '$1::timestamptz'), [instant])
    : client.query(sql, params),
})) });

test.each([false, true])('committed quota evidence is exact across midnight=%s and rollback', async midnight => {
  for (let attempt = 0; attempt < 11; attempt++) {
    const instant = midnight && attempt >= 2 ? '2026-10-07T00:00:00Z' : '2026-10-06T23:59:59.999Z';
    expect((await reserveOmdbQuota(atInstant(instant))).status).toBe('reserved');
  }
  const { rows: [config] } = await db.query('SELECT requests_today FROM omdb_config');
  expect(config.requests_today).toBe(midnight ? 9 : 11);
  await expect(assertStudyQuotaAudit(db, 11)).resolves.toBeUndefined();
  const current = atInstant(midnight ? '2026-10-07T00:00:01Z' : '2026-10-06T23:59:59.999Z');
  await expect(reserveOmdbQuota({ withTransaction: work => current.withTransaction(async client => {
    await work(client); throw new Error('synthetic rollback');
  }) })).rejects.toThrow('synthetic rollback');
  await expect(assertStudyQuotaAudit(db, 11)).resolves.toBeUndefined();
  await reserveOmdbQuota(current);
  await expect(assertStudyQuotaAudit(db, 11)).rejects.toThrow('study_quota_committed_reservations');
});

test('daily sequence corruption cannot pass merely because total reservations match', async () => {
  await reserveOmdbQuota(atInstant('2026-10-06T23:59:59.999Z'));
  await db.query('UPDATE study_omdb_quota_audit SET used=9');
  await expect(assertStudyQuotaAudit(db, 1)).rejects.toThrow('study_quota_daily_sequence');
});

test('audit installation refuses a non-test database before DDL', async () => {
  let queries = 0;
  await expect(installStudyQuotaAudit({ query: async () => {
    queries++; return { rows: [{ name: 'classifarr' }] };
  } })).rejects.toThrow();
  expect(queries).toBe(1);
});
