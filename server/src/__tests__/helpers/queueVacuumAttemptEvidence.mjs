/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { runQueueVacuumMaintenance } from '../../services/queueVacuumMaintenance.mjs';
import { queueVacuumFailureCategory } from '../../services/queueVacuumFailure.mjs';

const counter = value => typeof value === 'string' && /^\d{1,19}$/.test(value) ? value : null;

/** Bounded test failure evidence: never save raw notices, SQL, connection details or rows. */
export async function observeQueueVacuumAttempt(pool, { beforeVacuum = async () => {}, report } = {}) {
  const evidence = { observations: [], notices: [], commands: 0 };
  const database = { pool: { connect: async () => {
    const client = await pool.connect();
    const originalQuery = client.query.bind(client);
    client.on('notice', notice => {
      if (evidence.notices.length < 8) evidence.notices.push({
        warning: notice.severity === 'WARNING',
        code: typeof notice.code === 'string' && /^[0-9A-Z]{5}$/.test(notice.code) ? notice.code : null,
      });
    });
    client.query = async (sql, ...args) => {
      if (sql.startsWith('VACUUM ')) {
        evidence.commands += 1;
        await beforeVacuum();
      }
      const result = await originalQuery(sql, ...args);
      if (sql.includes('FROM pg_catalog.pg_class c') && evidence.observations.length < 3) {
        const row = result.rows[0];
        evidence.observations.push(row ? {
          vacuum: counter(row.vacuum_count), analyze: counter(row.analyze_count),
          automatic: counter(row.autovacuum_count), running: row.vacuum_running === true,
        } : null);
      }
      return result;
    };
    // The executor destroys its leased client; instrumentation never re-enters the pool.
    return client;
  } } };
  try {
    return { result: await runQueueVacuumMaintenance({ database, automatic: true, report }), error: null, evidence };
  } catch (error) {
    // Diagnosis is already the runtime's fixed, sanitized projection, not the raw cause.
    return { result: null, error: { category: queueVacuumFailureCategory(error.category),
      diagnosis: error.diagnosis ?? null }, evidence };
  }
}
