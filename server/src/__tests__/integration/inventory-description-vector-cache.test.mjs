/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile } from 'node:fs/promises';
import { beforeEach, afterEach, expect, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { createInventoryDescriptionVectorCache } from '../../services/inventoryDescriptionVectorCache.mjs';

let client;
let cache;
const identity = { provider: 'ollama', model: 'test:latest', digest: 'a'.repeat(64), dimensions: 3 };
const hash = 'b'.repeat(64);
beforeEach(async () => {
  client = await getPool().connect();
  await client.query('CREATE TEMP TABLE inventory_description_vector_cache (LIKE public.inventory_description_vector_cache INCLUDING ALL)');
  cache = createInventoryDescriptionVectorCache({ query: client.query.bind(client) });
});
afterEach(() => { client?.release(true); client = null; });

test('migration is idempotent and cache writes preserve a valid unexpired content key', async () => {
  const migration = await readFile(new URL('../../../../database/migrations/20260911_120000_add_inventory_description_vector_cache.sql', import.meta.url), 'utf8');
  await client.query(migration);
  await client.query(migration);
  await cache.write(identity, [{ hash, vector: [1, 0, 0] }]);
  await cache.write(identity, [{ hash, vector: [0, 1, 0] }]);
  expect((await cache.read(identity, [hash])).get(hash)).toEqual([1, 0, 0]);
  const columns = (await client.query("SELECT attname FROM pg_attribute WHERE attrelid='inventory_description_vector_cache'::regclass AND attnum>0 AND NOT attisdropped ORDER BY attnum")).rows.map(row => row.attname);
  expect(columns).toEqual(['projection_version', 'model_name', 'model_digest', 'dimensions', 'description_hash', 'embedding', 'created_at']);
});

test('requires exact model/content/dimension/projection provenance and ignores expired entries', async () => {
  await cache.write(identity, [{ hash, vector: [1, 0, 0] }]);
  expect((await cache.read({ ...identity, digest: 'c'.repeat(64) }, [hash])).size).toBe(0);
  expect((await cache.read({ ...identity, dimensions: 2 }, [hash])).size).toBe(0);
  expect((await cache.read(identity, ['d'.repeat(64)])).size).toBe(0);
  await client.query("UPDATE inventory_description_vector_cache SET projection_version='old'");
  expect((await cache.read(identity, [hash])).size).toBe(0);
  await cache.write(identity, [{ hash, vector: [1, 0, 0] }]);
  await client.query("UPDATE inventory_description_vector_cache SET created_at=now()-interval '31 days'");
  expect((await cache.read(identity, [hash])).size).toBe(0);
  await cache.write(identity, [{ hash, vector: [0, 1, 0] }]);
  expect((await cache.read(identity, [hash])).get(hash)).toEqual([0, 1, 0]);
  expect(await cache.pruneExpired()).toBe(1);
  expect((await cache.read(identity, [hash])).size).toBe(1);
});

test('validates batches atomically and database constraints reject malformed vectors', async () => {
  await expect(cache.write(identity, [{ hash, vector: [0, 0, 0] }])).rejects.toThrow();
  await expect(cache.write(identity, [{ hash, vector: [1, 0, 0] }, { hash, vector: [0, 1, 0] }])).rejects.toThrow();
  expect((await cache.read(identity, [hash])).size).toBe(0);
  await cache.write(identity, [{ hash, vector: [1, 0, 0] }]);
  await expect(client.query("UPDATE inventory_description_vector_cache SET embedding='[1,0]'::vector")).rejects.toThrow();
  await expect(client.query("UPDATE inventory_description_vector_cache SET embedding='[0,0,0]'::vector")).rejects.toThrow();
});

test('maintenance presence lookup is content and representation scoped, without returning vectors', async () => {
  await cache.write(identity, [{ hash, vector: [1, 0, 0] }]);
  expect(await cache.findPresent(identity, [hash, 'd'.repeat(64)])).toEqual(new Set([hash]));
  expect(await cache.findPresent({ ...identity, digest: 'c'.repeat(64) }, [hash])).toEqual(new Set());
  expect(await cache.findPresent({ ...identity, dimensions: 2 }, [hash])).toEqual(new Set());
  expect(await cache.findPresent(identity, [])).toEqual(new Set());
  await expect(cache.findPresent(identity, [hash, hash])).rejects.toThrow();
  await client.query("UPDATE inventory_description_vector_cache SET created_at=now()-interval '31 days'");
  expect(await cache.findPresent(identity, [hash])).toEqual(new Set());
});
