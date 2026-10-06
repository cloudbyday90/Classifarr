/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createInventoryRepresentativeProfileRepository, REPRESENTATIVE_PROFILE_LIBRARIES_SQL,
  REPRESENTATIVE_PROFILE_IDENTITIES_SQL, REPRESENTATIVE_PROFILE_CORPUS_SQL } from '../../services/inventoryRepresentativeProfileRepository.mjs';
import { INVENTORY_DESCRIPTION_REFRESH_STATE_SQL } from '../../services/inventoryDescriptionRefreshRepository.mjs';
import { collectInventoryObservationReadiness } from '../../services/inventoryObservationReadiness.mjs';
import { SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS } from '../../services/sourceConflictAuthorityGuard.mjs';
import { representativeProfileFixture } from '../helpers/inventoryRepresentativeProfileFixture.mjs';

function setup() {
  const fixture = representativeProfileFixture();
  const client = { query: jest.fn(async (sql, params) => {
    if (sql === INVENTORY_DESCRIPTION_REFRESH_STATE_SQL) return { rows: [fixture.state] };
    if (sql === REPRESENTATIVE_PROFILE_LIBRARIES_SQL) return { rows: fixture.snapshot.libraries };
    if (sql === REPRESENTATIVE_PROFILE_IDENTITIES_SQL) return { rows: fixture.rows };
    if (sql === REPRESENTATIVE_PROFILE_CORPUS_SQL) return { rows: fixture.rows };
    if (sql.includes('embedding::text')) return { rows: params[4].flatMap(hash => fixture.snapshot.vectors.has(hash)
      ? [{ description_hash: hash, embedding: JSON.stringify(fixture.snapshot.vectors.get(hash)) }] : []) };
    if (sql.includes('SELECT description_hash FROM inventory_description_vector_cache')) {
      return { rows: params[4].filter(hash => fixture.snapshot.vectors.has(hash)).map(description_hash => ({ description_hash })) };
    }
    return { rows: [] };
  }) };
  const withTransaction = jest.fn(callback => callback(client));
  return { ...fixture, client, withTransaction, repository: createInventoryRepresentativeProfileRepository({ withTransaction }) };
}

test('snapshot is read-only, bounded and current; conflict exclusions and vector representation remain scoped', async () => {
  const { repository, identity, client, withTransaction, snapshot, rows } = setup();
  expect(await repository.read(identity)).toEqual({ ...snapshot, observationReadiness: collectInventoryObservationReadiness(rows) });
  expect(withTransaction).toHaveBeenCalledTimes(1);
  expect(client.query.mock.calls[0]).toEqual(['SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY']);
  expect(client.query).toHaveBeenCalledWith("SET LOCAL transaction_timeout = '90s'");
  expect(client.query).toHaveBeenCalledWith(REPRESENTATIVE_PROFILE_CORPUS_SQL, [SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS]);
  expect(REPRESENTATIVE_PROFILE_CORPUS_SQL).toContain('octet_length');
  expect(REPRESENTATIVE_PROFILE_CORPUS_SQL).not.toContain('msi.title');
  const [sql, params] = client.query.mock.calls.find(([query]) => query.includes('embedding::text'));
  expect(sql).toContain("created_at > now() - interval '30 days'");
  expect(params.slice(1, 4)).toEqual([identity.model, identity.digest, identity.dimensions]);
  expect(REPRESENTATIVE_PROFILE_LIBRARIES_SQL).not.toContain('name');
});

test('missing vectors remain incomplete for automatic backfill and invalid representations fail before SQL', async () => {
  const { repository, identity, client, snapshot } = setup();
  snapshot.vectors.clear();
  expect((await repository.read(identity)).vectors.size).toBe(0);
  client.query.mockClear();
  await expect(repository.read({ ...identity, digest: 'bad' })).rejects.toThrow('representation_invalid');
  expect(client.query).not.toHaveBeenCalled();
});

test('library and vector bounds reject before loading large vectors', async () => {
  const { repository, identity, snapshot, client, rows } = setup();
  snapshot.libraries = Array.from({ length: 65 }, (_, i) => ({ id: i + 1, media_type: 'movie' }));
  await expect(repository.read(identity)).rejects.toThrow('library_budget');
  snapshot.libraries = [{ id: 1, media_type: 'movie' }];
  for (let i = 12; i < 501; i++) rows.push({ media_type: 'movie', tmdb_id: i + 1, library_id: 1, overview: `Unique ${i}` });
  await expect(repository.read({ ...identity, dimensions: 16000 })).rejects.toThrow('vector_budget');
  expect(client.query.mock.calls.some(([sql]) => sql.includes('embedding::text'))).toBe(false);
});

test('novelty identity budget rejects before training or vector loading', async () => {
  const { repository, identity, client } = setup();
  const query = client.query.getMockImplementation();
  client.query.mockImplementation((sql, params) => sql === REPRESENTATIVE_PROFILE_IDENTITIES_SQL
    ? { rows: Array(50001).fill({ media_type: 'movie', tmdb_id: 1 }) } : query(sql, params));
  await expect(repository.read(identity)).rejects.toThrow('identity_budget');
  expect(client.query.mock.calls.some(([sql]) => sql === REPRESENTATIVE_PROFILE_CORPUS_SQL)).toBe(false);
});

test('vector decoding stays within the bounded read-only snapshot', async () => {
  const { identity, client, snapshot } = setup();
  const query = client.query.getMockImplementation();
  let open = false;
  client.query.mockImplementation(async (sql, params) => {
    const result = await query(sql, params);
    if (sql.includes('embedding::text')) return { rows: result.rows.map(row => ({ description_hash: row.description_hash,
      get embedding() { expect(open).toBe(true); return row.embedding; } })) };
    return result;
  });
  const repository = createInventoryRepresentativeProfileRepository({ withTransaction: async callback => {
    open = true; try { return await callback(client); } finally { open = false; }
  } });
  expect((await repository.read(identity)).vectors).toEqual(snapshot.vectors);
});

test('cancellation refuses acquisition and stops before another query or decoded result', async () => {
  const { repository, identity, client, withTransaction } = setup();
  const controller = new AbortController();
  controller.abort(new Error('stopped'));
  await expect(repository.read(identity, { signal: controller.signal })).rejects.toThrow('stopped');
  expect(withTransaction).not.toHaveBeenCalled();
  const active = new AbortController(), query = client.query.getMockImplementation();
  client.query.mockImplementation(async (sql, params) => {
    const result = await query(sql, params);
    if (sql === REPRESENTATIVE_PROFILE_CORPUS_SQL) active.abort(new Error('stopped'));
    return result;
  });
  await expect(repository.read(identity, { signal: active.signal })).rejects.toThrow('stopped');
  expect(client.query.mock.calls.some(([sql]) => sql.includes('embedding::text'))).toBe(false);
});

test('complete-only preflight refuses missing vectors before payload transport', async () => {
  const { repository, identity, client, snapshot } = setup();
  const eligibleDescriptions = snapshot.corpus.texts.size;
  snapshot.vectors.delete(snapshot.vectors.keys().next().value);
  await expect(repository.read(identity, { requireCompleteVectors: true })).rejects.toMatchObject({
    message: 'multi_scale_complete_cache_required',
    coverage: { eligibleDescriptions, cachedDescriptions: eligibleDescriptions - 1, missingDescriptions: 1 },
  });
  expect(client.query.mock.calls.some(([sql]) => sql.includes('embedding::text'))).toBe(false);
});

test('complete-only presence and vector reads share one snapshot and representation', async () => {
  const { repository, identity, client, snapshot, withTransaction } = setup();
  expect((await repository.read(identity, { requireCompleteVectors: true })).vectors).toEqual(snapshot.vectors);
  expect(withTransaction).toHaveBeenCalledTimes(1);
  const [presenceSql, presenceParams] = client.query.mock.calls.find(([sql]) => sql.includes('SELECT description_hash FROM'));
  const [vectorSql, vectorParams] = client.query.mock.calls.find(([sql]) => sql.includes('embedding::text'));
  expect(presenceParams).toEqual(vectorParams);
  const predicate = sql => sql.slice(sql.indexOf('WHERE')).replace(/\s+/g, ' ');
  expect(predicate(presenceSql)).toBe(predicate(vectorSql));
});

test('complete-only empty corpus does not request cache rows; corrupt complete rows still reject', async () => {
  const { repository, identity, client, rows, snapshot } = setup();
  snapshot.vectors.set(snapshot.vectors.keys().next().value, [Number.NaN]);
  await expect(repository.read(identity, { requireCompleteVectors: true })).rejects.toThrow();
  rows.splice(0); client.query.mockClear();
  expect((await repository.read(identity, { requireCompleteVectors: true })).vectors.size).toBe(0);
  expect(client.query.mock.calls.some(([sql]) => sql.includes('FROM inventory_description_vector_cache'))).toBe(false);
});
