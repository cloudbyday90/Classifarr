/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { assertStudyProviderEnvironment } from './resourceStudyProviderFixture.mjs';
import { IMAGE_INDEXES } from '../services/imageIndexMaintenanceContract.mjs';

/** Only fixed synthetic sizes in the already empty, disposable installation. */
export async function seedImageIndexStudy(db, previous, target, sample) {
  assertStudyProviderEnvironment();
  assert([[0, 1000], [1000, 10000], [10000, 50000]].some(([a, b]) => previous === a && target === b));
  for (let offset = previous; offset < target; offset += 100) {
    await db.query(`WITH inserted AS (
      INSERT INTO classification_history(media_type,title,status,method)
      SELECT 'movie','Synthetic image study ' || n,'pending','existing_media'
      FROM generate_series($1::integer,$2::integer) n RETURNING id
    ) INSERT INTO classification_embeddings(classification_id,embedding_dims,provider,model,
      image_embedding,image_embedding_dims,image_provider,image_model,image_embedding_hash,image_embedding_size)
      SELECT id,1024,'synthetic','synthetic-text',
        ARRAY(SELECT sin(id::double precision * d + d::double precision * d * 0.17)::real
          FROM generate_series(1,2000) d)::public.vector,
        2000,'synthetic','synthetic-image',md5(id::text),8000 FROM inserted`, [offset + 1, offset + 100]);
    if ((offset + 100) % 1000 === 0) await sample('seed', {});
  }
}

export async function clearStudyImageIndexes(query) {
  assertStudyProviderEnvironment();
  for (const index of IMAGE_INDEXES) await query(index.drop.replace('CONCURRENTLY', 'CONCURRENTLY IF EXISTS'));
}

export async function claimStudyImageIndex(query) {
  assertStudyProviderEnvironment();
  return (await query(`INSERT INTO task_queue(task_type,payload,source,status,claim_token,visible_at,started_at)
    VALUES ('rebuild_hnsw_index','{}','synthetic_image_study','processing',gen_random_uuid(),
      clock_timestamp()+INTERVAL '150 seconds',NOW()) RETURNING id::text,claim_token`)).rows[0];
}

export async function readStudyImageData(query) {
  return (await query(`SELECT count(*)::integer AS rows, COALESCE(sum(id),0)::text AS identity_sum,
    count(*) FILTER (WHERE image_embedding IS NOT NULL AND vector_dims(image_embedding)=2000)::integer AS vectors,
    (SELECT count(*)::integer FROM classification_history) AS history FROM classification_embeddings`)).rows[0];
}
