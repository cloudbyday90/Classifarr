/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { getPool } from './setup.mjs';
import { representativeProfileFixture } from '../helpers/inventoryRepresentativeProfileFixture.mjs';
import { createInventoryRepresentativeProfileRepository, REPRESENTATIVE_PROFILE_LIBRARIES_SQL,
  REPRESENTATIVE_PROFILE_IDENTITIES_SQL, REPRESENTATIVE_PROFILE_CORPUS_SQL } from '../../services/inventoryRepresentativeProfileRepository.mjs';
import { INVENTORY_DESCRIPTION_REFRESH_STATE_SQL } from '../../services/inventoryDescriptionRefreshRepository.mjs';
import { createInventoryDescriptionVectorCache } from '../../services/inventoryDescriptionVectorCache.mjs';

test('presence and decoded batches stay consistent across concurrent deletion and update; fresh reads detect both', async () => {
  const pool = getPool(), fixture = representativeProfileFixture({ perLibrary: 150 });
  // Generated identifier only; no application or user input enters SQL identifiers.
  const table = `comparison_cache_${randomUUID().replaceAll('-', '')}`;
  const scoped = sql => sql.replaceAll('inventory_description_vector_cache', table);
  await pool.query(`CREATE TABLE ${table} (LIKE inventory_description_vector_cache INCLUDING ALL)`);
  let client, removed = false, batches = 0;
  try {
    const cache = createInventoryDescriptionVectorCache({ query: (sql, params) => pool.query(scoped(sql), params) });
    const entries = [...fixture.snapshot.vectors].map(([hash, vector]) => ({ hash, vector }));
    for (let i = 0; i < entries.length; i += 8) await cache.write(fixture.identity, entries.slice(i, i + 8));
    client = await pool.connect();
    const profiles = createInventoryRepresentativeProfileRepository({ withTransaction: async callback => {
      await client.query('BEGIN');
      try {
        const result = await callback({ query: async (sql, params) => {
          if (sql === INVENTORY_DESCRIPTION_REFRESH_STATE_SQL) return { rows: [fixture.state] };
          if (sql === REPRESENTATIVE_PROFILE_LIBRARIES_SQL) return { rows: fixture.snapshot.libraries };
          if (sql === REPRESENTATIVE_PROFILE_IDENTITIES_SQL || sql === REPRESENTATIVE_PROFILE_CORPUS_SQL) return { rows: fixture.rows };
          const answer = await client.query(scoped(sql), params);
          if (sql.includes('embedding::text')) batches++;
          if (!removed && sql.includes('embedding::text')) {
            removed = true;
            // Both changed rows are in a later transport batch, not already decoded.
            await pool.query(`DELETE FROM ${table} WHERE description_hash=$1`, [entries[299].hash]);
            await pool.query(`UPDATE ${table} SET embedding='[0,1]'::vector WHERE description_hash=$1`, [entries[298].hash]);
          }
          return answer;
        } });
        await client.query('COMMIT'); return result;
      } catch (error) { await client.query('ROLLBACK'); throw error; }
    } });
    const initial = (await profiles.read(fixture.identity, { requireCompleteVectors: true })).vectors;
    expect(initial.size).toBe(entries.length);
    expect(batches).toBe(2);
    expect(initial.get(entries[298].hash)).not.toEqual([0, 1]);
    expect(initial.has(entries[299].hash)).toBe(true);
    expect(removed).toBe(true);
    await expect(profiles.read(fixture.identity, { requireCompleteVectors: true })).rejects.toMatchObject({
      coverage: { eligibleDescriptions: entries.length, cachedDescriptions: entries.length - 1, missingDescriptions: 1 },
    });
    const fresh = (await profiles.read(fixture.identity)).vectors;
    expect(fresh.get(entries[298].hash)).toEqual([0, 1]);
    expect(fresh.has(entries[299].hash)).toBe(false);
  } finally { client?.release(); await pool.query(`DROP TABLE ${table}`); }
});

test('aborted batch read rolls back and releases a usable connection without returning partial vectors', async () => {
  const pool = getPool(), fixture = representativeProfileFixture({ perLibrary: 150 });
  const client = await pool.connect(), controller = new AbortController();
  let batches = 0, rolledBack = false;
  try {
    await client.query('CREATE TEMP TABLE inventory_description_vector_cache (LIKE public.inventory_description_vector_cache INCLUDING ALL)');
    const cache = createInventoryDescriptionVectorCache({ query: client.query.bind(client) });
    const entries = [...fixture.snapshot.vectors].map(([hash, vector]) => ({ hash, vector }));
    for (let i = 0; i < entries.length; i += 8) await cache.write(fixture.identity, entries.slice(i, i + 8));
    const repository = createInventoryRepresentativeProfileRepository({ withTransaction: async callback => {
      await client.query('BEGIN');
      try {
        const result = await callback({ query: async (sql, params) => {
          if (sql === INVENTORY_DESCRIPTION_REFRESH_STATE_SQL) return { rows: [fixture.state] };
          if (sql === REPRESENTATIVE_PROFILE_LIBRARIES_SQL) return { rows: fixture.snapshot.libraries };
          if (sql === REPRESENTATIVE_PROFILE_IDENTITIES_SQL || sql === REPRESENTATIVE_PROFILE_CORPUS_SQL) return { rows: fixture.rows };
          const result = await client.query(sql, params);
          if (sql.includes('embedding::text')) { batches++; controller.abort(new Error('stopped')); }
          return result;
        } });
        await client.query('COMMIT'); return result;
      } catch (error) { await client.query('ROLLBACK'); rolledBack = true; throw error; }
    } });
    await expect(repository.read(fixture.identity, { signal: controller.signal })).rejects.toThrow('stopped');
    expect(batches).toBe(1); expect(rolledBack).toBe(true);
    expect((await client.query('SHOW transaction_isolation')).rows[0].transaction_isolation).toBe('read committed');
    expect((await cache.read(fixture.identity, entries.map(entry => entry.hash))).size).toBe(300);
  } finally { client.release(true); }
});
