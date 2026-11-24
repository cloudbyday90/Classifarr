/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

const SEASONS_PER_MAPPING = 4;

/** The fixture owner has already verified the database, transaction and search path. */
export async function insertCorpusProfileSeasons(db, size) {
  const activeMappings = Math.floor(size / 10);
  const excludedMappings = 2;
  const totalMappings = activeMappings + excludedMappings;
  await db.query(`
    INSERT INTO description_corpus_profile.source_catalog_mappings(id,library_id,media_server_id,external_id,media_type,
      provider_fields,source_digest,layout_digest,configuration_digest,evidence_fingerprint,scope,documents,
      materialized_at,revoked_at)
    SELECT md5('corpus-season-'||i)::uuid,6+(i-1)%5,1,'season-'||i,'tv',ARRAY['tmdb_id'],
      repeat('a',64),repeat('b',64),repeat('c',64),repeat('d',64),jsonb_build_object('kind','seasons'),
      (SELECT jsonb_agg(jsonb_build_object(
        'catalogScope',jsonb_build_object('kind','season','tmdbSeriesId',$1::integer+i,'seasonNumber',n),
        'overview','Synthetic season description '||i||' '||n||' '||repeat(md5(i::text||':'||n),32)
      ) ORDER BY n) FROM generate_series(1,$3::integer) n)
        || jsonb_build_array(jsonb_build_object(
          'catalogScope',jsonb_build_object('kind','season','tmdbSeriesId',$1::integer+i,'seasonNumber',0),
          'overview','Synthetic evidence-only season','evidenceUse','fixture')),
      CASE WHEN i=$2::integer THEN statement_timestamp()-interval '31 days' ELSE statement_timestamp() END,
      CASE WHEN i=$2::integer-1 THEN statement_timestamp() END
    FROM generate_series(1,$2::integer) i`, [size, totalMappings, SEASONS_PER_MAPPING]);
  await db.query(`
    INSERT INTO description_corpus_profile.media_server_items(id,media_server_id,library_id,external_id,title,media_type,metadata)
    SELECT $1::integer+i,1,6+(i-1)%5,'season-'||i,'Synthetic season container','tv',
      jsonb_build_object('source_catalog_mapping',jsonb_build_object('id',md5('corpus-season-'||i)::uuid))
    FROM generate_series(1,$2::integer) i`, [size, totalMappings]);
  return { activeMappings, excludedMappings, evidenceOnlyDocuments: activeMappings,
    expectedSeasonRows: activeMappings * SEASONS_PER_MAPPING };
}
