/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { getPool } from './setup.mjs';
import { representativeProfileFixture } from '../helpers/inventoryRepresentativeProfileFixture.mjs';
import { createInventoryRepresentativeProfileRepository, REPRESENTATIVE_PROFILE_LIBRARIES_SQL,
  REPRESENTATIVE_PROFILE_IDENTITIES_SQL, REPRESENTATIVE_PROFILE_CORPUS_SQL } from '../../services/inventoryRepresentativeProfileRepository.mjs';
import { INVENTORY_DESCRIPTION_REFRESH_STATE_SQL } from '../../services/inventoryDescriptionRefreshRepository.mjs';
import { createInventoryDescriptionVectorCache } from '../../services/inventoryDescriptionVectorCache.mjs';

test('presence and payload remain consistent across a concurrent delete; the next snapshot refuses missing data', async () => {
  const pool = getPool(), fixture = representativeProfileFixture();
  // Generated identifier only; no application or user input enters SQL identifiers.
  const table = `comparison_cache_${randomUUID().replaceAll('-', '')}`;
  const scoped = sql => sql.replaceAll('inventory_description_vector_cache', table);
  await pool.query(`CREATE TABLE ${table} (LIKE inventory_description_vector_cache INCLUDING ALL)`);
  let client, removed = false;
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
          if (!removed && sql.includes('SELECT description_hash FROM')) {
            removed = true;
            await pool.query(`DELETE FROM ${table} WHERE description_hash=$1`, [entries[0].hash]);
          }
          return answer;
        } });
        await client.query('COMMIT'); return result;
      } catch (error) { await client.query('ROLLBACK'); throw error; }
    } });
    expect((await profiles.read(fixture.identity, { requireCompleteVectors: true })).vectors.size).toBe(entries.length);
    expect(removed).toBe(true);
    await expect(profiles.read(fixture.identity, { requireCompleteVectors: true })).rejects.toMatchObject({
      coverage: { eligibleDescriptions: entries.length, cachedDescriptions: entries.length - 1, missingDescriptions: 1 },
    });
  } finally { client?.release(); await pool.query(`DROP TABLE ${table}`); }
});
