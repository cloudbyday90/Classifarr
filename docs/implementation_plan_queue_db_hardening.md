# Queue & Database Hardening Implementation Plan

Title: Queue Pool Exhaustion, Logging Cascade, and Singleton Decomposition  
Owner: Classifarr team  
Status: In Progress  
Date: 2026-04-22  
Release target: next patch after current

---

## Summary

This plan captures the findings from four parallel sub-agent passes over the database, queue, and classification codebase, triggered by three production bugs on 2026-04-19T01:54:xx. All bugs occurred in an 8-second window and are causally linked:

1. **Bug #1** — `hasClassificationDispatchBlocker` seq scan took 1763ms under a classification burst.
2. **Bug #2** — `recoverExpiredVisibilityTasks` waited 2041ms for a pool connection (cascade from #1).
3. **Bug #3** — A worker itself waited 2040ms for a pool connection (same cascade event).
4. **Bug #4** (new) — `error_log` INSERT took 3004ms; confirmed self-referential logging cascade.
5. **Bug #5** (new) — "Invalid Issue 275 configuration keys in payload" error when changing the Ollama model — internal state columns from `SELECT *` echoed back by the client on every save.

---

## Fixes Already Implemented

These are complete and tested.

| Fix | File | Change | Tests |
|---|---|---|---|
| TTL cache for `hasClassificationDispatchBlocker` | `queueService.js` | 250ms shared cache prevents 5 workers doing lockstep pool checkouts | 94 pass |
| Partial index for the blocker query | `20260422_120000_add_task_queue_processing_classification_index.sql` | `WHERE status = 'processing' AND task_type = 'classification'` — at most 5 rows, microsecond lookup | — |
| Skip DB persist for slow-query warns | `database.js` | `{ skipDbPersist: true }` breaks the slow-query → `error_log` INSERT → slow-query → ... cascade | 159 pass |
| Strip internal state columns from `getConfig` | `aiSettingsHandlers.js` | 11 columns (`rag_loop_auto_fallback_*`, `rag_loop_auto_recover_*`, `image_embedding_models_cache*`) deleted before response | 159 pass |
| User-facing error message | `aiSettingsHandlers.js` | "Invalid Issue 275 configuration keys in payload" → "Unsupported configuration keys in payload. Please reload the page and try again." | 159 pass |

---

## Phase 1 — queueService.js Singleton Decomposition

**Current state:** 1108 lines, 47 methods. 28 are already clean 1-line delegates. 9 remain as inline logic that belong in sub-services.

**Target:** ~720 lines (35% reduction). `queueService.js` becomes a pure facade.

### 1.1 — Worker Lifecycle → `queueWorkerLoopService`

These three methods are passed as DI callbacks into `queueWorkerLoopService` but live in `queueService`. Move them into the worker loop service; eliminate the callback proxy pattern.

| Method | Lines | Notes |
|---|---|---|
| `resetStaleProcessingTasks()` | 47 | Startup recovery; uses advisory lock via `pool.connect()` directly |
| `recoverExpiredVisibilityTasks()` | 24 | Periodic visibility timeout recovery; fire-and-forget caller |
| `gracefulShutdown()` | 24 | Worker shutdown sequence; marks in-flight tasks |

**DI change:** Instead of:
```javascript
queueWorkerLoopService = new QueueWorkerLoopService({
    resetStaleProcessingTasks: (...args) => this.resetStaleProcessingTasks(...args),
    recoverExpiredVisibilityTasks: (...args) => this.recoverExpiredVisibilityTasks(...args),
    gracefulShutdown: (...args) => this.gracefulShutdown(...args),
})
```
Inject `{ db, logger }` and let the worker loop own the methods directly.

**Exit criteria:** Tests for `resetStaleProcessingTasks`, `recoverExpiredVisibilityTasks`, and `gracefulShutdown` still pass and now live in a `queueWorkerLoopService` test suite.

### 1.2 — Live Stats → `queueReadModel`

`getLiveStats()` is 101 lines of multi-query aggregation. `queueReadModel` already owns `getStats()` and `getGapAnalysisStats()`. Move `getLiveStats()` there to complete the read model.

**Exit criteria:** `queueService.getLiveStats()` becomes a 1-line delegate.

### 1.3 — Queue Maintenance → new `queueMaintenanceService.js`

`_backgroundDrainIfBloated()` is 107 lines implementing age-based and count-based table maintenance. It has no state coupling to `queueService` other than `db` and `logger`. Extract to a new file.

**New file:** `server/src/services/queueMaintenanceService.js`

```javascript
class QueueMaintenanceService {
    constructor({ db, logger }) { ... }
    async backgroundDrainIfBloated() { ... }  // moved verbatim
}
module.exports = new QueueMaintenanceService({ db: require('../config/database'), logger: ... });
```

**Exit criteria:** New file exists; existing `_backgroundDrainIfBloated` tests pass pointing at the new service.

### 1.4 — AI Availability → `aiRouterService`

`checkAIAvailability()` is 40 lines of provider detection + Ollama connection probing. It belongs in the AI routing layer. 

**Note:** Per user memory constraints, text embedding and image embedding must remain separate in model selection and test mechanisms. This method deals with LLM availability only and does not touch embedding providers. Move is safe.

**Exit criteria:** `queueService.checkAIAvailability()` becomes a 1-line delegate to `aiRouterService.checkAvailability()`.

### 1.5 — OMDb SSL State + `_queryWithTimeout` → `queueTaskProcessorService`

`isOmdbSslBlocked()` (56 lines) and `_queryWithTimeout()` (24 lines) are both called from `queueTaskProcessorService`. Move into the task processor.

**Exit criteria:** Both methods gone from `queueService.js`; task processor owns OMDb health state.

---

## Phase 2 — classification.js Rule Evaluation Extraction

**Current state:** 1373 lines. 45/55 methods are already pure delegates. The remaining 480+ lines of business logic live in four tightly coupled methods with an N+1 query bug.

**Target:** ~700 lines (49% reduction). Eliminates N+1 query in `matchRules`.

### 2.1 — `libraryRulesService.js` (new)

Extract `checkLibraryRules()` (111 lines, 1 SQL query, complex condition evaluation). This is library rules v2 matching and is fully self-contained.

**New file:** `server/src/services/libraryRulesService.js`

### 2.2 — `libraryLabelsService.js` (new)

Extract four tightly coupled methods:

| Method | Lines | Notes |
|---|---|---|
| `matchRules()` | ~60 | Contains N+1 query — runs 2 queries **per library** |
| `metadataMatchesLabel()` | ~40 | Pure matching; no SQL |
| `evaluateCustomRule()` | ~12 | Pure evaluation; no SQL |
| `evaluateSingleCondition()` | ~35 | Pure condition evaluation; no SQL |

**N+1 fix:** Rewrite `matchRules()` to pre-fetch all `library_labels` and `library_custom_rules` for the full library list in two bulk queries, then evaluate in memory. This eliminates O(n) queries where n = number of active libraries.

**New file:** `server/src/services/libraryLabelsService.js`

### 2.3 — `classificationLearnedCorrectionsService.js` (new)

Extract `checkLearnedCorrections()` (23 lines, 1 SQL query). This queries `learned_corrections` and should be owned by a dedicated service consistent with the classification evidence layer pattern from the layered-service-migration skill.

**New file:** `server/src/services/classificationLearnedCorrectionsService.js`

### 2.4 — `ensureDecisionQuestion` → `classificationRoutingService`

`ensureDecisionQuestion()` (53 lines) contains inline policy question building logic with conditional branches. Per the audit, it belongs in `classificationRoutingService`.

---

## Phase 3 — `runDecisionTree` Decomposition (Deferred)

`runDecisionTree()` is 511 lines — 37% of the file — and is the last major god-method. It has two internal code paths (policy path + legacy signal path) with duplicated error handling and inline nested helpers.

This is not safe to execute in a single pass due to:
- High test surface area (every classification test touches this path)
- Two paths share zero code despite similar structure
- Nested helper functions `buildRelatedEvidenceSummary` and `buildPolicySignalContext` need to be extracted first

**Prerequisite:** Phase 2 complete and stable.

**Extraction plan (deferred):**
1. Extract `buildRelatedEvidenceSummary` → `classificationEvidenceService` (already exists)
2. Extract `buildPolicySignalContext` → `policyScoringContextBuilder` (already exists)
3. Extract the policy path (lines ~722–836) → `classificationPolicyPath.js`
4. Extract the legacy signal path (lines ~850–1023) → `classificationLegacySignalPath.js`
5. `runDecisionTree` becomes an orchestrator routing between the two paths

---

## Phase 4 — Database Observability Improvements

These are improvements identified but not critical path for this release.

### 4.1 — `schema_migrations` Snapshot Update

`database/schema/current.sql` does not include `idx_task_queue_task_type_status` (from the March 14 migration). Regenerate the schema snapshot after the new `idx_task_queue_processing_classification` migration applies.

### 4.2 — Slow Query Threshold Env Var Documentation

`POSTGRES_SLOW_QUERY_THRESHOLD_MS` controls the slow-query threshold (default 500ms). Add this to `.env.example` and `README.md` so operators can tune it for their storage performance.

### 4.3 — Autovacuum Tuning for `task_queue`

The March 13 migration added autovacuum cost settings. With `seq_scan = 889,472` observed on the table, consider adding a targeted `ANALYZE task_queue` on container startup when the table has grown beyond a threshold. This ensures the new `idx_task_queue_processing_classification` partial index is always chosen when active processing rows exist.

---

## Risk Log

| Change | Risk | Mitigation |
|---|---|---|
| Worker lifecycle move (Phase 1.1) | `resetStaleProcessingTasks` uses `pool.connect()` directly (not timedQuery) — must preserve this | Keep `db.pool.connect()` call, don't route through timedQuery |
| `checkAIAvailability` move (Phase 1.4) | Caller in `queueWorkerLoopService` must be updated | Small, well-tested path |
| N+1 fix in `matchRules` (Phase 2.2) | Bulk query changes the data shape — ensure all libraries get correct labels | Test with multi-library classification scenarios |
| `runDecisionTree` decomposition (Phase 3) | Highest risk change in the codebase | Gated behind Phase 2 stability; requires complete test coverage pass first |

---

## Verification Commands

```bash
# Unit tests (no DB required)
npm --prefix server run test:unit

# Targeted: queue + database
cd server && npx jest --testPathPatterns="queueService|queueWorkerLoop|database|logger" --no-coverage

# Targeted: classification
cd server && npx jest --testPathPatterns="classification" --no-coverage

# Full suite
npm --prefix server test
```
