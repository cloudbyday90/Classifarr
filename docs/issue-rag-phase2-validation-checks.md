# Issue RAG/AI Resilience - Phase 2 Validation Checks

Run these checks in your UnRaid environment against the running `Classifarr` container after deploying the Phase 2 changes.

## 0) Precheck: DB session context
```bash
docker exec -i Classifarr sh -lc '
export PGHOST="${POSTGRES_HOST:-localhost}";
export PGPORT="${POSTGRES_PORT:-5432}";
export PGDATABASE="${POSTGRES_DB:-classifarr}";
export PGUSER="${POSTGRES_USER:-classifarr}";
export PGPASSWORD="${POSTGRES_PASSWORD:-classifarr_secret}";
psql -c "SELECT current_user, current_database(), current_setting('\''port'\'');"
'
```

## 1) Reason-code specificity in stage events (24h)
```bash
docker exec -i Classifarr sh -lc '
export PGHOST="${POSTGRES_HOST:-localhost}";
export PGPORT="${POSTGRES_PORT:-5432}";
export PGDATABASE="${POSTGRES_DB:-classifarr}";
export PGUSER="${POSTGRES_USER:-classifarr}";
export PGPASSWORD="${POSTGRES_PASSWORD:-classifarr_secret}";
psql -c "
SELECT
  error_stage,
  reason_code,
  COUNT(*) AS n
FROM error_log
WHERE created_at >= NOW() - INTERVAL '\''24 hours'\''
  AND module = '\''RAG'\''
  AND error_stage IN ('\''gate'\'','\''retrieval_pass2'\'')
GROUP BY error_stage, reason_code
ORDER BY error_stage, n DESC;"
'
```

## 2) Generic vs specific retrieval reason distribution (24h)
```bash
docker exec -i Classifarr sh -lc '
export PGHOST="${POSTGRES_HOST:-localhost}";
export PGPORT="${POSTGRES_PORT:-5432}";
export PGDATABASE="${POSTGRES_DB:-classifarr}";
export PGUSER="${POSTGRES_USER:-classifarr}";
export PGPASSWORD="${POSTGRES_PASSWORD:-classifarr_secret}";
psql -c "
SELECT
  error_stage,
  COUNT(*) FILTER (WHERE reason_code IN ('\''rag_pass1_candidate_failed'\'','\''rag_pass2_failed'\'')) AS generic_count,
  COUNT(*) FILTER (WHERE reason_code IN (
    '\''rag_pass1_candidate_timeout'\'',
    '\''rag_pass1_candidate_provider_failed'\'',
    '\''rag_pass1_candidate_db_failed'\'',
    '\''rag_pass1_candidate_embed_failed'\'',
    '\''rag_pass1_candidate_aborted'\'',
    '\''rag_pass2_timeout'\'',
    '\''rag_pass2_provider_failed'\'',
    '\''rag_pass2_db_failed'\'',
    '\''rag_pass2_embed_failed'\'',
    '\''rag_pass2_aborted'\''
  )) AS specific_count,
  COUNT(*) AS total_count
FROM error_log
WHERE created_at >= NOW() - INTERVAL '\''24 hours'\''
  AND module = '\''RAG'\''
  AND error_stage IN ('\''gate'\'','\''retrieval_pass2'\'')
GROUP BY error_stage
ORDER BY error_stage;"
'
```

## 3) Recent retrieval-stage events with recoverability/sql_state
```bash
docker exec -i Classifarr sh -lc '
export PGHOST="${POSTGRES_HOST:-localhost}";
export PGPORT="${POSTGRES_PORT:-5432}";
export PGDATABASE="${POSTGRES_DB:-classifarr}";
export PGUSER="${POSTGRES_USER:-classifarr}";
export PGPASSWORD="${POSTGRES_PASSWORD:-classifarr_secret}";
psql -c "
SELECT
  created_at,
  level,
  module,
  error_stage,
  reason_code,
  recoverable,
  sql_state,
  correlation_id,
  message
FROM error_log
WHERE created_at >= NOW() - INTERVAL '\''24 hours'\''
  AND module = '\''RAG'\''
  AND error_stage IN ('\''gate'\'','\''retrieval_pass2'\'')
ORDER BY created_at DESC
LIMIT 100;"
'
```

## 4) Verify `idx_embeddings_hnsw` exists
```bash
docker exec -i Classifarr sh -lc '
export PGHOST="${POSTGRES_HOST:-localhost}";
export PGPORT="${POSTGRES_PORT:-5432}";
export PGDATABASE="${POSTGRES_DB:-classifarr}";
export PGUSER="${POSTGRES_USER:-classifarr}";
export PGPASSWORD="${POSTGRES_PASSWORD:-classifarr_secret}";
psql -c "
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = '\''public'\''
  AND tablename = '\''classification_embeddings'\''
  AND indexname = '\''idx_embeddings_hnsw'\'';"
'
```

## 5) Verify planner can use HNSW for text embedding retrieval
```bash
docker exec -i Classifarr sh -lc '
export PGHOST="${POSTGRES_HOST:-localhost}";
export PGPORT="${POSTGRES_PORT:-5432}";
export PGDATABASE="${POSTGRES_DB:-classifarr}";
export PGUSER="${POSTGRES_USER:-classifarr}";
export PGPASSWORD="${POSTGRES_PASSWORD:-classifarr_secret}";
psql -c "
SET enable_seqscan = off;
EXPLAIN (ANALYZE, BUFFERS)
SELECT ce.classification_id
FROM classification_embeddings ce
WHERE ce.is_stale = false
ORDER BY ce.embedding <=> (
  SELECT embedding
  FROM classification_embeddings
  WHERE is_stale = false
  LIMIT 1
)
LIMIT 10;"
'
```

Expected signal: plan should show index usage on `idx_embeddings_hnsw` (for example `Index Scan using idx_embeddings_hnsw`).

## 6) Optional sanity check: retrieval traffic and classification recency
```bash
docker exec -i Classifarr sh -lc '
export PGHOST="${POSTGRES_HOST:-localhost}";
export PGPORT="${POSTGRES_PORT:-5432}";
export PGDATABASE="${POSTGRES_DB:-classifarr}";
export PGUSER="${POSTGRES_USER:-classifarr}";
export PGPASSWORD="${POSTGRES_PASSWORD:-classifarr_secret}";
psql -c "
SELECT id, status, method, confidence, created_at
FROM classification_history
ORDER BY created_at DESC
LIMIT 20;"
'
```

## Phase 2 Checklist Mapping
- Validate stage logs show specific reason codes:
  - Queries: **1**, **2**, **3**
- Validate index presence and query-plan evidence:
  - Queries: **4**, **5**

