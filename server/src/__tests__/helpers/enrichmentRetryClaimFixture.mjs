/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';

/** Orchestration-only SQL mock. Real ownership behavior is tested in PostgreSQL. */
export function installRetryClaimFixture(db, query) {
  let current;
  db.query.mockImplementation(async (sql, params) => {
    if (sql.includes('WITH candidate AS')) {
      const selected = await query(sql, params);
      const row = selected.rows.find(item => !params[1].includes(item.queue_id));
      if (!row) return { rows: [], rowCount: 0 };
      current = { media_server_id: 1, external_id: 'fixture', library_id: 1, media_type: 'movie',
        title: 'Fixture', year: null, imdb_id: null, tvdb_id: null, tmdb_id: null,
        attempts: 0, max_attempts: 3, ...row, claim_token: randomUUID() };
      return { rows: [current], rowCount: 1 };
    }
    if (sql.includes('SELECT claim_until::text')) return { rows: [{ deadline: '2099-01-01', attempts: current.attempts, max_attempts: current.max_attempts }], rowCount: 1 };
    if (sql.includes('SELECT clock_timestamp()')) return { rows: [{ live: true }] };
    if (sql.includes('SELECT msi.id FROM media_server_items')) return { rows: [{ id: current.media_item_id }], rowCount: 1 };
    return query(sql, params);
  });
  db.withTransaction = work => work(db);
  return db;
}
