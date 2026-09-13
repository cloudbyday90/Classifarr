/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { createInventorySemanticSampler } from './inventorySemanticSampler.mjs';
import { projectInventoryDescription } from './inventoryDescriptionProjection.mjs';
import { SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS, sourceConflictAuthorityExclusionForMediaServerItem } from './sourceConflictAuthorityGuard.mjs';

export function buildInventoryDescriptionCorpusSql({ includeCandidateMetadata = false, includeEvaluationMetadata = false,
  mediaTypeScoped = false } = {}) {
  // Keep history inside COALESCE: unused fallback rows and their full JSON must
  // not be joined into the corpus sort. Latest-row semantics stay unchanged.
  return `
  SELECT msi.media_type, msi.tmdb_id, msi.library_id,
    ${includeCandidateMetadata ? 'msi.genres, msi.studio, msi.content_rating,' : ''}
    ${includeEvaluationMetadata ? `msi.title, msi.year,
      CASE WHEN octet_length((msi.metadata->'inventory_tmdb')::text) <= 100000
        THEN jsonb_build_object('inventory_tmdb', msi.metadata->'inventory_tmdb')
        ELSE '{}'::jsonb END AS evaluation_metadata,` : ''}
    left(COALESCE(
      CASE WHEN jsonb_typeof(msi.metadata->'overview')='string' THEN NULLIF(btrim(msi.metadata->>'overview'), '') END,
      CASE WHEN jsonb_typeof(msi.metadata->'summary')='string' THEN NULLIF(btrim(msi.metadata->>'summary'), '') END,
      (SELECT CASE WHEN jsonb_typeof(h.metadata->'overview')='string' THEN h.metadata->>'overview' END
        FROM classification_history h
        WHERE h.media_type = msi.media_type AND h.tmdb_id = msi.tmdb_id
        ORDER BY h.created_at DESC, h.id DESC LIMIT 1), ''), 4000) AS overview
  FROM media_server_items msi
  JOIN libraries l ON l.id = msi.library_id AND l.is_active = true AND l.media_type = msi.media_type
  WHERE msi.media_type IN ('movie', 'tv') ${mediaTypeScoped ? 'AND msi.media_type = $2::text ' : ''}AND msi.tmdb_id > 0
    AND ${sourceConflictAuthorityExclusionForMediaServerItem('$1')}
  ORDER BY msi.media_type, msi.tmdb_id, msi.library_id, msi.id
  LIMIT 50001
`;
}

export const INVENTORY_DESCRIPTION_CORPUS_SQL = buildInventoryDescriptionCorpusSql();

export function inventoryDescriptionIdentity(item) {
  const { media_type: type, tmdb_id: id } = item?.metadata ?? item ?? {};
  if (!['movie', 'tv'].includes(type) || !Number.isInteger(id) || id < 1 || id > 2_147_483_647) {
    throw new Error('inventory_description_identity_invalid');
  }
  return `${type}:${id}`;
}

/** Private text and membership in memory only; printable coverage is allowlisted. */
export function prepareInventoryDescriptionCorpus(rows) {
  if (!Array.isArray(rows) || rows.length > 50000) throw new Error('inventory_description_corpus_limit_exceeded');
  const identities = new Map();
  for (const row of rows) {
    const key = inventoryDescriptionIdentity(row);
    if (!Number.isInteger(row.library_id) || row.library_id < 1 || row.library_id > 2_147_483_647) {
      throw new Error('inventory_description_library_invalid');
    }
    if (!identities.has(key)) identities.set(key, { key, type: row.media_type, id: row.tmdb_id, libraryIds: new Set(), descriptions: new Map() });
    const entry = identities.get(key);
    entry.libraryIds.add(row.library_id);
    const projection = projectInventoryDescription({ metadata: { overview: row.overview } });
    if (projection) entry.descriptions.set(projection.text, projection.shortened);
  }
  const documents = [];
  const texts = new Map();
  const coverage = { membershipRows: rows.length, identities: identities.size, eligibleIdentities: 0,
    missingDescriptions: 0, conflictingDescriptions: 0, shortenedIdentities: 0, uniqueDescriptions: 0 };
  for (const entry of identities.values()) {
    if (!entry.descriptions.size) { coverage.missingDescriptions++; continue; }
    if (entry.descriptions.size > 1) { coverage.conflictingDescriptions++; continue; }
    const [[text, shortened]] = entry.descriptions;
    const hash = createHash('sha256').update(text).digest('hex');
    texts.set(hash, text);
    coverage.shortenedIdentities += Number(shortened);
    documents.push({ key: entry.key, type: entry.type, id: entry.id, libraryIds: [...entry.libraryIds], hash });
  }
  if (texts.size > 10000) throw new Error('inventory_description_document_limit_exceeded');
  coverage.eligibleIdentities = documents.length;
  coverage.uniqueDescriptions = texts.size;
  return { documents, texts, coverage };
}

export function createInventoryDescriptionSnapshot({ withTransaction }) {
  // Extend the existing sampler's snapshot, not its public runtime behavior.
  return createInventorySemanticSampler({ withTransaction: callback => withTransaction(async client => {
    const sample = await callback(client);
    const { rows } = await client.query(INVENTORY_DESCRIPTION_CORPUS_SQL, [SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS]);
    return { ...sample, corpus: prepareInventoryDescriptionCorpus(rows) };
  }) });
}
