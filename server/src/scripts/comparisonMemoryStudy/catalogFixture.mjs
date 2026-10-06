/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { createResourceStudyFixture } from '../resourceStudyFixtures.mjs';
import { assertStudyProviderEnvironment } from '../resourceStudyProviderFixture.mjs';
import { createInventoryDescriptionRefreshRepository } from '../../services/inventoryDescriptionRefreshRepository.mjs';
import { createInventoryRepresentativeProfileRepository } from '../../services/inventoryRepresentativeProfileRepository.mjs';
import { createInventoryDescriptionVectorCache } from '../../services/inventoryDescriptionVectorCache.mjs';
import { getInventoryDescriptionRefreshRevision } from '../../services/inventoryDescriptionRefreshSignal.mjs';
import { resolveLocalStudyEmbeddingConfig } from '../../services/localStudyEmbeddingClient.mjs';

/** Synthetic transports only; all catalog, readiness, vector and lock SQL stays real. */
export async function createComparisonCatalogFixture(database) {
  assertStudyProviderEnvironment();
  const libraries = await database.withTransaction(async client => {
    await client.query("SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='2s'; SET LOCAL transaction_timeout='15s'");
    const { rows: [counts] } = await client.query(`SELECT
      (SELECT count(*)::integer FROM libraries) AS libraries,
      (SELECT count(*)::integer FROM media_server) AS servers,
      (SELECT count(*)::integer FROM media_server_items) AS items`);
    assert.deepEqual(counts, { libraries: 0, servers: 0, items: 0 }, 'comparison_catalog_not_empty');
    const { rows: [source] } = await client.query(`INSERT INTO media_server(type,name,url,api_key,is_active)
      VALUES ('jellyfin','Synthetic shared catalog','http://synthetic.invalid','synthetic-only',true) RETURNING id`);
    await client.query("INSERT INTO tmdb_config(api_key,is_active) VALUES ('synthetic-only',true)");
    await client.query(`UPDATE ai_provider_config SET rag_enabled=true,primary_provider='ollama',
      embedding_provider_mode='same',embedding_model='study',ollama_host='localhost' WHERE id=1`);
    const result = [];
    for (let index = 0; index < 10; index++) {
      const key = `catalog-${index}`, type = index < 5 ? 'movie' : 'tv';
      result.push((await client.query(`INSERT INTO libraries(media_server_id,external_id,name,media_type,is_active)
        VALUES ($1,$2,$2,$3,true) RETURNING id,external_id,media_type`, [source.id, key, type])).rows[0]);
    }
    return result;
  });
  let growth = 0;
  const identity = { provider: 'ollama', model: 'study:latest', digest: 'a'.repeat(64), dimensions: 1024 };
  const descriptions = createInventoryDescriptionRefreshRepository(database);
  // Validate the real saved configuration before spending time on a disabled study.
  assert.equal(resolveLocalStudyEmbeddingConfig(await descriptions.readState()).model, identity.model);
  const vectors = createInventoryDescriptionVectorCache({ query: descriptions.query });
  const provider = createResourceStudyFixture().provider;
  const transport = { provider,
    grow(increment) { assert.equal(increment, 20); assert.ok(growth < 400); growth += increment; },
    adapter: {
      async getLibraryPage(_url, _key, key, { offset, limit }) {
        const index = libraries.findIndex(library => library.external_id === key);
        assert.ok(index >= 0 && Number.isInteger(offset) && offset >= 0 && limit >= 1 && limit <= 100);
        await delay(20);
        const count = (index < 6 ? 178 : 177) + growth;
        const items = Array.from({ length: Math.min(limit, Math.max(0, count - offset)) }, (_, i) => {
          const id = 10000 + index * 1000 + offset + i;
          return { external_id: `${key}-${offset + i}`, tmdb_id: id, title: `Synthetic ${id}`, year: 2001,
            media_type: libraries[index].media_type, genres: ['Adventure'],
            metadata: { summary: `Synthetic shared catalog description ${id}` } };
        });
        return { items, keys: items.map(item => item.external_id), offset, total: count };
      },
      async getCollectionPage() { return { items: [], keys: [], offset: 0, total: 0 }; },
    } };
  return { identity, database, transport, libraries,
    repository: createInventoryRepresentativeProfileRepository(database), readState: descriptions.readState,
    getRevision: getInventoryDescriptionRefreshRevision,
    async cacheDescriptions() {
      // Do not keep a corpus or decoded vector map between calls. Never intercept repository SQL.
      const corpus = await descriptions.readCorpus(), hashes = [...corpus.texts.keys()];
      const present = await vectors.findPresent(identity, hashes);
      const missing = corpus.documents.filter(doc => !present.has(doc.hash));
      assert.ok(hashes.length <= 5776 && missing.length <= 5776);
      for (let offset = 0; offset < missing.length; offset += 8) {
        await vectors.write(identity, missing.slice(offset, offset + 8).map(doc => ({ hash: doc.hash,
          vector: Array.from({ length: 1024 }, (_, d) => Math.sin((d + 1) * (1 + doc.libraryIds[0] % 10)) +
            0.05 * Math.cos(d + 1 + doc.id)) })));
      }
      return { descriptions: hashes.length, cached: present.size + missing.length };
    },
  };
}
