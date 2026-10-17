/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { cleanupConfiguration } from '../ollamaGateway/cleanupConfiguration.mjs';
import { withArchiveMaintenance } from '../ollamaGateway/archiveMaintenanceLock.mjs';
import { resolve } from 'node:path';
import { cleanupFailureReason } from '../ollamaGateway/cleanupFailure.mjs';

const valid = () => ({ database: { host: '/source-socket',database: 'gateway',user: 'cleanup' },
  providerHash: 'a'.repeat(64),retentionDays: 90,archives: resolve('archives'),receipts: resolve('receipts') });
test('cleanup configuration retains the minimum window and fixed private socket boundary',() => {
  expect(cleanupConfiguration(valid())).toEqual(valid());
  for (const change of [{ retentionDays: 89 },{ retentionDays: 0 },{ retentionDays: 90.1 },{ extra: true },
    { database: { ...valid().database,host: 'https://provider' } },{ providerHash: 'bad' },
    { archives: '../escape' },{ receipts: valid().archives }]) {
    expect(() => cleanupConfiguration({ ...valid(),...change })).toThrow();
  }
});
test('cleanup failures distinguish bounded database outcomes without exposing error content',() => {
  for (const [code,reason] of [['57014','gateway_cleanup_statement_timeout'],['55P03','gateway_cleanup_contended'],
    ['42501','gateway_cleanup_permission_denied']]) {
    expect(cleanupFailureReason({ code,message: 'private SQL',detail: 'private data' })).toBe(reason);
  }
  expect(cleanupFailureReason({ message: 'gateway_cleanup_cooldown' })).toBe('gateway_cleanup_cooldown');
  for (const error of [null,undefined,{ code: 'secret',message: 'private' },{ message: 'gateway_cleanup_cooldown private' }]) {
    expect(cleanupFailureReason(error)).toBe('gateway_cleanup_unavailable');
  }
});
test('maintenance exclusion yields without acting and always releases after failure',async () => {
  const calls = []; let acted = false;
  const busy = { query: async sql => { calls.push(sql); return { rows: [{ acquired: false }] }; } };
  expect((await withArchiveMaintenance(busy,() => { acted = true; })).state).toBe('maintenance_busy');
  expect(acted).toBe(false); expect(calls).toHaveLength(1);
  const free = { query: async sql => { calls.push(sql); return { rows: [{ acquired: true }] }; } };
  await expect(withArchiveMaintenance(free,() => { throw new Error('synthetic'); })).rejects.toThrow('synthetic');
  expect(calls.at(-1)).toBe('SELECT pg_advisory_unlock(11435,4)');
});
