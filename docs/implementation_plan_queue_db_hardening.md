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

---

### Best-Practice Foundation for Phase 1

Before detailing each sub-phase, three canonical patterns apply across all five moves:

**1. Move Method (Fowler):** A method should live in the class that uses it most. All five methods fail this test — they use `db`, `logger`, and state fields that already exist in the target service, but are kept in `queueService` for historical reasons.

**2. Remove Middle Man (Fowler):** `queueService` currently passes 8+ anonymous callback wrappers into `queueWorkerLoopService`. This is constructor DI gone wrong — the injected "dependencies" are arrow functions wrapping `this.method()` rather than genuine interface boundaries. Fowler calls this "inappropriate intimacy" where one class knows too much about the internals of another to do its own bookkeeping.

**3. Extract Class / Single Responsibility:** `queueService` has three distinct responsibility domains that each warrant their own class — worker lifecycle management, read model aggregation, and background maintenance. Fowler's _Extract Class_ technique: start with private methods, relocate one at a time, test after each move.

**Callback-wall anti-pattern — current shape:**
```javascript
// CURRENT: queueService passes 8+ anonymous proxies into queueWorkerLoopService
this.queueWorkerLoopService = new QueueWorkerLoopService({
    resetStaleProcessingTasks:         (...args) => this.resetStaleProcessingTasks(...args),
    backgroundDrainIfBloated:          (...args) => this._backgroundDrainIfBloated(...args),
    hasClassificationDispatchBlocker:  (...args) => this.hasClassificationDispatchBlocker(...args),
    dequeue:                           (...args) => this.dequeue(...args),
    checkAIAvailability:               (...args) => this.checkAIAvailability(...args),
    processTask:                       (...args) => this.processTask(...args),
    recoverExpiredVisibilityTasks:     (...args) => this.recoverExpiredVisibilityTasks(...args),
    incrementProcessing:               () => { this.processing += 1; },
    decrementProcessing:               () => { this.processing -= 1; },
    setLastRecoveryCheck:              (v) => { this.lastRecoveryCheck = v; },
    setFullConcurrencyStartedAt:       (v) => { this.fullConcurrencyStartedAt = v; },
    setLastAiAvailabilityProbeAt:      (v) => { this.lastAiAvailabilityProbeAt = v; },
});
```

This is a "feature envy" chain — `queueWorkerLoopService` needs all this behaviour from `queueService` but is forbidden from owning it. The cleanest fix is to migrate ownership so that each dependency is a real injected service, not a lambda closure.

---

### 1.1 — Worker Lifecycle → `queueWorkerLoopService`

**Code smell:** Feature Envy + Middle Man. Three methods (`resetStaleProcessingTasks`, `recoverExpiredVisibilityTasks`, `gracefulShutdown`) are called exclusively by the worker loop but live in `queueService`. They are only accessible to the loop via the callback proxy pattern.

**State coupling analysis:**
- `resetStaleProcessingTasks` — needs only `db` (advisory lock via `pool.connect()` directly) and `logger`. No shared state reads.
- `recoverExpiredVisibilityTasks` — needs `db`, `logger`, and **adjusts `this.processing`** on `queueService`. After the move, this adjustment routes through the existing `decrementProcessing` callback (already wired), which is fine — the counter stays on `queueService` for now to avoid a larger scope change.
- `gracefulShutdown` — needs `db`, `logger`, and calls `this.stopWorker()` (sets `this.running = false`). After move, call the existing `setRunning(false)` callback.

**Important:** `resetStaleProcessingTasks` uses `this.db.pool.connect()` directly — not `timedQuery`. This MUST be preserved after the move. Using `pool.connect()` gives the advisory lock a transaction-scoped release which is the correct behaviour for startup coordination.

**Current (callback proxy):**
```javascript
// queueService.js — 47 lines, called only by queueWorkerLoopService
async resetStaleProcessingTasks() {
    let client;
    try {
        client = await this.db.pool.connect();
        await client.query('BEGIN');
        const lockResult = await client.query(
            'SELECT pg_try_advisory_xact_lock($1) AS acquired',
            [DB_ADVISORY_LOCKS.STARTUP_RESET]
        );
        if (!lockResult.rows[0].acquired) {
            this.logger.info('resetStaleProcessingTasks: skipped (another container holds startup lock)');
            await client.query('ROLLBACK');
            return 0;
        }
        // ... UPDATE + COMMIT ...
    } finally {
        if (client) client.release();
    }
}
```

**After move — queueWorkerLoopService.js:**
```javascript
class QueueWorkerLoopService {
    constructor(deps = {}) {
        this.db = deps.db;
        this.logger = deps.logger;
        this.decrementProcessing = deps.decrementProcessing || (() => {});
        this.setRunning = deps.setRunning || (() => {});
        // ... remaining deps unchanged ...
    }

    // Moved verbatim — pool.connect() path preserved, not routed through timedQuery
    async resetStaleProcessingTasks() {
        let client;
        try {
            client = await this.db.pool.connect();
            await client.query('BEGIN');
            const lockResult = await client.query(
                'SELECT pg_try_advisory_xact_lock($1) AS acquired',
                [DB_ADVISORY_LOCKS.STARTUP_RESET]
            );
            if (!lockResult.rows[0].acquired) {
                this.logger.info('resetStaleProcessingTasks: skipped (another container holds startup lock)');
                await client.query('ROLLBACK');
                return 0;
            }
            const result = await client.query(
                `UPDATE task_queue 
                 SET status = 'pending', started_at = NULL, visible_at = NULL,
                     error_message = 'Reset on startup - previous worker crashed'
                 WHERE status = 'processing'
                   AND (started_at IS NULL OR started_at < NOW() - INTERVAL '${VISIBILITY_TIMEOUT_MINUTES} minutes')
                 RETURNING id`
            );
            await client.query('COMMIT');
            if (result.rowCount > 0) {
                this.logger.warn('Reset stale processing tasks on startup', {
                    count: result.rowCount,
                    taskIds: result.rows.map(r => r.id)
                });
            }
            return result.rowCount;
        } catch (error) {
            if (client) await client.query('ROLLBACK').catch(() => {});
            this.logger.error('Failed to reset stale tasks', { error: error.message });
            return 0;
        } finally {
            if (client) client.release();
        }
    }

    async recoverExpiredVisibilityTasks() {
        try {
            const result = await this.db.query(
                `UPDATE task_queue
                 SET status = 'pending', started_at = NULL, visible_at = NULL,
                     error_message = 'Recovered: visibility timeout expired'
                 WHERE status = 'processing'
                   AND visible_at IS NOT NULL
                   AND visible_at <= NOW()
                 RETURNING id`
            );
            if (result.rowCount > 0) {
                // Adjust the counter in the parent (via existing callback)
                for (let i = 0; i < result.rowCount; i++) this.decrementProcessing();
                this.logger.warn('Recovered tasks with expired visibility timeout', {
                    count: result.rowCount,
                    taskIds: result.rows.map(r => r.id),
                });
            }
            return result.rowCount;
        } catch (error) {
            this.logger.error('Failed to recover expired visibility tasks', { error: error.message });
            return 0;
        }
    }

    async gracefulShutdown() {
        this.setRunning(false);
        try {
            const result = await this.db.query(
                `UPDATE task_queue
                 SET status = 'pending', started_at = NULL, visible_at = NULL,
                     error_message = 'Reset by graceful shutdown'
                 WHERE status = 'processing'
                 RETURNING id`
            );
            if (result.rowCount > 0) {
                this.logger.info('Graceful shutdown: reset in-flight tasks to pending', {
                    count: result.rowCount, taskIds: result.rows.map(r => r.id),
                });
            }
        } catch (err) {
            this.logger.error('Graceful shutdown: failed to reset in-flight tasks', { error: err.message });
        }
    }
}
```

**queueService.js after move:**
```javascript
// 3 proxy callbacks removed from the QueueWorkerLoopService constructor call
// 3 method bodies removed, replaced with 1-line delegates
async resetStaleProcessingTasks() {
    return this.queueWorkerLoopService.resetStaleProcessingTasks();
}
async recoverExpiredVisibilityTasks() {
    return this.queueWorkerLoopService.recoverExpiredVisibilityTasks();
}
async gracefulShutdown() {
    return this.queueWorkerLoopService.gracefulShutdown();
}
```

**Exit criteria:**
- [x] `resetStaleProcessingTasks`, `recoverExpiredVisibilityTasks`, `gracefulShutdown` method bodies moved to `queueWorkerLoopService.js`
- [x] Three anonymous callback proxies removed from the `QueueWorkerLoopService` constructor call in `queueService`
- [x] `pool.connect()` advisory lock path preserved (not replaced with `timedQuery`)
- [x] All existing tests for these methods still pass (tests can be updated to target `queueWorkerLoopService` or retained on `queueService` via the delegate — do not delete any tests)
- [x] `queueService.test.js` `describe` blocks for these methods continue to pass

---

### 1.2 — Live Stats → `queueReadModel`

**Code smell:** Feature Envy. `getLiveStats()` (101 lines) runs 5 parallel DB queries and assembles the combined dashboard payload. `queueReadModel` already owns `getStats()` and `getGapAnalysisStats()` — the two queries that `getLiveStats()` delegates to first. The remaining 3 queries belong there too.

**Additional opportunity identified:** `getLiveStats()` currently calls `this.getEnrichmentRetryStats()`, which delegates to `enrichmentRetryService.getStats()`. After the move, `queueReadModel` will need `enrichmentRetryService` as an injected dependency. This avoids back-coupling by passing the service reference at construction time.

**Current call flow:**
```
queueService.getLiveStats()
  → this.getStats()               → queueReadModel.getStats()
  → this.getGapAnalysisStats()   → queueReadModel.getGapAnalysisStats()
  → this.db.query(today stats)   ← inline
  → this.db.query(enrichment)    ← inline
  → this.db.query(pending count) ← inline
  → this.getEnrichmentRetryStats() → enrichmentRetryService.getStats()
```

**After move — queueReadModel.js constructor change:**
```javascript
class QueueReadModel {
    constructor(deps = {}) {
        this.db = deps.db;
        this.logger = deps.logger;
        this.getDispatchBlockers = deps.getDispatchBlockers || (async () => ({ ... }));
        this.getRuntimeState = deps.getRuntimeState || (() => ({ ... }));
        // NEW: inject enrichmentRetryService for getLiveStats
        this.enrichmentRetryService = deps.enrichmentRetryService || null;
    }

    async getLiveStats() {
        const anyEnrichmentSql = buildJsonbPresenceOr('metadata', ENRICHMENT_METADATA_KEYS);
        const tavilyEnrichmentSql = buildJsonbPresenceOr('metadata', TAVILY_METADATA_KEYS);
        const [queueStats, gapStats, todayResult, enrichmentResult, enrichmentQueueResult] = await Promise.all([
            this.getStats(),
            this.getGapAnalysisStats(),
            this.db.query(`SELECT ... FROM classification_history WHERE created_at >= CURRENT_DATE`),
            this.db.query(`SELECT ... FROM media_server_items`),
            this.db.query(`SELECT COUNT(*) AS pending FROM task_queue WHERE task_type = 'metadata_enrichment' AND status = 'pending'`)
        ]);

        let retryQueueStats = { tavily: { pending: 0 }, total: { pending: 0 } };
        if (this.enrichmentRetryService) {
            try {
                retryQueueStats = await this.enrichmentRetryService.getStats();
            } catch (_error) {
                // Retry queue table may not exist yet
            }
        }

        // ... assemble and return payload (identical to current body) ...
    }
}
```

**queueService.js constructor change:**
```javascript
this.queueReadModel = new QueueReadModel({
    db: this.db,
    logger: this.logger,
    getDispatchBlockers: () => this.hasClassificationDispatchBlocker(),
    getRuntimeState: () => ({ aiAvailable: this.aiAvailable, workerRunning: this.running }),
    enrichmentRetryService: this.enrichmentRetryService,  // NEW — passes through
});
```

**queueService.js getLiveStats after move:**
```javascript
async getLiveStats() {
    return this.queueReadModel.getLiveStats();
}
```

**Exit criteria:**
- [x] `getLiveStats()` body moved verbatim to `queueReadModel.js`
- [x] `queueReadModel` constructor accepts `enrichmentRetryService` dep with null fallback
- [x] `queueService.getLiveStats()` is a 1-line delegate
- [x] `getLiveStats assembles the combined queue payload` and `getLiveStats falls back when retry queue stats are unavailable` tests still pass

---

### 1.3 — Queue Maintenance → new `queueMaintenanceService.js`

**Code smell:** Large Class / Extract Class. `_backgroundDrainIfBloated()` (107 lines, two drain phases + VACUUM ANALYZE) is a standalone maintenance concern with zero shared state coupling to `queueService`. It only uses `this.db` and `this.logger` plus module-level constants. It is called only once, from `queueWorkerLoopService.startWorker()` via the `backgroundDrainIfBloated` callback.

**New file:** `server/src/services/queueMaintenanceService.js`

```javascript
/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const defaultDb = require('../config/database');
const { createLogger } = require('../utils/logger');

const BLOAT_THRESHOLD = 1000;
const DEFAULT_TASK_QUEUE_MAX_TOTAL_ROWS = 10000;
const BATCH = 5000;

function parseEnvMs(envValue, defaultValue) {
    const parsed = Number.parseInt(envValue || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

class QueueMaintenanceService {
    constructor(deps = {}) {
        this.db = deps.db || defaultDb;
        this.logger = deps.logger || createLogger('QueueMaintenance');
    }

    async backgroundDrainIfBloated() {
        const MAX_TOTAL_ROWS = parseInt(process.env.TASK_QUEUE_MAX_TOTAL_ROWS, 10) || DEFAULT_TASK_QUEUE_MAX_TOTAL_ROWS;
        const parsed = parseInt(process.env.TASK_QUEUE_RETENTION_DAYS, 10);
        const retentionDays = Number.isFinite(parsed) && parsed > 0 ? parsed : 7;

        const countResult = await this.db.query(
            `SELECT
               COUNT(*) FILTER (WHERE created_at < NOW() - ($1 || ' days')::INTERVAL) AS stale_count,
               COUNT(*) AS total_count
             FROM task_queue
             WHERE status IN ('completed', 'failed', 'cancelled')`,
            [retentionDays]
        );
        const staleCount = parseInt(countResult.rows[0].stale_count) || 0;
        const totalCount = parseInt(countResult.rows[0].total_count) || 0;

        const ageBloated = staleCount > BLOAT_THRESHOLD;
        const countBloated = totalCount > MAX_TOTAL_ROWS;

        if (!ageBloated && !countBloated) return;

        this.logger.warn('task_queue bloat detected at startup; running background drain', {
            staleRows: staleCount, totalRows: totalCount, retentionDays,
            maxTotalRows: MAX_TOTAL_ROWS,
            trigger: ageBloated && countBloated ? 'age+count' : ageBloated ? 'age' : 'count'
        });

        let totalDeleted = 0;
        let batchDeleted;

        // --- Age-based drain ---
        if (ageBloated) {
            do {
                const result = await this.db.query(
                    `DELETE FROM task_queue WHERE id IN (
                         SELECT id FROM task_queue
                         WHERE status IN ('completed', 'failed', 'cancelled')
                           AND created_at < NOW() - ($1 || ' days')::INTERVAL
                         LIMIT $2)`,
                    [retentionDays, BATCH]
                );
                batchDeleted = result.rowCount;
                totalDeleted += batchDeleted;
                await new Promise(resolve => setTimeout(resolve, 50));
            } while (batchDeleted === BATCH);
        }

        // --- Count-based drain ---
        const remainingAfterAge = totalCount - totalDeleted;
        if (countBloated && remainingAfterAge > MAX_TOTAL_ROWS) {
            const excess = remainingAfterAge - MAX_TOTAL_ROWS;
            this.logger.warn('task_queue count cap exceeded; trimming oldest rows', {
                remaining: remainingAfterAge, maxTotalRows: MAX_TOTAL_ROWS, toDelete: excess
            });
            let countDeleted = 0;
            do {
                const batchSize = Math.min(BATCH, excess - countDeleted);
                if (batchSize <= 0) break;
                const result = await this.db.query(
                    `DELETE FROM task_queue WHERE id IN (
                         SELECT id FROM task_queue
                         WHERE status IN ('completed', 'failed', 'cancelled')
                         ORDER BY created_at ASC LIMIT $1)`,
                    [batchSize]
                );
                batchDeleted = result.rowCount;
                countDeleted += batchDeleted;
                totalDeleted += batchDeleted;
                await new Promise(resolve => setTimeout(resolve, 50));
            } while (batchDeleted > 0 && countDeleted < excess);
        }

        this.logger.info('Background task_queue drain complete', { deleted: totalDeleted, retentionDays });

        try {
            await this.db.query('VACUUM ANALYZE task_queue');
            this.logger.info('task_queue VACUUM ANALYZE complete after background drain');
        } catch (vacuumErr) {
            this.logger.warn('task_queue VACUUM ANALYZE failed after background drain (non-fatal)', {
                error: vacuumErr.message
            });
        }
    }
}

const queueMaintenanceService = new QueueMaintenanceService();
module.exports = queueMaintenanceService;
module.exports.QueueMaintenanceService = QueueMaintenanceService;
```

**queueService.js change — replace _backgroundDrainIfBloated callback wiring:**
```javascript
// BEFORE (in QueueWorkerLoopService constructor call):
backgroundDrainIfBloated: (...args) => this._backgroundDrainIfBloated(...args),

// AFTER:
backgroundDrainIfBloated: (...args) => this.queueMaintenanceService.backgroundDrainIfBloated(...args),
```

**queueService.js — add queueMaintenanceService to constructor deps:**
```javascript
const defaultQueueMaintenanceService = require('./queueMaintenanceService');

constructor(deps = {}) {
    // ... existing deps ...
    this.queueMaintenanceService = deps.queueMaintenanceService || defaultQueueMaintenanceService;
}
```

**queueService.js — remove `_backgroundDrainIfBloated` body entirely** (no facade delegate needed; it is not part of queueService's public API).

**Test migration:** The existing `describe('_backgroundDrainIfBloated')` block in `queueService.test.js` should be duplicated/moved to a new `server/src/__tests__/queueMaintenanceService.test.js` following the established test file pattern. The `queueService` test can be replaced with a single smoke test: `queueService._backgroundDrainIfBloated does not exist (method moved)`.

**Exit criteria:**
- [x] `queueMaintenanceService.js` created with GPL header, class + singleton export
- [x] All 5 drain tests pass in new `queueMaintenanceService.test.js` (6 tests total, incl. env override)
- [x] `_backgroundDrainIfBloated` removed from `queueService.js`
- [x] `queueWorkerLoopService` callback updated to reference `queueMaintenanceService`

---

### 1.4 — AI Availability → `aiRouterService`

**Code smell:** Feature Envy. `checkAIAvailability()` (40 lines) calls `this.aiRouterService.getProvider()` and `this.ollamaService.testConnection()` — both already belong to the AI routing layer. The method lives in `queueService` only because it updates `this.aiAvailable` (a queue-level state flag used for transition logging and worker loop decisions).

**Opportunity identified:** `aiRouterService` already has `isAvailable()` (returns `provider !== null`) but it does not probe Ollama connectivity. The fuller check with Ollama probe and transition logging belongs in `aiRouterService` as `checkAvailability({ currentState, ollamaService, logger })`, or more cleanly, as a method that the caller provides its current state to so the service can detect and log transitions.

**Note:** Per user memory constraint — text embeddings and image embeddings stay separate. `checkAIAvailability` deals only with LLM classification provider routing. It does not touch `imageEmbeddingProvider` or `embeddingProvider`. The move is safe.

**Recommended approach:** Move the full probe logic to `aiRouterService.checkAvailability(currentlyAvailable)`. The `currentlyAvailable` parameter allows transition logging (only log on first change) without `aiRouterService` owning a stateful `aiAvailable` field.

**Addition to aiRouter.js:**
```javascript
/**
 * Full availability probe: checks provider configuration and tests Ollama
 * connectivity when Ollama is the active provider.
 *
 * @param {boolean} currentlyAvailable  - caller's current state for transition logging
 * @param {object}  ollamaService       - injected so aiRouter stays stateless
 * @param {object}  logger              - caller's logger for transition logging
 * @returns {Promise<boolean>}
 */
async checkAvailability(currentlyAvailable, ollamaService, logger) {
    try {
        const provider = await this.getProvider('classification');

        if (!provider) {
            if (currentlyAvailable) {
                logger.info('AI is disabled or no provider configured');
            }
            return false;
        }

        // Cloud provider — assume available if configured
        if (provider.isCloud) {
            if (!currentlyAvailable) {
                logger.info(`Cloud AI provider available: ${provider.type}`);
            }
            return true;
        }

        // Ollama — probe connectivity
        if (provider.type === 'ollama') {
            const result = await ollamaService.testConnection();
            if (result.success) {
                if (!currentlyAvailable) logger.info('Ollama is now available');
                return true;
            } else {
                if (currentlyAvailable) logger.warn('Ollama is offline', { error: result.error });
                return false;
            }
        }

        logger.warn('Unknown AI provider type', { type: provider.type });
        return false;
    } catch (error) {
        if (currentlyAvailable) logger.warn('AI availability check failed', { error: error.message });
        return false;
    }
}
```

**queueService.js — checkAIAvailability becomes a delegate:**
```javascript
async checkAIAvailability() {
    const wasAvailable = this.aiAvailable;
    const nowAvailable = await this.aiRouterService.checkAvailability(
        wasAvailable,
        this.ollamaService,
        this.logger
    );
    this.aiAvailable = nowAvailable;
    return nowAvailable;
}
```

**Why not move `this.aiAvailable` too?** `this.aiAvailable` is read by two callbacks: `getRuntimeState` in `queueReadModel` and `getState` in `queueWorkerLoopService`. Moving the state to `queueWorkerLoopService` (where the worker loop probes it) would be cleaner long-term, but that's a Phase 1.1 follow-up concern — scope it separately to avoid a cascade change.

**Exit criteria:**
- [x] `aiRouterService.checkAvailability(currentlyAvailable, ollamaService, logger)` added
- [x] `queueService.checkAIAvailability()` updated to call it; `this.aiAvailable` still lives on `queueService`
- [x] Existing `checkAIAvailability` test coverage retained (test the delegate path + new `aiRouterService` method independently)

---

### 1.5 — OMDb SSL State + `_queryWithTimeout` → `queueTaskProcessorService`

**Code smell:** Feature Envy + Inappropriate Intimacy. Five OMDb state fields live on `queueService` but are exclusively read/written by `queueTaskProcessorService` (via `getOmdbRuntimeState` / `setOmdbRuntimeState` callbacks). `isOmdbSslBlocked()` (56 lines) and `_queryWithTimeout()` (24 lines) are both called only from `queueTaskProcessorService` — they're only on `queueService` because they were there before the task processor was extracted.

**State fields to migrate off queueService:**
```javascript
// CURRENT — these live on queueService but belong to queueTaskProcessorService:
this.omdbLimitHit = false;
this.lastOmdbCircuitWarnAt = 0;
this.lastOmdbSslWarnAt = 0;
this.omdbSslBlockedUntil = 0;
this.lastOmdbSslProbeAt = 0;
```

**Complication:** `queueCarsaService` calls `resetVolatileState()` during CARSA (clear-and-resync), which zeros all five fields. After the move, this reset must call into `queueTaskProcessorService` instead.

**queueTaskProcessorService.js — owns OMDb state:**
```javascript
class QueueTaskProcessorService {
    constructor(deps = {}) {
        // ... existing deps ...
        // OMDb state lives here after migration (no longer passed via getOmdbRuntimeState/setOmdbRuntimeState)
        this.omdbLimitHit = false;
        this.lastOmdbCircuitWarnAt = 0;
        this.lastOmdbSslWarnAt = 0;
        this.omdbSslBlockedUntil = 0;
        this.lastOmdbSslProbeAt = 0;
    }

    // Moved verbatim from queueService — no deps change needed
    async _queryWithTimeout(sql, params, timeoutMs = 30_000) {
        let client;
        try {
            if (this.db.pool && typeof this.db.pool.connect === 'function') {
                client = await this.db.pool.connect();
            }
        } catch (_) { /* fall through */ }

        if (!client || typeof client.query !== 'function') {
            return this.db.query(sql, params);
        }

        try {
            await client.query('BEGIN');
            await client.query(`SET LOCAL statement_timeout = '${timeoutMs}'`);
            const result = await client.query(sql, params);
            await client.query('COMMIT');
            return result;
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            throw err;
        } finally {
            client.release();
        }
    }

    // Moved verbatim from queueService — references this.omdbSslBlockedUntil etc. directly now
    async isOmdbSslBlocked(omdbApiKey, title) {
        const now = Date.now();

        if (this.omdbSslBlockedUntil === 0 || now >= this.omdbSslBlockedUntil) {
            return false;
        }
        // ... recovery probe logic unchanged, reading/writing this.* directly ...
    }

    resetOmdbState() {
        this.omdbLimitHit = false;
        this.lastOmdbCircuitWarnAt = 0;
        this.lastOmdbSslWarnAt = 0;
        this.omdbSslBlockedUntil = 0;
        this.lastOmdbSslProbeAt = 0;
    }
}
```

**queueService.js constructor — remove the 8-field OMDb state wiring:**
```javascript
// REMOVED from queueService constructor:
this.omdbLimitHit = false;
this.lastOmdbCircuitWarnAt = 0;
this.lastOmdbSslWarnAt = 0;
this.omdbSslBlockedUntil = 0;
this.lastOmdbSslProbeAt = 0;

// REMOVED from QueueTaskProcessorService construction:
queryWithTimeout: (...args) => this._queryWithTimeout(...args),
isOmdbSslBlocked: (...args) => this.isOmdbSslBlocked(...args),
getOmdbRuntimeState: () => ({ omdbLimitHit: this.omdbLimitHit, ... }),
setOmdbRuntimeState: (patch) => { ... },

// REMOVED from QueueCarsaService construction:
resetVolatileState: () => {
    this.omdbLimitHit = false;
    this.lastOmdbCircuitWarnAt = 0;
    this.lastOmdbSslWarnAt = 0;
    this.omdbSslBlockedUntil = 0;
    this.lastOmdbSslProbeAt = 0;
},
```

**queueCarsaService.js — resetVolatileState callback becomes:**
```javascript
// NEW — queueCarsaService gets queueTaskProcessorService injected
resetVolatileState: () => this.queueTaskProcessorService.resetOmdbState(),
```

Or: pass `resetVolatileState` as a callback into `queueCarsaService` that references `queueTaskProcessorService.resetOmdbState()` — preserves the existing callback pattern.

**queueService.js delegates (replacing inline bodies):**
```javascript
async _queryWithTimeout(sql, params, timeoutMs) {
    return this.queueTaskProcessorService._queryWithTimeout(sql, params, timeoutMs);
}
async isOmdbSslBlocked(omdbApiKey, title) {
    return this.queueTaskProcessorService.isOmdbSslBlocked(omdbApiKey, title);
}
```

**Exit criteria:**
- [x] `_queryWithTimeout` and `isOmdbSslBlocked` method bodies moved to `queueTaskProcessorService.js`
- [x] Five OMDb state fields removed from `queueService.js`
- [x] `getOmdbRuntimeState` / `setOmdbRuntimeState` callbacks removed from `QueueTaskProcessorService` constructor call
- [x] `queueTaskProcessorService.resetOmdbState()` replaces the `resetVolatileState` callback in `queueCarsaService`
- [x] Existing tests for these methods still pass

---

### Phase 1 — Summary

| Sub-phase | Lines removed from queueService | Pattern applied | State impact |
|---|---|---|---|
| 1.1 | ~95 lines (3 methods + 3 proxy callbacks) | Move Method, Remove Middle Man | `processing` counter stays on queueService via existing decrementProcessing callback |
| 1.2 | ~101 lines (getLiveStats body) | Move Method, Extract Class | `enrichmentRetryService` ref added to queueReadModel DI |
| 1.3 | ~107 lines (_backgroundDrainIfBloated body) | Extract Class | No shared state; new file only |
| 1.4 | ~40 lines (checkAIAvailability body) | Move Method | `aiAvailable` stays on queueService; aiRouter gains stateless `checkAvailability` |
| 1.5 | ~80 lines (2 methods + 5 state fields + 8 callbacks) | Move Field + Move Method | OMDb state migrates to queueTaskProcessorService |

**Total:** ~423 lines removed from `queueService.js`. Projected final size: ~685 lines (from 1108). All remaining methods become 1-line delegates, correctly named for the sub-service they call.

---

## Phase 2 — classification.js Rule Evaluation Extraction

**Current state:** 1373 lines. 45/55 methods are already pure delegates. The remaining 480+ lines of business logic live in four tightly coupled methods with an N+1 query bug.

**Target:** ~700 lines (49% reduction). Eliminates N+1 query in `matchRules`.

---

### Best-Practice Foundation for Phase 2

Two additional canonical patterns apply beyond the Phase 1 foundation:

**4. Feature Envy (Fowler):** A method uses data from another class more than from its own. `checkLibraryRules` and `matchRules` both use `db`, `normalizeMetadataListLower`, and `classificationMetadataService` exclusively — none of which are classification-level state. They are envy-smelling over the library data layer.

**5. N+1 Query Pattern (Martin, *Clean Code*):** Loop-driven queries are a correctness/performance smell, not just a code smell. `matchRules()` issues 2N SQL queries (`library_labels` + `library_custom_rules` per library). With 10 libraries, this is 20 queries on every classification. The fix is to bulk-fetch all labels and rules for the full library list up front, then match in memory — a standard read-model pre-load pattern.

**Method inventory (current state):**

| Method | Lines | SQL queries | Callers in classification.js | Coupling |
|---|---|---|---|---|
| `checkLibraryRules()` | 112 | 1 (bulk SELECT rules) | `runDecisionTree()` only | `detectEventTypesFromMetadata` → already delegates to `classificationMetadataService` |
| `checkLearnedCorrections()` | 28 | 1 (SELECT learned_corrections) | `runDecisionTree()` only | `db`, `logger` only |
| `matchRules()` | 68 | **2N** (per-library loop) | `runDecisionTree()` only | calls `metadataMatchesLabel`, `evaluateCustomRule` |
| `metadataMatchesLabel()` | 46 | 0 (pure) | `matchRules()` only | `normalizeMetadataListLower` only |
| `evaluateCustomRule()` | 14 | 0 (pure) | `matchRules()` only | calls `evaluateSingleCondition` |
| `evaluateSingleCondition()` | 46 | 0 (pure) | `evaluateCustomRule()` only | none |
| `ensureDecisionQuestion()` | 49 | 0 | `runDecisionTree()` only | `policyQuestionBuilder.build()` |

All seven are called only from `runDecisionTree()` via `this.method()`. None mutate shared class state. This is the cleanest possible extraction profile.

---

### 2.1 — `libraryRulesService.js` (new)

**Code smell:** Feature Envy. `checkLibraryRules()` (112 lines) owns the library_rules_v2 matching engine. Its only connection to `ClassificationService` is `this.detectEventTypesFromMetadata()` — which is already a 1-line delegate to `classificationMetadataService.detectEventTypesFromMetadata()`. The dependency chain is `checkLibraryRules → classificationMetadataService`, not `checkLibraryRules → ClassificationService`.

**State coupling analysis:** None. All inputs passed as `(metadata, libraries)`. All outputs are return values. `db` and `logger` are module-level in `classification.js` but can be injected directly.

**New file:** `server/src/services/libraryRulesService.js`

```javascript
/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const defaultDb = require('../config/database');
const { createLogger } = require('../utils/logger');
const { normalizeMetadataListLower } = require('../utils/metadataNormalization');
const classificationMetadataService = require('./classificationMetadataService');

const logger = createLogger('libraryRulesService');

/**
 * Checks library_rules_v2 for an item-level match.
 * Returns the first matching library rule or null.
 *
 * @param {object} metadata
 * @param {object[]} libraries - active libraries for this media type
 * @param {object} [db]
 * @returns {Promise<{library, isException, matchedRule, reason}|null>}
 */
async function checkLibraryRules(metadata, libraries, db = defaultDb) {
    const rulesResult = await db.query(`
        SELECT r.*, l.name AS library_name
        FROM library_rules_v2 r
        JOIN libraries l ON r.library_id = l.id
        WHERE r.is_active = true AND l.is_active = true
        ORDER BY l.priority DESC, r.priority ASC
    `);

    if (rulesResult.rows.length === 0) return null;

    const itemData = {
        rating:        (metadata.certification || '').toUpperCase(),
        genre:         normalizeMetadataListLower(metadata.genres),
        keyword:       normalizeMetadataListLower(metadata.keywords),
        language:      (metadata.original_language || '').toLowerCase(),
        year:          metadata.year ? parseInt(metadata.year) : null,
        title:         (metadata.title || '').toLowerCase(),
        overview:      (metadata.overview || '').toLowerCase(),
        content_type:  metadata.contentAnalysis?.bestMatch?.type || null,
        event_type:    classificationMetadataService.detectEventTypesFromMetadata(metadata),
    };

    for (const rule of rulesResult.rows) {
        let conditions;
        try {
            conditions = typeof rule.conditions === 'string'
                ? JSON.parse(rule.conditions)
                : rule.conditions;
        } catch (e) {
            logger.warn('Failed to parse rule conditions', { ruleId: rule.id, error: e.message });
            continue;
        }

        if (!conditions || !Array.isArray(conditions)) continue;

        const allMatch = conditions.every(condition => {
            const { field, operator, value } = condition;
            const itemValue = itemData[field];
            const ruleValues = value.split(',').map(v => v.trim().toLowerCase());

            if (itemValue === null || itemValue === undefined) return false;

            if (Array.isArray(itemValue)) {
                switch (operator) {
                    case 'includes':  return ruleValues.some(v => itemValue.includes(v));
                    case 'excludes':  return !ruleValues.some(v => itemValue.includes(v));
                    case 'contains':  return ruleValues.some(v => itemValue.some(item => item.includes(v)));
                    default:          return false;
                }
            }

            const strValue = String(itemValue).toLowerCase();
            switch (operator) {
                case 'equals':
                case 'is':          return ruleValues.includes(strValue);
                case 'includes':    return ruleValues.includes(strValue);
                case 'excludes':    return !ruleValues.includes(strValue);
                case 'contains':    return ruleValues.some(v => strValue.includes(v));
                case 'not_contains':return !ruleValues.some(v => strValue.includes(v));
                case 'greater_than':return parseFloat(itemValue) > parseFloat(ruleValues[0]);
                case 'less_than':   return parseFloat(itemValue) < parseFloat(ruleValues[0]);
                case 'between': {
                    const yearVal = parseFloat(itemValue);
                    const [minY, maxY] = ruleValues[0].includes(',')
                        ? ruleValues[0].split(',').map(v => parseFloat(v.trim()))
                        : [parseFloat(ruleValues[0]), parseFloat(ruleValues[1] || ruleValues[0])];
                    return yearVal >= minY && yearVal <= maxY;
                }
                default: return false;
            }
        });

        if (allMatch) {
            const library = libraries.find(l => l.id === rule.library_id);
            if (library) {
                const conditionsSummary = conditions.map(c => `${c.field} ${c.operator} "${c.value}"`).join(' AND ');
                return {
                    library,
                    isException: false,
                    matchedRule: conditionsSummary,
                    reason: rule.description || `Matched rule: ${rule.name}`,
                };
            }
        }
    }

    return null;
}

module.exports = { checkLibraryRules };
```

**classification.js after move:**
```javascript
async checkLibraryRules(metadata, libraries) {
    return libraryRulesService.checkLibraryRules(metadata, libraries);
}
```

**Test migration:** No existing tests for `checkLibraryRules` in `classification.test.js`. Create `server/src/__tests__/libraryRulesService.test.js` with the core scenarios:
- Returns null when no active rules
- Returns match for a rule where all conditions pass
- Returns null when a condition fails (AND logic)
- Skips rules with malformed conditions JSON
- Correctly handles `between` operator for year ranges

**Exit criteria:**
- [x] `libraryRulesService.js` created with GPL header and exported `checkLibraryRules`
- [x] `classification.js` `checkLibraryRules()` body replaced with 1-line delegate
- [x] New `libraryRulesService.test.js` with at minimum 5 tests covering the above scenarios

---

### 2.2 — `libraryLabelsService.js` (new) + N+1 fix

**Code smell:** Feature Envy + N+1 Query. `matchRules()`, `metadataMatchesLabel()`, `evaluateCustomRule()`, and `evaluateSingleCondition()` form a tightly coupled quartet. All four belong together: `matchRules` orchestrates, the other three are its sub-operations. The N+1 bug is the primary motivation for extraction — fixing it without moving the method would leave business logic scattered.

**The N+1 bug — current shape:**
```javascript
// Runs 2 queries PER LIBRARY — with 10 libraries = 20 queries per classification
for (const library of libraries) {
    const labelsResult = await db.query(
        'SELECT ... FROM library_labels ll JOIN label_presets lp ON ... WHERE ll.library_id = $1',
        [library.id]
    );
    const rulesResult = await db.query(
        'SELECT * FROM library_custom_rules WHERE library_id = $1 AND is_active = true',
        [library.id]
    );
}
```

**N+1 fix — bulk pre-fetch:**
```javascript
// After fix: 2 queries total regardless of library count
const libraryIds = libraries.map(l => l.id);

const [labelsResult, customRulesResult] = await Promise.all([
    db.query(
        `SELECT ll.library_id, ll.rule_type, lp.category, lp.name, lp.display_name,
                lp.tmdb_match_field, lp.tmdb_match_values
         FROM library_labels ll
         JOIN label_presets lp ON ll.label_preset_id = lp.id
         WHERE ll.library_id = ANY($1)`,
        [libraryIds]
    ),
    db.query(
        'SELECT * FROM library_custom_rules WHERE library_id = ANY($1) AND is_active = true',
        [libraryIds]
    )
]);

// Group by library_id in memory
const labelsByLibrary = new Map();
const rulesByLibrary = new Map();
for (const row of labelsResult.rows) {
    if (!labelsByLibrary.has(row.library_id)) labelsByLibrary.set(row.library_id, []);
    labelsByLibrary.get(row.library_id).push(row);
}
for (const row of customRulesResult.rows) {
    if (!rulesByLibrary.has(row.library_id)) rulesByLibrary.set(row.library_id, []);
    rulesByLibrary.get(row.library_id).push(row);
}
```

**New file:** `server/src/services/libraryLabelsService.js`

```javascript
/*
 * Classifarr ...GPL-3.0 header...
 */

const defaultDb = require('../config/database');
const { createLogger } = require('../utils/logger');
const { normalizeMetadataListLower } = require('../utils/metadataNormalization');

const logger = createLogger('libraryLabelsService');

/**
 * Check if metadata matches a label's field+values criteria.
 * Pure — no SQL.
 */
function metadataMatchesLabel(metadata, label) {
    const { tmdb_match_field, tmdb_match_values } = label;
    if (!tmdb_match_field || !tmdb_match_values || tmdb_match_values.length === 0) return false;

    switch (tmdb_match_field) {
        case 'certification':
            return tmdb_match_values.some(value =>
                metadata.certification && metadata.certification.toLowerCase() === value.toLowerCase()
            );
        case 'genres': {
            const genres = normalizeMetadataListLower(metadata.genres);
            if (genres.length === 0) return false;
            return tmdb_match_values.some(value => genres.some(g => g === value.toLowerCase()));
        }
        case 'keywords': {
            const keywords = normalizeMetadataListLower(metadata.keywords);
            if (keywords.length === 0) return false;
            return tmdb_match_values.some(value => keywords.includes(value.toLowerCase()));
        }
        case 'original_language':
            return tmdb_match_values.some(value =>
                metadata.original_language && metadata.original_language.toLowerCase() === value.toLowerCase()
            );
        default:
            return false;
    }
}

/**
 * Evaluate a custom rule's condition array (AND logic) against metadata.
 * Pure — no SQL.
 */
function evaluateCustomRule(metadata, ruleJson) {
    try {
        if (Array.isArray(ruleJson)) {
            return ruleJson.every(condition => evaluateSingleCondition(metadata, condition));
        }
        return evaluateSingleCondition(metadata, ruleJson);
    } catch (error) {
        logger.error('Error evaluating custom rule', { error: error.message });
        return false;
    }
}

/**
 * Evaluate one condition object against metadata fields.
 * Pure — no SQL.
 */
function evaluateSingleCondition(metadata, condition) {
    const { field, operator, value } = condition;

    let fieldValue;
    if (field === 'content_type') {
        fieldValue = metadata.contentAnalysis?.bestMatch?.type;
    } else {
        fieldValue = metadata[field];
    }

    if (!fieldValue) return false;

    switch (operator) {
        case 'contains':
            if (Array.isArray(fieldValue)) {
                return fieldValue.some(v => v.toLowerCase().includes(value.toLowerCase()));
            }
            return String(fieldValue).toLowerCase().includes(value.toLowerCase());
        case 'not_contains':
            if (Array.isArray(fieldValue)) {
                return !fieldValue.some(v => v.toLowerCase().includes(value.toLowerCase()));
            }
            return !String(fieldValue).toLowerCase().includes(value.toLowerCase());
        case 'equals':
            return String(fieldValue).toLowerCase() === String(value).toLowerCase();
        case 'not_equals':
            return String(fieldValue).toLowerCase() !== String(value).toLowerCase();
        case 'greater_than':
            return parseFloat(fieldValue) > parseFloat(value);
        case 'less_than':
            return parseFloat(fieldValue) < parseFloat(value);
        case 'between': {
            const yearVal = parseFloat(fieldValue);
            const [minYear, maxYear] = value.split(',').map(v => parseFloat(v.trim()));
            return yearVal >= minYear && yearVal <= maxYear;
        }
        default:
            return false;
    }
}

/**
 * Score each library against metadata using labels + custom rules.
 * Bulk-fetches all labels and rules in 2 queries (fixes N+1 from inline loop).
 *
 * @param {object} metadata
 * @param {object[]} libraries  - active libraries for this media type
 * @param {object} [db]
 * @returns {Promise<{library, confidence, reason}|null>}
 */
async function matchRules(metadata, libraries, db = defaultDb) {
    if (!libraries || libraries.length === 0) return null;

    const libraryIds = libraries.map(l => l.id);

    // 2 queries total — independent, run in parallel
    const [labelsResult, customRulesResult] = await Promise.all([
        db.query(
            `SELECT ll.library_id, ll.rule_type, lp.category, lp.name, lp.display_name,
                    lp.tmdb_match_field, lp.tmdb_match_values
             FROM library_labels ll
             JOIN label_presets lp ON ll.label_preset_id = lp.id
             WHERE ll.library_id = ANY($1)`,
            [libraryIds]
        ),
        db.query(
            'SELECT * FROM library_custom_rules WHERE library_id = ANY($1) AND is_active = true',
            [libraryIds]
        )
    ]);

    // Group by library_id in memory — O(n) passes, no further queries
    const labelsByLibrary = new Map();
    for (const row of labelsResult.rows) {
        if (!labelsByLibrary.has(row.library_id)) labelsByLibrary.set(row.library_id, []);
        labelsByLibrary.get(row.library_id).push(row);
    }
    const rulesByLibrary = new Map();
    for (const row of customRulesResult.rows) {
        if (!rulesByLibrary.has(row.library_id)) rulesByLibrary.set(row.library_id, []);
        rulesByLibrary.get(row.library_id).push(row);
    }

    let bestMatch = null;
    let highestScore = 0;

    for (const library of libraries) {
        let score = 0;
        const reasons = [];

        const labels = labelsByLibrary.get(library.id) || [];

        // EXCLUDE labels: disqualify if any match
        const excludeLabels = labels.filter(l => l.rule_type === 'exclude');
        let disqualified = false;
        for (const label of excludeLabels) {
            if (metadataMatchesLabel(metadata, label)) {
                score = -1000;
                disqualified = true;
                break;
            }
        }
        if (disqualified) continue;

        // INCLUDE labels: add score
        const includeLabels = labels.filter(l => l.rule_type === 'include');
        for (const label of includeLabels) {
            if (metadataMatchesLabel(metadata, label)) {
                score += 25;
                reasons.push(`Matches ${label.category}: ${label.display_name}`);
            }
        }

        // Custom rules
        const customRules = rulesByLibrary.get(library.id) || [];
        for (const rule of customRules) {
            if (evaluateCustomRule(metadata, rule.rule_json)) {
                score += 30;
                reasons.push(`Matches custom rule: ${rule.name}`);
            }
        }

        const confidence = Math.min(100, score);
        if (confidence > highestScore) {
            highestScore = confidence;
            bestMatch = {
                library,
                confidence,
                reason: reasons.join('; ') || 'Matched library criteria',
            };
        }
    }

    return bestMatch;
}

module.exports = { matchRules, metadataMatchesLabel, evaluateCustomRule, evaluateSingleCondition };
```

**classification.js after move:**
```javascript
metadataMatchesLabel(metadata, label) {
    return libraryLabelsService.metadataMatchesLabel(metadata, label);
}
evaluateCustomRule(metadata, ruleJson) {
    return libraryLabelsService.evaluateCustomRule(metadata, ruleJson);
}
evaluateSingleCondition(metadata, condition) {
    return libraryLabelsService.evaluateSingleCondition(metadata, condition);
}
async matchRules(metadata, libraries) {
    return libraryLabelsService.matchRules(metadata, libraries);
}
```

**Test migration:** `classification.test.js` has 15+ tests spread across `describe('evaluateCustomRule')` (8 tests) and `describe('metadataMatchesLabel')` (12 tests across 4 sub-describes) that call `classificationService.evaluateCustomRule(...)` and `classificationService.metadataMatchesLabel(...)` directly. These tests continue to pass via the delegate — no test changes required immediately. A new `libraryLabelsService.test.js` can test the service directly.

**Important:** After the N+1 fix, verify with a multi-library test that the bulk-fetch grouping produces identical results to the original per-library loop. The semantics are preserved — the only change is query count.

**Exit criteria:**
- [x] `libraryLabelsService.js` created with GPL header, all 4 functions exported
- [x] `matchRules` no longer issues N+1 queries — confirmed by reading the new implementation (2 queries always)
- [x] `classification.js` `matchRules`, `metadataMatchesLabel`, `evaluateCustomRule`, `evaluateSingleCondition` replaced with 1-line delegates
- [x] All 20+ existing tests in `classification.test.js` for these methods still pass via the delegates
- [x] New `libraryLabelsService.test.js` covers: bulk-fetch path, exclude disqualification, include scoring, custom rule scoring, multi-library selection, empty libraries list

---

### 2.3 — `classificationLearnedCorrectionsService.js` (new)

**Code smell:** Feature Envy. `checkLearnedCorrections()` (28 lines) queries only `learned_corrections` and is the natural complement to `classificationEvidenceService` (which owns `findExactMatch` — the step called immediately before it in `runDecisionTree()`). It has no state coupling to `ClassificationService`.

**Consistency argument:** `checkExactMatch` is already a 1-line delegate to `classificationEvidenceService.findExactMatch()`. Learned corrections are the same architectural tier — user-provided evidence that overrides classification signals. They belong in the evidence layer.

**New file:** `server/src/services/classificationLearnedCorrectionsService.js`

```javascript
/*
 * Classifarr ...GPL-3.0 header...
 */

const defaultDb = require('../config/database');
const { createLogger } = require('../utils/logger');

const logger = createLogger('classificationLearnedCorrectionsService');

/**
 * Look up a user-confirmed correction for a specific TMDB ID + media type.
 * Returns the correction row or null if none exists.
 *
 * Learned corrections have HIGHEST PRIORITY in the decision tree — user truth.
 *
 * @param {number} tmdbId
 * @param {'movie'|'show'} mediaType
 * @param {object} [db]
 * @returns {Promise<object|null>}
 */
async function checkLearnedCorrections(tmdbId, mediaType, db = defaultDb) {
    if (!tmdbId) return null;

    try {
        const result = await db.query(
            `SELECT corrected_library_id, corrected_by, title, created_at, user_note
             FROM learned_corrections
             WHERE tmdb_id = $1 AND media_type = $2
             ORDER BY created_at DESC LIMIT 1`,
            [tmdbId, mediaType]
        );

        if (result.rows.length > 0) {
            logger.info('Found learned correction', {
                tmdbId,
                mediaType,
                correctedLibraryId: result.rows[0].corrected_library_id,
            });
        }

        return result.rows[0] || null;
    } catch (error) {
        // Table may not exist in older installations — non-fatal
        logger.warn('Failed to check learned corrections', { error: error.message });
        return null;
    }
}

module.exports = { checkLearnedCorrections };
```

**classification.js after move:**
```javascript
async checkLearnedCorrections(tmdbId, mediaType) {
    return classificationLearnedCorrectionsService.checkLearnedCorrections(tmdbId, mediaType);
}
```

**Test migration:** No existing tests for `checkLearnedCorrections` in `classification.test.js`. Create `server/src/__tests__/classificationLearnedCorrectionsService.test.js`:
- Returns null when `tmdbId` is falsy
- Returns null when no matching row
- Returns the most-recent row ordered by `created_at DESC`
- Returns null (with log warning) when the table does not exist (error path)

**Exit criteria:**
- [x] `classificationLearnedCorrectionsService.js` created
- [x] `classification.js` `checkLearnedCorrections()` body replaced with 1-line delegate
- [x] New test file with at minimum 4 tests

---

### 2.4 — `ensureDecisionQuestion` → `classificationRoutingService`

**Code smell:** Feature Envy. `ensureDecisionQuestion()` (49 lines) calls `policyQuestionBuilder.build()` to determine whether a classification result needs a user-facing decision question, and if so, builds and attaches it. This is decision-routing logic — it decides the outcome path (complete vs. pending-clarification) — which fits `classificationRoutingService`'s responsibility domain of "what happens after a classification decision is made".

**Complexity analysis:** Three conditional branches:
1. Early return if `result.needs_retry` or no result
2. If question already exists in result, normalise the field set and return
3. Otherwise call `policyQuestionBuilder.build()` and attach the result

No SQL. No shared class state. Only external call is to `policyQuestionBuilder.build()` — which `classificationRoutingService` will need to import.

**Addition to classificationRoutingService.js:**
```javascript
// Add at top of file:
const policyQuestionBuilder = require('./policyQuestionBuilder');

// Add as exported function:
/**
 * Ensure a policy/clarification question is attached to a classification result
 * that needs one. Mutates and returns the result object.
 *
 * @param {object} params
 * @param {object} params.metadata
 * @param {object} params.result
 * @param {object|null} params.policyResult
 * @param {object[]} params.libraries
 * @param {object|null} params.ragContext
 * @returns {Promise<object>} mutated result
 */
async function ensureDecisionQuestion({ metadata, result, policyResult = null, libraries = [], ragContext = null }) {
    if (!result || result.needs_retry) return result;

    const requiresDecisionQuestion = Boolean(
        result.needs_clarification ||
        result.method === 'fallback' ||
        (result.confidence && result.confidence < 70)
    );

    if (!requiresDecisionQuestion) {
        result.needs_clarification = false;
        result.clarification = null;
        result.policy_question = null;
        result.pending_reason = null;
        return result;
    }

    const existingQuestion = result.policy_question || result.clarification || null;
    if (existingQuestion) {
        result.needs_clarification = true;
        result.clarification = result.clarification || existingQuestion;
        result.policy_question = result.policy_question || existingQuestion;
        result.pending_reason = result.pending_reason || existingQuestion.problem_summary || result.reason || null;
        return result;
    }

    const effectivePolicyResult = result.policyResult || policyResult || null;
    const policyQuestion = await policyQuestionBuilder.build({
        metadata,
        policyResult: effectivePolicyResult,
        libraries,
        suggestedLibrary: result.library || null,
        ragContext,
        aiResult: result,
        relatedEvidenceSummary: result.signalContext?.relatedEvidenceSummary ?? null,
    });

    if (policyQuestion) {
        result.needs_clarification = true;
        result.clarification = policyQuestion;
        result.policy_question = policyQuestion;
        result.pending_reason = policyQuestion.problem_summary;
    }

    return result;
}
```

**classification.js after move:**
```javascript
async ensureDecisionQuestion({ metadata, result, policyResult = null, libraries = [], ragContext = null }) {
    return classificationRoutingService.ensureDecisionQuestion({ metadata, result, policyResult, libraries, ragContext });
}
```

**Test migration:** The single existing test `ensureDecisionQuestion builds from the adopted result policy context` in `classification.test.js` (line 2664) calls `classificationService.ensureDecisionQuestion(...)`. This continues to pass via the delegate with no changes. The test should also be duplicated or moved to `classificationRoutingService.test.js` to test the service directly.

**Exit criteria:**
- [x] `ensureDecisionQuestion` function added to `classificationRoutingService.js`, exported via `module.exports`
- [x] `classificationRoutingService.js` imports `policyQuestionBuilder`
- [x] `classification.js` `ensureDecisionQuestion()` body replaced with 1-line delegate
- [x] Existing `ensureDecisionQuestion builds from the adopted result policy context` test still passes

---

### Phase 2 — Summary

| Sub-phase | Lines removed from classification.js | New file | Key benefit |
|---|---|---|---|
| 2.1 | ~112 lines + 1 proxy method | `libraryRulesService.js` | library_rules_v2 engine isolated and independently testable |
| 2.2 | ~174 lines (4 methods) + 4 proxy methods | `libraryLabelsService.js` | **N+1 eliminated**: 2N queries → 2 parallel bulk queries |
| 2.3 | ~28 lines + 1 proxy method | `classificationLearnedCorrectionsService.js` | Evidence layer consistency (alongside `classificationEvidenceService`) |
| 2.4 | ~49 lines + 1 proxy method | `classificationRoutingService.js` (added function) | Policy question building owned by routing layer |

**Total:** ~363 lines removed from `classification.js`. Projected final size: ~1010 lines (from 1373), with 49 pure 1-line delegates.

**N+1 impact:** In a 10-library deployment, `matchRules()` goes from 20 queries → 2 queries. With 20 libraries: 40 → 2. This is significant under classification burst load where `runDecisionTree()` is called concurrently by multiple workers.

---

## Phase 3 — `runDecisionTree` Decomposition (Deferred)

`runDecisionTree()` is 511 lines — 37% of the file — and is the highest-risk extraction in this plan. It contains two intertwined classification paths, two inline helper closures that both paths share, and a common error-handling shape that is duplicated across both paths.

**Prerequisite:** Phase 2 complete and stable. All delegates tested and green.

---

### Best-Practice Foundation for Phase 3

Beyond the patterns in Phases 1–2, three additional principles apply:

**5. Strategy Pattern (Fowler / DEV.to):** When a function selects behavior based on a runtime condition, that condition should route to strategy objects — not inline branches. `runDecisionTree` currently selects between two paths via `if (policySignalContext)`. The extracted path services are the strategy objects. `runDecisionTree` becomes the context/router that selects them.

**6. Strangler Fig Pattern (AWS Prescriptive Guidance, 2025):** For high-risk extractions, wrap the old code behind a service boundary first, prove the wrapped version works via existing tests, then incrementally migrate. For Phase 3, the correct order is: (1) extract helpers → (2) create service boundaries (new files with same logic) → (3) replace inline code with service calls → (4) delete inline code only after tests pass. Never delete the inline logic and service together in one commit.

**7. Extract Before Branch (Fowler "Composing Method"):** Nested helper closures that are called inside a method become invisible to tests and hard to reason about. The correct order is: extract the helpers to module-level (or a service) first, verify nothing broke, then extract the branches that call them. Attempting to extract a branch before its helpers are extracted creates circular dependency risks.

**`runDecisionTree` anatomy (verified by code reading, April 2026):**

```
Lines 512–629: Pre-flight steps (always run, regardless of path chosen)
  - Library fetch (db.query)
  - source_library_id → early return (100%)
  - checkLearnedCorrections → early return (100%)
  - mediaSyncService.findExistingMedia → early return (100%)
  - contentTypeAnalyzer.analyze → mutates metadata.contentAnalysis
  - checkExactMatch → early return (100%)
  - classificationEvidenceService.collectRelatedEvidence → relatedEvidence

Lines 632–651: buildRelatedEvidenceSummary (closure — shared by both paths)
Lines 651–673: buildPolicySignalContext (closure — used only in policy path setup)

Lines 674–846: Policy path block
  - try: policyEngine.evaluateItem(metadata, { relatedEvidence })
    - auto_classify → early return (100%)
    - ranked results present → buildPolicySignalContext → sets policySignalContext
  - catch: PolicyEngine failed → policySignalContext remains null → fall through
  - if (policySignalContext): [policy-guided AI path]
    - Build ragContext from policyResult.ragCache
    - classificationPhaseService.updatePhase x3
    - classificationAiService.aiClassify(metadata, libraries, policySignalContext, { mode: 'classify', ragContext })
    - classificationRagLoopService.evaluateRagLoopSecondPass(...)
    - classificationRoutingService.ensureDecisionQuestion(...)
    - [catch]: 3-branch error handler (retry | signal_calculation | fallback)

Lines 851–1035: Legacy signal path block (runs when policySignalContext is null)
  - new SignalCollector(); signalCollector.collectAll(metadata, libraries, detectors)
  - ragRetriever.semanticSearch(metadata, 5)
  - confidenceCalculator.loadWeights() + calculate()
  - classificationAiService.aiClassify(metadata, libraries, signalContext)
  - classificationRagLoopService.evaluateRagLoopSecondPass(...)
  - classificationRoutingService.ensureDecisionQuestion(...)
  - [catch]: same 3-branch error handler
```

**Key archaeology findings:**
- `aiClassify` — already a 1-line delegate to `classificationAiService.aiClassify` (line 1241–1243)
- `evaluateRagLoopSecondPass` — already a 1-line delegate to `classificationRagLoopService` (line 378–380)
- `buildPendingRetryResult` — already a 1-line delegate to `classificationUtilsService` (line 354–356)
- `isAiTransientAvailabilityError` — already a 1-line delegate to `classificationUtilsService` (line 334–335)
- `policyScoringContextBuilder.js` **does not exist yet** — the SKILL documents it as planned but it was never built. Phase 3.2 creates it.
- After Phase 2 is complete, `this.checkLearnedCorrections`, `this.checkLibraryRules`, `this.matchRules` become 1-line delegates, simplifying the `detectors` object in the legacy path

---

### 3.1 — Extract `buildRelatedEvidenceSummary` → `classificationEvidenceService`

**Code smell:** Hidden helper (Fowler "Extract Function"). `buildRelatedEvidenceSummary` is a closure inside `runDecisionTree`. It is called in two places: directly in the pre-policy setup (line 674) and inside `buildPolicySignalContext` (line 712). Because it is a closure, it is invisible to tests and cannot be verified independently.

**Why `classificationEvidenceService`:** The function takes a `relatedEvidence` array (the output of `collectRelatedEvidence`) and summarises it into a compact object. This is an evidence-tier summarization — architecturally consistent with `collectRelatedEvidence` on the same service.

**New method on `ClassificationEvidenceService`:**
```javascript
/**
 * Summarise a related-evidence array for use in AI prompts and clarification question builders.
 * Informational-only — policy scores remain authoritative.
 *
 * @param {object[]} evidence  - from collectRelatedEvidence()
 * @param {object[]} libraries - active libraries for this media type
 * @returns {{ topLibrary, confidence, topScopes, hasConflict }|null}
 */
buildRelatedEvidenceSummary(evidence, libraries) {
    if (!Array.isArray(evidence) || evidence.length === 0) return null;

    const sorted = [...evidence].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
    const top = sorted[0];
    const topLibraryObj = top?.libraryId
        ? (libraries || []).find(l => l.id === top.libraryId)
        : null;
    const topLibrary = topLibraryObj?.name ?? null;
    const topScopes = sorted.slice(0, 5).map(e => ({
        scope:       e.scope,
        label:       e.evidenceData?.genre ?? e.evidenceData?.studio ?? e.evidenceData?.franchise ?? e.evidenceKey ?? e.scope,
        confidence:  e.confidence ?? 0,
        provenance:  e.provenance ?? null,
    }));
    const uniqueLibraryIds = new Set(sorted.map(e => e.libraryId).filter(Boolean));
    const hasConflict = uniqueLibraryIds.size > 1;

    return { topLibrary, confidence: top?.confidence ?? 0, topScopes, hasConflict };
}
```

**`classification.js` changes after 3.1:**
- The `buildRelatedEvidenceSummary` closure is deleted from `runDecisionTree`
- Call sites replaced:
  - Line 674: `buildRelatedEvidenceSummary(evidence, candidates)` → `classificationEvidenceService.buildRelatedEvidenceSummary(evidence, candidates)`
  - Line 712 (inside `buildPolicySignalContext` closure): same replacement
  - Line 928 (legacy path): `buildRelatedEvidenceSummary(relatedEvidence, libraries)` → `classificationEvidenceService.buildRelatedEvidenceSummary(relatedEvidence, libraries)`

**Test migration:** New test in `classificationEvidenceService.test.js` (or a new sub-describe in that file):
- Returns null when evidence is empty
- Returns `{ topLibrary: 'Documentaries', ... }` when top evidence has a matching library
- `hasConflict: true` when evidence spans multiple library IDs
- `topScopes` is sorted descending by confidence, capped at 5

**Exit criteria:**
- [x] `ClassificationEvidenceService.buildRelatedEvidenceSummary` method added
- [x] `buildRelatedEvidenceSummary` closure deleted from `runDecisionTree`
- [x] All 3 call sites updated
- [x] All existing classification tests pass

---

### 3.2 — Create `policyScoringContextBuilder.js` (new)

**Code smell:** Hidden helper + misplaced responsibility. `buildPolicySignalContext` is a closure that assembles the `policySignalContext` object used by the policy-guided AI path. It belongs in its own service per the layered-service-migration SKILL (Layer 3 — Policy Integration). `policyScoringContextBuilder` does not yet exist.

**Dependency:** Requires 3.1 complete (calls `classificationEvidenceService.buildRelatedEvidenceSummary`).

**New file:** `server/src/services/policyScoringContextBuilder.js`

```javascript
/*
 * Classifarr ...GPL-3.0 header...
 */

const classificationEvidenceService = require('./classificationEvidenceService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('policyScoringContextBuilder');

/**
 * Build the policy signal context object used to guide AI classification.
 * This is the "context" handed to aiClassify when PolicyEngine has provided
 * ranked results. It is informational — policy scores remain authoritative.
 *
 * @param {object} policyResult   - from policyEngine.evaluateItem()
 * @param {object[]} libraries    - active libraries for this media type
 * @param {object[]} rankedList   - policyResult.ranked
 * @param {object[]} relatedEvidence - from classificationEvidenceService.collectRelatedEvidence()
 * @returns {{ confidence, suggestedLibrary, breakdown, ranked, scores, weights, hasConflict, relatedEvidenceSummary }}
 */
function buildSignalContext(policyResult, libraries, rankedList, relatedEvidence = []) {
    const ranked = Array.isArray(rankedList) ? rankedList : [];
    const top = ranked[0] || null;
    const suggestedLibrary = top ? libraries.find(l => l.id === top.library_id) : null;

    const breakdown = top?.breakdown?.length ? top.breakdown : (top ? [
        { type: 'preset',   score: top.scores?.preset   || 0, weight: top.weights?.preset   || 0 },
        { type: 'profile',  score: top.scores?.profile  || 0, weight: top.weights?.profile  || 0 },
        { type: 'pattern',  score: top.scores?.pattern  || 0, weight: top.weights?.pattern  || 0 },
        { type: 'rag',      score: top.scores?.rag      || 0, weight: top.weights?.rag      || 0 },
        { type: 'history',  score: top.scores?.history  || 0, weight: top.weights?.history  || 0 },
    ] : []);

    const hasConflict = ranked.length > 1 &&
        top?.score != null &&
        ranked[1]?.score != null
            ? Math.abs(top.score - ranked[1].score) <= 10
            : false;

    return {
        confidence:             policyResult?.confidence || 0,
        suggestedLibrary,
        breakdown,
        ranked,
        scores:                 top?.scores  || null,
        weights:                top?.weights || null,
        hasConflict,
        relatedEvidenceSummary: classificationEvidenceService.buildRelatedEvidenceSummary(relatedEvidence, libraries),
    };
}

module.exports = { buildSignalContext };
```

**`classification.js` after 3.2:**
- The `buildPolicySignalContext` closure deleted from `runDecisionTree`
- Call site (line 712) replaced: `buildPolicySignalContext(policyResult, libraries, policyResult.ranked, relatedEvidence)` → `policyScoringContextBuilder.buildSignalContext(policyResult, libraries, policyResult.ranked, relatedEvidence)`
- `policyScoringContextBuilder` added to `require` block at top of file

**Test migration:** Create `server/src/__tests__/policyScoringContextBuilder.test.js`:
- Returns correct `suggestedLibrary` matched from ranked top
- `hasConflict: true` when top and second-ranked differ by ≤ 10 points
- `hasConflict: false` when only one ranked entry
- `breakdown` falls back to scores object when `top.breakdown` is absent
- `relatedEvidenceSummary` propagates from `classificationEvidenceService.buildRelatedEvidenceSummary`

**Exit criteria:**
- [x] `policyScoringContextBuilder.js` created with GPL header
- [x] `buildPolicySignalContext` closure deleted from `runDecisionTree`
- [x] Call site replaced with `policyScoringContextBuilder.buildSignalContext(...)`
- [x] `policyScoringContextBuilder` required in `classification.js`
- [x] New test file with ≥ 5 tests (8 added)
- [x] All existing classification tests pass

---

### 3.3 — Create `classificationPolicyPathService.js` (new)

**Code smell:** Feature Envy + Single Responsibility Violation. The `if (policySignalContext)` block (including the `policyEngine.evaluateItem` setup that gates it) is the policy-guided classification path. It owns: policy evaluation, RAG context construction, AI invocation, second-pass RAG loop, decision question attachment, and full error handling. It has no business living in the `runDecisionTree` orchestrator.

**Dependencies:** Requires 3.2 complete.

**Design: "handled / not handled" return shape:**

The service returns a discriminated union so `runDecisionTree` can route cleanly:
```javascript
// Handled — result is final
{ handled: true, result: { library, confidence, method, ... } }

// Not handled — PolicyEngine produced no ranked signal; fall through to legacy path
{ handled: false, policyResult: null }
```

**New file:** `server/src/services/classificationPolicyPathService.js`

```javascript
/*
 * Classifarr ...GPL-3.0 header...
 */

const policyEngine = require('./policyEngine');
const classificationPhaseService = require('./classificationPhaseService');
const ragRetriever = require('./ragRetriever');
const policyScoringContextBuilder = require('./policyScoringContextBuilder');
const classificationAiService = require('./classificationAiService');
const classificationRagLoopService = require('./classificationRagLoopService');
const classificationUtilsService = require('./classificationUtilsService');
const classificationRoutingService = require('./classificationRoutingService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('classificationPolicyPathService');

/**
 * Attempt policy-guided classification for a single item.
 *
 * Returns { handled: true, result } if the policy path produced a final result.
 * Returns { handled: false, policyResult: null } if PolicyEngine produced no ranked
 * signal and the caller should fall through to the legacy signal path.
 *
 * @param {object} params
 * @param {object} params.metadata
 * @param {object[]} params.libraries
 * @param {string|null} params.taskId
 * @param {object[]} params.relatedEvidence
 * @returns {Promise<{ handled: boolean, result?: object, policyResult?: object|null }>}
 */
async function execute({ metadata, libraries, taskId, relatedEvidence }) {
    let policyResult = null;
    let policySignalContext = null;

    try {
        if (taskId && !metadata.source_library_id) {
            await classificationPhaseService.updatePhase(taskId, 'policy_eval');
        }

        logger.info('Evaluating with PolicyEngine', { title: metadata.title });
        policyResult = await policyEngine.evaluateItem(metadata, { relatedEvidence });

        if (policyResult?.action === 'auto_classify' && policyResult.library) {
            logger.info('PolicyEngine auto-classified (AI skipped)', {
                title: metadata.title,
                library: policyResult.library.library_name,
                confidence: policyResult.confidence,
            });
            const matchedLibrary = libraries.find(l => l.id === policyResult.library.library_id);
            if (!matchedLibrary) {
                logger.error('PolicyEngine returned unknown library', { policyLibraryId: policyResult.library.library_id });
                throw new Error('PolicyEngine selected unknown library');
            }
            return {
                handled: true,
                result: {
                    library: matchedLibrary,
                    confidence: policyResult.confidence,
                    method: 'policy_auto',
                    reason: `Policy: ${policyResult.library.policy_name}`,
                    libraries,
                    policyResult,
                },
            };
        }

        if (policyResult?.ranked && policyResult.ranked.length > 0) {
            metadata.policyResult = policyResult;
            policySignalContext = policyScoringContextBuilder.buildSignalContext(
                policyResult, libraries, policyResult.ranked, relatedEvidence
            );
        }
    } catch (policyError) {
        logger.warn('PolicyEngine evaluation failed, falling back to legacy signals', {
            error: policyError.message,
            title: metadata.title,
        });
        return { handled: false, policyResult: null };
    }

    if (!policySignalContext) {
        return { handled: false, policyResult };
    }

    // Policy-guided AI path
    let ragContext = null;
    const ragCache = policyResult?.ragCache || null;
    const ragMatches = ragCache?.matches || [];
    if (ragCache && taskId && !metadata.source_library_id) {
        await classificationPhaseService.updatePhase(taskId, 'rag_analysis');
    }
    if (ragMatches.length > 0) {
        ragContext = {
            similarItems: ragMatches.slice(0, 3),
            suggestion: ragRetriever.getSuggestedLibrary(ragMatches),
        };
    }

    if (taskId && !metadata.source_library_id) {
        await classificationPhaseService.updatePhase(taskId, 'ai_analysis', {
            skippedPhases: ['signal_combine'],
            skippedPhaseMetadata: { signal_combine: { reason: 'policy_signal_path' } },
        });
    }

    try {
        const aiMatch = await classificationAiService.aiClassify(
            metadata, libraries, policySignalContext, { mode: 'classify', ragContext }
        );
        const aiResult = {
            ...aiMatch,
            method: aiMatch.verified_by_ai ? 'ai_verified' : 'ai_analysis',
            libraries,
            signalContext: policySignalContext,
            policyResult,
            ragContext,
        };

        if (taskId && !metadata.source_library_id) {
            await classificationPhaseService.updatePhase(taskId, 'decision', { confidence: aiResult.confidence });
        }

        let finalResult = await classificationRagLoopService.evaluateRagLoopSecondPass({
            metadata, libraries, baselineResult: aiResult, policyResult,
            signalContext: policySignalContext, ragContext,
        });
        const effectiveRagContext = finalResult.ragContext || ragContext;

        return {
            handled: true,
            result: await classificationRoutingService.ensureDecisionQuestion({
                metadata, result: finalResult,
                policyResult: policyResult || null,
                libraries, ragContext: effectiveRagContext,
            }),
        };
    } catch (error) {
        const fallbackConfidence = policySignalContext.confidence || 0;
        const suggestedLibrary = policySignalContext.suggestedLibrary;
        const isTransientAiAvailability = classificationUtilsService.isAiTransientAvailabilityError(error);

        if (isTransientAiAvailability) {
            logger.warn('AI classification temporarily unavailable', { error: error.message, code: error.code });
        } else {
            logger.error('AI classification failed', { error: error.message });
        }

        if (isTransientAiAvailability || fallbackConfidence < 50) {
            logger.info('AI unavailable/busy - queuing for retry', {
                confidence: fallbackConfidence, tmdbId: metadata.tmdb_id, title: metadata.title,
                transient_ai_availability: isTransientAiAvailability,
            });
            return {
                handled: true,
                result: classificationUtilsService.buildPendingRetryResult({
                    confidence: fallbackConfidence, libraries,
                    signalContext: policySignalContext,
                    transientError: error,
                    previousRetryCount: metadata.retry_count,
                    maxRetries: metadata.max_retries,
                }),
            };
        }

        if (suggestedLibrary && fallbackConfidence >= 50) {
            return {
                handled: true,
                result: await classificationRoutingService.ensureDecisionQuestion({
                    metadata,
                    result: {
                        library: suggestedLibrary, confidence: fallbackConfidence,
                        method: 'signal_calculation',
                        reason: 'Calculated from policy signals (AI unavailable)',
                        libraries, policyResult,
                    },
                    policyResult: policyResult || null, libraries, ragContext,
                }),
            };
        }

        const fallbackLibrary = libraries[libraries.length - 1];
        return {
            handled: true,
            result: await classificationRoutingService.ensureDecisionQuestion({
                metadata,
                result: {
                    library: fallbackLibrary, confidence: 50,
                    method: 'fallback',
                    reason: `Default library - AI unavailable (fell back to ${fallbackLibrary.name})`,
                    libraries,
                },
                policyResult: policyResult || null, libraries, ragContext,
            }),
        };
    }
}

module.exports = { execute };
```

**classification.js after 3.3:**
```javascript
// Replace lines 674–846 with:
const policyPath = await classificationPolicyPathService.execute({ metadata, libraries, taskId, relatedEvidence });
if (policyPath.handled) return policyPath.result;
const fallbackPolicyResult = policyPath.policyResult;
```

**Test migration:** Create `server/src/__tests__/classificationPolicyPathService.test.js`:
- Returns `{ handled: true, result: { method: 'policy_auto' } }` when policyEngine returns `auto_classify`
- Returns `{ handled: false }` when policyEngine throws
- Returns `{ handled: false }` when policyEngine returns no ranked results
- Returns `{ handled: true, result: { method: 'ai_verified' | 'ai_analysis' } }` when AI succeeds
- Returns `{ handled: true, result: { needs_retry: true } }` when AI is unavailable + confidence < 50
- Returns `{ handled: true, result: { method: 'signal_calculation' } }` when AI unavailable + confidence ≥ 50 + suggestedLibrary present
- Returns `{ handled: true, result: { method: 'fallback' } }` when AI unavailable + no suggestedLibrary

All tests mock `policyEngine`, `classificationAiService`, `classificationRagLoopService`, `classificationUtilsService`, and `classificationRoutingService`.

**Exit criteria:**
- [x] `classificationPolicyPathService.js` created with GPL header
- [x] Lines 674–846 of `runDecisionTree` replaced with 3-line routing call
- [x] `classificationPolicyPathService` required in `classification.js`
- [x] New test file with ≥ 7 tests covering all return branches (9 added)
- [x] All existing classification tests pass

---

### 3.4 — Create `classificationLegacySignalPathService.js` (new)

**Code smell:** Feature Envy. The legacy signal path (lines 851–1035) builds a `SignalCollector`, runs RAG retrieval, computes confidence, calls AI, and handles errors. It is not orchestration — it is the full execution of the legacy classification algorithm. None of this logic involves shared state from `ClassificationService`.

**Dependencies:** Requires 3.3 complete. Requires Phase 2 complete (so that `checkLearnedCorrections`, `checkLibraryRules`, `matchRules` are all delegates, meaning the `detectors` object in the legacy path can import services directly instead of passing callbacks through).

**New file:** `server/src/services/classificationLegacySignalPathService.js`

```javascript
/*
 * Classifarr ...GPL-3.0 header...
 */

const { SignalCollector, SIGNAL_TYPES } = require('./signalCollector');
const ragRetriever = require('./ragRetriever');
const confidenceCalculator = require('./confidenceCalculator');
const classificationPhaseService = require('./classificationPhaseService');
const classificationEvidenceService = require('./classificationEvidenceService');
const classificationAiService = require('./classificationAiService');
const classificationRagLoopService = require('./classificationRagLoopService');
const classificationUtilsService = require('./classificationUtilsService');
const classificationRoutingService = require('./classificationRoutingService');
// Phase 2 services — detectors
const classificationLearnedCorrectionsService = require('./classificationLearnedCorrectionsService');
const libraryRulesService = require('./libraryRulesService');
const libraryLabelsService = require('./libraryLabelsService');
const mediaSyncService = require('./mediaSync');
const contentTypeAnalyzer = require('./contentTypeAnalyzer');
const { createLogger } = require('../utils/logger');

const logger = createLogger('classificationLegacySignalPathService');

/**
 * Execute the legacy signal-based classification path.
 * Called when PolicyEngine produced no ranked signal (policySignalContext is null).
 *
 * @param {object} params
 * @param {object} params.metadata
 * @param {object[]} params.libraries
 * @param {string|null} params.taskId
 * @param {object[]} params.relatedEvidence
 * @param {object|null} params.policyResult  - may be non-null if PolicyEngine ran but produced no ranked output
 * @returns {Promise<object>} classification result
 */
async function execute({ metadata, libraries, taskId, relatedEvidence, policyResult = null }) {
    const signalCollector = new SignalCollector();

    // Build detector map — all delegates after Phase 2
    const detectors = {
        checkLearnedCorrections: classificationLearnedCorrectionsService.checkLearnedCorrections.bind(classificationLearnedCorrectionsService),
        checkLibraryRules:       libraryRulesService.checkLibraryRules.bind(libraryRulesService),
        findExistingMedia:       mediaSyncService.findExistingMedia.bind(mediaSyncService),
        analyzeContent:          contentTypeAnalyzer.analyze.bind(contentTypeAnalyzer),
        checkExactMatch:         (tmdbId, mediaType) => classificationEvidenceService.findExactMatch({ tmdbId, mediaType })
                                     .then(m => m ? { library_id: m.libraryId, confidence: m.confidence } : null),
        matchRules:              libraryLabelsService.matchRules.bind(libraryLabelsService),
    };

    await signalCollector.collectAll(metadata, libraries, detectors);

    // RAG retrieval
    let ragContext = null;
    try {
        if (taskId && !metadata.source_library_id) {
            await classificationPhaseService.updatePhase(taskId, 'rag_analysis');
        }
        const similarItems = await ragRetriever.semanticSearch(metadata, 5);
        if (similarItems && similarItems.length > 0) {
            const suggestedLibrary = ragRetriever.getSuggestedLibrary(similarItems);
            const dynamicWeight = ragRetriever.calculateDynamicWeight(similarItems);
            if (suggestedLibrary) {
                const ragLibrary = libraries.find(l => l.id === suggestedLibrary.libraryId);
                if (ragLibrary) {
                    if (!signalCollector.hasSignal(SIGNAL_TYPES.SEMANTIC_SIMILARITY)) {
                        signalCollector.addSignal(
                            SIGNAL_TYPES.SEMANTIC_SIMILARITY,
                            { similarItems: similarItems.slice(0, 3), avgSimilarity: suggestedLibrary.avgSimilarity, voteCount: suggestedLibrary.voteCount },
                            dynamicWeight,
                            ragLibrary
                        );
                    }
                    ragContext = {
                        similarItems: similarItems.slice(0, 3),
                        suggestion: ragRetriever.getSuggestedLibrary(similarItems),
                    };
                }
            }
        }
    } catch (ragError) {
        logger.debug('RAG search failed, continuing without', { error: ragError.message });
    }

    if (taskId && !metadata.source_library_id) {
        await classificationPhaseService.updatePhase(taskId, 'signal_combine');
    }

    await confidenceCalculator.loadWeights();
    const confidenceResult = confidenceCalculator.calculate(signalCollector.getSignals());

    if (taskId && !metadata.source_library_id) {
        await classificationPhaseService.updatePhase(taskId, 'ai_analysis');
    }

    const aiContext = confidenceCalculator.toAIContext(confidenceResult);
    const signalContext = {
        ...confidenceResult,
        aiContext,
        ragContext,
        signals: signalCollector.getSignals(),
        patternSignals: signalCollector.getPatternSignals(),
        relatedEvidenceSummary: classificationEvidenceService.buildRelatedEvidenceSummary(relatedEvidence, libraries),
    };

    try {
        const aiMatch = await classificationAiService.aiClassify(metadata, libraries, signalContext);
        const aiResult = {
            ...aiMatch,
            method: aiMatch.verified_by_ai ? 'ai_verified' : 'ai_analysis',
            libraries,
            signalContext,
            policyResult: policyResult || null,
        };

        if (taskId && !metadata.source_library_id) {
            await classificationPhaseService.updatePhase(taskId, 'decision', { confidence: aiResult.confidence });
        }

        let finalResult = await classificationRagLoopService.evaluateRagLoopSecondPass({
            metadata, libraries, baselineResult: aiResult,
            policyResult: policyResult || null, signalContext, ragContext,
        });
        const effectiveRagContext = finalResult.ragContext || ragContext;

        return classificationRoutingService.ensureDecisionQuestion({
            metadata, result: finalResult,
            policyResult: metadata.policyResult || null, libraries,
            ragContext: effectiveRagContext,
        });
    } catch (error) {
        const isTransientAiAvailability = classificationUtilsService.isAiTransientAvailabilityError(error);

        if (isTransientAiAvailability) {
            logger.warn('AI classification temporarily unavailable', { error: error.message, code: error.code });
        } else {
            logger.error('AI classification failed', { error: error.message });
        }

        if (isTransientAiAvailability || confidenceResult.confidence < 50) {
            logger.info('AI unavailable/busy - queuing for retry', {
                confidence: confidenceResult.confidence, tmdbId: metadata.tmdb_id, title: metadata.title,
                transient_ai_availability: isTransientAiAvailability,
            });
            return classificationUtilsService.buildPendingRetryResult({
                confidence: confidenceResult.confidence, libraries, signalContext,
                transientError: error,
                previousRetryCount: metadata.retry_count,
                maxRetries: metadata.max_retries,
            });
        }

        if (confidenceResult.suggestedLibrary && confidenceResult.confidence >= 50) {
            return classificationRoutingService.ensureDecisionQuestion({
                metadata,
                result: {
                    library: confidenceResult.suggestedLibrary, confidence: confidenceResult.confidence,
                    method: 'signal_calculation',
                    reason: 'Calculated from signals (AI unavailable)',
                    libraries,
                },
                policyResult: metadata.policyResult || null, libraries, ragContext,
            });
        }

        const fallbackLibrary = libraries[libraries.length - 1];
        return classificationRoutingService.ensureDecisionQuestion({
            metadata,
            result: {
                library: fallbackLibrary, confidence: 50,
                method: 'fallback',
                reason: `Default library - AI unavailable (fell back to ${fallbackLibrary.name})`,
                libraries,
            },
            policyResult: metadata.policyResult || null, libraries, ragContext,
        });
    }
}

module.exports = { execute };
```

**classification.js after 3.4:**
```javascript
// Replace lines 851–1035 with:
return classificationLegacySignalPathService.execute({
    metadata, libraries, taskId, relatedEvidence,
    policyResult: fallbackPolicyResult || null,
});
```

**Test migration:** Create `server/src/__tests__/classificationLegacySignalPathService.test.js`:
- `SignalCollector.collectAll` called with correct `detectors` shape
- RAG signal added when `ragRetriever.semanticSearch` returns results
- RAG signal skipped when `SEMANTIC_SIMILARITY` already collected
- Returns AI result through `ensureDecisionQuestion` when AI succeeds
- Returns `needs_retry` result when AI is unavailable + confidence < 50
- Returns `signal_calculation` result when AI unavailable + confidence ≥ 50 + suggestedLibrary present
- Returns `fallback` result when AI unavailable + no suggestedLibrary
- RAG failure is silent (logged as `debug`, does not throw)

**Exit criteria:**
- [x] `classificationLegacySignalPathService.js` created with GPL header
- [x] Lines 851–1035 replaced with 5-line delegate call in `runDecisionTree`
- [x] `classificationLegacySignalPathService` required in `classification.js`
- [x] New test file with ≥ 8 tests (8 added)
- [x] All existing classification tests pass

---

### 3.5 — `runDecisionTree` as a pure orchestrator

After 3.1–3.4, `runDecisionTree` retains only the pre-flight steps and routing logic:

```javascript
async runDecisionTree(metadata, mediaType, taskId = null) {
    // Library fetch
    const librariesResult = await db.query(
        'SELECT * FROM libraries WHERE media_type = $1 AND is_active = true ORDER BY priority DESC',
        [mediaType]
    );
    const libraries = librariesResult.rows;

    if (libraries.length === 0) {
        throw new Error(`No active libraries found for media type: ${mediaType}`);
    }

    // [Pre-flight steps — unchanged, ~120 lines]
    // source_library_id → return
    // checkLearnedCorrections → return
    // mediaSyncService.findExistingMedia → return
    // contentTypeAnalyzer.analyze (mutates metadata.contentAnalysis)
    // checkExactMatch → return
    // classificationEvidenceService.collectRelatedEvidence → relatedEvidence

    // Policy path
    const policyPath = await classificationPolicyPathService.execute({ metadata, libraries, taskId, relatedEvidence });
    if (policyPath.handled) return policyPath.result;

    // Legacy signal path
    return classificationLegacySignalPathService.execute({
        metadata, libraries, taskId, relatedEvidence,
        policyResult: policyPath.policyResult || null,
    });
}
```

**Projected final size:** `runDecisionTree` drops from 511 lines to ~150 lines (pre-flight guard clauses + routing). `classification.js` overall: ~710 lines (from 1373 pre-Phase 2, 1010 post-Phase 2, 710 post-Phase 3).

**Duplicate error handler note:** Both path services contain structurally identical `catch` blocks (3-branch: retry | signal_calculation | fallback). This is a known code smell that should be addressed as a Phase 3.6 cleanup after both services are stable: extract an `executeAiWithFallback({ metadata, libraries, taskId, signalContext, policyResult, ragContext })` utility to `classificationUtilsService`. This is deferred to avoid scope creep during the main extraction.

**Exit criteria:**
- [x] `runDecisionTree` body is ≤ 160 lines (~15 lines)
- [x] `classification.js` total line count ≤ 750
- [x] `SignalCollector`, `confidenceCalculator`, `ragRetriever` removed from `classification.js` imports (moved to `classificationLegacySignalPathService`)
- [x] `policyEngine` import removed from `classification.js` (moved to `classificationPolicyPathService`)
- [x] All classification tests pass: 910 tests
- [x] All queue tests pass

---

### Phase 3 — Summary

| Sub-phase | Change | New file | Key benefit |
|---|---|---|---|
| 3.1 | Add `buildRelatedEvidenceSummary` to `classificationEvidenceService` | (existing file, new method) | Helper visible to tests; removes closure from `runDecisionTree` |
| 3.2 | Extract `buildPolicySignalContext` closure | `policyScoringContextBuilder.js` | Layer 3 service per SKILL; independently testable signal context builder |
| 3.3 | Extract policy-guided AI path | `classificationPolicyPathService.js` | Strategy pattern; `runDecisionTree` no longer owns policy execution |
| 3.4 | Extract legacy signal path | `classificationLegacySignalPathService.js` | Legacy algorithm fully encapsulated; enables future deprecation without touching orchestrator |
| 3.5 | Replace inline blocks with 5-line routing | (classification.js shrinks) | `runDecisionTree` is a pure orchestrator: 511 → ~150 lines |

**Removal from `classification.js` imports after Phase 3:**

| Import | Removed by | Moves to |
|---|---|---|
| `policyEngine` | 3.3 | `classificationPolicyPathService` |
| `SignalCollector`, `SIGNAL_TYPES` | 3.4 | `classificationLegacySignalPathService` |
| `confidenceCalculator` | 3.4 | `classificationLegacySignalPathService` |
| `ragRetriever` | 3.3 + 3.4 | both path services |
| `policyScoringContextBuilder` | 3.3 uses it directly | added to `classification.js` only temporarily at 3.2 |

---

## Phase 4 — Database Observability Improvements

These are improvements identified but not critical path for this release.

### 4.1 — `schema_migrations` Snapshot Update

`database/schema/current.sql` does not include `idx_task_queue_task_type_status` (from the March 14 migration). Regenerate the schema snapshot after the new `idx_task_queue_processing_classification` migration applies.

**Exit criteria:**
- [x] `idx_task_queue_task_type_status` added to `database/schema/current.sql`
- [x] `idx_task_queue_processing_classification` added to `database/schema/current.sql`

### 4.2 — Slow Query Threshold Env Var Documentation

`POSTGRES_SLOW_QUERY_THRESHOLD_MS` controls the slow-query threshold (default 500ms).

**Status:** `.env.example` is already done (line 102: `# POSTGRES_SLOW_QUERY_THRESHOLD_MS=500` with comment). Only `README.md` is missing it.

**Where to add in README.md:** Append to the existing **OMDb Behavior and Tuning** section (line ~631) — it is the closest operational-tuning neighbour and avoids creating a new heading for a single variable.

```markdown
## Database Tuning

| Variable | Default | Effect |
|---|---|---|
| `POSTGRES_SLOW_QUERY_THRESHOLD_MS` | `500` | Queries exceeding this threshold (ms) emit a `[SLOW QUERY]` warning with elapsed time and query text. Lower on fast NVMe storage; raise on spinning disk or NAS. Set to `-1` to disable. |
| `POSTGRES_CONN_TIMEOUT_MS` | `5000` | Pool connection acquisition timeout (ms). |
| `POSTGRES_STATEMENT_TIMEOUT_MS` | `30000` | Per-query statement timeout (ms). Kills runaway queries server-side. |
```

**Exit criteria:**
- [x] `.env.example` already contains `# POSTGRES_SLOW_QUERY_THRESHOLD_MS=500`
- [x] `README.md` **Database Tuning** section added with the three Postgres knobs in a table

### 4.3 — Autovacuum Tuning for `task_queue`

The March 13 migration added autovacuum cost settings. With `seq_scan = 889,472` observed on the table, consider adding a targeted `ANALYZE task_queue` on container startup when the table has grown beyond a threshold. This ensures the new `idx_task_queue_processing_classification` partial index is always chosen when active processing rows exist.

**Status:** Informational. The `20260313_120000_task_queue_insert_autovacuum.sql` and `20260305_200400_autovacuum_tuning.sql` migrations already configure aggressive autovacuum tuning for `task_queue`. The startup `ANALYZE` suggestion is deferred as a future operational improvement outside this plan's scope.

---

## Risk Log

| Change | Risk | Mitigation |
|---|---|---|
| Worker lifecycle move (Phase 1.1) | `resetStaleProcessingTasks` uses `pool.connect()` directly (not timedQuery) — must preserve this | Keep `db.pool.connect()` call, don't route through timedQuery |
| `checkAIAvailability` move (Phase 1.4) | Caller in `queueWorkerLoopService` must be updated | Small, well-tested path |
| N+1 fix in `matchRules` (Phase 2.2) | Bulk query changes data grouping from per-library to Map lookup — semantics must be equivalent | Verify with multi-library test: same winner library, same confidence, same reason strings |
| `ensureDecisionQuestion` (Phase 2.4) | `classificationRoutingService` must import `policyQuestionBuilder` — circular import check needed | Verify no circular require chain: `classificationRoutingService → policyQuestionBuilder → ...` |
| `runDecisionTree` decomposition (Phase 3) | Highest risk change in the codebase | Gated behind Phase 2 stability; requires complete test coverage pass first |
| `buildRelatedEvidenceSummary` extraction (Phase 3.1) | Called in 3 places including inside `buildPolicySignalContext` — must update all 3 call sites atomically | Verify with `grep -n buildRelatedEvidenceSummary classification.js` → 0 results after replacement |
| `policyScoringContextBuilder` is new (Phase 3.2) | Does not exist yet — was planned in SKILL but never built | Create fresh; do not confuse with `policyDecisionBuilder` which does exist |
| Policy path service (Phase 3.3) | `metadata.policyResult = policyResult` mutation must be preserved (consumed downstream) | Keep mutation inside `classificationPolicyPathService.execute` before calling `buildSignalContext` |
| Legacy path detectors (Phase 3.4) | Phase 2 must complete before 3.4: detector map moves from `this.method.bind(this)` to direct service imports | Do not start 3.4 until Phase 2 services exist and are tested |
| Duplicate error handlers (Phase 3.5) | Both path services have identical 3-branch catch blocks — known duplication, not a regression | Deferred to Phase 3.6 (extract `executeAiWithFallback` to `classificationUtilsService`) |

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
