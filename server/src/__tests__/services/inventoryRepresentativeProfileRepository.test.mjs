/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createInventoryRepresentativeProfileRepository, REPRESENTATIVE_PROFILE_LIBRARIES_SQL,
  REPRESENTATIVE_PROFILE_IDENTITIES_SQL, REPRESENTATIVE_PROFILE_CORPUS_SQL } from '../../services/inventoryRepresentativeProfileRepository.mjs';
import { INVENTORY_DESCRIPTION_REFRESH_STATE_SQL } from '../../services/inventoryDescriptionRefreshRepository.mjs';
import { collectInventoryObservationReadiness } from '../../services/inventoryObservationReadiness.mjs';
import { SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS } from '../../services/sourceConflictAuthorityGuard.mjs';
import { representativeProfileFixture } from '../helpers/inventoryRepresentativeProfileFixture.mjs';
import { inspectUnseenMultiScaleSource } from '../../services/inventoryMultiScaleSource.mjs';
import { inventoryRepresentativeSourceKey } from '../../services/inventoryRepresentativeProfile.mjs';

test.each(['complete', 'partial', 'missing'])('representative verification preserves %s coverage without materializing a vector map', async mode => {
  const v = setup(), configKey = 'fixture-config';
  if (mode === 'partial') v.snapshot.vectors.delete(v.snapshot.vectors.keys().next().value);
  if (mode === 'missing') v.snapshot.vectors.clear();
  const fresh = await v.repository.readRepresentativeVerification(v.identity, { configKey });
  expect(fresh).not.toHaveProperty('vectors');
  expect(fresh.key).toBe(inventoryRepresentativeSourceKey(v.snapshot, v.identity, configKey));
  expect(fresh.observedKeys).toEqual(v.snapshot.observedKeys);
  expect(fresh.observationReadiness).toEqual(collectInventoryObservationReadiness(v.rows));
  expect(v.withTransaction).toHaveBeenCalledTimes(1);
  expect(v.client.query.mock.calls[0]).toEqual(['SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY']);
});

test('representative verification requires configuration before SQL and rejects corrupt partial evidence', async () => {
  const v = setup();
  await expect(v.repository.readRepresentativeVerification(v.identity)).rejects.toThrow('config_required');
  expect(v.withTransaction).not.toHaveBeenCalled();
  const hashes = [...v.snapshot.vectors.keys()];
  v.snapshot.vectors.delete(hashes[0]); v.snapshot.vectors.set(hashes[1], [0, 0]);
  await expect(v.repository.readRepresentativeVerification(v.identity, { configKey: 'fixture-config' })).rejects.toThrow();
});

test('verification reads fresh complete evidence without returning a vector map', async () => {
  const v = setup();
  const fresh = await v.repository.readVerification(v.identity);
  expect(fresh).not.toHaveProperty('vectors');
  expect(fresh.key).toBe(inspectUnseenMultiScaleSource(v.snapshot, v.identity).key);
  expect(fresh.observedKeys).toEqual(v.snapshot.observedKeys);
  expect(v.withTransaction).toHaveBeenCalledTimes(1);
  expect(v.client.query.mock.calls[0]).toEqual(['SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY']);
  v.snapshot.vectors.delete(v.snapshot.vectors.keys().next().value); v.client.query.mockClear();
  await expect(v.repository.readVerification(v.identity)).rejects.toMatchObject({ coverage: { missingDescriptions: 1 } });
  expect(v.client.query.mock.calls.some(([sql]) => sql.includes('embedding::text'))).toBe(false);
});

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

test('warm preparation gets explicit presence and an expiring bounded reader in the same transaction', async () => {
  const v = setup(); let expired;
  const result = await v.repository.prepareRepresentative(v.identity, { configKey: 'fixture-config' }, async (snapshot, readVectors) => {
    expect(snapshot).not.toHaveProperty('vectors');
    expect(snapshot.presentHashes).toEqual(new Set(v.snapshot.vectors.keys()));
    expect(snapshot.key).toBe(inventoryRepresentativeSourceKey(v.snapshot, v.identity, 'fixture-config'));
    expect(snapshot.observedKeys).toEqual(v.snapshot.observedKeys);
    const hashes = [...snapshot.presentHashes];
    expect(await readVectors(hashes)).toEqual(v.snapshot.vectors);
    await expect(readVectors(['f'.repeat(64)])).rejects.toThrow('batch');
    await expect(readVectors(Array(257).fill(hashes[0]))).rejects.toThrow('batch');
    expired = readVectors;
    return { prepared: true };
  });
  expect(result).toEqual({ prepared: true });
  expect(v.withTransaction).toHaveBeenCalledTimes(1);
  const calls = v.client.query.mock.calls.length;
  await expect(expired([...v.snapshot.vectors.keys()])).rejects.toThrow('closed');
  expect(v.client.query).toHaveBeenCalledTimes(calls);
});

test('warm preparation errors expire the reader and do not return a candidate', async () => {
  const v = setup(); let expired;
  await expect(v.repository.prepareRepresentative(v.identity, { configKey: 'fixture-config' }, async (_snapshot, readVectors) => {
    expired = readVectors; throw new Error('preparation_failed');
  })).rejects.toThrow('preparation_failed');
  await expect(expired([])).rejects.toThrow('closed');
});

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
