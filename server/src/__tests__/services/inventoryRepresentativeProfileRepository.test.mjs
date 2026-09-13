/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createInventoryRepresentativeProfileRepository, REPRESENTATIVE_PROFILE_LIBRARIES_SQL } from '../../services/inventoryRepresentativeProfileRepository.mjs';
import { INVENTORY_DESCRIPTION_REFRESH_STATE_SQL } from '../../services/inventoryDescriptionRefreshRepository.mjs';
import { INVENTORY_DESCRIPTION_CORPUS_SQL } from '../../services/inventoryDescriptionCorpus.mjs';
import { SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS } from '../../services/sourceConflictAuthorityGuard.mjs';
import { representativeProfileFixture } from '../helpers/inventoryRepresentativeProfileFixture.mjs';

function setup() {
  const fixture = representativeProfileFixture();
  const client = { query: jest.fn(async (sql, params) => {
    if (sql === INVENTORY_DESCRIPTION_REFRESH_STATE_SQL) return { rows: [fixture.state] };
    if (sql === REPRESENTATIVE_PROFILE_LIBRARIES_SQL) return { rows: fixture.snapshot.libraries };
    if (sql === INVENTORY_DESCRIPTION_CORPUS_SQL) return { rows: fixture.rows };
    if (sql.includes('embedding::text')) return { rows: params[4].flatMap(hash => fixture.snapshot.vectors.has(hash)
      ? [{ description_hash: hash, embedding: JSON.stringify(fixture.snapshot.vectors.get(hash)) }] : []) };
    return { rows: [] };
  }) };
  const withTransaction = jest.fn(callback => callback(client));
  return { ...fixture, client, withTransaction, repository: createInventoryRepresentativeProfileRepository({ withTransaction }) };
}

test('snapshot is read-only, bounded and current; conflict exclusions and vector representation remain scoped', async () => {
  const { repository, identity, client, withTransaction, snapshot } = setup();
  expect(await repository.read(identity)).toEqual(snapshot);
  expect(withTransaction).toHaveBeenCalledTimes(1);
  expect(client.query.mock.calls[0]).toEqual(['SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY']);
  expect(client.query).toHaveBeenCalledWith("SET LOCAL transaction_timeout = '90s'");
  expect(client.query).toHaveBeenCalledWith(INVENTORY_DESCRIPTION_CORPUS_SQL, [SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS]);
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
