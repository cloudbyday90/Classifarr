/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const START_SOURCE_CAPTURE = `INSERT INTO media_source_capture_state
  (library_id, media_server_id, generation, mode, phase, source)
  SELECT id, media_server_id, 1, $3, 'collecting', $4 FROM libraries WHERE id=$1 AND media_server_id=$2
  ON CONFLICT (library_id) DO UPDATE SET generation=media_source_capture_state.generation+1,
    mode=EXCLUDED.mode, phase='collecting', source=EXCLUDED.source, started_at=clock_timestamp(),
    completed_at=NULL, observed_count=0, rejected_count=0, uncapturable_count=0, omitted_count=0
  WHERE media_source_capture_state.media_server_id=EXCLUDED.media_server_id
  RETURNING generation`;

export const CAPTURE_SOURCE_OBSERVATIONS = `WITH incoming AS MATERIALIZED (
    SELECT * FROM jsonb_to_recordset($4::jsonb) AS i(external_id text, title text, year integer,
      media_type text, identity_issue text, provider_fields text[])
  ), existing AS MATERIALIZED (
    SELECT external_id FROM media_source_observations WHERE library_id=$1 AND media_server_id=$2
  ), admitted AS (
    SELECT i.* FROM incoming i JOIN existing e USING (external_id)
    UNION ALL
    (SELECT i.* FROM incoming i WHERE NOT EXISTS (SELECT 1 FROM existing e WHERE e.external_id=i.external_id)
      ORDER BY i.external_id LIMIT GREATEST(0, $5::integer-(SELECT COUNT(*) FROM existing)))
  ) INSERT INTO media_source_observations
    (library_id, media_server_id, external_id, title, year, media_type, identity_issue, provider_fields, generation)
    SELECT $1,$2,external_id,title,year,media_type,identity_issue,provider_fields,$3 FROM admitted
    ON CONFLICT (library_id, media_server_id, external_id) DO UPDATE SET title=EXCLUDED.title,
      year=EXCLUDED.year, media_type=EXCLUDED.media_type, identity_issue=EXCLUDED.identity_issue,
      provider_fields=EXCLUDED.provider_fields, generation=EXCLUDED.generation, last_seen_at=clock_timestamp()`;
