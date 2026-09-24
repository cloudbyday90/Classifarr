/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { descriptionConfigDigest, readCurrentDescriptionRepresentation,
  recordDescriptionRepresentation } from '../services/inventoryDescriptionRepresentationCheckpoint.mjs';
import { buildInventoryDescriptionCorpusSql } from '../services/inventoryDescriptionCorpus.mjs';

const identity = { provider: 'ollama', model: 'test:latest', digest: 'a'.repeat(64), dimensions: 2 };

test('configuration fingerprint stores no host or credential and scopes the model checkpoint', async () => {
  const key = JSON.stringify({ baseUrl: 'http://localhost:11434', model: 'test:latest' });
  const query = jest.fn().mockResolvedValue({ rows: [] });
  await recordDescriptionRepresentation({ query }, identity, key);
  expect(query.mock.calls[0][1]).toEqual([
    'synopsis_only_1000_codepoints.v1', descriptionConfigDigest(key),
    'test:latest', 'a'.repeat(64), 2,
  ]);
  expect(JSON.stringify(query.mock.calls[0][1])).not.toContain('localhost');
  expect(await readCurrentDescriptionRepresentation(query, key)).toBeNull();
  expect(query.mock.calls[1][1]).toEqual([descriptionConfigDigest(key)]);
});

test('library corpus query is parameter-scoped and bounded without altering the worker query', () => {
  const scoped = buildInventoryDescriptionCorpusSql({ libraryScoped: true, limit: 10001 });
  expect(scoped).toContain('msi.library_id = $2::integer');
  expect(scoped).toContain('LIMIT 10001');
  expect(buildInventoryDescriptionCorpusSql()).toContain('LIMIT 50001');
  expect(() => buildInventoryDescriptionCorpusSql({ libraryScoped: true, mediaTypeScoped: true })).toThrow();
  expect(() => buildInventoryDescriptionCorpusSql({ limit: 100000 })).toThrow();
});
