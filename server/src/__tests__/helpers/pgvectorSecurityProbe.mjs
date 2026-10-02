/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';

// Harmless native-boundary regression, not an exploit. All tables are temporary
// and all settings/writes are rolled back on the caller's dedicated connection.
export async function verifyPgvectorSecurityBoundary(client) {
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL statement_timeout = '15s'");
    await client.query('SET LOCAL enable_seqscan = off');
    await client.query('SET LOCAL max_parallel_maintenance_workers = 0');
    for (const method of ['ivfflat', 'hnsw']) {
      for (const [type, opclass, operator, value, wrong] of [
        ['vector', 'vector_l2_ops', '<->', '[1,2,3]', '[1,2,3,4]'],
        ['halfvec', 'halfvec_l2_ops', '<->', '[1,2,3]', '[1,2,3,4]'],
        ['bit', 'bit_hamming_ops', '<~>', '101', '1010'],
      ]) {
        // Identifiers and SQL operators come only from the closed lists above.
        const table = `pgvector_probe_${method}_${type}`;
        const index = `${table}_idx`;
        // Bare SQL bit defaults to bit(1); varbit preserves the input length.
        const inputType = type === 'bit' ? 'varbit' : type;
        await client.query(`CREATE TEMP TABLE ${table} (embedding ${type}(3)) ON COMMIT DROP`);
        await client.query(`INSERT INTO ${table} VALUES ($1::${inputType})`, [value]);
        await client.query(`CREATE INDEX ${index} ON ${table} USING ${method}
          (embedding ${opclass}) ${method === 'ivfflat' ? 'WITH (lists = 1)' : ''}`);
        const sql = `SELECT embedding::text AS value FROM ${table} ORDER BY embedding ${operator} $1::${inputType} LIMIT 1`;
        const plan = await client.query(`EXPLAIN (FORMAT JSON) ${sql}`, [value]);
        assert.ok(JSON.stringify(plan.rows).includes(index), 'Probe must exercise the native index');
        assert.equal((await client.query(sql, [value])).rows[0].value, value);
        await client.query('SAVEPOINT invalid_dimensions');
        await assert.rejects(client.query(sql, [wrong]), {
          code: '22000', message: 'expected 3 dimensions, not 4',
        });
        await client.query('ROLLBACK TO SAVEPOINT invalid_dimensions');
        assert.equal((await client.query(sql, [value])).rows[0].value, value);
      }
    }
    const empty = await client.query('SELECT avg(embedding) AS value FROM pgvector_probe_ivfflat_vector WHERE false');
    assert.equal(empty.rows[0].value, null);
    await client.query('SAVEPOINT nonfinite');
    await assert.rejects(client.query("SELECT '[NaN,0,1]'::vector"), /NaN not allowed/);
    await client.query('ROLLBACK TO SAVEPOINT nonfinite');
    return { indexBoundaries: 6, emptyAverage: true, nonfiniteRejected: true };
  } finally {
    await client.query('ROLLBACK');
  }
}
