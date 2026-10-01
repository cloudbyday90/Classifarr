/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { getPool } from './setup.mjs';
import { assertQueueMaintenanceHandoffBoundary } from '../../services/queueMaintenanceHandoffBoundary.mjs';
import { assessQueueVacuumHandoff } from '../../services/queueVacuumHandoffAssessment.mjs';

const query = (sql, params) => getPool().query(sql, params);
beforeEach(async () => {
  await query('CREATE ROLE cf_runtime NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS');
  await query('GRANT USAGE ON SCHEMA public TO cf_runtime');
  await query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
  await query('GRANT SELECT ON queue_vacuum_recovery_state TO cf_runtime');
});
afterEach(async () => { await query('DROP OWNED BY cf_runtime'); await query('DROP ROLE cf_runtime'); });

test('protected ledger is readable but not writable by the runtime, including after a new connection', async () => {
  const database = { pool: getPool() };
  await expect(assertQueueMaintenanceHandoffBoundary(database)).resolves.toBeUndefined();
  const restricted = { pool: { connect: async () => {
    const client = await getPool().connect(); await client.query('SET ROLE cf_runtime'); return client;
  } } };
  const result = await assessQueueVacuumHandoff({ database: restricted });
  expect(result.status).toBe('idle');
  const client = await restricted.pool.connect();
  try {
    for (const sql of ['UPDATE queue_vacuum_recovery_state SET attempts=0', 'DELETE FROM queue_vacuum_recovery_state', 'TRUNCATE queue_vacuum_recovery_state']) {
      await expect(client.query(sql)).rejects.toMatchObject({ code: '42501' });
    }
  } finally { client.release(true); }
});
test.each(['UPDATE', 'INSERT', 'TRUNCATE', 'UPDATE(attempts)'])('worker rejects runtime authority %s without repairing grants', async grant => {
  await query(`GRANT ${grant} ON queue_vacuum_recovery_state TO cf_runtime`);
  await expect(assertQueueMaintenanceHandoffBoundary({ pool: getPool() })).rejects.toThrow('boundary_unavailable');
});
test('runtime role membership is rejected even without inherited ledger permissions', async () => {
  await query('GRANT pg_read_all_stats TO cf_runtime WITH INHERIT FALSE');
  await expect(assertQueueMaintenanceHandoffBoundary({ pool: getPool() })).rejects.toThrow('boundary_unavailable');
});
