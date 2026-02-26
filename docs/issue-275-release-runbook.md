# Issue 275 Release Runbook

Date: 2026-02-11

## Scope
Operational checklist to activate Issue 275 directly in `apply` mode.

## Mode Semantics
- `apply`: second-pass outcome may be adopted immediately when comparator gates pass.
- `shadow`: optional diagnostic-only mode and rollback target.
- Rollback remains configuration-only (`apply` -> `shadow`), with no schema rollback required.

## Ordered Rollout Checklist
1. Run migration pre-checks in staging.
2. Apply Issue 275 migrations in staging; verify schema parity.
3. Run API/settings contract gate in staging.
4. Initialize feature defaults for immediate activation (`apply`).
5. Optionally accelerate coverage (embedding backfill + targeted reclassification).
6. Validate apply Operational Visibility and trace observability.
7. Run rollback drill (`apply` -> `shadow`) in staging.
8. Activate production in `apply`.
9. Continue normal Operational Visibility monitoring and rollback only if regression thresholds are exceeded.

## Pre-flight Integrity Audits
Run these in staging before activation:

```sql
-- Ensure one ai_provider_config row exists
SELECT COUNT(*) AS cfg_rows FROM ai_provider_config WHERE id = 1;

-- Detect libraries missing policy rows (should be zero)
SELECT l.id, l.name
FROM libraries l
LEFT JOIN library_policies lp ON lp.library_id = l.id
WHERE lp.id IS NULL;

-- Detect invalid policy threshold ordering
SELECT id, library_id, auto_classify_threshold, prompt_threshold
FROM library_policies
WHERE auto_classify_threshold < prompt_threshold;

-- Detect malformed/legacy metadata rows that are not JSON objects
SELECT id
FROM classification_history
WHERE metadata IS NOT NULL
  AND jsonb_typeof(metadata) <> 'object'
LIMIT 100;

-- Verify Issue 275 migrations are recorded
SELECT filename
FROM schema_migrations
WHERE filename IN (
  '20260211_090000_add_rag_loop_core_config.sql',
  '20260211_090100_add_rag_loop_governance_config.sql',
  '20260211_090200_add_rag_loop_error_observability.sql',
  '20260211_090300_add_rag_loop_trace_query_indexes.sql',
  '20260211_090400_enable_rag_loop_apply_defaults.sql'
)
ORDER BY filename;
```

## Expected Thresholds (Go/No-Go)
- `cfg_rows` must equal `1`.
- libraries missing policy rows must equal `0`.
- invalid threshold-order rows must equal `0`.
- malformed metadata rows must equal `0`.
- all five Issue 275 migration filenames must be present in `schema_migrations`.

If any threshold fails:
- do not activate `apply`
- fix data/schema consistency first
- rerun audits until all thresholds pass

## API/Settings Contract Gate
Validate in staging before activation:
- `GET /api/settings/ai` returns full Issue 275 keyset.
- `PUT /api/settings/ai` round-trips valid values and rejects unknown keys.
- partial updates preserve unrelated provider fields and masked secrets.

Recommended automated gate:
```bash
npm --prefix server run test:integration -- src/__tests__/integration/settings-ai-ragloop.test.js
```

## Feature Gate Initialization (Apply-First)
Set activation defaults:
- `rag_retrieval_loop_enabled=true`
- `policy_recheck_below_prompt_threshold_enabled=true`
- `rag_loop_rollout_mode=apply`

Recommended SQL:
```sql
UPDATE ai_provider_config
SET
  rag_retrieval_loop_enabled = true,
  policy_recheck_below_prompt_threshold_enabled = true,
  rag_loop_rollout_mode = 'apply',
  updated_at = NOW()
WHERE id = 1;
```

Verification query:
```sql
SELECT
  rag_retrieval_loop_enabled,
  policy_recheck_below_prompt_threshold_enabled,
  rag_loop_rollout_mode
FROM ai_provider_config
WHERE id = 1;
```

## Optional Acceleration (Recommended for Low-Volume Systems)
To benefit from Issue 275 faster on sparse traffic:
1. Run embedding backfill so older rows are retrieval-ready.
2. Reclassify targeted low-confidence historical items.

Example local backfill call:
```bash
curl -X POST http://localhost:21324/api/rag/backfill/start \
  -H "Content-Type: application/json" \
  -d "{\"limit\":1000}"
```

## Apply Operational Visibility Validation Gate
Confirm traces and stage outcomes are queryable:
```sql
-- Recent Issue 275 traces
SELECT
  COUNT(*) FILTER (WHERE metadata->'classification_details'->'rag_loop_trace' IS NOT NULL) AS with_trace,
  COUNT(*) AS total_rows
FROM classification_history
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- Stage-level second-pass errors
SELECT error_stage, reason_code, COUNT(*) AS count
FROM error_log
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND rag_operation = 'second_pass'
GROUP BY error_stage, reason_code
ORDER BY count DESC;
```

## Rollback Drill
Validate operational reversal in staging:
1. keep `rag_loop_rollout_mode=apply` under controlled traffic.
2. confirm traces show `mode=apply` and adoption outcomes.
3. switch to `rag_loop_rollout_mode=shadow`.
4. confirm behavior is non-invasive while traces continue.

## Production Activation and Stabilization
After staging validation:
1. activate production in `apply`.
2. monitor normal production Operational Visibility for error/latency/correction regressions.
3. if regressions exceed tolerance, immediately revert to `shadow`.

## Phase 4 Notes (Runtime Safety)
- Mapping-gap handling is fail-open and deterministic (baseline classification is preserved).
- Scoped resilience breakers (`tmdb_enrichment`, `rag_pass2`, `ai_rerun`) can skip optional stages without disabling baseline flow.
- SQLSTATE `40xxx` is retried with bounded backoff for safe recheck paths; non-retryable classes fail-open with explicit reason codes.
