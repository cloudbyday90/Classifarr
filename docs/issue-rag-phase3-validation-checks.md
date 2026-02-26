# Issue RAG/AI Resilience - Phase 3 Validation Checks

Run these checks in UnRaid against the `Classifarr` container after deploying Phase 3.

## 0) DB session precheck
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

## 1) Verify no second-pass DB writes from `RAGLogger` module
```bash
docker exec -i Classifarr sh -lc '
export PGHOST="${POSTGRES_HOST:-localhost}";
export PGPORT="${POSTGRES_PORT:-5432}";
export PGDATABASE="${POSTGRES_DB:-classifarr}";
export PGUSER="${POSTGRES_USER:-classifarr}";
export PGPASSWORD="${POSTGRES_PASSWORD:-classifarr_secret}";
psql -c "
SELECT COUNT(*) AS raglogger_second_pass_rows_24h
FROM error_log
WHERE created_at >= NOW() - INTERVAL '\''24 hours'\''
  AND module = '\''RAGLogger'\''
  AND message ILIKE '\''Second-pass stage %'\'';"
'
```

Expected: `0`.

## 2) Duplicate-stage check in canonical `module=RAG` stream
```bash
docker exec -i Classifarr sh -lc '
export PGHOST="${POSTGRES_HOST:-localhost}";
export PGPORT="${POSTGRES_PORT:-5432}";
export PGDATABASE="${POSTGRES_DB:-classifarr}";
export PGUSER="${POSTGRES_USER:-classifarr}";
export PGPASSWORD="${POSTGRES_PASSWORD:-classifarr_secret}";
psql -c "
SELECT
  correlation_id,
  error_stage,
  reason_code,
  COALESCE(metadata->>'\''outcome'\'','\''unknown'\'') AS outcome,
  sql_state,
  COUNT(*) AS n
FROM error_log
WHERE created_at >= NOW() - INTERVAL '\''24 hours'\''
  AND module = '\''RAG'\''
  AND error_stage IN ('\''gate'\'','\''retrieval_pass2'\'','\''policy_recheck'\'','\''ai_rerun'\'','\''enrichment'\'')
GROUP BY correlation_id, error_stage, reason_code, COALESCE(metadata->>'\''outcome'\'','\''unknown'\''), sql_state
HAVING COUNT(*) > 1
ORDER BY n DESC, correlation_id NULLS LAST;"
'
```

Expected: no rows for normal traffic.

## 3) Stage-event vs `rag_metrics` parity (24h)
```bash
docker exec -i Classifarr sh -lc '
export PGHOST="${POSTGRES_HOST:-localhost}";
export PGPORT="${POSTGRES_PORT:-5432}";
export PGDATABASE="${POSTGRES_DB:-classifarr}";
export PGUSER="${POSTGRES_USER:-classifarr}";
export PGPASSWORD="${POSTGRES_PASSWORD:-classifarr_secret}";
psql -c "
WITH stage_events AS (
  SELECT
    CASE
      WHEN error_stage = '\''gate'\'' AND reason_code LIKE '\''rag_pass1_candidate_%'\'' THEN '\''second_pass_gate_pass1'\''
      WHEN error_stage = '\''retrieval_pass2'\'' THEN '\''second_pass_retrieval_pass2'\''
      ELSE NULL
    END AS operation,
    CASE WHEN COALESCE(metadata->>'\''outcome'\'','\''unknown'\'') = '\''applied'\'' THEN true ELSE false END AS success,
    COUNT(*) AS n
  FROM error_log
  WHERE created_at >= NOW() - INTERVAL '\''24 hours'\''
    AND module = '\''RAG'\''
    AND (
      (error_stage = '\''gate'\'' AND reason_code LIKE '\''rag_pass1_candidate_%'\'')
      OR error_stage = '\''retrieval_pass2'\''
    )
  GROUP BY 1, 2
),
metric_events AS (
  SELECT
    operation,
    success,
    COUNT(*) AS n
  FROM rag_metrics
  WHERE created_at >= NOW() - INTERVAL '\''24 hours'\''
    AND operation IN ('\''second_pass_gate_pass1'\'','\''second_pass_retrieval_pass2'\'')
  GROUP BY 1, 2
)
SELECT
  COALESCE(s.operation, m.operation) AS operation,
  COALESCE(s.success, m.success) AS success,
  COALESCE(s.n, 0) AS stage_count,
  COALESCE(m.n, 0) AS metric_count,
  COALESCE(m.n, 0) - COALESCE(s.n, 0) AS delta
FROM stage_events s
FULL OUTER JOIN metric_events m
  ON s.operation = m.operation
 AND s.success = m.success
ORDER BY 1, 2;"
'
```

Expected: `delta` near `0` for each `(operation, success)` row.

## 4) Optional: inspect recent parity rows
```bash
docker exec -i Classifarr sh -lc '
export PGHOST="${POSTGRES_HOST:-localhost}";
export PGPORT="${POSTGRES_PORT:-5432}";
export PGDATABASE="${POSTGRES_DB:-classifarr}";
export PGUSER="${POSTGRES_USER:-classifarr}";
export PGPASSWORD="${POSTGRES_PASSWORD:-classifarr_secret}";
psql -c "
SELECT created_at, operation, success, duration_ms, metadata
FROM rag_metrics
WHERE created_at >= NOW() - INTERVAL '\''24 hours'\''
  AND operation IN ('\''second_pass_gate_pass1'\'','\''second_pass_retrieval_pass2'\'')
ORDER BY created_at DESC
LIMIT 100;"
'
```
