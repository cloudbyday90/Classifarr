/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';

/** Read-only barrier; only identities captured from this fixture are observed. */
export async function waitForDatabaseSessionsExit(pool, sessions, timeoutMs = 5_000) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 5_000) {
    throw new Error('fixture_database_session_deadline_invalid');
  }
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    const result = await pool.query({
      text: `SELECT EXISTS (
        SELECT 1 FROM pg_stat_activity AS activity
        JOIN unnest($1::integer[], $2::timestamptz[]) AS owned(pid, started_at)
          ON activity.pid = owned.pid AND activity.backend_start = owned.started_at
        WHERE activity.datname = current_database()
      ) AS active`,
      values: [sessions.map(session => session.pid), sessions.map(session => session.startedAt)],
      query_timeout: Math.max(1, Math.ceil(deadline - performance.now())),
    });
    if (result.rows[0]?.active === false) return;
    if (result.rows[0]?.active !== true) throw new Error('fixture_database_session_observation_invalid');
    await delay(Math.min(20, Math.max(0, deadline - performance.now())));
  }
  throw new Error('fixture_database_sessions_still_active');
}

/** Track disposable admission clients, including rejected attempts, for cleanup. */
export function trackDatabaseSessions(pool) {
  if (!/^(?:classifarr_suite_[a-f0-9]{12}|cf_schema_[a-f0-9]{32})$/.test(pool.options?.database ?? '')) {
    throw new Error('isolated_admission_fixture_required');
  }
  const sessions = [];
  const clients = [];
  return {
    database: { pool: {
      options: pool.options,
      async connect() {
        const client = await pool.connect();
        const release = client.release.bind(client);
        let released = false;
        client.release = (destroy = false) => {
          if (released) return;
          released = true;
          release(destroy);
        };
        clients.push(client);
        try {
          const { rows } = await client.query(`SELECT pid, backend_start::text AS started_at
            FROM pg_stat_activity WHERE pid = pg_backend_pid()`);
          if (!rows[0]) throw new Error('fixture_database_session_missing');
          sessions.push({ pid: rows[0].pid, startedAt: rows[0].started_at });
          return client;
        } catch (error) { client.release(true); throw error; }
      },
    } },
    waitForExit: (timeoutMs) => waitForDatabaseSessionsExit(pool, sessions, timeoutMs),
    async cleanup() {
      for (const client of clients) client.release(true);
      await waitForDatabaseSessionsExit(pool, sessions);
    },
  };
}
