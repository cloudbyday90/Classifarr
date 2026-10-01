/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { getPool } from './setup.mjs';
import { executeSemanticVectorSearch, mapSearchResults } from '../../services/ragRetrieverQuery.mjs';

test('synthetic history assignment works against the real schema in bounded batches', async () => {
  const pool = getPool();
  const source = (await pool.query("INSERT INTO media_server(type,name,url,api_key) VALUES ('jellyfin','Synthetic','http://synthetic.invalid','synthetic-only') RETURNING id")).rows[0];
  const library = (await pool.query("INSERT INTO libraries(media_server_id,external_id,name,media_type) VALUES ($1,'synthetic','Synthetic','movie') RETURNING id", [source.id])).rows[0];
  const { rows: [column] } = await pool.query("SELECT format_type(atttypid,atttypmod) AS type FROM pg_attribute WHERE attrelid='classification_embeddings'::regclass AND attname='embedding'");
  const dimensions = Number(column.type.match(/\((\d+)\)/)[1]);
  const result = await pool.query(`WITH inserted AS (
    INSERT INTO classification_history(media_type,title,status,method)
    SELECT 'movie','Synthetic '||n,'pending','existing_media' FROM generate_series(1,100) n RETURNING id
  ) INSERT INTO classification_embeddings(classification_id,embedding_dims,provider,model,embedding)
    SELECT id,$1,'synthetic','synthetic-text',$2::vector FROM inserted RETURNING id`, [dimensions, JSON.stringify(Array(dimensions).fill(1))]);
  const ids = result.rows.map(row => row.id);
  const assigned = await pool.query(`UPDATE classification_history ch SET library_id=l.id, media_type=l.media_type, status='completed'
    FROM classification_embeddings ce, libraries l WHERE ch.id=ce.classification_id
    AND l.id=($1::integer[])[(ce.id % 4)+1] AND ce.id BETWEEN $2 AND $3`,
  [[library.id, library.id, library.id, library.id], Math.min(...ids), Math.max(...ids)]);
  expect(assigned.rowCount).toBe(100);
});

test('real semantic SQL retains status, image reranking, missing-image fallback and exclusions without an image index', async () => {
  const client = await getPool().connect();
  await client.query('BEGIN');
  try {
    await client.query(`CREATE TEMP TABLE libraries(id integer, name text) ON COMMIT DROP;
      CREATE TEMP TABLE classification_history(id integer, title text, media_type text, library_id integer,
        library_name text, status text, method text, confidence integer, created_at timestamptz) ON COMMIT DROP;
      CREATE TEMP TABLE classification_embeddings(id integer, classification_id integer,
        embedding vector(3), image_embedding vector(3), is_stale boolean) ON COMMIT DROP;
      INSERT INTO libraries VALUES (1,'Synthetic');
      INSERT INTO classification_history(id,title,media_type,library_id,status) VALUES
        (1,'text first','movie',1,'completed'), (2,'image first','movie',1,'pending'),
        (3,'no image','tv',1,'completed'), (4,'stale','movie',1,'completed'), (5,'unassigned','movie',NULL,'completed');
      INSERT INTO classification_embeddings VALUES
        (1,1,'[1,0,0]','[0,1,0]',false), (2,2,'[0.9,0.1,0]','[1,0,0]',false),
        (3,3,'[0.8,0.2,0]',NULL,false), (4,4,'[1,0,0]','[1,0,0]',true),
        (5,5,'[1,0,0]','[1,0,0]',false);`);
    const options = { vectorString: '[1,0,0]', imageVectorString: '[1,0,0]',
      textWeight: 0.7, imageWeight: 0.3, candidateLimit: 50, limit: 5 };
    const run = async () => {
      const result = await executeSemanticVectorSearch({ withTransaction: work => work(client) }, options);
      return mapSearchResults(result.rows, { ...options, applyThreshold: false }).matches;
    };
    const before = await run();
    expect(before.map(row => row.classificationId)).toEqual([2, 3, 1]);
    expect(before[0]).toMatchObject({ status: 'pending', imageSimilarity: 1, similarity: 1 });
    expect(before[1]).toMatchObject({ status: 'completed', imageSimilarity: null });
    await client.query('CREATE INDEX ON classification_embeddings USING hnsw(image_embedding vector_cosine_ops)');
    expect(await run()).toEqual(before);
  } finally { await client.query('ROLLBACK'); client.release(); }
});
