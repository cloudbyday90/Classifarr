/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export function availableOmdbQuotaFixture() {
  return { api_key: 'synthetic', daily_limit: 1000, requests_today: 0,
    last_reset_date: '2026-09-29', quota_day: '2026-09-29' };
}

/** Only for isolated integration databases; never call against application data. */
export async function seedOmdbQuotaFixture(db) {
  await db.query('TRUNCATE omdb_config');
  await db.query(`INSERT INTO omdb_config(api_key, is_active, daily_limit, requests_today, last_reset_date)
    VALUES ('synthetic', true, 1000, 0, (statement_timestamp() AT TIME ZONE 'UTC')::date)`);
}
