/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { createInventoryDiscoveryAdmission, INVENTORY_DISCOVERY_LOCK } from '../../services/inventoryDiscoveryAdmission.mjs';

jest.unstable_unmockModule('../../config/database.mjs');
const { createDatabaseModule } = await import('../../config/database.mjs');
const readMemory = () => ({ available: 2 ** 31, constrained: 2 ** 32, total: 2 ** 34 });
function database() {
  return createDatabaseModule({ pgModule: { Pool: class { constructor() { return getPool(); } } },
    loggerFactory: () => ({ error: jest.fn(), warn: jest.fn() }), environment: { NODE_ENV: 'production' } });
}

test('independent runtime owners share one nonblocking session lease and recover after cancellation', async () => {
  const db = database(), first = createInventoryDiscoveryAdmission({ ...db, readMemory }), second = createInventoryDiscoveryAdmission({ ...db, readMemory });
  const controller = new AbortController(); let entered;
  const ready = new Promise(resolve => { entered = resolve; });
  const pending = first(signal => new Promise(resolve => { signal.addEventListener('abort', resolve, { once: true }); entered(); }), { signal: controller.signal });
  const rejected = expect(pending).rejects.toThrow('stop test owner');
  await ready;
  const callback = jest.fn();
  await expect(second(callback)).rejects.toMatchObject({ reason: 'busy' });
  expect(callback).not.toHaveBeenCalled();
  expect((await db.query('SELECT 1 AS ok')).rows[0].ok).toBe(1);
  controller.abort(new Error('stop test owner')); await rejected;
  expect(await second(async () => 'recovered')).toBe('recovered');
});

test('terminated lock connection cancels work, rejects late success, and permits a new owner', async () => {
  const db = database(), run = createInventoryDiscoveryAdmission({ ...db, readMemory });
  let entered; const ready = new Promise(resolve => { entered = resolve; });
  const pending = run(signal => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('missing lease cancellation')), 3000);
    signal.addEventListener('abort', () => { clearTimeout(timeout); resolve('late result'); }, { once: true }); entered();
  }));
  const rejected = expect(pending).rejects.toMatchObject({ code: '57P01' });
  await ready;
  const { rows } = await getPool().query("SELECT pid FROM pg_locks WHERE locktype='advisory' AND classid=0 AND objid=$1 AND granted", [INVENTORY_DISCOVERY_LOCK]);
  expect(rows).toHaveLength(1);
  await getPool().query('SELECT pg_terminate_backend($1)', [rows[0].pid]);
  await rejected;
  expect(await run(async () => 'recovered')).toBe('recovered');
});
