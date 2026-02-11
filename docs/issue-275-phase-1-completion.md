# Issue 275 Phase 1 Completion

Date: 2026-02-11

## Scope
This document closes Phase 1 in `docs/issue-275-task-list.md`:
- migration/package conformance to `docs/issue-275-implementation-plan.md`
- schema-safety and idempotency validation
- pre/post integrity audit execution
- schema snapshot update

## Delivered Migration Set
- `database/migrations/20260211_090000_add_rag_loop_core_config.sql`
- `database/migrations/20260211_090100_add_rag_loop_governance_config.sql`
- `database/migrations/20260211_090200_add_rag_loop_error_observability.sql`
- `database/migrations/20260211_090300_add_rag_loop_trace_query_indexes.sql`

## Conformance Checklist (Plan -> SQL)
- Core config migration:
  - all required V1 core second-pass and policy re-check columns present
  - default values + bounded normalization (`UPDATE ... COALESCE/LEAST/GREATEST`) present
  - enum/range/JSON checks present with idempotent `DO $$ ... IF NOT EXISTS (pg_constraint...)`
  - operator-facing column comments present for all new columns
- Governance config migration:
  - rollout, trace, learning, alias, resilience, and cooldown columns present
  - bounds/enum checks present and aligned to plan defaults
  - bounded normalization + column comments present
- Error observability migration:
  - required `error_log` columns/indexes present
  - stage/sql_state constraints present
  - no FK on `error_log.classification_id` (fail-open logging preserved)
- Optional-now-required migration:
  - mode/outcome expression indexes created on `classification_history`
  - optional created_at support index created only when missing

## Validation Evidence
Executed on ephemeral PostgreSQL (`pgvector/pgvector:pg17`) with a clean comparison database:

- Pre-Issue-275 migrations applied: `87`
- Issue-275 migrations applied: `4`
- Direct rerun of all Issue-275 SQL files: `4/4 succeeded` (no errors)
- `schema_migrations` rows for Issue-275 files: `4`

Pre/post integrity audit queries (from plan) were run and captured:
- `cfg_rows` (`ai_provider_config id=1`): `1` pre, `1` post
- libraries missing policy rows: `0` pre, `0` post
- invalid threshold ordering: `0` pre, `0` post
- malformed `classification_history.metadata` JSON shape: `0` pre, `0` post

Schema/object verification:
- core column coverage: `29/29` present
- governance column coverage: `28/28` present
- error-log column coverage: `5/5` present
- required sampled constraints present (including JSON shape and stage/sql_state checks)
- required indexes present (error-log + trace mode/outcome)
- `error_log.classification_id` FK count: `0`

Static safety checks:
- `npm run migration:check`: passed
- no `CREATE INDEX CONCURRENTLY` found in Issue-275 migrations
- no new domain table creation in Issue-275 migrations

## Defects Found and Resolved During Phase 1
1. Core migration JSON check used `jsonb_object_length(...)`, which is not available in the validated environment.
   - Fix: replaced with strict keyset check via JSONB key subtraction:
     - `(policy_recheck_identifier_caps - 'keywords' - 'genres' - 'studios' - 'cast') = '{}'::jsonb`
2. Schema snapshot workflow had compatibility issues with PG17 `pg_dump` output and runner expectations.
   - Fixes:
     - strip psql meta-command lines (`\...`) in `scripts/dump-schema.js`
     - exclude `schema_migrations` from schema dump
     - qualify migration-marking insert as `public.schema_migrations`
     - reset `search_path` to `public` before migration-marking insert
   - Verification: fresh-install `migrationRunner.run()` now succeeds from snapshot (`applied: 0`, `total: 91`, `method: snapshot`).

## Schema Snapshot Update
- `database/schema/current.sql` was regenerated from validated DB state and includes Issue-275 migration lineage.
- `scripts/dump-schema.js` was updated so future snapshot generation remains compatible with current PostgreSQL output and the Node migration loader.

## Phase 1 Status
Phase 1 is complete with conformance, safety, and validation evidence recorded.
