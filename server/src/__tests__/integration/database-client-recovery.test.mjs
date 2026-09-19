/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { getPool } from './setup.mjs';

// Integration setup normally substitutes the application database API with its suite pool.
// This regression must exercise the real wrapper rather than that substitute.
jest.unstable_unmockModule('../../config/database.mjs');
const { createDatabaseModule } = await import('../../config/database.mjs');

test('real idle-in-transaction termination is contained and a fresh database request succeeds', async () => {
  const pool = getPool(), logger = { error: jest.fn(), warn: jest.fn() };
  const db = createDatabaseModule({ pgModule: { Pool: class { constructor() { return pool; } } },
    loggerFactory: () => logger, environment: { NODE_ENV: 'production' } });
  await pool.query('CREATE TABLE client_recovery_receipts (id integer PRIMARY KEY)');
  let failedPid;
  const callback = jest.fn(async (client, { signal }) => {
    failedPid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    await client.query('INSERT INTO client_recovery_receipts (id) VALUES (1)');
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '50ms'");
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('expected_idle_timeout_missing')), 3000);
      signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
    });
    return 'must not commit';
  });
  await expect(db.withTransaction(callback)).rejects.toMatchObject({ code: '25P03' });
  expect(callback).toHaveBeenCalledTimes(1);
  expect(logger.warn).toHaveBeenCalledWith('Database operation lost its checked-out connection',
    { operation: 'transaction', code: '25P03' }, { skipDbPersist: true });
  const fresh = await db.query('SELECT pg_backend_pid() AS pid, 1 AS ok');
  expect(fresh.rows[0]).toMatchObject({ ok: 1 }); expect(fresh.rows[0].pid).not.toBe(failedPid);
  expect((await db.query('SELECT count(*)::integer AS count FROM client_recovery_receipts')).rows[0].count).toBe(0);
  await db.withTransaction(client => client.query('INSERT INTO client_recovery_receipts (id) VALUES (2)'));
  expect((await db.query('SELECT id FROM client_recovery_receipts')).rows).toEqual([{ id: 2 }]);
  expect(await db.healthCheck()).toEqual({ healthy: true });
});
