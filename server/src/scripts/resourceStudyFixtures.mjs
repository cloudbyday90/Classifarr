/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setTimeout as delay } from 'node:timers/promises';
import { prepareInventoryDescriptionCorpus } from '../services/inventoryDescriptionCorpus.mjs';
import { inventorySourceDescriptionKey } from '../services/inventorySourceDescriptionIdentity.mjs';
import { collectInventoryCandidateMetadata } from '../services/inventoryMetadataCandidates.mjs';

export function studyPhase(elapsed, duration) {
  const progress = elapsed / duration;
  return progress < 0.2 ? 'warmup' : progress < 0.4 ? 'steady' : progress < 0.5 ? 'provider_outage'
    : progress < 0.6 ? 'telemetry_pressure' : 'recovery';
}

export function createResourceStudyFixture() {
  let count = 0, outage = false;
  const adapter = {
    async getLibraryPage(_url, _key, key, { offset, limit }) {
      await delay(20);
      if (outage) throw new Error('synthetic_provider_outage');
      const mediaType = key.endsWith('tv') ? 'tv' : 'movie';
      const items = Array.from({ length: count }, (_, index) => ({ external_id: `${key}-${index}`,
        tmdb_id: 10000 + Number(key.split('-')[1]) * 1000 + index, title: `Synthetic ${key} ${index}`,
        year: 2001, media_type: mediaType, genres: ['Adventure'], metadata: { summary: `Synthetic study item ${index}` } }));
      items.push({ external_id: `${key}-audio`, title: 'Excluded music', media_type: 'track' });
      const page = items.slice(offset, offset + limit);
      return { items: page, keys: page.map(item => item.external_id), offset, total: items.length };
    },
    async getCollectionPage() { return { items: [], keys: [], offset: 0, total: 0 }; },
  };
  const details = async id => {
    await delay(25);
    return { id, original_language: 'en', production_companies: [{ id: 1, name: 'Synthetic studio' }],
      keywords: { keywords: [{ name: 'adventure' }], results: [{ name: 'adventure' }] } };
  };
  return { adapter, provider: { getApiKey: async () => 'synthetic-only', getMovieDetails: details, getTVDetails: details },
    setPhase(value) { outage = value === 'provider_outage'; },
    grow(increment = 20) {
      if (!Number.isInteger(increment) || increment < 1 || increment > 20) throw new Error('resource_study_growth_invalid');
      count = Math.min(400, count + increment);
    },
    get count() { return count; },
  };
}

export async function seedResourceStudyLibraries(db) {
  const source = (await db.query(`INSERT INTO media_server(type,name,url,api_key,is_active)
    VALUES ('jellyfin','Synthetic resource study','http://synthetic.invalid','synthetic-only',true) RETURNING id`)).rows[0];
  await db.query("INSERT INTO tmdb_config(api_key,is_active) VALUES ('synthetic-only',true)");
  await db.query('UPDATE ai_provider_config SET rag_enabled=true WHERE id=1');
  const libraries = [];
  for (let index = 0; index < 4; index++) {
    const type = index < 2 ? 'movie' : 'tv', key = `study-${index}-${type}`;
    libraries.push((await db.query(`INSERT INTO libraries(media_server_id,external_id,name,media_type,is_active)
      VALUES ($1,$2,$2,$3,true) RETURNING id,external_id,media_type`, [source.id, key, type])).rows[0]);
  }
  return libraries;
}

/** Synthetic vectors, real evaluation computation. Never represents AI quality. */
export function resourceStudyEvaluationSnapshot({ rows: rowCount = 400, dimensions = 768 } = {}) {
  if (![400, 6700].includes(rowCount) || dimensions !== 768) throw new Error('resource_study_vectors_invalid');
  const libraries = Array.from({ length: 4 }, (_, index) => ({ id: index + 1, name: `Synthetic ${index}`,
    media_type: index < 2 ? 'movie' : 'tv' }));
  const rows = Array.from({ length: rowCount }, (_, index) => ({ library_id: index % 4 + 1,
    media_type: libraries[index % 4].media_type, tmdb_id: index % 8 < 4 ? index + 1 : null,
    media_server_id: 1, external_id: `synthetic-${index}`, overview: `Synthetic synopsis ${index}`,
    genres: [`Genre ${index % 4}`], studio: 'Synthetic studio', content_rating: 'PG' }));
  const corpus = prepareInventoryDescriptionCorpus(rows, { includeSourceItems: true });
  return { observedAt: new Date().toISOString(), inputs: { identity: {
    provider: 'ollama', model: 'synthetic:study', digest: 'a'.repeat(64), dimensions },
  source: { libraries, rows, corpus, candidateMetadata: collectInventoryCandidateMetadata(rows, inventorySourceDescriptionKey),
    vectors: new Map(corpus.documents.map((doc, index) => [doc.hash,
      Array.from({ length: dimensions }, (_, dimension) => dimension === index % 4 ? 1 : (index % 13 + 1) / 100)])),
    operatorFeedbackRows: [] } } };
}
