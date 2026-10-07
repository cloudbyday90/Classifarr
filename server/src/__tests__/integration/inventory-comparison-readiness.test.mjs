/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { getPool } from './setup.mjs';
import { representativeProfileFixture } from '../helpers/inventoryRepresentativeProfileFixture.mjs';
import { createInventoryRepresentativeProfileRepository, REPRESENTATIVE_PROFILE_LIBRARIES_SQL,
  REPRESENTATIVE_PROFILE_IDENTITIES_SQL, REPRESENTATIVE_PROFILE_CORPUS_SQL } from '../../services/inventoryRepresentativeProfileRepository.mjs';
import { INVENTORY_DESCRIPTION_REFRESH_STATE_SQL } from '../../services/inventoryDescriptionRefreshRepository.mjs';
import { createInventoryDescriptionVectorCache } from '../../services/inventoryDescriptionVectorCache.mjs';
import { inspectUnseenMultiScaleSource } from '../../services/inventoryMultiScaleSource.mjs';
import { createLiveMultiScaleRefresh } from '../../services/liveMultiScaleRefresh.mjs';

test.each(['read', 'readVerification'])('%s stays consistent across concurrent deletion and update; fresh reads detect both', async method => {
  const pool = getPool(), fixture = representativeProfileFixture({ perLibrary: 150 });
  // Generated identifier only; no application or user input enters SQL identifiers.
  const table = `comparison_cache_${randomUUID().replaceAll('-', '')}`;
  const scoped = sql => sql.replaceAll('inventory_description_vector_cache', table);
  await pool.query(`CREATE TABLE ${table} (LIKE inventory_description_vector_cache INCLUDING ALL)`);
  let client, removed = false, batches = 0;
  try {
    const cache = createInventoryDescriptionVectorCache({ query: (sql, params) => pool.query(scoped(sql), params) });
    const ordered = [...fixture.snapshot.vectors];
    if (method === 'readVerification') ordered.sort(([a], [b]) => a.localeCompare(b));
    const entries = ordered.map(([hash, vector]) => ({ hash, vector }));
    for (let i = 0; i < entries.length; i += 8) await cache.write(fixture.identity, entries.slice(i, i + 8));
    const expectedKey = inspectUnseenMultiScaleSource({ ...fixture.snapshot,
      vectors: await cache.read(fixture.identity, entries.map(entry => entry.hash)) }, fixture.identity).key;
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
    const initial = await profiles[method](fixture.identity, { requireCompleteVectors: true });
    if (method === 'read') {
      expect(initial.vectors.size).toBe(entries.length);
      expect(initial.vectors.get(entries[298].hash)).not.toEqual([0, 1]);
      expect(initial.vectors.has(entries[299].hash)).toBe(true);
    } else {
      expect(initial).not.toHaveProperty('vectors');
      expect(initial.key).toBe(expectedKey);
    }
    expect(batches).toBe(2);
    expect(removed).toBe(true);
    await expect(profiles[method](fixture.identity, { requireCompleteVectors: true })).rejects.toMatchObject({
      coverage: { eligibleDescriptions: entries.length, cachedDescriptions: entries.length - 1, missingDescriptions: 1 },
    });
    const fresh = (await profiles.read(fixture.identity)).vectors;
    expect(fresh.get(entries[298].hash)).toEqual([0, 1]);
    expect(fresh.has(entries[299].hash)).toBe(false);
    await cache.write(fixture.identity, [entries[299]]);
    expect((await profiles.readVerification(fixture.identity)).key).not.toBe(expectedKey);
  } finally { client?.release(); await pool.query(`DROP TABLE ${table}`); }
});

test.each(['read', 'readVerification'])('aborted %s rolls back and releases a usable connection without returning partial evidence', async method => {
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
    await expect(repository[method](fixture.identity, { signal: controller.signal })).rejects.toThrow('stopped');
    expect(batches).toBe(1); expect(rolledBack).toBe(true);
    expect((await client.query('SHOW transaction_isolation')).rows[0].transaction_isolation).toBe('read committed');
    expect((await cache.read(fixture.identity, entries.map(entry => entry.hash))).size).toBe(300);
  } finally { client.release(true); }
});

test.each(['unchanged', 'updated', 'deleted'])('warm streamed refresh detects %s vectors across separate real transactions', async change => {
  const pool = getPool(), fixture = representativeProfileFixture({ perLibrary: 150 });
  const table = `comparison_cache_${randomUUID().replaceAll('-', '')}`;
  const scoped = sql => sql.replaceAll('inventory_description_vector_cache', table);
  await pool.query(`CREATE TABLE ${table} (LIKE inventory_description_vector_cache INCLUDING ALL)`);
  let time = 1_000_000, warm = false, transactions = 0, worker;
  try {
    const cache = createInventoryDescriptionVectorCache({ query: (sql, params) => pool.query(scoped(sql), params) });
    const entries = [...fixture.snapshot.vectors].map(([hash, vector]) => ({ hash, vector }));
    for (let i = 0; i < entries.length; i += 8) await cache.write(fixture.identity, entries.slice(i, i + 8));
    const profiles = createInventoryRepresentativeProfileRepository({ withTransaction: async callback => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN'); transactions++;
        const result = await callback({ query: async (sql, params) => {
          if (sql === INVENTORY_DESCRIPTION_REFRESH_STATE_SQL) return { rows: [fixture.state] };
          if (sql === REPRESENTATIVE_PROFILE_LIBRARIES_SQL) return { rows: fixture.snapshot.libraries };
          if (sql === REPRESENTATIVE_PROFILE_IDENTITIES_SQL || sql === REPRESENTATIVE_PROFILE_CORPUS_SQL) return { rows: fixture.rows };
          return client.query(scoped(sql), params);
        } });
        await client.query('COMMIT');
        // Commit a competing writer after the warm probe, before publication verification.
        if (warm && transactions === 1 && change === 'updated') {
          await pool.query(`UPDATE ${table} SET embedding='[0,1]'::vector WHERE description_hash=$1`, [entries[299].hash]);
        }
        if (warm && transactions === 1 && change === 'deleted') {
          await pool.query(`DELETE FROM ${table} WHERE description_hash=$1`, [entries[299].hash]);
        }
        return result;
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    } });
    const repository = { read: jest.fn(profiles.read), readVerification: jest.fn(profiles.readVerification) };
    const build = jest.fn(async () => ({ handle: {}, cacheable: true, weight: 1000 }));
    worker = createLiveMultiScaleRefresh({ repository, readState: async () => fixture.state, build,
      createEmbedder: () => ({ ...fixture.identity, inspect: async () => fixture.identity }), now: () => time, random: () => 0 });
    expect(await worker.run()).toEqual({ status: 'ready' });
    time += 300000; warm = true; transactions = 0;
    repository.read.mockClear(); repository.readVerification.mockClear(); build.mockClear();
    const result = await worker.run();
    if (change === 'deleted') expect(result).toEqual({ status: 'unavailable', failure: {
      stage: 'snapshot_verify', code: 'cached_vectors_incomplete',
      coverage: { eligibleDescriptions: 300, cachedDescriptions: 299, missingDescriptions: 1 },
    } });
    else expect(result).toEqual({ status: change === 'unchanged' ? 'revalidated' : 'invalidated' });
    expect(transactions).toBe(2);
    expect(repository.readVerification).toHaveBeenCalledTimes(2);
    expect(repository.read).not.toHaveBeenCalled(); expect(build).not.toHaveBeenCalled();
  } finally { worker?.stop(); await pool.query(`DROP TABLE ${table}`); }
});
