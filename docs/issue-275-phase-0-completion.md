# Issue 275 Phase 0 Completion

Date: 2026-02-11

## Scope
This document closes Phase 0 in `docs/issue-275-task-list.md` by recording:
- external best-practice research
- latest-version checks for required runtime/DB/dependency components
- local prerequisite verification
- dependency-contract and Operational Visibility-readiness confirmation
- locked rollout defaults for V1 execution

## 1) Best-Practice Research (External)

### Bounded retrieval loops
- Self-RAG and Adaptive-RAG both support a controlled, conditional retrieval strategy rather than unbounded iterative retrieval.
- Practical implication for Issue 275:
  - keep a hard upper bound on passes and AI reruns
  - run targeted re-check only when gate conditions are met
  - require measurable improvement before applying pass-2 outcomes

Sources:
- Self-RAG (ICLR 2024): https://arxiv.org/abs/2310.11511
- Adaptive-RAG (NAACL 2024): https://aclanthology.org/2024.naacl-long.389/

### Fail-open resilience and circuit-breaker behavior
- Circuit breaker pattern guidance supports `CLOSED -> OPEN -> HALF_OPEN` with limited probes before recovery.
- Practical implication for Issue 275:
  - dependency-scoped cooldown/breaker behavior is correct for second-pass optional stages
  - baseline classification path must remain available (fail-open on optional-stage failures)

Source:
- Microsoft Circuit Breaker Pattern: https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker

### Structured observability for staged pipelines
- OpenTelemetry guidance supports recording exceptions as events plus setting status/error consistently.
- Practical implication for Issue 275:
  - structured stage metadata and reason codes are required
  - preserve consistent severity and error attributes for reliable aggregation

Source:
- OpenTelemetry semantic conventions (recording errors): https://opentelemetry.io/docs/specs/semconv/general/recording-errors/

## 2) Latest-Version and Compatibility Checks

## Runtime and DB service versions
| Component | Repo/Local | Latest (checked) | Result |
|---|---|---|---|
| Node.js | engines `>=24.11.0`; local `v25.4.0`; `.nvmrc` `24.11.0` | Node site shows current release lines including `v24.13.1` (LTS line) and `v25.6.1` | Compatible |
| npm CLI | local `11.7.0` | npm/cli release page shows `v11.9.0` | Minor update available |
| PostgreSQL | Docker/runtime tracks PG17 (`postgresql17` packages); schema dump from PG `17.7` | PostgreSQL release page lists `18.1` current major release | Supported baseline is valid; newer major available |
| pgvector | Dockerfile pinned `v0.8.0` | pgvector tags show `v0.8.1` | Patch update available |

Sources:
- Node previous releases: https://nodejs.org/en/about/previous-releases
- npm CLI releases: https://github.com/npm/cli/releases
- PostgreSQL releases: https://www.postgresql.org/docs/release/
- pgvector tags: https://github.com/pgvector/pgvector/tags

## Key npm dependency spot-check (latest vs current)
Checked via `npm view` against declared versions in root/server/client package manifests.

Patch/minor updates available:
- `axios`: `^1.13.4` -> `1.13.5`
- `vue`: `^3.5.27` -> `3.5.28`
- `@vueuse/core`: `^14.2.0` -> `14.2.1`

Major update available (requires planned migration, not Phase 0):
- `express`: `^4.22.1` -> `5.2.1`

No newer version found for sampled core components:
- `dotenv`, `pg`, `socket.io`, `jsonwebtoken`, `node-cron`, `vite`, `vitest`, `pinia`, `vue-router`, `tailwindcss`, `jest`, `testcontainers`.

Conclusion:
- No new dependency is required to start Issue 275 implementation.
- Optional version bumps can be handled separately; do not couple to Issue 275 logic delivery.

## 3) Platform Prerequisite Verification (Local/Repo)

- Node and npm engine requirements are defined in:
  - `server/package.json`
  - `client/package.json`
- Local versions satisfy declared engines:
  - `node -v` -> `v25.4.0`
  - `npm -v` -> `11.7.0`
- PG/pgvector prerequisites are present in repo runtime definitions:
  - `Dockerfile` installs PostgreSQL 17 packages and builds pgvector
  - `database/migrations/031_add_rag_embeddings.sql` contains `CREATE EXTENSION IF NOT EXISTS vector;`
  - `database/schema/current.sql` contains `CREATE EXTENSION IF NOT EXISTS vector` and reflects PG 17.7 dump metadata

## 4) External Dependency Contracts (Issue 275 Relevance)

- AI provider availability/fallback path exists:
  - `server/src/services/aiRouter.js` handles fallback and provider selection (`ollama_fallback_enabled` path).
- Metadata-enrichment dependency is bounded:
  - TMDb client uses explicit timeouts and rate limiter execution wrapper in `server/src/services/tmdb.js`.
- Existing resilience primitives are available:
  - generic circuit breaker in `server/src/services/circuitBreaker.js`
  - OMDb circuit-breaker wrapper in `server/src/utils/omdbCircuitBreaker.js`
  - retry classification helpers in `server/src/utils/retryUtils.js`

Conclusion:
- The codebase already contains fail-open/retry/circuit primitives that Issue 275 can extend for second-pass stages.

## 5) Rollout-Operational Visibility Readiness Dependencies

Validated dependencies for shadow Operational Visibility and auditability:
- classification metadata container exists in schema:
  - `classification_history.metadata jsonb` in `database/schema/current.sql`
- history endpoints already read/return metadata:
  - `server/src/routes/classification.js` (`/history` and `/history/:id`)
- rag metrics persistence/query infrastructure exists:
  - `database/migrations/039_rag_enhancements.sql` (`rag_metrics`, `rag_health_summary`)
  - `server/src/routes/rag.js` queries `rag_metrics`
- error observability schema for Issue 275 exists:
  - `database/migrations/20260211_090200_add_rag_loop_error_observability.sql`

Important boundary:
- `rag_loop_trace` write semantics are not yet implemented in runtime classification flow (scheduled in later phases), but required storage/read paths already exist.

## 6) Locked V1 Rollout Defaults (from Implementation Plan)

Locked for implementation/startup in shadow mode:
- `rag_loop_rollout_mode = shadow`
- `rag_loop_low_confidence_threshold = 70`
- `rag_loop_shadow_min_samples = 200`
- `rag_loop_shadow_max_error_rate_delta = 0.01`
- `rag_loop_shadow_max_p95_latency_delta_ms = 250`
- shadow observation window: `7-14 days` or until minimum sample gate is met

Source:
- `docs/issue-275-implementation-plan.md` (configuration additions + pre-flight rollout checklist)

## Phase 0 Status

All Phase 0 checklist components are complete and evidenced in this document.
