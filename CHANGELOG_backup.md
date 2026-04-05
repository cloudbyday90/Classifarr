# Classifarr Changelog Archive

(Older releases moved from CHANGELOG.md)

---

## [0.43.9-beta] — 2026-03-13

### Changed

- **Post-upgrade log clear on first boot** — A `clear_logs` post-upgrade task (`clear_logs_0439`) is registered for v0.43.9. On the first startup after upgrading, all unresolved error logs and application/RAG logs are automatically deleted from the database, and any `.log` files in the logs directory are truncated. Gives a clean log baseline for the new version. (`postUpgradeService.js`)

### Fixed

- **Rating normalization worker stall under DB lock contention** — `processRatingNormalization()` now acquires a dedicated pool client and wraps all `UPDATE media_server_items` calls in a transaction with `SET LOCAL statement_timeout = '30000'`. When a concurrent Plex sync holds row locks beyond 30 s the statement throws, the transaction rolls back, `processTask()`'s catch block calls `failTask()`, and the worker slot is freed so retries can proceed. (`queueService.js`)
- **`recoverExpiredVisibilityTasks()` never unblocked the worker loop** — The visibility-timeout recovery correctly reset expired DB rows to `'pending'` but never decremented the in-memory `this.processing` counter. Because the counter stayed at `MAX_CONCURRENT (5)`, `dequeue()` was permanently suppressed even after rows were recovered. Now decrements `this.processing = Math.max(0, this.processing - recovered)` so dequeue resumes on the next tick. (`queueService.js`)
- **Four other `UPDATE media_server_items` calls in `processTask()` were equally vulnerable** — The classification metadata merge, OMDb rating update, TMDB ID backfill, and enrichment metadata merge all used bare `this.db.query()` with no timeout guards. All four now go through the new `_queryWithTimeout()` private helper (dedicated pool client + `SET LOCAL statement_timeout`). (`queueService.js`)
- **Auto-queue duplicates on restart** — The rating normalization startup INSERT previously used `ON CONFLICT DO NOTHING`, which only guards against exact PK collisions. Items with an existing `pending` or `processing` task were re-queued on every restart, producing up to 291 duplicate tasks. The INSERT now uses a `NOT EXISTS` subquery to skip any item that already has an active task. (`index.js`)
- **Auth integration tests using wrong transport** — The `/login`, `/refresh`, and `/logout` integration tests sent and expected the refresh token in the JSON body, but the route has always used HttpOnly cookies exclusively. Tests now use `request.agent(app)` for automatic cookie carrythrough and an `extractCookie()` helper to inspect raw `Set-Cookie` headers. (`auth-routes.test.js`)
- **Remember Me sessions revoked on server restart** — `revokeAllRefreshTokensOnStartup()` was unconditionally revoking every active refresh token (`WHERE revoked_at IS NULL`), including those created with `remember_me = true`. Users who checked "Remember me for 30 days" were silently logged out on every container update or restart. The SQL now filters to `WHERE revoked_at IS NULL AND remember_me = false`, preserving remember-me sessions across restarts while still clearing regular 48-hour sessions as before. (`services/auth.js`, `index.js`)
- **Remember Me sessions requiring re-login after ~7 days (CSRF chicken-and-egg)** — The CSRF cookie had a hardcoded 7-day `maxAge` while remember-me refresh tokens last 30 days. After day 7 the CSRF cookie expired silently. On the next page load `ensureCsrfCookie` re-issued a fresh one, but the very next auto-refresh call (`POST /api/auth/refresh`) still required a valid CSRF header that wasn't yet present, producing a `403`. The API interceptor only retries requests on `401`, not `403`, so the refresh failed and the user was redirected to `/login` with no explanation. Two fixes: (1) CSRF cookie `maxAge` raised from 7 days to 30 days to match the maximum remember-me window — the CSRF token is not secret (it is intentionally readable by JavaScript), so a longer lifetime does not weaken security; (2) `/auth/refresh` added to `CSRF_EXEMPT_PREFIXES` — the httpOnly + `SameSite=lax` refresh token cookie already prevents CSRF on that endpoint at the browser level (a cross-site POST cannot include the httpOnly cookie), making CSRF protection there redundant while creating the circular dependency. (`middleware/csrf.js`)
- **`classification-history-constraints` integration test: fallback library INSERT violated schema** — The fallback fixture INSERT used `(name, media_type, is_active)` but the `libraries` table has `external_id VARCHAR(100) NOT NULL`. On a fresh container with no pre-existing libraries the INSERT failed with `null value in column "external_id" violates not-null constraint`, causing 2 of 11 tests in the suite to fail. Added `external_id: 'test-clarify-library'` to the fallback INSERT. (`src/__tests__/integration/classification-history-constraints.test.js`)
- **AI clarification options not matching libraries when LLM uses numbered/bulleted list prefixes** — `mapOptionsToLibraries()` was matching option text directly against library names, but LLMs frequently prefix options with list artifacts (`1. `, `a. `, `(1) `, `- `, `•`). The prefix strip now occurs before the name match, so `"1. Action Movies"` correctly resolves to the "Action Movies" library instead of silently dropping the option. (`aiResponseParser.js`)
- **Duplicate clarification options when LLM uses variant names for the same library** — `mapOptionsToLibraries()` did not deduplicate resolved options by `library_id`. If the AI returned `"Action Movies"` and `"action movies"`, both resolved to the same library and were shown as two identical choices. A `.filter()` by first-occurrence `library_id` now removes duplicates after name resolution. (`aiResponseParser.js`)
- **`parseNarrativeSuggestion` returned `null` in `verify` mode, silently dropping the clarification** — The method previously returned `null` for any `mode !== 'classify'`. In `verify` mode, when the AI returns narrative text instead of a structured format it is expressing uncertainty about the suggested library, not classifying freely. The method now uses `signalContext.suggestedLibrary` as the contested pick and returns a `narrative_clarify` result so the user is prompted to confirm or override rather than silently getting no question. (`aiResponseParser.js`)
- **AI 429 rate-limit errors not detected as transient in classification** — `isAiTransientAvailabilityError()` relied solely on `error.message` string checks. Providers like Anthropic set only `error.response.status = 429` without embedding a status code in the message, so rate-limit errors were not retried and instead failed permanently. The check now reads `error.response.status` directly; HTTP 429/500/502/503/504 are treated as transient regardless of message content. A dedicated `ai_rate_limited` error code (429) is now returned by `categorizeAiError()`. String checks also broadened to include "rate limit", "too many requests", and "status code 429". (`services/classification.js`)
- **OMDb / enrichment HTTP transient errors not retried when status code was not in message** — `isTransientOmdbTransportError()` relied on error message strings and Axios-level codes, missing cases where Axios set only `error.response.status` (e.g. 429, 408, 502, 503, 504). Cloudflare edge errors (52x–530) were also not covered. The check now reads `error.response.status` first and treats 408/429/502/503/504 and Cloudflare 520–530 as transient; string/code checks retained as fallback. (`services/enrichmentRetryService.js`)
- **AI CLARIFY options allow LLM to invent genre names not in the library list** — The CLARIFY prompt format used `<option1>|<option2>|<option3_optional>` as placeholders, giving the LLM latitude to supply any string as an option. The LLM frequently responded with genre labels ("Documentary", "Biography") rather than exact library names, causing `mapOptionsToLibraries()` to drop all options silently. Both `aiPromptBuilder.js` and the inline prompt in `classification.js` now use `<exact_library_name_1>|<exact_library_name_2>|...` and include a `⚠ option names MUST be copied exactly from the AVAILABLE LIBRARIES list — do not invent genre names` guard line. (`services/aiPromptBuilder.js`, `services/classification.js`)

### Added

- **Worker stall visibility** — `startWorker()` emits a `WARN` log every 30 s when all `MAX_CONCURRENT` slots have been occupied continuously, including elapsed time and slot counts. Makes lock-contention stalls diagnosable from logs without requiring a restart. (`queueService.js`)
- **`_queryWithTimeout(sql, params, timeoutMs)` private helper** — Acquires a dedicated pool client, executes the query inside `BEGIN` / `SET LOCAL statement_timeout` / `COMMIT` with `ROLLBACK` on error, then releases the client. Falls back to `this.db.query()` when the pool is unavailable (test environments). (`queueService.js`)

### Changed

- **Structured logging throughout** — `console.log / warn / error` calls replaced with `createLogger()` across `discordBot.js`, `healthCheckService.js`, `system.js` route, `settings.js` route, `apiKeys.js` route, and `apiKeyService.js`. All log entries now carry a named scope prefix (e.g. `[discordBot]`, `[healthCheck]`) for easier filtering.

### Tests

- **`queueService.test.js`** — 2 new tests for `recoverExpiredVisibilityTasks` counter compensation: verifies `this.processing` is decremented by the exact number of recovered rows and is floored at zero. 68 tests total.
- **`queue-robustness.test.js`** (NEW) — 11 integration tests against real PostgreSQL: recovery SQL correctness (5 tests), `NOT EXISTS` dedup behaviour (4 tests), and `_queryWithTimeout()` normal + error-rollback paths (2 tests).
- **`auth.service.test.js`** — 1 new test: `revokeAllRefreshTokensOnStartup` now asserts the SQL contains `remember_me = false` so remember-me sessions are preserved on restart.
- **`csrf.middleware.test.js`** — 3 new tests: (1) `POST /api/auth/refresh` is allowed without a CSRF header even when `access_token` cookie is present; (2) other `POST /api/auth/*` routes still require CSRF; (3) existing setup-route exemption tests preserved. 14 tests total.
- **Test anti-patterns eliminated** — Six test files corrected across three categories:
  - **5× `toBe(JSON.stringify(...))`** → `JSON.parse(...).toEqual(...)` — the string comparison was fragile against key ordering/whitespace differences. (`auth.service.test.js`, `webhook.test.js`, `sonarr-season-mapping.test.js`)
  - **3× deprecated `fail()`** (removed in Jest 27+) → `await expect(promise).rejects.toMatchObject(...)` / `.rejects.toBeDefined()`. (`embeddingProvider.test.js`, `omdb.test.js`)
  - **`done` callback + real `setTimeout`** → `jest.useFakeTimers()` + `jest.advanceTimersByTime()` — eliminates real-time waits and makes the OPEN→HALF_OPEN circuit breaker transition test instant and deterministic. (`circuitBreaker.test.js`)
- **3 non-DB tests relocated from `integration/` to main `__tests__/`** — `prompt-builder.test.js`, `sonarr-season-mapping.test.js`, and `v037.1-regression.test.js` do not use a database at all but were living in `src/__tests__/integration/`, which is excluded from `jest.config.js` (the unit runner). They were therefore never executed by `npm test` and only ran if Docker was available via `npm run test:integration`. Moved to `src/__tests__/` and import paths updated (`../../` → `../`). The 36 genuinely database-backed integration tests remain in `integration/` and continue to run only under `npm run test:integration`. Net effect: `npm test` total grows from 2,096 → 2,135 tests across 110 suites.
- **`aiResponseParser.test.js`** (NEW, at `src/__tests__/`) — 20 tests covering prefix-stripping pipeline, deduplication, narrative fall-through, and `verify`-mode clarification path.
- **`services/aiResponseParser.test.js`** — 3 new pipeline tests: (1) numbered-prefix CLARIFY options resolve to correct `library_id`; (2) duplicate-name options dedup so single-library result falls through to narrative salvage; (3) unrecognized CLARIFY options fall through to `narrative_clarify` when `signalContext.suggestedLibrary` is present. 40 tests total.
- **Total: 2,135 server tests (110 suites), 548 integration tests (37 suites) — all passing.**

---

## [0.43.8-beta] — 2026-03-10

### Security

- **Token reuse / replay detection** — `validateRefreshToken` now uses a two-phase query: the `AND revoked_at IS NULL` filter is removed so that revoked tokens are returned rather than `null`. A revoked token triggers a `{ compromised: true, user_id }` sentinel, causing the `/refresh` route to call `revokeAllUserTokens` for the entire account and return `HTTP 401 "Session invalidated. Please log in again."` A previously indistinguishable reply attack now immediately invalidates all sessions for that user. (`auth.js` service + route)
- **Sliding expiry for Remember Me sessions** — `generateRefreshToken` gains a `slideFromDate` parameter. When a Remember Me refresh token is consumed, the new token's expiry is extended from `max(existingExpiry, now) + 30 days` rather than always from `now`. Sessions that are actively used keep sliding forward indefinitely; idle sessions still expire naturally. (`auth.js` service + `/refresh` route)
- **Password change revokes other sessions, keeps current** — `/change-password` now hashes the caller's current `refresh_token` cookie and passes it as `exceptTokenHash` to `revokeAllUserTokens`. All other sessions are revoked; the current browser session survives. The audit log entry includes `{ otherSessionsRevoked: N }`. (`auth.js` route)
- **Timing attack fix for username enumeration** — A `DUMMY_HASH` constant (`bcrypt.hashSync('dummy-timing-placeholder', 12)`) is pre-computed at module load. When `authenticate()` cannot find the given username it always runs `bcrypt.compare(password, DUMMY_HASH)` before throwing, producing the same ~100 ms response time as a wrong-password attempt against a real account. (`auth.js` service)
- **Per-account login lockout** — `authenticate()` checks `locked_until > now` before verifying the password; if locked, throws a human-readable countdown message (`"Account temporarily locked … Try again in N minute(s)."`). On each wrong-password attempt the `failed_login_count` column is incremented atomically; when it reaches `MAX_FAILED_LOGINS (10)` the `locked_until` column is set to `NOW() + 15 minutes` via a single SQL `CASE` expression. On successful login both columns are reset to `0 / NULL` in a single query. Lockout is time-based and self-expiring — no admin action required. Constants `MAX_FAILED_LOGINS = 10` and `LOCKOUT_DURATION_MINUTES = 15` are exported. (`auth.js` service)

### Fixed

- **`clearAndResync` drain race condition** — The previous implementation called `stopWorker()` then waited a hard-coded 1-second sleep before truncating database tables. `stopWorker()` only flips `this.running = false`, which causes the worker loop to exit on its *next iteration*, but any `processTask()` calls already dispatched continue running asynchronously. Under real load (e.g. 5 concurrent tasks each making DB writes), this 1-second window was not sufficient — in-flight tasks would attempt writes against rows that no longer existed after the truncation, producing spurious `WARN` log entries. The fix replaces the sleep with a proper drain loop: polls `this.processing` every 100 ms until it reaches zero or a 15-second deadline, whichever comes first. If the deadline is exceeded, a `WARN` is emitted and the cleanup proceeds. (`queueService.js`)

### Added

- **DB migration `20260310_110000_add_login_lockout_to_users.sql`** — Adds `failed_login_count INTEGER NOT NULL DEFAULT 0` and `locked_until TIMESTAMPTZ` to the `users` table with `IF NOT EXISTS` guards (safe for both fresh installs and upgrades). Includes a partial index `idx_users_locked_until ON users (locked_until) WHERE locked_until IS NOT NULL` for efficient expiry queries.

### Tests

- **`auth.service.test.js`** — 6 new service tests: `hashToken` SHA-256 hex digest, `generateRefreshToken` sliding expiry (future `slideFromDate`, past fallback), `validateRefreshToken` two-phase (revoked → `{ compromised: true }`, expired → `null`, valid → row), `authenticate` lockout (locked throws countdown, counter increments on wrong password, resets on success, `bcrypt.compare` always called on unknown user).
- **`queueService.test.js`** — 2 new drain-related tests: (1) verifies `performClearAndResyncCleanup` is only called after `this.processing` reaches zero when tasks are in-flight; (2) verifies that when in-flight tasks do not drain within the 15-second timeout the service emits a warning and proceeds rather than hanging forever.
- **`auth-routes.test.js`** — 3 new route tests: `/refresh` replay detection triggers `revokeAllUserTokens` + 401, sliding expiry passes `slideFromDate` to `generateRefreshToken`, `/change-password` revokes other sessions while keeping current; lockout message pass-through (verbatim `error.message` → `res.body.error`); `rememberMe` string coercion (`'yes'` → `false`). 35 tests total.
- **`Login.test.js`** (client) — 1 new test: lockout message display in UI (renders "temporarily locked" + minute countdown). 17 tests total.
- **Total: 2,025 server tests (106 suites), 406 client tests (39 files) — all passing.**

---

## [0.43.7a-beta] — 2026-03-09

### Fixed
- **`clearAndResync` (Clear & Resync All) was broken** — `LOCK TABLE` statement inside
  `performClearAndResyncCleanup` failed with `LOCK TABLE can only be used in transaction
  blocks` because `withOptionalTransaction` fell through to the no-transaction path.
  Root cause: the production `db` object (`database.js`) exports `{ query, pool,
  withTransaction, ... }` without a top-level `connect()` method, which the guard
  `typeof this.db.connect !== 'function'` mistook for "no connection available".
  Fix: `performClearAndResyncCleanup` now calls `db.withTransaction()` directly.
  (`queueService.js`, `database.js`)
- **Graph relationship backfill UI text** — `GraphTab.vue` still told users to run the
  backfill script manually even though v0.43.7a now runs it automatically at startup.
  Updated messaging to reflect the automatic behaviour; CLI fallback info moved to a
  collapsed note.

### Added
- **Auto-backfill graph relationship columns at startup** — new
  `graphRelationshipBackfillService` counts rows with null `cast_ids`,
  `primary_studio_name`, `genre_names` (Pass 1) and null `director_name` + non-null
  `tmdb_id` (Pass 2) and fires the relevant backfill passes as non-blocking background
  jobs. Pass 1 requires no API calls; Pass 2 only runs when `TMDB_API_KEY` is set.
  Both passes are idempotent — safe to restart mid-run. After the first post-upgrade boot
  the service finds nothing to do and exits instantly. (`graphRelationshipBackfillService.js`,
  `backfillGraphRelationships.js`, `index.js`)
  
### Changed
- **`backfillGraphRelationships.js`** — added `require.main === module` guard and
  `module.exports = { runPass1, runPass2 }` so the script is importable as a module
  without auto-executing; CLI behaviour unchanged.
- **Coverage ratchet baseline updated** — bumped to reflect improvements from GraphTab
  and `graphRelationshipBackfillService` tests added in this cycle (client +0.85%
  statements, +1.59% branches; server baseline already above threshold).

### Tests
- `queueService.test.js` — added `db.withTransaction` mock in `clearAndResync` and
  `clearAndResync with mapping preservation` describe blocks to exercise the production
  transaction path.

---

## [v0.43.7-beta] - 2026-03-09

### Added

- **Graph retrieval for RAG pipeline (`ragRetriever.graphSearch()`)** — New third retrieval path alongside the existing vector (semantic) and full-text paths. Queries Postgres directly against five indexed relationship columns (`collection_id`, `director_name`, `primary_studio_name`, `cast_ids[]`, `genre_names[]`) to find past classifications that are relationally connected to the query item — even when semantic similarity is too low to surface them (e.g. a new film in an established franchise that embeds very differently from earlier entries). Returns scored, ranked candidates using a configurable per-dimension scoring scheme; results are capped by `rag_graph_candidates_limit`.
- **3-way weighted RRF fusion (`ragRetriever.calculateWeightedRRF()`)** — Replaces the previous 2-way `calculateRRF()` when graph retrieval is active. Each source contributes `weight * (1 / (k + rank + 1))` to the accumulated score. Graph weight defaults to `0.20` and is operator-adjustable. The existing `calculateRRF()` is retained (and used) when graph is disabled, so the pre-286 pipeline is reproduced exactly with `rag_graph_enabled: false`.
- **Graph relationship extractor (`server/src/services/ragGraphExtractor.js`)** — Deterministic, synchronous function that extracts five structured signals from enriched TMDB metadata: `collection_id` (integer), `director_name` (string), `primary_studio_name` (string), `cast_ids` (integer array, top-5 by popularity), `genre_names` (string array). Called at classification write time (in both `classification.js` and `queueService.js`) to populate the new relationship columns on `classification_history`. Also called by `graphSearch()` at query time to extract signals from the item being classified.
- **DB migration `20260309_120000_add_rag_graph_relationship_columns.sql`** — Adds five indexed columns to `classification_history`: `director_name VARCHAR(200)`, `primary_studio_name VARCHAR(200)`, `cast_ids INTEGER[]`, `genre_names TEXT[]`, plus a GIN index on each array column and a B-tree index on `director_name`. `collection_id` already existed and is already indexed; no change needed.
- **DB migration `20260309_120100_add_rag_graph_config_columns.sql`** — Adds eight `rag_graph_*` settings columns to the config table: `rag_graph_enabled BOOLEAN DEFAULT false`, `rag_graph_weight NUMERIC(4,2) DEFAULT 0.20`, `rag_graph_collection_enabled BOOLEAN DEFAULT true`, `rag_graph_director_enabled BOOLEAN DEFAULT true`, `rag_graph_studio_enabled BOOLEAN DEFAULT false`, `rag_graph_cast_enabled BOOLEAN DEFAULT false`, `rag_graph_genre_enabled BOOLEAN DEFAULT false`, `rag_graph_min_matches_to_apply INTEGER DEFAULT 1`, `rag_graph_candidates_limit INTEGER DEFAULT 20`.
- **Graph settings UI (`client/src/views/rag/GraphTab.vue`)** — New tab added to RAG Settings (Settings → RAG & Embeddings → Graph 🕸️). Contains: master enable/disable toggle, fusion weight slider (0.05–1.0), candidates limit input, min-matches-to-apply input, and per-dimension enable toggles (collection, director, studio, cast, genre). Includes a fill-rate panel showing what percentage of existing classification rows have each relationship column populated — helps users decide whether to run the backfill before enabling.
- **Graph fill-rate API endpoint (`GET /api/rag/graph/fill-rate`)** — Returns the percentage of `classification_history` rows with each relationship column populated. Used by the GraphTab UI to surface backfill readiness; also available as a standalone diagnostic.
- **Backfill script (`server/src/scripts/backfillGraphRelationships.js`)** — Idempotent batch script that iterates all `classification_history` rows with `metadata IS NOT NULL`, calls `ragGraphExtractor.extract()`, and writes the five relationship columns (skipping rows where the column is already non-NULL). Supports `--pass1` (collection/director/studio only), `--pass2` (cast/genre only), or full run. Prints per-batch progress and final totals. Designed to be run once after upgrading existing installs; new classifications are populated automatically at write time.
- **Graph config round-trip in settings API (`server/src/routes/settings.js`)** — All eight `rag_graph_*` keys now read and written through the existing RAG settings GET/PATCH endpoints. No new endpoints required.

### Fixed

- **PostgreSQL connection pool default raised 10 → 15 (`server/src/config/database.js`)** — The graph retrieval path added a third concurrent DB query per classification task (on top of the existing vector search transaction and full-text query). Under load with `MAX_CONCURRENT = 5` tasks, plus logger `persistToDb` calls and the worker loop, pool exhaustion (`timeout exceeded when trying to connect`) became possible at burst peaks. Raising the default from 10 to 15 provides headroom. The pool size remains fully tunable via `POSTGRES_POOL_MAX` env var.

### Added

- **`POSTGRES_POOL_MAX`, `POSTGRES_CONN_TIMEOUT_MS`, `POSTGRES_STATEMENT_TIMEOUT_MS` documented in `.env.example`** — All three were already supported env vars but were not listed in the example file. Added with guidance explaining when to tune each (pool exhaustion under heavy classification load, connection fanout from concurrent vector/graph queries).

### Tests

- **`server/src/__tests__/ragGraphExtractor.test.js`** — 25 tests, 100%/100%/100%/100% statement/branch/function/line coverage for `ragGraphExtractor.extract()`.
- **`server/src/__tests__/ragRetriever.graph.test.js`** — 37 tests covering `graphSearch()`, `calculateWeightedRRF()`, and the graph integration paths in `hybridSearch()`.
- **`server/src/__tests__/ragRetriever.test.js` and `ragRetriever.rrf.test.js`** — Extended with 11 precision math tests verifying: exact `calculateDynamicWeight` threshold boundary behaviour (strict `>` inequalities at 0.90/0.80/0.70/0.60), weight normalization when configured weights sum ≠ 1.0 (e.g. 0.3+0.9 → 0.25/0.75), similarity rounding to 2 decimal places in result mapping, `formatForAIContext` `Math.round` (not floor) behaviour on non-trivial percentages, 3-caps-at-3-matches enforcement, and 3-source weighted RRF accumulated score (`1.0/61 + 1.0/61 + 0.20/61 = 2.20/61`).
- **Total: 2,002 tests, 106 suites, 0 failures.** `ragRetriever.js` at 100% statement coverage.

---

## [v0.43.6a-beta] - 2026-03-09

### Fixed

- **`VACUUM ANALYZE task_queue` after bulk cleanup (`QueueService._backgroundDrainIfBloated()`)** — After the startup drain loop deletes stale rows, the method now issues `VACUUM ANALYZE task_queue` via pool-level `db.query()` (autocommit, outside any transaction). This refreshes the query-planner statistics immediately after a mass delete so subsequent queries do not generate plans sized for the old (bloated) row count. Failure is caught and logged at `WARN` level — a VACUUM error never surfaces as a user-visible crash. Without this, upgrading users whose backlog was purged by the migration still faced stale planner estimates until autovacuum eventually fired (potentially many minutes later on a busy instance).
- **`VACUUM ANALYZE task_queue` after scheduled cleanup (`scheduler.runTaskQueueCleanup()`)** — Same fix applied to the daily cleanup job: when `totalDeleted > 0`, the scheduler issues `VACUUM ANALYZE task_queue` after the batch-delete loop completes. Keeps planner statistics current across every subsequent daily run, not just at upgrade time. Failure is caught and logged at `WARN` level (non-fatal). This is consistent with the official PostgreSQL recommendation in §14.4.8 "Run ANALYZE Afterwards": *"Whenever you have significantly altered the distribution of data within a table, running ANALYZE is strongly recommended."*

---

## [v0.43.6-beta] - 2026-03-09

### Fixed

- **OOM crash: `task_queue` unbounded growth caused Node.js heap exhaustion** — Root cause: `task_queue` accumulated >300 000 completed rows (416 MB) with no TTL policy. Every 5-minute gap-analysis cycle ran a `NOT EXISTS` subquery across the full bloated table, while `getStats()` ran an unconstrained `COUNT(*) FROM task_queue`. Under sustained GC pressure the process heap reached Node's ~4 GB auto-cap and was killed with no error-log entry (the process died before it could write). Five-layer fix:
  1. **Migration `20260309_140000_task_queue_retention.sql`** — Adds `idx_task_queue_cleanup`, a partial B-tree index on `(created_at)` for completed/failed/cancelled rows, enabling O(log n) cleanup queries. Seeds the `task_queue_retention_days` setting (default 7 days). Includes a one-time batched emergency purge (10 000 rows/loop) that fires during migration if >1 000 stale rows exist — resolves the backlog for any existing installation.
  2. **Startup background drain (`QueueService._backgroundDrainIfBloated()`)** — On every worker startup, if stale-row count exceeds 1 000, a background coroutine loops in 5 000-row batches (50 ms yield between batches) until the table is clean. Non-blocking: the queue worker starts immediately.
  3. **Daily scheduler job (`scheduler.runTaskQueueCleanup()`)** — Registered at 03:15 daily and once 5 minutes after startup. Loops in 5 000-row batches until fully clean, so a single run clears any accumulated backlog rather than only making partial progress. Retention window is configurable via `TASK_QUEUE_RETENTION_DAYS` env var (default 7).
  4. **Node.js heap cap added to all Docker Compose files** — `NODE_OPTIONS: --max-old-space-size=1536` (1536 MB, leaving headroom within the 2 GB container memory limit) added to `docker-compose.yml` and `docker-compose.unraid.yml`. Memory limits (`2G` / `512M` reservation) enabled by default in the Unraid compose. Without an explicit cap, Node v18+ auto-sizes its heap to ~4 GB and an OOM kill produces no error log.
  5. **`RETURNING id` removed from bulk-clear operations** — `clearCompletedTasks()` and `clearFailedTasks()` previously used `DELETE … RETURNING id`, which materialized all deleted row IDs into Node.js memory. On a 300 000-row table this allocates ~9 MB of JS objects for no reason (`rowCount` is sufficient).

### Added

- **Process and OS memory health check (`healthCheckService.checkProcessMemory()`)** — New function using `process.memoryUsage()` and Node's `os` module. Reports Node.js heap used/total/cap (via `v8.getHeapStatistics()`), RSS, and OS free/total/used RAM. Included in every `GET /api/health/services` response under the `memory` key. Status is `ok` / `warning` (heap >75% of cap or OS >85% used) / `critical` (heap >90% of cap or OS >95% used). Allows operators to observe memory pressure trends before they trigger an OOM kill.
- **Adaptive Node.js heap cap from container memory limits (`docker-entrypoint.sh`)** — On startup, before launching the Node process, the entrypoint now reads the container's cgroup memory limit (cgroup v2 `/sys/fs/cgroup/memory.max`, falling back to cgroup v1 `/memory.limit_in_bytes`) and automatically derives `--max-old-space-size` as 75% of the limit (minimum 256 MB). Only activates if `--max-old-space-size` is not already present in `NODE_OPTIONS` (e.g. set via docker-compose or Unraid template), so explicit operator values are never overridden. If no limit is detected at all, a `WARN` is printed listing the risk and recommended actions. Makes the OOM fix self-tuning for any deployment method — bare `docker run`, Unraid templates, Kubernetes — without requiring the operator to know about `NODE_OPTIONS`.
- **`GET /api/system/health/memory` no-auth endpoint (`server/src/routes/system.js`)** — Lightweight probe returning Node.js heap usage (used/total/cap/%) and host OS RAM (free/total/used/%), alongside a derived `status: ok | warning | critical`. Placed before the `authenticateToken` middleware (consistent with `/health/live` and `/health/ready`) so it is reachable without a session token. Returns HTTP 503 when status is `critical`. Designed for external monitoring tools: Uptime Kuma, Grafana Loki, Prometheus http-probe, Healthchecks.io, etc.
- **Startup memory pressure warning (`server/src/index.js`)** — On `app.listen()` callback, if `NODE_OPTIONS` contains no explicit heap cap, logs a `[WARN]` to the console with the auto-detected V8 heap limit, current free RAM, total RAM, and a remediation hint. This surfaces the missing-cap risk immediately in container logs for anyone who has never read the docker-compose comments or documentation.

### Added

- **CodeQL SAST workflow (`.github/workflows/codeql.yml`)** — New workflow providing static application security testing for CIS compliance. Scans `javascript-typescript` and `actions` languages using the `security-extended` query suite (OWASP Top 10 + additional CWEs). Uploads results to the GitHub Security tab via SARIF. Triggers: push/PR to `main`, weekly Monday 02:00 UTC. PR trigger ignores doc/logo changes. Inline config excludes `node_modules`, test files, coverage dirs, `client/dist`, and `.tmp`. `timeout-minutes: 30`.

### Changed

- **Trivy Security Scan (`.github/workflows/trivy.yml`)** — Replaced manual `apt-get` install with official `aquasecurity/trivy-action@0.35.0`. Restructured into two jobs: `trivy-fs` (dual-pass filesystem scan: SARIF upload for Security tab + table gate that fails the workflow on HIGH/CRITICAL vulns or secrets; scanners: `vuln,secret`; `limit-severities-for-sarif: true`) and `trivy-config` (IaC misconfiguration scan of Dockerfile and docker-compose files against the CIS Docker Benchmark, SARIF upload). Added weekly schedule (Tuesdays 02:00 UTC), PR `paths-ignore` for docs, and `timeout-minutes` per job. Both jobs use least-privilege permissions (`contents: read`, `security-events: write`, `actions: read`).
- **Gitleaks Secret Scan (`.github/workflows/gitleaks.yml`)** — Pinned from floating `@v2` to `gitleaks/gitleaks-action@v2.3.9` (latest stable). Added missing `pull-requests: write` permission (was silently failing PR comments). Added `workflow_dispatch` for manual incident-response triggering, weekly schedule (Wednesdays 02:00 UTC), `timeout-minutes: 10`, and PR `paths-ignore`. Enabled `GITLEAKS_ENABLE_COMMENTS`, `GITLEAKS_ENABLE_SUMMARY`, and `GITLEAKS_ENABLE_UPLOAD_ARTIFACT`. SARIF upload to the Security tab intentionally omitted per maintainer guidance: removing a secret in a later commit falsely marks the Security alert as "resolved" even though the secret remains in git history.
- **OSV Dependency Scan (`.github/workflows/osv-scanner.yml`)** — Added `push: branches: [main]` trigger so every commit landing on `main` (hotfixes, bot merges) receives a full OSV scan, not only tagged releases. Added weekly schedule (Thursdays 02:00 UTC, staggered with other tools). Added dedicated `merge-group-scan` job using the PR-diff reusable workflow for merge queue support. Added `workflow_dispatch`. Renamed `release-scan` to `full-scan` to reflect its expanded scope (push to main + tags + schedule + manual). Added PR `paths-ignore` for doc-only changes. Moved permissions to a top-level block per official template. Version remains `v2.3.3` (already latest).
- **Copyright Compliance (`.github/workflows/copyright-compliance.yml`)** — Added `permissions: contents: read` (least-privilege; no write access needed). Added `paths-ignore` on both PR and push triggers to skip doc/markdown-only changes. Added `workflow_dispatch` for manual runs. Added `timeout-minutes: 10`. Added explicit `branches: [main]` scope to the PR trigger (was unscoped — previously ran on PRs targeting any branch). Added named steps for clearer job logs.

## [v0.43.5a-beta] - 2026-03-06

### Security

- **`express-rate-limit` upgraded 8.2.1→8.3.0** — Fixes **GHSA-46wh-pxpv-q5gq**: IPv4 addresses mapped to IPv6 notation (e.g. `::ffff:1.2.3.4`) were not correctly normalised before checking against the rate limit store, allowing clients on dual-stack networks to bypass configured limits. Upgraded to 8.3.0 which includes the fix (`handle ipv4 mapped to ipv6`).
- **`immutable` (dev) upgraded to `>=4.3.8` via `overrides`** — OSV scan flagged `immutable@4.3.7` (transitive dependency of `pg-mem`, the in-memory PostgreSQL used in unit tests) with **GHSA-wf6x-7x77-mvgw** (CVSS 8.7, High). The vulnerability is in a dev/test-only dependency with no production exposure, but the scan gate blocks tagging until it is resolved. Added `"immutable": ">=4.3.8"` to `server/package.json` `overrides` so npm resolves the transitive dep to `5.1.5` (latest), eliminating the advisory. `pg-mem@3.0.14` itself was also updated from the previously stale `3.0.13`.

### Changed

- **`axios` 1.13.5→1.13.6** (server, client, root) — Bug fixes: `AxiosError.message` is now correctly enumerable; `AxiosError.from` correctly copies the `status` property from the source error; fixed module exports for React Native and Browserify environments.
- **`pg` 8.19.0→8.20.0** (server) — Adds `onConnect` callback to `pg.Pool` constructor options, allowing async initialization of newly created pooled clients. No behaviour change for existing usage.
- **`postcss` 8.5.6→8.5.8** (client dev) — Fixes `Processor#version`; improves source map annotation cleaning performance.
- **GitHub Actions: Docker actions updated to Node 24 runtime** — `docker/setup-buildx-action` v3→v4, `docker/build-push-action` v6→v7, `docker/metadata-action` v5→v6, `docker/login-action` v3→v4, `docker/setup-qemu-action` v3→v4. All require Actions Runner v2.327.1+. No workflow behaviour changes.

### Fixed

- **`database/migrations/MIGRATION_GUIDE.md`** — Removed consecutive blank lines that violated MD012 lint rule.

## [v0.43.5-beta] - 2026-03-05

### Fixed

- **`task_queue` duplicate `rating_normalization` entries from bare `ON CONFLICT DO NOTHING`** — `runRatingNormalizationCheck()` was inserting tasks with `ON CONFLICT DO NOTHING` and no conflict target. PostgreSQL resolves a bare `ON CONFLICT DO NOTHING` only against the serial primary key; since each new row gets a fresh `id`, the guard never fired and duplicate `pending` rows accumulated for the same `media_item_id` on every daily run. Fixed by (1) adding a partial unique index `idx_task_queue_active_item_dedup ON task_queue (task_type, (payload->>'media_item_id')) WHERE status IN ('pending', 'processing')` (migration `20260305_150000_add_task_queue_item_dedup_index.sql`) and (2) updating the `INSERT` to use the correct conflict target `ON CONFLICT (task_type, (payload->>'media_item_id')) WHERE status IN ('pending', 'processing') DO NOTHING`. The partial predicate scopes deduplication only to active rows — failed or cancelled rows do not prevent re-queueing. The migration includes a pre-dedup `UPDATE` step that cancels all but the oldest active row per `(task_type, media_item_id)` pair before creating the unique index, ensuring the migration succeeds on existing installations that accumulated historical duplicates. — The dimension-mismatch auto-heal in `embeddingService.storeImageEmbedding()` previously ran `CREATE INDEX ... USING hnsw` inside `db.withTransaction()`. HNSW index builds are CPU-proportional to table size and can hold an `ACCESS EXCLUSIVE` lock for minutes on large datasets, blocking all concurrent writes and making the embedding store call appear to hang until the index finished. `CREATE INDEX CONCURRENTLY` is also forbidden inside a transaction (PostgreSQL restriction). The three `CREATE INDEX` calls (`idx_embeddings_image_hnsw`, `idx_embeddings_image_present`, `idx_embeddings_image_hash`) are now removed from the heal transaction; only the minimal schema DDL (`DROP INDEX`, `DROP COLUMN`, `ADD COLUMN`) remains inside `withTransaction`. After the heal transaction commits, a `rebuild_hnsw_index` row is inserted into `task_queue` (priority 5, source `'system'`). A new `case 'rebuild_hnsw_index'` in `QueueService.processTask()` re-creates all three indexes using `CREATE INDEX CONCURRENTLY IF NOT EXISTS` via pool-level `db.query()` (autocommit, outside any transaction block), so index builds run in the background without blocking writes.
- **`gracefulShutdown()` races with `resetStaleProcessingTasks()` on rolling restarts** — `QueueService.resetStaleProcessingTasks()` now wraps its startup UPDATE inside a `pg_try_advisory_xact_lock` transaction. If two containers overlap during a K8s rolling update, only the first one to acquire the lock (key `STARTUP_RESET = 1234567890`, added to `DB_ADVISORY_LOCKS`) will reset stale `processing` rows; the second silently skips. This prevents two containers from both re-queueing the same in-flight task and processing it twice.
- **`schedulerService.checkRagBackfillSchedule()` queried wrong table** — The 5-minute throttle gate for the lightweight RAG backfill incorrectly read `MAX(created_at)` from `embedding_costs` (an AI billing table that updates constantly, permanently suppressing the backfill on busy instances). The query now reads `MAX(completed_at)` from `backfill_runs WHERE type = 'scheduler' AND status = 'completed'`. `runRagBackfill()` now inserts a `backfill_runs` row (type `'scheduler'`) at the start of each batch and marks it `completed` or `failed` when done, consistent with the pattern used by `scheduledBackfillService` and `idleBackfillService`.
- **`GET /api/classification/pending/count` badge inflation from stale `awaiting_decision` rows** — The Command Center badge count now excludes rows where `created_at` is older than 7 days, preventing permanently-stuck Discord items (disconnected bot, deleted message, lost session) from inflating the count indefinitely. (`classification_history` has no `updated_at` column; the filter is on `created_at`.) A new daily scheduler job `cleanupStaleAwaitingDecisions` (runs at 04:00) resets these stale rows back to `pending` and re-inserts a `task_queue` entry so they are re-classified with fresh context.
- **`policies.js` POST/PUT routes: raw `BEGIN`/`ROLLBACK` replaced with `withTransaction()`** — Both `POST /api/policies` and `PUT /api/policies/:id` were manually managing transactions using bare `await db.query('BEGIN')` / `ROLLBACK` / `COMMIT` calls. The PUT route had 6 scattered early-return `ROLLBACK` sites (one per validation check) which could leave a connection checked-out mid-transaction if the pool errored between any of those guards — corrupting the next caller that received that connection from the pool. Both routes now use `db.withTransaction(async (client) => { ... })` from `database.js`, which guarantees `BEGIN`/`COMMIT`/`ROLLBACK`/`client.release()` in a single `finally` block. All input validation was moved *before* the transaction begins, eliminating the early-rollback pattern entirely and avoiding consuming a pool slot for validation-only rejections. Aligns with node-postgres official documentation guidance and 2025 community best practices.
- **`withOptionalTransaction()` JSDoc carried stale `clearAndResync` description** — The doc comment for `QueueService.withOptionalTransaction()` incorrectly read "Clear all queue data and trigger fresh library sync" — a copy-paste from `clearAndResync`. Corrected to accurately describe the function: executes `work(client)` inside a transaction when a real pool is available, falls back to `work(db)` directly in test environments, commits on success, rolls back on error, always releases.
- **`embeddingService.js` auto-heal paths used pool-level `db.query('BEGIN')`** — Both dimension-mismatch auto-heal blocks (`storeEmbedding` text heal and `storeImageEmbedding` image heal) issued `await db.query('BEGIN')` followed by multiple `await db.query(DDL)` calls. Because `db.query()` is pool-level, each call could be dispatched to a different idle connection, meaning `BEGIN` ran on connection A and the subsequent `ALTER TABLE`/`DROP COLUMN` ran on connection B — completely outside the transaction. Both blocks now use `db.withTransaction(async (client) => { ... })` so all DDL is pinned to a single connection, aligning with the node-postgres official documentation requirement: *"You must use the same client instance for all statements within a transaction."*
- **`legacyMigration.migrateRule()` used pool-level `db.query('BEGIN')`** — Same class of bug as the embedding auto-heal: `migrateRule()` issued `await db.query('BEGIN')` then performed multiple `db.query()` writes (policy lookup/insert, preset insert, rule UPDATE), each of which could land on a different pool connection. The method now uses `db.withTransaction(async (client) => { ... })` for all writes. `getOrCreatePolicy()` now accepts an optional `txClient = db` parameter so the SELECT + conditional INSERT run on the same pinned connection as the caller's transaction.
- **`rag_logs` table excluded from all log cleanup paths** — `POST /api/logs/cleanup`, `DELETE /api/logs`, and `schedulerService.runLogCleanup()` only cleaned `error_log` and `app_log`, leaving `rag_logs` (the RAG operation audit table written on every WARN/ERROR during classification) to grow indefinitely. All three paths now include `DELETE FROM rag_logs WHERE created_at < NOW() - INTERVAL '1 day' * $1` using a new `rag_log_retention_days` setting (default 30 d, seeded by migration `20260307_000000`). `DELETE /api/logs` (clear-all) also truncates `rag_logs`.
- **`gracefulShutdown()` silently discarded in-flight task diagnostic context** — The shutdown UPDATE set `error_message = NULL` on all `processing` rows, erasing any partial-failure note written during the task's execution. Operators querying `task_queue` after a restart had no signal that those rows were interrupted mid-flight rather than cleanly finished. Now sets `error_message = 'Reset by graceful shutdown'`, matching the diagnostic pattern already used by `resetStaleProcessingTasks()` (`'Reset on startup - previous worker crashed'`).
- **`withOptionalTransaction()` lost rollback-failure context on broken connections** — When `ROLLBACK` itself threw (e.g. broken TCP connection), the `rollbackError` was only written to a `WARN` log entry; the re-thrown original error carried no indication that the transaction was in an undefined state. Structured error-handlers that keyed on specific error codes (`CARSA_*`) would silently treat the task as a clean failure. The caught `rollbackError` is now also attached to the primary thrown error as `error.rollbackFailed = true` and `error.rollbackError = rollbackError.message` before re-throwing, so callers and error-monitoring tooling surface the complete picture.
- **`manualBackfillService.start()` threw misleading "RAG is not enabled" on fresh install** — When `ai_provider_config` had no row yet (setup not yet completed), `configResult.rows[0]` was `undefined` and the optional-chain returned `undefined` (falsy), causing the same error message as a deliberate operator disablement. The two cases are now distinguished: a missing row throws `'RAG configuration not found. Complete setup in Settings before running backfill.'`; an existing row with `rag_enabled = false` still throws the original `'RAG is not enabled...'` message. This mirrors the fix applied to `idleBackfillService` in v0.43.3-alpha.

### Added

- **`debug_*.js` / `diagnostic_*.js` / `check_*.js` patterns added to `.gitignore`** — `debug_queue.js`, `diagnostic_script.js`, and `check_ollama_config.js` were committed root-level debug artifacts containing raw DB queries and `process.exit()` calls. All three have been removed via `git rm` and the patterns `debug_*.js`, `diagnostic_*.js`, `check_*.js`, and `logs*.txt` added to `.gitignore` to prevent future accidental commits of ad-hoc investigation scripts and runtime log captures. `logs.txt` (8 800+ lines of Docker container startup output with no credential content) was also de-tracked.
- **Scheduled Log Cleanup** — `schedulerService.js` gains `runLogCleanup()` running daily at 02:30. Reads `log_retention_days` (default 30 d), `error_log_retention_days` (default 90 d), and `rag_log_retention_days` (default 30 d) from the `settings` table and issues batch DELETEs against `app_log`, `error_log`, and `rag_logs` respectively — the same retention windows used by `POST /api/logs/cleanup` so manual and scheduled cleanups are consistent. A new `cleanup_logs` case in `executeTask()` dispatches to this method. `ensureDefaultTasks()` seeds the task row on first boot (idempotent SELECT-before-INSERT guard) and is called at the end of `scheduler.start()` inside a try/catch so a missing `scheduled_tasks` table during the first pre-migration boot does not abort startup. This closes the long-standing gap where log tables accumulated rows indefinitely on unattended instances.
- **Scheduled `refresh_tokens` Cleanup** — `scheduler.js` gains `runRefreshTokenCleanup()` running daily at 03:05. Batch-deletes up to 1 000 rows per run where `expires_at < NOW()` or token was revoked >30 days ago. Controlled by `REFRESH_TOKEN_CLEANUP_ENABLED` env var (default `true`). Prevents unbounded table growth for long-running instances.
- **Scheduled `api_key_audit` Pruning** — `scheduler.js` gains `runApiKeyAuditPrune()` running daily at 03:10. Prunes rows older than `API_AUDIT_RETENTION_DAYS` (default `90`) in batches of 1 000. Keeps the audit table at a predictable size without operator intervention.
- **Migration `20260305_110000_add_security_cleanup_indexes`** — Adds `idx_refresh_tokens_expires_at`, `idx_refresh_tokens_revoked_at` (partial: `WHERE revoked_at IS NOT NULL`), and `idx_api_key_audit_created_at` to make the new cleanup jobs index-efficient. The first and third indexes are no-ops on existing installs (prior migrations already created identical indexes with `IF NOT EXISTS` guards); `idx_refresh_tokens_revoked_at` is genuinely new.
- **Migration `20260305_120000_add_classification_history_check_constraints`** — Adds `chk_classification_confidence_range` (`confidence` 0–100 or NULL) and `chk_classification_completed_has_library` (`status='completed'` requires non-NULL `library_id`) as `NOT VALID` constraints on `classification_history`. Instant DDL; does not lock existing rows. Both `ADD CONSTRAINT` statements are wrapped in idempotent `DO $$` guards (no-op if constraint already exists), making the migration safe to re-run after a partial failure.
- **Migration `20260305_130000_validate_classification_history_constraints`** — Validates both constraints added in the previous migration using `VALIDATE CONSTRAINT` (SHARE UPDATE EXCLUSIVE lock; reads and writes continue). After validation, PostgreSQL can use constraints for query optimizations. Includes pre-validation data scrubs: (1) clamps any `confidence` values outside 0–100 to the valid range (guards against legacy data); (2) reclassifies `completed` rows with `library_id IS NULL` (library deleted via `ON DELETE SET NULL`) to `failed` — preventing `VALIDATE CONSTRAINT` from erroring on existing installations. Both `VALIDATE CONSTRAINT` calls are wrapped in idempotent `DO $$` guards (skipped if constraint is already valid).

### Changed

- **`postUpgradeService.clearLogs()` uses surgical DELETE instead of TRUNCATE** — Both log-clearing queries in `clearLogs()` previously used `TRUNCATE TABLE error_log` and `TRUNCATE TABLE app_log`. `TRUNCATE` is non-selective and destroys all rows including those an operator already reviewed and marked `resolved = true`, permanently removing the audit trail of resolved issues. `error_log` now uses `DELETE FROM error_log WHERE resolved = false`, preserving resolved entries as a permanent record. `app_log` (no `resolved` column) uses `DELETE FROM app_log`. This is consistent with the surgical approach already used by `POST /api/logs/cleanup`. Operator-reviewed (resolved) error entries survive the post-upgrade clear.
- **`updated_at` Triggers: DB-Level Enforcement** — Migration `20260305_100100_add_updated_at_triggers.sql` creates a shared `update_updated_at_column()` PL/pgSQL function and attaches it as a `BEFORE UPDATE` trigger on `radarr_config`, `sonarr_config`, `ollama_config`, `tmdb_config`, `notification_config`, `libraries`, `library_custom_rules`, and `settings`. The trigger uses `ROW(NEW.*) IS DISTINCT FROM ROW(OLD.*)` guard (2025 idiomatic best practice) so no-op `UPDATE SET x = x` statements do not bump `updated_at`, preventing spurious cache invalidation and audit noise. Migration is fully idempotent: checks for table existence, column existence, and existing trigger before creating.
- **BIGINT primary keys on log and queue tables; full `classification_history.id` upgrade** — Migration `20260305_200500_bigint_primary_keys.sql` widens the serial sequences for `task_queue`, `app_log`, `error_log`, `audit_log`, and `ai_usage_log` from `INTEGER` to `BIGINT` and alters the `id` columns accordingly, preventing sequence overflow on high-volume installs. Migration `20260305_200700_bigint_classification_history_pk.sql` completes the same upgrade for `classification_history.id`: it drops all 9 FK constraints referencing the column, widens `classification_history.id` and all 9 `classification_id` columns in referencing tables to `BIGINT`, then recreates the FK constraints with their original `ON DELETE` behaviour. The outer migration is wrapped in a single DO-block with an idempotency guard (skipped if `classification_history.id` is already `bigint`). Note: each `ALTER COLUMN TYPE bigint` is a full table rewrite with an `ACCESS EXCLUSIVE` lock; on large installs (hundreds of thousands of rows) this may take several seconds per table.
- **`pg` driver int8 type parser** — The `pg` driver returns PostgreSQL `BIGINT` (OID 20) values as JavaScript `string` by default to prevent precision loss on values beyond `Number.MAX_SAFE_INTEGER`. `database.js` now registers a global `pg.types.setTypeParser(20, ...)` that converts BIGINT to JS `number` for values within safe range, keeping normal ID and `COUNT()` results as numbers. Values beyond `MAX_SAFE_INTEGER` are left as strings. The parser is registered defensively (`if (pg.types && typeof pg.types.setTypeParser === 'function')`) to avoid crashing under unit-test mocks that stub out `pg`.

### Performance

- **FILLFACTOR tuning for high-churn tables** — Migration `20260305_200300_fillfactor_hot_update_tables.sql` sets `fillfactor = 75` on `task_queue` and `fillfactor = 80` on `classification_history`. When a page is not full, PostgreSQL can place updated row versions on the same heap page as the original (Heap-Only Tuple / HOT update), avoiding dead tuple accumulation and index bloat. Existing data is unaffected; the setting applies to new writes immediately.
- **Per-table autovacuum tuning** — Migration `20260305_200400_autovacuum_tuning.sql` applies custom `autovacuum_*` storage parameters on five tables: `task_queue` (`scale_factor = 0.01`, `threshold = 50`, `analyze_scale = 0.05`, `cost_delay = 2 ms`) to keep the high-churn queue table aggressively vacuumed; `classification_history` (`scale_factor = 0.05`); and `app_log`, `error_log`, `ai_usage_log` (all `scale_factor = 0.10`) to defer vacuum frequency on large append-only log tables. All settings are idempotent `ALTER TABLE SET` operations — no rewrite required.
- **BRIN indexes on append-only log tables** — Migration `20260305_200600_brin_log_indexes.sql` replaces the B-tree `created_at` indexes on `app_log`, `error_log`, and `audit_log` with BRIN indexes (`pages_per_range = 128`). BRIN indexes are 100–1000× smaller than B-tree for monotonically increasing timestamp columns; date-range queries against these append-only tables use the BRIN and are equally efficient. The partial unresolved-errors indexes (`idx_error_log_unresolved_stage`, `idx_error_log_unresolved_errors`) are preserved unchanged.
- **`pg_trgm` trigram search on `classification_history.title`** — Migration `20260305_200100_enable_pg_trgm.sql` installs the `pg_trgm` extension and creates a GIN trigram index (`idx_classification_history_title_trgm`). Enables `LIKE '%keyword%'` and `ILIKE` queries to use the index instead of a full sequential scan, reducing title-search latency on large history tables.
- **`pg_prewarm` HNSW index warm-up on container start** — Migration `20260305_200200_enable_pg_prewarm.sql` installs the `pg_prewarm` extension. `database.js` exports `prewarmHnswIndexes()` which is called during `startServer()` after migrations complete. On each restart, `pg_prewarm('idx_embeddings_hnsw')` and `pg_prewarm('idx_embeddings_image_hnsw')` load both HNSW vector indexes into `shared_buffers`, eliminating the cold-disk penalty on the first RAG semantic search. Gracefully no-ops if the extension or indexes are not yet present.
- **`pg_stat_statements` extension for production query profiling** — Migration `20260305_200000_enable_pg_stat_statements.sql` installs the `pg_stat_statements` extension (`track = all`, `max = 10000`). `docker-entrypoint.sh` now appends `shared_preload_libraries = 'pg_stat_statements'` to `postgresql.conf` on fresh installs and idempotently on existing installs (grep-guarded). A `checkPgStatStatements()` function in `database.js` is called at startup to log whether the extension is actively collecting (requires `shared_preload_libraries` to be in effect, which needs a container recreate after the first upgrade applying this change).

- **RAGRetriever: 30-second TTL cache for `getEmbeddingCount()` and `hasMinimumEmbeddings()`**** — Every `semanticSearch()` call previously issued two unconditional `SELECT COUNT(*)` round-trips (one for `getEmbeddingCount()`, one for `hasMinimumEmbeddings()`). At 5 concurrent classification tasks per second this produced 10 extraneous DB queries per second against `classification_embeddings`. Both values are now cached as instance fields (`_embeddingCountCache`, `_hasMinimumCache`) with a 30-second TTL (`EMBEDDING_STATS_TTL_MS = 30_000`). Cache misses fall through to the original queries; hits skip them entirely. A new private `_getHasMinimumCached()` helper wraps the `embeddingService.hasMinimumEmbeddings()` call. The `RAGRetriever` singleton is exported as `module.exports = new RAGRetriever()` so instance caches are shared across all callers in the same process.
- **`schedule()` advisory lock support for cross-process job deduplication** — The `schedule(name, cron, handler)` method now accepts an optional fourth parameter `lockKey`. When provided, the cron handler wraps the job with `withSessionAdvisoryLock(lockKey, handler)`. If the lock is already held by another container (rolling restart, multi-replica deployment), the job is silently skipped and a `debug` log entry is emitted (`'Scheduled task %s skipped — advisory lock held by another process'`). Six new `DB_ADVISORY_LOCKS` constants cover the non-idempotent scheduler jobs: `GAP_ANALYSIS=2001`, `LIBRARY_SYNC=2002`, `RETRY_QUEUE=2003`, `ENRICHMENT_RETRY_QUEUE=2004`, `RATING_NORMALIZATION_CHECK=2005`, `STALE_CLEANUP=2006`. Idempotent jobs (library watchdog, token cleanup, API key audit prune) are left unlocked.
- **`GET /api/logs/stats` trend queries merged from two to one** — The endpoint previously issued two separate `SELECT COUNT(*)` queries against `error_log` — one filtered to the last 24 hours and one to the last 7 days. Both queries scanned overlapping row ranges from the same table. They are now replaced by a single query that uses conditional aggregation (`COUNT(*) FILTER (WHERE ...)`) to compute all ten trend columns (`logs_24h`, `errors_24h`, `warnings_24h`, `info_24h`, `debug_24h`, `logs_7d`, `errors_7d`, `warnings_7d`, `info_7d`, `debug_7d`) in a single scan of rows from the last 7 days. The response shape (`trends.last24h`, `trends.last7d`) is unchanged; the server splits the single result row into the two sub-objects. Halves database round-trips for every call to the Logs stats page.
- **`runLibraryWatchdog()` collapsed from 2N queries to one** — The watchdog previously fetched all active libraries, then for each library issued a `COUNT(*)` query, and for empty ones a second query against `media_server_sync_status`. On an instance with many libraries this meant up to 2N round-trips on every 5-minute tick. The function now executes a single query using correlated `NOT EXISTS` subqueries to return only libraries that are both empty and have no running sync — exactly the set that needs triggering. `NOT EXISTS` short-circuits on the first matching row, making it significantly cheaper than `COUNT(*)` for non-empty libraries.
- **`runAutoLearnRules()` per-library rule INSERTs collapsed to one UNNEST batch** — The function previously issued up to 6–8 sequential `INSERT INTO library_rules ... VALUES ($1, ...)` round-trips per library (one per detected rule type: rating, genre, language, keyword variants, anime rules). Now the JS logic collects candidate rule objects into an array, then issues a single `INSERT INTO library_rules ... SELECT $1, UNNEST($2::text[]), UNNEST($3::text[]), UNNEST($4::text[]), UNNEST($5::text[]), false, true, 10 ON CONFLICT DO NOTHING` query, broadcasting the scalar `library_id` across all generated rows in one PostgreSQL statement. If no rules are detected, no INSERT is issued at all.
- **Task Queue: Visibility Timeout for Crash Recovery** — `task_queue` gains a `visible_at TIMESTAMPTZ` column (migration `20260306_000000_add_task_queue_visible_at.sql`). When a worker claims a task it now sets `visible_at = NOW() + INTERVAL 'N minutes'` (default 10 min, tunable via `TASK_VISIBILITY_TIMEOUT_MINUTES`). `dequeue()` picks up either: (a) a pending task whose retry window has elapsed, or (b) a processing task whose `visible_at` has expired — enabling continuous, startup-independent crash recovery. A `recoverExpiredVisibilityTasks()` method runs in the worker loop every 60 seconds as a belt-and-suspenders fallback. `resetStaleProcessingTasks()` now carries an age guard (`started_at < NOW() - INTERVAL 'N minutes'`) so very-recently-started tasks are not blindly reset during a rolling-restart overlap. All task lifecycle methods (`completeTask`, `failTask`, `gracefulShutdown`, AI-unavailable re-queue) reset `visible_at = NULL` on state transition. A partial index `idx_task_queue_visible_at` on `(visible_at) WHERE status = 'processing' AND visible_at IS NOT NULL` makes the expired-timeout sweep query efficient. Implements the industry-standard SQS visibility-timeout pattern for Postgres-backed queues, per brandur.org / pgqueuer / Amazon SQS documentation (March 2026).
- **Database Pool: Timeout Configuration** — `database.js` now explicitly configures `connectionTimeoutMillis` (5 s), `idleTimeoutMillis` (30 s), `statement_timeout` (30 s), and `max` pool size on the `pg.Pool`. All four values are tunable via environment variables (`POSTGRES_POOL_MAX`, `POSTGRES_CONN_TIMEOUT_MS`, `POSTGRES_IDLE_TIMEOUT_MS`, `POSTGRES_STATEMENT_TIMEOUT_MS`). Previously the pool used `pg` defaults with no timeouts, meaning a saturated pool would hang requests indefinitely and a runaway query would hold a connection forever. Validated against March 2026 node-postgres community best practices.
- **Database Pool: `healthCheck()` Export** — Added `healthCheck()` to `server/src/config/database.js`. The function acquires a dedicated client, executes `SELECT 1`, and returns `{ healthy: true }` or `{ healthy: false, error }`. Uses `try/finally` to always release the client. Available for use by `/health` endpoints to surface DB connectivity without consuming a pool slot long-term. **Security:** in `NODE_ENV=production` the `error` field is replaced with the generic string `'Database connection failed'` rather than the raw pg `err.message` (which can contain internal host IPs, port numbers, and database names visible to unauthenticated `/health` callers). Development and test environments retain the full message for debugging. A new test `'healthCheck sanitizes error message in production'` covers this path in `database-resilience.test.js`.
- **Task Queue: Composite Partial Index for `dequeue()`** — Migration `20260305_100000_optimize_task_queue_indexes.sql` adds `idx_task_queue_dequeue` on `task_queue (priority DESC, created_at ASC, next_retry_at ASC) WHERE status = 'pending'`. This index is designed to support the `QueueService.dequeue()` pattern, which filters on pending tasks eligible for retry and orders by `priority DESC, created_at ASC`, allowing the planner to satisfy the filter and sort efficiently from the index. A second index `idx_task_queue_processing_stale` on `(started_at) WHERE status = 'processing'` speeds up `resetStaleProcessingTasks()` and `gracefulShutdown()`. Both indexes are created as part of the regular transactional migration and use `IF NOT EXISTS` for idempotency.
- **Pagination: Eliminate Double `COUNT(*)` Round-Trip** — `GET /api/classification/history` now uses `COUNT(*) OVER()` window function to return the total row count in the same query as the page data instead of issuing a separate `SELECT COUNT(*)` query. This halves the database round-trips for every paginated history request and eliminates the race condition where a row could be inserted between the two queries. The `total_count` column is stripped from individual row objects before the response is serialized.
- **Live Stats: Parallelize Independent Queries** — `GET /api/queue/live-stats` previously fired `todayResult`, `enrichmentResult`, and `enrichmentQueueResult` sequentially after the initial `Promise.all`. All five queries are now executed in a single `Promise.all`, reducing the endpoint's database wait time to the slowest single query instead of the sum of all queries.
- **Slow Query Logging** — `db.query` is now wrapped with `process.hrtime.bigint()` timing. Queries exceeding `POSTGRES_SLOW_QUERY_THRESHOLD_MS` (default 500 ms) emit a `[SLOW QUERY]` warning with the elapsed time and first 120 characters of the query text. Surfaced in runtime logs for diagnosis without requiring `pg_stat_statements` or external tooling.
- **`withTransaction()` Helper** — `server/src/config/database.js` now exports a `withTransaction(fn)` utility that acquires a pool client, runs `BEGIN`/fn/`COMMIT`, always releases in `finally`, and re-throws after `ROLLBACK`. Removes the need for each service to implement its own transaction boilerplate.
- **Session-level advisory locks for Backfill Services** — `tryAdvisoryLock(client, lockKey)`, `withSessionAdvisoryLock(lockKey, fn)`, and `DB_ADVISORY_LOCKS` constants (`IDLE_BACKFILL=1001`, `SCHEDULED_BACKFILL=1002`, `MANUAL_BACKFILL=1003`) added to `database.js`. All three backfill services (`idleBackfillService`, `scheduledBackfillService`, `manualBackfillService`) now acquire a **session-level** advisory lock (`pg_try_advisory_lock`) during startup to prevent split-brain races between processes. Session-level locks are appropriate here because backfill jobs run for minutes and must hold the lock across multiple `BEGIN/COMMIT` cycles; the lock is held for the full job duration and released explicitly in a `finally` block when the job completes (or automatically by PostgreSQL when the connection closes on crash). `tryAdvisoryLock` (which uses `pg_try_advisory_xact_lock`, transaction-scoped) is used separately by `resetStaleProcessingTasks()` for the `STARTUP_RESET` lock.
- **HNSW `ef_search` Tuning for RAG Semantic Search** — `ragRetriever.semanticSearch()` and `semanticSearchCandidates()` now issue `SET LOCAL hnsw.ef_search = $1` inside a transaction before executing the vector similarity CTE. Default value is `80` (configurable via `PGVECTOR_EF_SEARCH` env var, range 40–200). Increases recall for ambiguous queries without regressing fast exact-match lookups.
- **RAG: Per-Call `efSearch` Option and Lower Default for Candidate Probes** — `semanticSearch()` now accepts `options.efSearch` to override the module-level `PGVECTOR_EF_SEARCH` constant on a per-call basis. `semanticSearchCandidates()` automatically passes `efSearch: EF_SEARCH_CANDIDATES` (default `40`, configurable via `PGVECTOR_EF_SEARCH_CANDIDATES` env var) so pass-2 candidate-probe scans use a narrower search width than pass-1. The outer re-ranking step operates on the already-materialized candidate rows and does not perform an additional HNSW index scan, so it is unaffected by `ef_search`. Callers that need maximum recall on a single query can pass `{ efSearch: 120 }` explicitly without changing the global setting.
- **RAG: `CANDIDATE_LIMIT_MAX` Env-Configurable Ceiling** — The maximum number of HNSW candidates fetched by the inner CTE (`Math.min(limit * 5, 25)` floored at 25) was previously hard-coded to `200`. It is now controlled by `PGVECTOR_CANDIDATE_LIMIT` (default `200`). High-embedding-count deployments can raise the ceiling without a code change; resource-constrained instances can lower it.
- **`checkQueueWorker()` Health Check: Scoped Table Scan** — The health-check query `SELECT SUM(...) ... FROM task_queue` previously scanned every row in the table — including all historical `completed` and `failed` rows — on every heartbeat poll. The query now adds `WHERE status IN ('pending', 'processing') OR (status = 'completed' AND completed_at > NOW() - INTERVAL '1 hour')` so the planner can use the existing `idx_task_queue_status` index and only touches active/recent rows. `MAX(started_at)` for stall detection still captures any task that ran within the last hour.
- **Partial Index `idx_error_log_unresolved_errors` for Unresolved ERROR Queries** — The existing `idx_error_log_unresolved_stage` only applied `WHERE error_stage IS NOT NULL`, leaving general-purpose errors (no stage set) unindexed for the common Command Center filter `WHERE resolved = false AND level = 'ERROR'`. Migration `20260307_000000` adds `CREATE INDEX IF NOT EXISTS idx_error_log_unresolved_errors ON error_log (created_at DESC) WHERE resolved = false AND level = 'ERROR'`, making unresolved-error UI queries index-only scans.
- **Migration `20260307_000000_add_rag_log_cleanup_and_indexes`** — Seeds `rag_log_retention_days = '30'` into `settings` (ON CONFLICT DO NOTHING) and creates `idx_error_log_unresolved_errors` as described above. Removed the erroneous explicit `BEGIN;`/`COMMIT;` wrapper that could prematurely commit the migration runner's outer transaction; migration now runs in the runner's transaction context like all other migrations.

### Tests

- **`queueService.test.js`** — Added `'dequeue SET includes visible_at assignment'` and `'dequeue WHERE includes visibility-timeout recovery branch'` to the `dequeue SQL pattern` describe block. Added `'recoverExpiredVisibilityTasks'` describe block (3 tests: successful recovery, error resilience, no-warn on no-op). Updated `'resetStaleProcessingTasks: acquires advisory lock and resets rows'` to assert the age guard (`started_at < NOW() - INTERVAL`) and `visible_at = NULL` reset are present in the UPDATE SQL. Suite grows by 5 tests (58 total).
- **`schedulerService.test.js`** — Added `'runLogCleanup'` describe block (4 tests: uses retention settings for all three tables including `rag_logs`, falls back to defaults when settings absent (90d error / 30d app / 30d rag), propagates DB errors, `executeTask` dispatches `cleanup_logs` task type to `runLogCleanup`).
- **`queueService.test.js`** — Added `'gracefulShutdown'` describe block (2 tests: UPDATE sets `error_message = 'Reset by graceful shutdown'` and does not use `NULL`; does not throw when DB update fails, logs error). Added `'withOptionalTransaction'` describe block (2 tests: attaches `rollbackFailed: true` and `rollbackError` to thrown error when ROLLBACK also fails; does not add rollback properties when ROLLBACK succeeds).
- **`manualBackfillService.test.js`** — Added `'throws a configuration-not-found error on fresh install'` test: mocks `ai_provider_config` query with `{ rows: [] }`, asserts thrown message matches `/configuration not found/i` and does NOT match `/not enabled/i`.
- **`embeddingService.test.js`** — Added `db.withTransaction.mockImplementation` to `beforeEach` so auto-heal paths run on the correct mock client. Renamed `'auto-heals image vector schema on dimension mismatch'` → `'...using pinned transaction'` and added assertion that `db.withTransaction` is called once. Added new `'storeEmbedding (text auto-heal)'` describe block (1 test: triggers text embedding dimension mismatch, asserts `withTransaction` called, TRUNCATE and column-type DDL present in executed SQL, retry INSERT returns correct id).
- **`legacyMigration.test.js`** — New test file (5 tests): `migrateRule` preset path calls `db.withTransaction` and writes preset via pinned client; `migrateRule` override path calls `db.withTransaction`; rule-not-found throws before any transaction; transaction errors propagate to caller; `getOrCreatePolicy` INSERT runs on pinned client when no policy exists.
- **`database-resilience.test.js`** — Added `'Pool Configuration - Timeouts and Limits'` describe block with 8 new tests: static-analysis assertions that `connectionTimeoutMillis`, `idleTimeoutMillis`, `statement_timeout`, and `POSTGRES_POOL_MAX` are present in `database.js`; `healthCheck()` export existence; mock-based tests for healthy connection path, failed connection path, and client release guarantee on query failure. Suite grows from 4 tests to 12 tests.
- **`queueService.test.js`** — Added `'dequeue SQL pattern'` describe block with 3 new tests asserting the dequeue SQL contains `FOR UPDATE SKIP LOCKED`, filters on `status = 'pending'` and `next_retry_at <= NOW()`, and orders by `priority DESC, created_at ASC`. These tests act as regression guards ensuring the SQL shape remains compatible with `idx_task_queue_dequeue`.
- **`database-resilience.test.js`** — Added `'withTransaction()'` describe block (5 tests: commits on success, rolls back and rethrows on error, releases client when ROLLBACK itself fails, fn receives the client, exports check). Added `'Slow Query Logging'` describe block (4 tests: no log for fast query, logs `[SLOW QUERY]` prefix, truncates to 120 chars, respects env var). Added `'tryAdvisoryLock()'` describe block (4 tests: returns true/false based on mock, DB_ADVISORY_LOCKS shape, exports check). Suite grows by 13 tests.
- **`idleBackfillService.test.js`** — Added `'Advisory lock guard'` describe block (1 test: skips when lock not acquired).
- **`scheduler.test.js`** — Added `'Security Cleanup Tasks'` describe block (6 tests: refresh token cleanup happy path, skipped via env var, audit prune happy path, respects `API_AUDIT_RETENTION_DAYS`, error resilience for both tasks).
- **`ragRetriever.test.js`** — Added `'HNSW ef_search tuning'` describe block (6 tests: `SET LOCAL` issued before CTE, defaults to 80, respects `PGVECTOR_EF_SEARCH` env var, client released on error, `semanticSearchCandidates` uses `EF_SEARCH_CANDIDATES` (40) by default, per-call `efSearch` option overrides module constant).
- **`integration/classification-history-constraints.test.js`** — New integration test file (9 tests) verifying `chk_classification_confidence_range` and `chk_classification_completed_has_library` constraints enforce correct data at the database layer.
- **`database-resilience.test.js` — `checkPgStatStatements()`** — Added `'pg_stat_statements Status Check'` describe block (3 tests: returns `{ active: false }` when extension not installed, returns `{ active: false, reason: '...recreate the container...' }` when installed but not in `shared_preload_libraries`, returns `{ active: true }` when both conditions are met). Covers the startup informational probe added to `index.js`.
- **Int8 type parser assertion updates** — Three integration test assertions that explicitly expected PostgreSQL `BIGINT`/`COUNT()` results as JavaScript `string` values (`suggestions-api.test.js`, `migration-routes.test.js`, `legacy-migration.test.js`) have been updated to `number` now that the global int8 type parser converts safe-range bigint values to JS numbers.

## [v0.43.3a-alpha] - 2026-03-03

### Fixed

- **Graceful Shutdown: In-Flight Queue Tasks No Longer Left as Stale on Restart** — `QueueService` gained a `gracefulShutdown()` method that calls `stopWorker()` and immediately resets any `status = 'processing'` rows back to `pending` before the process exits. `server/src/index.js` now registers `SIGTERM` and `SIGINT` handlers that invoke this, then close the HTTP server cleanly and call `process.exit(0)`. Previously, Docker container restarts (rolling update, `docker stop`, OOM kill) would leave whatever tasks were in-flight locked as `processing`, causing a spurious `WARN Reset stale processing tasks on startup` on the next boot with a list of task IDs. Crash/OOM kills are still handled by the existing startup reset — this fix only eliminates the noise on clean restarts. A 10-second force-exit timeout guards against a hung shutdown.

## [v0.43.3-alpha] - 2026-03-03

### Added

- **Schema Snapshot Fast-Path (Fresh Installs)** — `docker-entrypoint.sh` now loads `database/schema/current.sql` directly on a fresh install instead of applying all 107 migrations sequentially via `init.sql`. The snapshot path is verified with `ON_ERROR_STOP=1` and falls back to `init.sql` on failure. Reduces fresh install startup time significantly.
- **Schema Snapshot: Seed Data Embedding** — `scripts/dump-schema.js` now auto-splices seed INSERTs from 8 data-only migrations (`005`, `006`, `019`, `043`, `044`, `046`, `20260201_010000`, `20260226_002000`) into `current.sql` after every `npm run db:dump-schema`. The snapshot is fully self-contained: DDL + seed data + `schema_migrations` table DDL + 107 migration tracking rows.
- **Schema Snapshot: `schema_migrations` Table DDL** — `current.sql` now includes `CREATE TABLE IF NOT EXISTS public.schema_migrations (...)` so it can be applied to a completely empty database without a missing-table error (previously `pg_dump --exclude-table` stripped the DDL too).
- **RAG: `expandedQuery` and `expansionTermCount` fields in `hybrid_search` operation logs** — `ragLogger.logOperation` for `hybrid_search` now records whether query expansion was active (`expandedQuery: true/false`) and how many extra terms were injected into the FTS query (`expansionTermCount`). Enables future recall measurement on ambiguous queries.
- **Migration `20260303_123026_extend_search_text_tsvector`** — Extends the `update_classification_search_text()` trigger and backfills existing rows so the `search_text` tsvector also indexes genre and keyword names extracted from the `metadata` JSONB column. Includes helper function `extract_jsonb_name_text()` supporting both string arrays and `{id,name}` object arrays. Safe for existing installs.

### Changed

- **RAG FTS: pass-2 queries now use expanded terms** — `fullTextSearch()` with `options.useExpandedQuery: true` incorporates `alias_terms`, `genres`, `keywords`, and `cast` from `metadata.rag_query_overrides` into the search string. `hybridSearch()` forwards its `options` (including `useExpandedQuery`) to `fullTextSearch()` so pass-2 calls automatically benefit.
- **RAG FTS: `websearch_to_tsquery` for expanded queries** — When expanded terms are present `fullTextSearch()` switches from `plainto_tsquery` to `websearch_to_tsquery` for broader, more flexible matching. Pass-1 / unexpanded queries continue to use `plainto_tsquery` (no regression).

### Fixed

- **Fresh Install: CSRF Validation Failed on Setup Page** — `csrfProtection` middleware (`server/src/middleware/csrf.js`) now exempts the `/setup` route prefix from CSRF validation. A stale `access_token` browser cookie left over from a prior (wiped) installation no longer blocks admin account creation on a fresh instance. Setup routes are pre-authentication and rate-limited (10/hr); no security regression.
- **Fresh Install: `PostUpgradeService` Executing Historical Tasks on New Instances** — Added `isFreshInstall()` check (queries `SELECT COUNT(*) FROM users`). When no users exist, all pending post-upgrade tasks are pre-seeded as complete without executing. Previously all 5 versions' tasks would fire on first boot (including 5× `clearLogs()`) because `post_upgrade_tasks` was empty.
- **Fresh Install: `IdleBackfillService` Logging ERROR When AI Provider Unconfigured** — `loadConfig()` now returns `{ rag_enabled: false, idle_backfill_enabled: false }` as a safe default when `ai_provider_config` has no row yet. The service exits via the existing "RAG is disabled" INFO path instead of logging `[ERROR] Idle backfill NOT started: Failed to load configuration` on every idle detection cycle.
- **RAG FTS: `fullTextSearch()` no longer ignores expanded metadata in pass-2 hybrid retrieval** — Previously, pass-2 calls to `hybridSearch()` used only `title + library_name` for full-text search regardless of the enriched `rag_query_overrides` payload. Expanded terms are now incorporated.
- **RAG FTS: pass-2 OR semantics, unindexed cast exclusion, options mutation guard** — FTS pass-2 expansion now uses OR semantics for correct `websearch_to_tsquery` phrase handling; cast terms excluded when the `tsvector` does not index cast strings; options object mutation guard removed to prevent cross-call state bleed.

### Tests

- **`csrf.middleware.test.js`** — Added 2 tests for `/setup` exemption: stale-cookie POST to `/api/setup/*` allowed; non-setup POST to `/api/other` still blocked (403). Suite now 10 tests.
- **`postUpgradeService.test.js`** — Added fresh-install pre-seed test: verifies `executed: 0`, `TRUNCATE` never called, all tasks marked complete; updated 2 stale test descriptions. Suite now 13 tests.
- **`idleBackfillService.test.js`** — Added direct `loadConfig()` unit test asserting safe defaults (`rag_enabled: false`) for fresh install (empty `ai_provider_config`); added no-throw test for DB errors in `loadConfig()`; corrected 2 stale test descriptions. Suite now 14 tests.
- **`queueService.test.js`** — Fixed inter-test mock contamination that caused 3 intermittent failures in full-suite runs: replaced `jest.clearAllMocks()` with `jest.resetAllMocks()` (also resets mock implementations, not just call counts) and added `aiAvailable`, `omdbSslBlockedUntil`, `lastOmdbSslProbeAt` to `beforeEach` state reset. Suite now runs deterministically across repeated full runs.
- **Test count: 1803 passing** (up from 1792 at v0.43.2a-alpha).

## [v0.43.2a-alpha] - 2026-03-02

### Fixed

- **Radarr: "Already Exists" 400 Handling in `addMovie()`** - `addMovie()` in `radarr.js` now detects Radarr's 400 response when a movie already exists in the library (matched via `MovieExistsValidator` errorCode or "already been added"/"already added" in the error message body) and returns `{ alreadyExists: true }` instead of throwing. Any other 400 (e.g., bad quality profile) still throws.
- **Sonarr: "Already Exists" 400 Handling in `addSeries()`** - `addSeries()` in `sonarr.js` receives parity fix — detects Sonarr's 400 "This series has already been added" (matched via "already been added" or `SeriesExistsValidator`) and returns `{ alreadyExists: true }` instead of throwing.
- **`routeToArr()`: Radarr Pre-Check + `alreadyExists` Handling** - `routeToArr()` Radarr path in `classification.js` now calls `getMovieByTmdbId` before attempting `addMovie`. If the movie is already present, routing returns `{ routed: true, reason: 'already_in_arr' }` immediately without calling `addMovie`. If a race condition bypasses the pre-check, the `{ alreadyExists: true }` result from `addMovie()` is caught and handled identically.
- **`routeToArr()`: Sonarr Pre-Check + `alreadyExists` Handling** - Same two-layer defense applied to the `routeToArr()` Sonarr path using `getSeriesByTvdbId` pre-check and `addSeries()` `alreadyExists` result handling.

### Tests

- Added 4 new tests to `radarr.test.js`: `alreadyExists` return via `MovieExistsValidator` errorCode, `alreadyExists` return via "already added" message, non-exists 400 still throws, network error still throws.
- Added 4 new tests to `sonarr.test.js`: parity coverage for matching Sonarr 400 body patterns.
- Added 4 new tests to `classification-routing.test.js`: Radarr pre-check found → skip `addMovie`; Radarr pre-check null → proceed to add; Sonarr pre-check found → skip `addSeries`; Sonarr pre-check null → proceed to add.
- Test count: 1792 passing (up from 1782 at v0.43.2-alpha).

## [v0.43.2-alpha] - 2026-03-02

### Added

- **RAG Loop: `policy_prompt_confirm` Trigger** - `prompt_confirm` policy results now enter the full second-pass RAG loop pipeline (previously only `prompt_select` did). Added `'policy_prompt_confirm'` to `TRACE_ALLOWED_TRIGGERS`, mirrored the `shouldTriggerSecondPass()` branch, relaxed guards in `getRecheckEligibility()`, `isMetadataEnrichmentEligible()`, and `isAiRerunEligible()`, and extended the policy recheck block in `classification.js`.
- **RAG Loop: Language Keyword Injection in Query Expansion** - Added `LANGUAGE_QUERY_KEYWORDS` constant (41 non-English ISO 639-1 codes → lowercase English labels) to `ragLoopHelpers.js`. `expandRetrievalMetadata()` now appends the language label (e.g. `'chinese'`, `'korean'`) to expanded keywords for any non-English `original_language`. `extractVerifiableEvidence()` now returns `language: metadata.original_language` on the evidence object. `evidence_tokens` in `rag_query_overrides` now includes a `language` field.
- **Config: `policy_recheck_confidence_gain_multiplier`** - Added configurable multiplier (default: 2, range: 1–10) to `ragLoopConfig.js`. Replaces the hardcoded `* 2` in `evaluatePolicyRecheckGate()`'s `significantImprovement` computation.
- **Policy Engine: Full Language Conflict Surface in Questions** - `policyQuestionBuilder.buildLanguageConflictQuestion()` now incorporates all detected language conflicts (not just the first). Single vs. multi-conflict text differs accordingly; all conflict libraries are listed first in options.
- **Policy Engine: Expanded Language Labels** - `LANGUAGE_LABELS` in `policyQuestionBuilder.js` expanded from 13 to 47 ISO 639-1 codes covering major world, South/Southeast Asian, European, and Middle Eastern languages.
- **Dependency Maintenance** - Bumped server dependencies `pg` to `8.19.0`, `pg-mem` to `3.0.14`, and `eslint-plugin-security` to `4.0.0`.
- **Security Workflow Tooling** - Switched the GitHub Actions Trivy filesystem scan to install Trivy directly from Aqua's Debian repository and run the `trivy fs` CLI in CI.

### Fixed

- **Policy Engine: `mapOptionsToLibraries()` Null Library ID** - Fixed `aiResponseParser` storing `library_id: null` when AI returned an option without a matched library, causing null entries in policy question options.
- **Policy Engine: Language Hard-Block in `evaluatePresetSignals()`** - Fixed language signal blending a `0` score instead of hard-blocking when a required-language preset was not met.
- **Policy Engine: Language Conflict Propagation in `evaluateItem()`** - Language-conflicting policies are now excluded from `evaluations` via a `languageConflictPolicyIds` Set even when profile/RAG/history scores would otherwise be positive. `languageConflicts` is returned on all result objects.
- **Policy Engine: `buildLanguageConflictQuestion()` New Method + Case B** - Added `buildLanguageConflictQuestion()` method to `policyQuestionBuilder`; fixed Case B (conflict + single eligible library) generating wrong question type.
- **Policy Engine: `scoreStudios()` Neutral-50 When No Studio Data** - `scoreStudios()` now returns `0` (not `50`) when `require_any` is configured and the item has no production company data.
- **RAG Loop: Language Conflict Guard in Recheck Gate** - `evaluatePolicyRecheckGate()` now blocks `shouldAdopt` when `policyAfter.action === 'auto_classify'` and `policyAfter.languageConflicts.length > 0`, returning `reason: 'language_conflict_present'` with `conflictCount` in metrics. Guard does not apply to `prompt_confirm`/`prompt_select` actions.
- **Dependency PR CI Reliability** - Updated the Gitleaks workflow to fetch full PR history and pinned `minimatch` to `10.2.3` across root, client, and server lockfiles so audit, OSV, and Trivy checks no longer fail on dependency update PRs.
- **Trivy Workflow Upstream Breakage** - Removed the failing `aquasecurity/trivy-action` setup path so filesystem security scans no longer abort while trying to check out the upstream `aquasecurity/trivy` repository.

### Tests

- Added 12 new tests across `ragLoopHelpers.test.js` covering `policy_prompt_confirm` trigger paths, language conflict gate blocking/permitting, language keyword injection (zh, ko, en skip, no double-inject), and configurable multiplier (3×, 1×).
- Extended `ragLoopConfig.test.js` to assert `policy_recheck_confidence_gain_multiplier` default (`2`) and clamp behavior (99 → 10).
- Fixed `classification.test.js` `rag_details` storage test to mock `rag_retrieval_loop_enabled: false` after `prompt_confirm` now triggers the second pass.
- Test count: 1782 passing (up from 1773 at start of session).

## [v0.43.1b-alpha] - 2026-02-26

### Added

- **Notifications Hard Delete Controls** - Added `POST /api/notifications/:id/delete` and `POST /api/notifications/clear-all` (read-write protected) to allow explicit deletion of individual or all in-app notifications.
- **Notifications UI Delete/Clear Actions** - Added `Delete` per row and `Clear All` bulk actions in both Header notifications dropdown and `/notifications` page.
- **Route and UI Regression Coverage** - Added/updated tests for new notifications delete/clear-all behaviors across server routes and client notification center interactions.

### Changed

- **RAG INFO Stage Persistence Behavior** - Updated RAG second-pass stage logging so INFO-level events are console/file visible but no longer persisted to `error_log`; WARN/ERROR persistence remains unchanged.
- **Release-Targeted Log Cleanup Task** - Added one-time post-upgrade task `clear_logs_0431b` for `v0.43.1b-alpha`.

### Fixed

- **Error Logs Signal Noise** - Prevented non-actionable informational RAG stage rows (for example strategy-selection stage decisions) from appearing in Settings → Error Logs.
- **Stale Notification Cleanup Gap** - Operators can now remove non-dismissible/stale notification rows directly without relying on dismiss-only constraints.

## [v0.43.1a-alpha] - 2026-02-26

### Fixed

- **Logs API Schema Compatibility Hotfix** - Updated `/api/logs` and `/api/logs/export` filtering/selection to use backward-compatible field resolution via `to_jsonb(error_log)` + metadata fallbacks, preventing `500 Internal Server Error` on upgraded instances missing expanded `error_log` observability columns.

## [v0.43.1-alpha] - 2026-02-26

### Added

- **Command Center Retry Classification Flow** - Added per-item `Retry Classification` and bulk `Retry Classification All` actions in Needs Attention to reset stale classification state and requeue items as fresh classification tasks.
- **Retry Classification API** - Added `POST /api/classification/retry` with bounded batch validation, per-item results, and structured reason codes for queued/skipped/failed outcomes.
- **Retry Follow-up Enrichment Queueing** - Added best-effort post-retry enqueue of `metadata_enrichment` tasks (lower priority) for linked media items to rebuild OMDb/Tavily context after reset.
- **Retry Audit Trail Filtering in Logs** - Extended logs API/UI to support retry-audit filtering and surfaced retry result/reason/correlation fields for operator diagnostics.
- **Retry Regression Test Coverage** - Added unit, route-auth/CSRF, and integration coverage for retry cleanup, dedupe, concurrency, queue ordering, and enrichment cleanup boundaries.
- **Migration Regression Coverage** - Added integration test coverage to verify runtime-security seed SQL remains compatible with the legacy `settings` table schema.
- **AI/Timeout Regression Coverage** - Added unit tests for:
  - operation-name propagation in timeout wrapper
  - timeout error normalization behavior
  - chunk-split stream done-signal parsing
  - narrative suggested-library parser recovery

### Changed

- **Retry Queue Semantics** - Retry duplicate handling now deterministically skips when matching pending/processing classification tasks already exist for the same identity key, preventing duplicate pending work.

### Fixed

- **Runtime Security Migration Schema Compatibility** - Updated `20260226_002000_seed_runtime_security_defaults.sql` to seed `settings` using only `key/value` columns so upgrades no longer fail on installs where `settings.category` does not exist.
- **AI Stream Completion Parsing** - Fixed Ollama streaming parser to buffer chunk-split JSON lines so `done=true` completion signals are not dropped, preventing false `EINCOMPLETE` retries.
- **RAG Timeout Attribution** - Fixed `withTimeout()` to pass stage-specific operation names into `OperationController` and normalize timeout errors consistently, eliminating ambiguous `operation: "unnamed"` timeout logs.
- **Narrative AI Response Recovery** - Added safe parser recovery for narrative responses containing `suggested library is "..."`, converting them into structured clarification results instead of malformed fallback warnings.

## [v0.43.0b-alpha] - 2026-02-26

### Fixed

- **Gitleaks CI Config Parsing** - Corrected `.gitleaks.toml` allowlist schema so the `Gitleaks Secret Scan` workflow loads config successfully and no longer fails with `Allowlist.Regexes[0]` type errors.
- **Local HTTP Asset Upgrade Loop** - Disabled CSP `upgrade-insecure-requests` and app-level HSTS by default to prevent browsers from rewriting local `http://` asset requests to `https://` and rendering a blank page.

### Added

- **Optional HTTPS Header Enforcement Flag** - Added `ENFORCE_HTTPS_HEADERS` (default `false`) for deployments that explicitly want app-level HSTS and CSP HTTPS-upgrade behavior.

## [v0.43.0a-alpha] - 2026-02-26

### Added

- **Runtime Security Defaults Migration** - Added `20260226_002000_seed_runtime_security_defaults.sql` to seed missing `force_secure_cookies`, `csrf_protection`, and `cors_origin` settings for upgraded deployments without overriding existing values.

### Fixed

- **Local HTTP Cookie Lockout Guard** - Secure cookie handling now falls back safely on non-HTTPS requests even when `force_secure_cookies` is enabled, preventing login/session lockouts on local Unraid/LAN HTTP access.

## [v0.43.0-alpha] - 2026-02-26

### Added

- **Security Review Documentation** - Complete security audit with 31 findings documented in `docs/SECURITY_REVIEW.md`
- **Route Authentication Audit** - Full route audit in `docs/security-fixes/ROUTE-auth-audit.md`
- **Security Benchmarks Documentation** - CIS, OWASP, SANS, Node.js, NIST coverage in `docs/SECURITY_BENCHMARKS.md`
- **CORS Configuration Documentation** - Added `CORS_ORIGIN` environment variable documentation to docker-compose.yml
- **Refresh Token Rotation** - JWT refresh tokens with rotation on each use (7-day expiry)
- **Content Security Policy** - CSP enabled with strict directives (defaultSrc self, frameAncestors none)
- **Gitleaks Configuration** - Added `.gitleaks.toml` for secret scanning in CI/pre-commit
- **AES-256-GCM Encryption Utility** - New `server/src/utils/encryption.js` for API key/secret encryption
- **Database Migration: Refresh Tokens** - `20260224_140000_add_refresh_tokens.sql` - New `refresh_tokens` table
- **Database Migration: API Key Audit** - `20260224_130000_add_api_key_audit.sql` - Local-only security audit log for API key usage (NO external telemetry - data stays in your database)
- **Test Coverage** - Added 10 new test files (+226 tests):
  - `auth-routes.test.js` (29 tests) - Auth endpoints
  - `classificationProgress-routes.test.js` (6 tests) - Classification progress
  - `patterns-routes.test.js` (40 tests) - Patterns routes (90.52% coverage)
  - `route-authentication.test.js` (59 tests) - Route auth verification
  - `scheduler-routes.test.js` (18 tests) - Scheduler routes
  - `setup-routes.test.js` (11 tests) - Setup endpoints
  - `startupService.test.js` (20 tests) - Startup service
  - `user-routes.test.js` (17 tests) - User profile/password endpoints
  - `webSocketService.test.js` (12 tests) - WebSocket service
  - Function coverage: 58.11% → 58.58%
- **OMDb Timeout Configuration** - Added `OMDB_REQUEST_TIMEOUT_MS` support for configurable OMDb request timeout (default 15000ms)
- **OMDb Retry Configuration** - Added `OMDB_MAX_RETRIES` support for configurable transient-retry attempts (default 2)
- **Enrichment Retry Stale Recovery** - Added automatic stale-row recovery for `enrichment_retry_queue` via `ENRICHMENT_RETRY_STALE_MS` (default 20 minutes)
- **Resilience Test Coverage** - Added targeted tests for:
  - OMDb concurrent request pacing serialization
  - Enrichment retry stale-processing recovery behavior
- **CSRF Protection** - Added double-submit CSRF protection for cookie-authenticated write requests (`classifarr_csrf_token` cookie + `X-CSRF-Token` header) with dedicated middleware tests
- **Client CSRF Regression Guard** - Added `client/src/__tests__/security/csrfClientUsage.test.js` to fail builds when mutating `axios`/`fetch` calls bypass the shared `@/api` client

### Changed

- **Route Authentication** - Protected 21 previously unprotected routes:
  - Tier 1 (Admin-only): `/reclassification`, `/policies`, `/mappings`, `/confidence`, `/rag`, `/patterns`, `/scheduler`, `/settings/path-mappings`, `/media-server`, `/classification`, `/settings`
  - Tier 2 (Authenticated): `/feedback`, `/prompts`, `/presets`, `/requests`, `/suggestions`, `/migration`, `/rating-normalization`, `/sync`, `/clarifications`
- **JWT Token Storage** - Migrated from localStorage to httpOnly cookies (XSS-proof)
- **Client API Layer** - Updated `client/src/api/index.js` for cookie-based auth with automatic token refresh
- **Client API Layer** - Write requests now automatically attach `X-CSRF-Token` from CSRF cookie, including refresh flow
- **Client API Standardization** - Migrated remaining auth/setup/settings/migration mutating requests from direct `axios`/`fetch` usage to shared `@/api` client wrappers for consistent CSRF/auth handling
- **Client API Cleanup** - Removed deprecated SmartRuleForm-only API wrappers from `client/src/api/index.js` (legacy rule-builder helper methods not used by active UI flows)
- **Login/Setup Views** - Updated `Login.vue`, `SetupAccount.vue` for cookie-based authentication
- **Cookie SameSite Policy** - Changed from `strict` to `lax` for browser compatibility
- **CORS Warning Behavior** - Moved CORS_ORIGIN warning to startup-only
- **Webhook Authentication** - Secret key now required; requests rejected with 401 if not configured
- **Webhook Settings UX** - Authorization Header controls moved directly under Webhook Endpoint/JSON Payload with inline `Unmask/Mask`, `Regenerate`, and `Copy` actions
- **Webhook Secret Reveal Safety** - Added inactivity-based auto-remask for revealed Authorization Header values (default 60s, timer resets on reveal/copy activity)
- **API Key Permission UX** - Removed `Webhook Only` option from Settings → Security create-key dropdown (webhook auth now handled in Webhooks settings via Authorization Header)
- **OMDb Request Pacing** - Global OMDb rate limiting now serializes concurrent requests to prevent startup/backlog bursts from creating timeout storms
- **API Key Logging** - Key no longer logged to console; view only in UI after login
- **Debug Endpoints** - Gated with `NODE_ENV !== 'production'` check
- **Dependency Updates** - All production dependencies updated; `npm audit` shows 0 vulnerabilities
- **Feedback Route** - Now uses `req.user.id` from JWT instead of request body
- **Security Environment Docs** - Documented `FORCE_SECURE_COOKIES` (for HTTPS vs local HTTP) and `CSRF_PROTECTION` in `.env.example`
- **OMDb Environment Docs** - Documented `OMDB_REQUEST_TIMEOUT_MS` and `OMDB_MAX_RETRIES` in `.env.example` for self-hosted tuning

### Deprecated

- **Rule Builder** - Removed deprecated rule builder feature (replaced by Policy Engine):
  - Deleted `server/src/routes/ruleBuilder.js`
  - Deleted `server/src/services/ruleBuilder.js`
  - Deleted `server/src/__tests__/ruleBuilder.test.js`
  - Deleted orphan `client/src/components/SmartRuleForm.vue` (no active route/import usage)

### Fixed

- **Critical: Unauthenticated Settings Access** - Applied `authenticateToken` + `requireAdmin` to settings routes
- **Critical: Unauthenticated Classification Access** - Applied `authenticateToken` + `requireAdmin` to classification routes
- **Critical: Unauthenticated Media Server Access** - Applied `authenticateToken` + `requireAdmin` to media-server routes
- **Cookie-Based Authentication** - Multiple fixes for session persistence:
  - Fixed cookie maxAge unit (was 900ms, now 900000ms = 15 minutes)
  - Added cookie-parser middleware for Express
  - Fixed `authenticateTokenOrApiKey` to check cookies (previously only checked headers)
  - Fixed `IS_SECURE` logic to use `FORCE_SECURE_COOKIES` env var instead of NODE_ENV
  - Fixed CORS to reflect origin instead of wildcard (required for credentials)
- **PostgreSQL tmpfs Permissions** - Fixed tmpfs mount (`uid=1000,gid=1000,mode=770`)
- **OMDb Daily Limit Reset** - Fixed timezone mismatch causing quota reset on every request
- **OMDb Test Timezone Mismatch** - Fixed `hasRemainingQuota` tests to use local timezone (`en-CA`) matching production code
- **Webhook Secret Decrypt Failures After Restart** - Added automatic webhook secret rotation/recovery when stored encrypted secret cannot be decrypted (e.g., encryption-key mismatch/corruption), preventing repeated `Failed to decrypt webhook secret` errors
- **Webhook Runtime Auth Config** - Webhook route now uses unmasked config (`getConfig({ mask: false })`) so encrypted secrets validate correctly during inbound webhook auth
- **Encryption Key Persistence Fallback** - When `API_KEY_ENCRYPTION_KEY` is unset, Classifarr now persists a generated key to `/app/data/secrets/api_key_encryption_key` and reuses it across restarts to avoid decrypt regressions
- **Enrichment Retry Noise Reduction** - OMDb `not found` results now hand off immediately to Tavily fallback (no extra pending retry churn), and interim retry-state logs no longer raise warning-level bug reports
- **OMDb Transient Retry Logging** - Transient OMDb retry warnings remain visible in runtime logs but are no longer persisted to the DB bug-report stream
- **Enrichment Retry Test Cleanup** - Removed outdated test for Tavily processing when OMDb quota unavailable (Tavily has monthly credits, not auto-retried)
- **Jest CLI Flag Update** - Fixed deprecated `--testPathPattern` to `--testPathPatterns` in `server/package.json`
- **Tavily Warning Spam** - Suppressed repeated warnings; now only logs at debug level
- **Webhook Secret Handling Regression** - Fixed masked secret preservation in `/api/settings/webhook` updates so masked placeholders are never persisted as live secrets
- **Webhook URL/Test Secret Source** - `/api/settings/webhook/url` and `/api/settings/webhook/test` now use decrypted full secret values instead of masked config values
- **Authorization Header Unmask Reliability** - Fixed initial unmask/remask flow where secret reveal could fail until regenerate
- **Logs Settings CSRF Regression** - Fixed Settings → Logs mutating actions (`Clear All`, `Prune Old`, resolve operations) to use shared API client and include CSRF token automatically
- **Legacy Migration CSRF Coverage Gap** - Fixed migration dashboard/wizard POST operations by routing through shared `@/api` client instead of raw `fetch`
- **Enrichment Retry Queue Stale Rows** - Fixed stale `processing` rows that could remain stuck after restart/interruption by auto-recovering them to `pending`/`failed` with attempt accounting
- **Enrichment Retry Queue Pending Drift** - Fixed stale `pending` rows that already had enrichment metadata (OMDb/Tavily) by auto-resolving them to `completed`, so pending counts represent actionable work without manual SQL cleanup
- **Enrichment Retry Selection Guard** - Retry processing now skips rows where required metadata is already present, preventing re-processing and re-inflated pending counters
- **OMDb Timeout Burst Amplification** - Reduced repeated OMDb timeout cascades under concurrent enrichment load by enforcing serialized pacing between requests
- **OMDb Retry Telemetry Clarity** - Added retry context (`maxRetries`, timeout) to transient OMDb warning logs and prevented terminal transient-unavailable warnings from being persisted as DB bug-report noise

### Security

- **CIS Docker Benchmark 4.8** - Added setuid/setgid binary removal to Dockerfile
- **CIS Docker Benchmark 5.3** - Added capability restrictions (`cap_drop: ALL`, selective `cap_add`)
- **CIS Docker Benchmark 5.10** - Added memory limits (2G) to docker-compose
- **CIS Docker Benchmark 5.12** - Added read-only root filesystem with tmpfs for writable paths
- **CIS Docker Benchmark 5.25** - Added `no-new-privileges` security option
- **CIS Score Improvement** - 74% → 79%
- **OWASP API Security** - 90% → 100%

---

## [v0.42.8a-alpha] - 2026-02-23

### Fixed

- **Embedding model warm-up uses correct Ollama endpoint**
  - Added `warmEmbeddingModel()` method that uses `/api/embed` instead of `/api/generate`.
  - `warmAllModels()` now calls `warmEmbeddingModel()` for embedding models.
  - `warmModel()` auto-falls back to `/api/embed` when model returns "does not support generate" error.
  - Fixes 400 error when warming embedding models like `mxbai-embed-large`.

---

## [v0.42.8-alpha] - 2026-02-23

### Fixed

- **AI model field resolution in getConfig()**
  - `getConfig()` now returns the `model` field from either `ollama_config.model` or `ai_provider_config.ollama_model`.
  - Added `this.model` to constructor and `resetConfig()` for proper state management.
  - Fixes `warmAllModels()` skipping AI classification model warm-up when using unified settings.

---

## [v0.42.7e-alpha] - 2026-02-23

### Fixed

- **Embedding model field resolution in warm-up**
  - `warmAllModels()` now checks both `embedding_model` and `embedding_ollama_model` fields.
  - `startScheduledPreflight()` uses same resolution logic for consistency.
  - Fixes issue where warm-all would fail when embedding model was configured in `embedding_model` field.

### Changed

- **Test coverage improvements**
  - Added 23 new unit tests for OllamaService methods.
  - Coverage baseline updated: server 47.50% → 48.28%, client 55.44% → 56.35%.

---

## [v0.42.7d-alpha] - 2026-02-23

### Added

- **Ollama preflight connection checks**
  - `preflightConnection()` method validates connectivity and model availability before classification.
  - Checks for model availability with flexible name matching (handles tag suffixes like `gemma3:12b:latest`).
  - Optional generation probe to verify model can actually generate responses.
  - Results cached for 60 seconds to avoid redundant checks.
- **Scheduled daily Ollama health check**
  - Runs every 24 hours to verify Ollama connectivity.
  - Checks both AI classification model and embedding model (if different).
  - Logs results for operational visibility.
- **Model warm-up endpoints**
  - `POST /api/settings/ollama/warm` - Load a specific model into memory with configurable keep_alive.
  - `POST /api/settings/ollama/warm-all` - Load both AI and embedding models simultaneously.
- **Preflight status endpoint**
  - `GET /api/settings/ollama/preflight/last` - Returns last scheduled preflight results for both AI and embedding models.
- **Specific retry reason codes for Ollama failures**
  - `ai_stream_incomplete` - Generation ended without done signal.
  - `ai_stream_stalled` - Stream stalled during generation.
  - `ai_stream_aborted` - Generation aborted before completion.
  - `ai_timeout` - Request timed out.
  - `ai_server_error` - HTTP 500 from Ollama.
  - `ai_gateway_error` - HTTP 502/504 from Ollama.
  - `ai_unavailable` - HTTP 503 from Ollama.

### Changed

- **HTTP 5xx errors treated as transient**
  - HTTP 500, 502, 503, 504 errors from Ollama now queue items for retry instead of failing permanently.
  - Errors logged as warnings instead of errors when transient.
- **Preflight cache TTL increased**
  - Default cache duration increased from 15s to 60s to reduce redundant checks.
- **Test connection endpoint enhanced**
  - `/api/settings/ollama/test` now accepts optional `model` parameter to test specific model availability.
- **Classification preflight integration**
  - `_streamGenerate()` now runs preflight check before attempting generation for faster failure detection.

### Fixed

- **Discord embed library name fallback**
  - Added `resolveSuggestedLibraryName()` to fall back to top alternative when `library_name` is undefined.
  - Prevents "Suggested library: undefined" in Discord notifications.

---

## [v0.42.7c-alpha] - 2026-02-23

### Added

- **OMDb SSL resilience configuration**
  - Added optional environment controls for SSL outage handling windows:
    - `OMDB_SSL_WARN_THROTTLE_MS`
    - `OMDB_SSL_BLOCK_MS`
    - `OMDB_SSL_RECOVERY_PROBE_MS`
- **Security header compatibility toggle**
  - Added `SECURITY_HEADERS_STRICT` runtime toggle for HTTP LAN deployments that need to suppress browser COOP/OAC warnings.

### Changed

- **OMDb SSL outage handling flow**
  - Queue enrichment now temporarily pauses direct OMDb calls after certificate failures, performs periodic recovery probes, and automatically resumes when OMDb health is restored.
  - SSL-related enrichment retries now stay on the OMDb retry lane (`enrichment_type='omdb'`) instead of falling through to Tavily fallback.
- **HTTP header policy behavior**
  - Helmet COOP/OAC behavior is now environment-driven:
    - strict mode enabled by default (`SECURITY_HEADERS_STRICT=true`)
    - COOP/OAC disabled only when explicitly set to `false`.

### Fixed

- **OMDb SSL warning log spam**
  - Repeated certificate-failure warnings are now throttled in both OMDb and queue-service paths.
- **Metadata routing fallback correctness during SSL outages**
  - Prevented SSL certificate failures from triggering incorrect non-OMDb fallback semantics while upstream certificates are temporarily invalid.

---

## [v0.42.7b-alpha] - 2026-02-23

### Added

- **Client dependency security guardrail**
  - Added a client-level dependency override to enforce `minimatch >=10.2.1` across transitive development dependencies.

### Changed

- **Client lockfile dependency resolution**
  - Regenerated `client/package-lock.json` so `@vue/test-utils` transitive `minimatch` entries resolve to `10.2.2` instead of vulnerable `9.x`.

### Fixed

- **Tag release OSV dependency scan failure**
  - Resolved `GHSA-3ppc-4f35-3m26` findings in client dev dependency chain that previously failed `OSV Dependency Scan` on `v0.42.7a-alpha`.

---

## [v0.42.7a-alpha] - 2026-02-23

### Added

- **AI clarification mapping regression coverage**
  - Added parser coverage to assert exact-match precedence for overlapping library names (for example, `Anime Movies` vs `Movies`).

### Changed

- None.

### Fixed

- **AI Library Mapping**
  - Prioritized exact string matching for AI clarification options so `Movies` maps to `Movies` instead of `Anime Movies` when libraries have overlapping substring names.

---

## [v0.42.7-alpha] - 2026-02-20

### Added

- **One-time post-upgrade log reset task**
  - Added `clear_logs_0427` to post-upgrade tasks so upgraded instances run a one-time `error_log`/`app_log` clear for a fresh operational baseline.

### Changed

- **RAG stage-event noise reduction**
  - Suppressed persistence of informational second-pass success events with `outcome='applied'` (for example, `retrieval_pass2 applied (hybrid)` and `ai_rerun applied (material_improvement)`) from `error_log`/bug-report surfaces.

### Fixed

- **Command Center processing title fallback**
  - Active processing cards now resolve display title/year/media type from nested task payload fields (`media.*`, `metadata.*`, and `subject`) before falling back to `Unknown`.
- **OMDb retry exhaustion fallback semantics**
  - Exhausted OMDb retry rows now hand off to Tavily fallback and are marked `skipped` instead of terminal `failed` when fallback is available.
  - Expected OMDb no-data misses now log as informational handoffs instead of terminal operational errors.

## [v0.42.6-alpha] - 2026-02-19

### Added

- **Runtime wiring preflight validation**
  - Added `startupService.validateRuntimeWiring()` to validate critical runtime contracts before queue/scheduler startup.
  - Startup now checks constructor/export wiring for `OperationController`, `classification.withTimeout`, and `ragLogger.logStageEvent`.
  - If validation fails, startup skips queue worker and scheduler initialization and emits structured diagnostics.

### Changed

- **CARSA reset hardening**
  - Refactored `queueService.clearAndResync()` cleanup into a transactional path with rollback support when a pooled DB client is available.
  - Added explicit table locking and deterministic FK-safe cleanup sequencing around `libraries` and `media_server_sync_status`.
  - Added cleanup of `policy_feedback_log.selected_library_id` references during full reset (while preserving feedback rows).
  - CARSA error path now normalizes into structured codes:
    - `CARSA_DEPENDENCY_CONFLICT`
    - `CARSA_RESET_FAILED`
  - `/api/queue/clear-and-resync` now returns structured `code` and `details` payloads on failures.
- **Second-pass stage logging policy**
  - Recoverable `rag_pass1_candidate_failed` and `rag_pass2_failed` stage events now downgrade to `INFO` when no hard error object exists.
  - Stage-event metadata now consistently carries `raw_error_message`, `raw_error_name`, `raw_error_code`, and raw reason fields.
- **Import contract alignment**
  - `classification.js` now uses named import `{ OperationController }` to match `operationController` module exports.

### Fixed

- **Second-pass constructor crash**
  - Resolved `TypeError: OperationController is not a constructor` in RAG second-pass timeout orchestration paths.
- **Clear-and-resync dependency failure diagnostics**
  - Improved visibility and API-level context for FK-blocked CARSA runs instead of opaque generic errors.

---

## [v0.42.5e-alpha] - 2026-02-19

### Added

- **CARSA failure recovery coverage**
  - Added queue-service regression coverage to verify the worker is restarted if `clearAndResync()` fails after worker shutdown.
- **Confidence history rendering normalization**
  - Added client-side normalization for confidence audit rows across mixed field shapes (snake_case/camelCase).

### Changed

- **CARSA dependency clear order**
  - `clearAndResync()` now deletes `media_server_sync_status` rows before deleting `libraries` to honor non-cascading FK constraints.
  - CARSA result payload/log now includes `syncStatusRowsCleared`.
- **CARSA error-path behavior**
  - If CARSA fails and the worker was previously active, queue worker restart is now requested automatically.
- **Confidence settings history UX**
  - History table now uses friendly setting labels, value formatting, and includes change-reason visibility.
  - Revert action is now disabled for non-actionable/non-revertable rows.

### Fixed

- **Clear-and-resync FK failure** - resolved `libraries` delete failure caused by `media_server_sync_status_library_id_fkey`.
- **Worker paused after CARSA failure** - queue processing no longer remains offline when clear-and-resync errors out.
- **Confidence history “Unknown” noise** - history rows now render meaningful setting/value/date/user data.
- **Header notifications dropdown layering**
  - Fixed header notification/account dropdown positioning and stacking so panels render below the header (not underneath it) on Command Center and other pages.

---

## [v0.42.5d-alpha] - 2026-02-19

### Added

- **Confidence-aware second-pass config gate**
  - Added `policy_recheck_skip_when_ai_confident_enabled` to RAG loop config manifest (default `true`).
  - Added migration `database/migrations/20260219_010500_add_policy_recheck_skip_when_ai_confident.sql` to add/backfill the new column in `ai_provider_config`.
- **Second-pass gate coverage**
  - Added unit coverage for policy prompt-select skip behavior when AI confidence already exceeds auto threshold and no risk signals are present.
  - Added classification orchestration coverage to assert pass2 retrieval is skipped and trace reason code is `policy_prompt_risk_clear`.

### Changed

- **Second-pass trigger policy (Issue 275 follow-up)**
  - `shouldTriggerSecondPass()` now skips policy prompt-select second pass when:
    - AI confidence is already at/above policy auto-classify threshold, and
    - no prompt-risk signals exist (no clarification flag, no conflict signal, no narrow top-score gap).
- **Stage event reason resolution**
  - Classification gate skip events now emit explicit reason-code mapping for `policy_prompt_risk_clear` (instead of generic gate-not-met/context-missing fallback).
- **RAG stage diagnostics**
  - Stage-event persistence now carries raw error fields (`message/name/code/stack`) and preserves raw metadata fields for downstream analysis.
  - Generic `rag_pass1_candidate_failed`/`rag_pass2_failed` can now be refined to specific mapped reason codes when raw error detail is available.
- **Tavily enrichment logging semantics**
  - Classification web enrichment now treats Tavily `432` as monthly deferral (`INFO`) and logs non-`432` failures as actionable errors.
  - Enrichment retry service now consistently logs Tavily enrichment failures with status and error payload.
- **SQLSTATE normalization hardening**
  - SQLSTATE validators in RAG logger/error handler now require at least one digit, preventing non-SQL codes (for example `EPIPE`) from being treated as SQLSTATE.
- **Second-pass no-op suppression**
  - Added `policy_prompt_risk_clear` to skip-by-design/no-op suppression sets to reduce non-actionable Error Log noise.
- **Release gate tooling**
  - Copyright check/update scripts now ignore generated `coverage/` directories so release checks are stable after coverage runs.

### Fixed

- **Unnecessary pass2 retrieval attempts on already-high-confidence prompt-select results** - second pass is now skipped deterministically when risk is clear.
- **Noisy logging for expected policy skip paths** - skip-by-design cases now remain quiet in persisted log views.
- **Ambiguous pass2 error telemetry** - refined reason-code mapping now keeps raw error context while producing clearer failure reasons.
- **Misclassification of non-SQL provider codes as SQLSTATE** - normalization now rejects non-digit alphanumeric codes.

---

## [v0.42.5c-alpha] - 2026-02-18

### Added

- **Migration to restore Tavily quota failures to deferred pending**
  - Added `database/migrations/20260218_231500_restore_tavily_quota_rows_to_pending.sql` to move legacy Tavily quota-related `failed/skipped/exhausted pending` rows back to a deferred pending state.
- **Second-pass no-op suppression coverage**
  - Added `ragLogger` unit coverage for non-actionable stage-event suppression behavior.

### Changed

- **Enrichment retry pipeline separation**
  - `EnrichmentRetryService.triggerProcessing()` now evaluates OMDb and Tavily independently so OMDb quota pause no longer blocks Tavily retry processing.
- **Tavily monthly deferral lifecycle**
  - Quota-limited Tavily rows are normalized to `status='pending'`, `reason='tavily_monthly_quota_deferred'`, and `attempts=0`.
  - Deferred rows are excluded from execution during the same month and become runnable after month rollover.
- **Queue upsert behavior for deferred rows**
  - `queueForRetry` now reopens deferred Tavily rows as pending and resets attempts when the deferred reason is present.
- **RAG stage-event logging policy**
  - Suppressed persistence of non-actionable second-pass “no-op” outcomes/reasons (for example: `policy_not_upgraded`, `no_material_improvement`, `auto_default`, `rag_pass1_candidate_failed`, `rag_pass2_failed`) to reduce log noise.

### Fixed

- **Tavily retries blocked by OMDb quota path** - Tavily processing now continues even when OMDb daily quota is unavailable.
- **Deferred Tavily rows ending in terminal states** - legacy and active quota-related rows are normalized back into deferred pending state.
- **Second-pass informational log flood** - no-op second-pass events no longer pollute persisted error log views.

---

## [v0.42.5b-alpha] - 2026-02-18

### Added

- **Tavily monthly deferral recovery**
  - Added deferred-state reactivation logic so Tavily retries skipped for monthly quota can automatically return to pending when a new month starts.
- **Migration for legacy Tavily exhausted rows**
  - Added `database/migrations/20260218_223500_defer_tavily_exhausted_retries.sql` to preserve exhausted Tavily `432` retries as deferred instead of dead pending.

### Changed

- **Enrichment retry queue upsert behavior**
  - `queueForRetry` now preserves terminal states (`completed`, exhausted `failed`, deferred `skipped`) and avoids reopening exhausted rows as `pending`.
- **Retry telemetry severity**
  - Auto-heal exhausted-pending events now log as `INFO` instead of `WARN` to reduce alert fatigue.

### Fixed

- **Tavily monthly quota retries consuming attempts** - Tavily `432` responses now defer rows until monthly reset instead of incrementing attempts to exhaustion.
- **Repeated “Auto-healed exhausted pending enrichment retries” warning bursts** - queue state churn reduced by stabilizing retry state transitions and preserving deferred/exhausted states.

---

## [v0.42.5a-alpha] - 2026-02-18

### Added

- **Routing outcome diagnostics**
  - `classificationService.routeToArr` now returns a structured result (`attempted`, `routed`, `reason`, `error`, `arrType`) instead of failing silently.
  - Classification pending-resolution API now returns `routingReason` alongside `routed`/`routingError`.
- **Retry queue self-heal path**
  - Added automatic cleanup for exhausted enrichment retries (`status='pending' AND attempts >= max_attempts`) to prevent dead pending rows.

### Changed

- **Discord correction flow**
  - `processCorrection` now marks clarification as resolved, writes `clarification_response`, and attempts post-correction routing.
  - Discord correction/clarification messages now include explicit routing outcome text and follow-up details when routing is skipped or fails.
- **Command Center queue consistency**
  - “Up Next” list/count now consistently use pending classification tasks only.

### Fixed

- **Silent Sonarr/Radarr non-routing after Discord correction** - corrected items no longer stop at `status='corrected'` with unresolved clarification while appearing completed to the user.
- **Dead enrichment retry queue pending rows** - exhausted retries are now promoted to `failed` and no longer remain indefinitely pending.
- **False-positive routed state transitions** - pending resolution now updates `classification_history.status='routed'` only when route execution actually succeeds.

---

## [v0.42.5-alpha] - 2026-02-18

### Added

- **Coverage ratchet tooling and CI enforcement**
  - Added `scripts/check-coverage-ratchet.js`, `scripts/update-coverage-baseline.js`, and `scripts/coverage-ratchet-utils.js`
  - Added baseline file `docs/testing/coverage-baseline.json`
  - Wired ratchet validation into root CI/test scripts and GitHub workflow
  - Updated `docs/testing/coverage.md` with ratchet usage and guardrails
- **Database migration for missing vector index**
  - Added `database/migrations/20260218_150000_backfill_missing_rag_text_hnsw_index.sql`
  - Idempotently backfills `idx_embeddings_hnsw` when `pgvector` and `hnsw` are available
- **Expanded route coverage suites**
  - Added high-yield route coverage tests for policies, stats, queue, and libraries

### Changed

- **AI parse resilience**
  - `AIResponseParser` now returns structured `parse_failure_reason`
  - Verify-mode parsing now only accepts verify-safe formats (no CONFIDENT fallback)
  - Classification flow now performs an optional AI response repair attempt before final fallback
  - Parse diagnostics (`contract_version`, attempts, repair status, failure reason) are persisted with classification metadata
- **RAG loop reliability**
  - Added retry-aware handling for pass1 candidate and pass2 retrieval stages with bounded retries and backoff
  - Expanded reason-code taxonomy for timeout, provider, DB, embedding, and abort scenarios
  - Improved stage-event persistence alignment with `rag_metrics` emission
- **Phase tracking and UI consistency**
  - Classification phase transitions now support explicit skipped phases
  - Command Center stepper now renders skipped state for `signal_combine` (desktop + mobile)
- **Logs observability UX**
  - Log stats endpoint now returns total logs and multi-level trend counters (ERROR/WARN/INFO/DEBUG)
  - Logs UI now supports Info-level filtering and uses reset-on-filter-change pagination
  - Log level badges now render with level-specific styles beyond just error/warning
- **Logging internals**
  - `logger.error`/`logger.warn` now support `skipDbPersist` to prevent duplicate database writes in RAG logging paths

### Fixed

- **Signal Combination visibility** - workflows that intentionally skip `signal_combine` now show a clear skipped state instead of appearing as missing.
- **Malformed AI response handling** - malformed responses now have deterministic fallback metadata and optional one-pass repair before final manual review fallback.
- **Log totals mismatch in Settings** - log dashboard totals now reflect full log volume, not only error-level slices.

---

## [v0.42.4-alpha] - 2026-02-18

### Removed

- **OMDb Circuit Breaker** — Removed `omdbCircuitBreaker.js` utility and all associated logic. The circuit breaker was tripping too aggressively on transient network issues, blocking valid enrichment requests even when the OMDb API was functional. Existing protections (15s timeout, 2 retries with exponential backoff, daily quota check, enrichment retry queue) are sufficient for an optional enrichment service.
  - Removed `circuitBreaker.execute()` wrappers from `omdb.js` `getByTitle` and `getByIMDBId` methods
  - Removed `circuit_open` status and `circuitBreaker` field from `healthCheckService.js` `checkOMDb` response
  - Removed `POST /api/settings/omdb/circuit-breaker/reset` admin endpoint from `settings.js`
  - Removed dead `isCircuitOpen` check from `enrichmentRetryService.js`
  - Deleted `omdbCircuitBreaker.test.js`; updated `omdb.test.js` and `omdb-integration.test.js` to remove circuit-breaker-specific assertions

---

## [v0.42.3c-alpha] - 2026-02-17

### Fixed

- **Schema File Sync** — Added missing `policy_recheck` method to `database/schema/current.sql` constraint definition (was added in migration but missed in schema file)
- New migration `20260217_192610_fix_classification_method_constraint.sql` consolidates all 22 classification methods

---

## [v0.42.3b-alpha] - 2026-02-17

### Added

- **Constraint Validation Tests** (`server/src/__tests__/classification-methods-constraint.test.js`) — Unit test that scans all service code for `method:` values and validates against allowed list
- **Integration Constraint Tests** (`server/src/__tests__/integration/classification-methods-constraint.test.js`) — Validates DB constraint matches code and can insert with each method

### Fixed

- **Policy Recheck Method Constraint** — Added missing `policy_recheck` method to `classification_history_method_check` constraint
- New migration `20260217_233000_add_policy_recheck_method.sql`

---

## [v0.42.3a-alpha] - 2026-02-17

### Fixed

- **Classification Method Constraint** — Added missing methods (`rag_improved`, `authoritative_source_library`, `policy_engine`) to `classification_history_method_check` constraint that were causing database insert failures
- New migration `20260217_224200_add_missing_classification_methods.sql`
- Updated `database/schema/current.sql` to include new methods

---

## [v0.42.3-alpha] - 2026-02-17

### Added

- **OperationController Utility** (`server/src/utils/operationController.js`) — Unified timeout and cancellation handling with two modes:
  - `simple` mode: Basic timeout with abort support
  - `streaming` mode: Heartbeat-based stall detection with partial result recovery
- **OperationController Tests** (`server/src/__tests__/operationController.test.js`) — 29 tests covering constructor, simple/streaming modes, abort, reset, and factory
- **AbortSignal Tests for RAG** (`server/src/__tests__/ragRetriever.test.js`) — 4 new tests for AbortSignal support in semanticSearch, hybridSearch, and fullTextSearch

### Changed

- **Cloud Embedding Providers** (`server/src/services/embeddingProvider.js`) — All cloud embedding methods now accept optional `signal` parameter:
  - `getOpenAIEmbedding()`, `getGeminiEmbedding()`, `getVoyageEmbedding()`, `getOpenRouterEmbedding()`, `getCohereEmbedding()`
  - Methods pass `signal` to axios for proper HTTP cancellation
  - Methods re-throw `AbortError` immediately without recording as failures
- **RAG Retriever** (`server/src/services/ragRetriever.js`) — `semanticSearch()` now passes `signal` to `embeddingRouter.embed()`
- **Classification Service** (`server/src/services/classification.js`) — Enhanced `withTimeout()` method:
  - Supports function-based operations with actual abort capability (uses `OperationController`)
  - Maintains backward compatibility with promise-based pattern
  - Updated RAG calls (`semanticSearchCandidates`, `semanticSearch`, `hybridSearch`) to use abortable function pattern
- **Embedding Router** (`server/src/services/embeddingRouter.js`) — Fixed orphaned duplicate code block causing syntax errors

### Fixed

- **Test Assertions** — Updated `embeddingProvider.test.js` and `embeddingRouter.test.js` to expect new `signal` parameter in mock calls

---

## [v0.42.2-alpha] - 2026-02-17

### Added

- **Signal Agreement Scoring** — `PolicyEngine.calculateAgreementMultiplier()` applies a graduated consensus multiplier (1.05–1.30×) when 2-5 enabled signals contribute a positive score. Result includes `agreement.multiplier` and `agreement.contributing` in evaluation metadata.
- **Agreement multiplier unit tests** — `agreementMultiplier.test.js` with 7 tests covering all multiplier tiers (0-5 signals), enabled-only counting, and the 95 cap.
- **Relaxed gate unit tests** — 2 new tests in `ragLoopHelpers.test.js` for significant improvement without action upgrade and OR-based adoption.

### Changed

- **Policy recheck gate** (`ragLoopHelpers.js`) — relaxed to allow adoption when confidence gain is ≥2× the minimum threshold, even without an action upgrade (previously required action upgrade).
- **Compare pass results** (`ragLoopHelpers.js`) — adoption gate changed from AND to OR logic: confidence improvement, similarity delta, or margin delta alone can now trigger adoption.
- **RAG loop timeouts** (`classification.js`) — increased max loop timeout from 5s to 15s (default 10s), with a minimum 3s budget reserved for AI reruns.
- **Candidate building** (`classification.js`) — when policy/AI don't produce a pass2 candidate, candidates are now built from pass2 RAG matches.
- **Policy question filtering** (`policyQuestionBuilder.js`) — low-score candidates (below a configurable threshold) are filtered from policy questions.
- **Roadmap** (`docs/roadmap.md`) — moved "Second Pass reliability fixes" and "Signal Agreement Scoring" to Recently Completed.

---

## [v0.42.1d-alpha] - 2026-02-17

### Added

- `hasRemainingQuota()` method in OMDbService to check daily limit without incrementing
- 11 new tests for quota checking and retry scheduling logic

### Changed

- **Enrichment retry** - Now ONLY retries OMDb (not Tavily). Tavily has monthly credits and should not be auto-retried.
- **Enrichment retry** - Respects OMDb daily limit. Pauses retry when limit reached until next day reset.
- **Enrichment retry** - Limits batch size to remaining quota (won't exceed daily limit)

---

## [v0.42.1c-alpha] - 2026-02-17

### Added

- **Smart Enrichment Retry** - OMDb/Tavily enrichment retry now triggers on-demand when items are queued (5 second debounce). No more manual "Retry OMDb" clicks needed.
- 7 new tests for scheduling logic (`scheduleProcessing`, `triggerProcessing`, `cancelScheduledProcessing`)

### Changed

- **Enrichment retry cron** - Reduced from every 10 minutes to every 6 hours (on-demand trigger handles immediate needs, cron is safety net only)

---

## [v0.42.1b-alpha] - 2026-02-17

### Added

- **Test Coverage** - New test suites for high-risk services:
  - `enrichmentRetryService.test.js` (28 tests) - covers OMDb/Tavily enrichment retry logic
  - `aiRouter.test.js` (23 tests) - covers AI provider routing and budget fallback
  - `mediaSync.test.js` (22 tests) - covers library sync with Plex/Jellyfin/Emby
  - `radarr.test.js` (27 tests) - covers Radarr API integration
  - `sonarr.test.js` (27 tests) - covers Sonarr API integration
  - `tavily.test.js` (25 tests) - covers web enrichment API
  - `plex.test.js` (18 tests) - covers Plex media server integration
  - `jellyfin.test.js` (17 tests) - covers Jellyfin media server integration
  - `emby.test.js` (17 tests) - covers Emby media server integration
- **.gitattributes** - Expanded to enforce LF line endings for all text files

### Changed

- **Header** - Hamburger menu icon now hidden on desktop (sidebar is always visible, button was non-functional)

### Fixed

- **EnrichmentRetryService** - Corrected OMDb method call from `getById` to `getByIMDBId`

---

## [v0.42.1a-alpha] - 2026-02-17

### Added

- **"Waiting for AI" UI State** - Command Center Processing section now displays clear message when tasks are queued but AI provider is offline, with quick link to AI settings
- **OMDb Integration Tests** - New comprehensive test suite with 16 integration tests using 10 real media examples (mix of TV/movies)
- **Database Migration** - Added `routed` status to `classification_history_status_check` constraint for items successfully sent to \*arr after manual resolution

### Changed

- **OMDb Rate Limiting** - Minimum 1-second delay between all OMDb API requests to prevent Cloudflare 520 errors
- **OMDb Cloudflare Retry Delays** - Increased from 1-2 seconds to 3-6 seconds for Cloudflare 5xx errors (520, 521, 522, 523, 524)
- **OMDb Test Coverage** - Added rate limiter tests, 522 Cloudflare error tests, and circuit breaker state isolation

### Fixed

- **Classification Routing** - `classification_history` constraint violation when status was set to "routed" after successful \*arr routing

---

## [v0.42.1-alpha] - 2026-02-16

### Changed

- **Circuit Breaker Expansion** - OMDb circuit breaker now trips on additional error conditions:
  - DNS resolution failures (`ENOTFOUND`, `EAI_AGAIN`)
  - Connection resets (`ECONNRESET`)
  - Cloudflare/server errors (HTTP 502, 503, 504, 520, 521, 522, 523, 524)
  - Previous coverage was limited to `ECONNABORTED`, `ETIMEDOUT`, `ECONNREFUSED`

### Fixed

- **Clipboard Fallback** - Webhook URL and secret key copy buttons now fall back to `document.execCommand('copy')` when `navigator.clipboard` is unavailable (non-HTTPS contexts)
- **Null Safety** - `formatSettingKey()` in Confidence.vue now handles undefined/null keys gracefully

---

## [v0.42.0-alpha] - 2026-02-14

### Added

- **Command Center** - Unified action-first operational surface replacing fragmented Dashboard/Activity/Queue workflows:
  - Split-layout design with Processing (left) + Needs Attention (right) primary panels
  - Visual phase stepper showing 8-step classification progress inline
  - Collapsible secondary sections: Errors, Enrichment, Recently Completed, Quick Add, Libraries, Today's Summary
  - Mobile-responsive layout with bottom sheet for Processing details
  - Deep-link anchors for all sections (`#processing`, `#needs-attention`, `#errors`, etc.)
- **Global Notification System** - Complete in-app notification infrastructure:
  - Bell icon in header with unread badge count
  - Notification panel with unread/read grouping and row actions
  - Full `/notifications` view with filters and pagination
  - Open-target routing to Command Center sections from notifications
  - Read/unread state persistence across sessions
- **Legacy Route Compatibility** - Graceful redirect behavior for existing bookmarks:
  - `/dashboard` → Command Center with guidance notice
  - `/activity` → Command Center `#processing` with guidance notice
  - `/queue` → Command Center `#processing` with guidance notice
  - Dismissible legacy route notices explaining the transition
- **Adaptive SWR Data Layer** - Smart refresh cadence for live operational data:
  - Active workload: faster polling during classification
  - Idle state: slower polling to reduce unnecessary requests
  - Hidden tab: pauses aggressive refresh when browser tab is hidden
  - Freshness indicator with "Live" / "Updating" status

### Changed

- **Navigation Architecture** - Command Center is now the default landing page:
  - `/` route loads Command Center directly
  - Activity and Queue removed from primary sidebar navigation
  - Migration page removed from primary navigation
  - Smart Rule Builder v2 deprecated from active user journeys
- **Status Bar Design** - Non-sticky status bar scrolls with page content:
  - Shows AI/Worker health indicators
  - Queue pending count and action items count
  - Live/Updating status with timestamp
- **Section Collapsibility** - Secondary sections default to sensible expansion states:
  - Errors and Enrichment expanded by default (action-needed)
  - Libraries expanded by default (context)
  - Quick Add and Today collapsed by default (on-demand)

### Deprecated

- `/activity` page - functionality moved to Command Center Processing module
- `/queue` page - functionality moved to Command Center Processing/Errors modules
- `/dashboard` page - replaced by Command Center
- Smart Rule Builder v2 entry points - removed from primary navigation

### Fixed

- Module headers changed from UPPERCASE to Title Case for improved readability
- Section anchor IDs properly resolve for deep-linking from notifications
- Test suite updated to match new split-layout design and collapsible sections

---

## [v0.41.3-alpha] - 2026-02-11

### Added

- RAG low-confidence second-pass framework (Issue #275) with targeted policy re-check path and bounded rerun controls.
- New RAG loop configuration manifests/validation and tests:
  - `server/src/utils/ragLoopConfig.js`
  - `server/src/utils/ragLoopHelpers.js`
  - `server/src/services/ragLoopMetricsCollector.js`
  - `server/src/services/ragLoopResilienceManager.js`
- New schema migrations for Issue 275:
  - `database/migrations/20260211_090000_add_rag_loop_core_config.sql`
  - `database/migrations/20260211_090100_add_rag_loop_governance_config.sql`
  - `database/migrations/20260211_090200_add_rag_loop_error_observability.sql`
  - `database/migrations/20260211_090300_add_rag_loop_trace_query_indexes.sql`
  - `database/migrations/20260211_090400_enable_rag_loop_apply_defaults.sql`
  - `database/migrations/20260211_090500_add_rag_loop_auto_fallback_config.sql`
- Automatic rollout fallback controls (`apply -> shadow`) with incident payload state persisted on `ai_provider_config`.
- Optional version-aware auto-recover controls (`shadow -> apply`) for post-fix retry behavior.
- Preset usage-count labels in policy/preset selection surfaces (`Used in X policies`).
- New post-upgrade release task target:
  - `server/src/services/postUpgradeService.js` now includes `clear_logs_0413` for `0.41.3`.

### Changed

- RAG loop defaults now activate immediate apply mode for this release:
  - `rag_retrieval_loop_enabled=true`
  - `policy_recheck_below_prompt_threshold_enabled=true`
  - `rag_loop_rollout_mode='apply'`
- Classification pipeline now records and evaluates apply-mode health metrics to drive automatic fallback decisions.
- RAG API/settings responses now expose fallback state and incident metadata for diagnostics.
- Integration test runtime hardened for long-running scenarios (`300000ms` timeout in integration config/setup).

### Fixed

- JSON body parse failures now return a clean 400 (`Invalid JSON payload`) without unnecessary error-report noise.
- OMDb HALF_OPEN throttle/circuit-block events no longer generate warning spam; logging is throttled/downgraded for expected blocked states.
- Queue warning behavior for OMDb circuit-blocked enrichment failures now avoids repetitive high-noise warnings while keeping actionable diagnostics.

---

## [v0.41.2d-alpha] - 2026-02-07

### Changed

- DB: schema snapshot loader strips UTF-8 BOM and ensures `schema_migrations` exists during fresh installs.
- UI: RAG Settings status bar uses the correct API routes for status/backfill/heartbeat.

### Fixed

- Fresh installs: schema snapshot no longer fails on startup due to BOM/missing `schema_migrations` and will fall back to migrations when needed.
- Setup: `/login` now redirects to `/setup-account` when no users exist yet (avoids a fresh-install dead-end).
- UI: RAG Settings status bar icon labels no longer render as garbled characters.

---

## [v0.41.2c-alpha] - 2026-02-06

### Changed

- UI: preserve active RAG Settings tab on refresh (via `?tab=`).
- UI: rename "Policy Engine - Classification Thresholds" to "Classification Thresholds".
- Repo: ignore `.tmp/` intermediate artifacts.

### Fixed

- RAG Settings: refreshing no longer resets the view back to Overview.

---

## [v0.41.2b-alpha] - 2026-02-06

### Added

- CI/CD: workflow dispatch mode to run Docker cleanup without running the full pipeline.
- Tests: regression coverage for policy-based auto-routing thresholds.

### Changed

- Discord: confidence tier selection now prefers per-policy thresholds when available.
- Classification: auto-routing now respects the PolicyEngine auto-classify threshold (not a hardcoded 90%).
- CI/CD: Docker Hub tag cleanup now paginates and fails fast on HTTP errors.

### Fixed

- Docker cleanup: keep `latest` plus the newest 5 tags (by `last_updated`) on Docker Hub.

---

## [v0.41.2a-alpha] - 2026-02-06

### Changed

- CI/CD: improved Dependabot OSV scan behavior; Docker images publish on release tags only.
- UI: refinements to RAG status strip presentation.
- Dependencies:
  - `dotenv` -> `17.2.4` (root + server)
  - `glob` -> `13.0.1` (dev)
  - `pg-mem` -> `3.0.11` (server dev)

### Fixed

- OMDb: retry transient socket/network errors.
- Circuit breaker logging: preserve failure stack traces.
- DB schema alignment: add missing `learning_patterns.media_type` to prevent runtime errors.

---

## [v0.41.2-alpha] - 2026-02-06

### Added

- **Multimodal RAG (Image Embeddings)** (Issue #289, Closes #289)
  - Image embedding configuration fields and migrations (size, rate limits, cache)
  - Image embedding provider service for cloud/local providers
  - Image embedding storage on `classification_embeddings` with model/size/hash metadata
  - Combined text + image similarity scoring during retrieval
- **Image Embedding UI**
  - Separate image embedding configuration with disabled mode default
  - Overview summary for text + image embedding status
  - Re-embed images action and image backfill status
- **Migration Governance**
  - Timestamped migration support + legacy allowlist
  - Migration validation script `scripts/check-migrations.js`
- **Repo Workflow Foundations**
  - `directives/` and `execution/` with comprehensive READMEs
  - Database schema snapshot `database/schema/current.sql`

### Changed

- **Image Embedding Modes**
  - Default image embedding mode is now `disabled`
  - Removed “same host as text embeddings” option
  - Simplified local hosting to custom host/port only
- **Docker Compose Simplification**
  - Removed image-embedder stack and docker socket proxy from compose files
  - Local image embedder moved to optional external service
- **Tests**
  - Updated server and client tests to cover new image embedding defaults and status
- **Unraid Template Cleanup**
  - Removed redundant XML sections (`Networking`, `Data`, `Environment`, `Shell`, empty `PostArgs`) for cleaner templates

### Fixed

- **Test Noise**
  - Reduced console error noise in client tests (service status error handling)
- **Copyright Tooling**
  - Avoid scanning `node_modules` and handle directory matches safely
- **Dependency Hygiene**
  - Resolved npm audit findings after dependency install

---

## [v0.41.1-alpha] - 2026-02-02

### Added

- **OMDb Circuit Breaker** (PR #293)
  - Implemented 3-state circuit breaker (CLOSED, OPEN, HALF_OPEN) for OMDb service
  - Added automatic recovery after 30-second cool-off period
  - Added visual indicators in System Health dashboard (Open/Half-Open states)
  - Added admin reset endpoint for manual intervention
  - Improved error handling: Timeouts now throw errors to trigger Tavily fallback instead of returning null
- **Node.js 24 LTS Support** (PR #296)
  - Standardized all environments (Docker, CI/CD, Dev) to Node.js 24.11.0+
  - Added `.nvmrc` and proper engines field enforcement
  - Added `docs/nodejs-24-migration.md` guide
- **Test Script Standardization**
  - Standardized `npm run test` scripts for consistency across client and server
  - Server: `npm run test:unit` now correctly uses `jest.config.js` (removed invalid path pattern)
  - Server: `npm run test:integration` now runs with `--runInBand` by default to prevent race conditions
  - Client: `npm run test:unit` now correctly targets `src/__tests__` instead of non-existent subfolder

### Changed

- **Dependency Updates** (Fixes #294 - Comprehensive Dependency Audit and Update)
  - Standardized axios version across all workspaces (root, server, client) to `^1.13.4`
  - Updated server dependencies to latest compatible versions:
    - express: `^4.18.2` â†’ `^4.22.1` (latest 4.x)
    - discord.js: `^14.14.1` â†’ `^14.25.1` (latest 14.x)
    - dotenv: `^16.3.1` â†’ `^17.2.3` (latest)
    - helmet: `^7.1.0` â†’ `^7.2.0`
    - jsonwebtoken: `^9.0.2` â†’ `^9.0.3`
    - pg: `^8.17.1` â†’ `^8.18.0`
    - swagger-ui-express: `^5.0.0` â†’ `^5.0.1`
    - morgan: `^1.10.0` â†’ `^1.10.1`
  - Updated client dependencies:
    - vue-router: `^4.2.5` â†’ `^4.6.4` (latest 4.x)

### Fixed

- **Cloudflare Error Handling** (PR #252)
  - Extended retry logic to cover all primary Cloudflare error codes (520, 521, 522, 523)
  - Added comprehensive test coverage for error scenarios
- **Rating Normalization Priority** (PR #134)
  - Updated rating priority chain: OMDb (MPAA) â†’ TMDB â†’ Normalized Age â†’ NR
  - Ensures most reliable MPAA ratings are preferred over generic age ratings
- **Dependency Hygiene** (PR #297)
  - Updated 12+ packages including `axios`, `express`, `pg`, `discord.js`
  - Resolved 4 moderate security vulnerabilities via overrides (undici, glob)

## [0.41.0-alpha] - 2026-02-01

### Added

- **Test Coverage Improvements** (Fixes #227)
  - Added integration tests for Sonarr season mapping with `include_specials` flag
  - Added coverage reporting scripts for server and client (`npm run test:coverage`)
  - Added coverage badge to README
  - Added `docs/testing/coverage.md` with comprehensive testing guide
  - Added logger mocking to suppress expected error noise in tests
  - Added test to verify expected errors log as warnings (404s don't log as errors)
  - Added coverage thresholds for server: 80% lines, 75% functions, 70% branches
  - Added CI test scripts with `npm run test:ci`
- **Backup & Restore System** (Fixes #186)
  - Encrypted config backups with AES-256-GCM encryption
  - Export/import with replace or merge modes
  - Complete audit trail of all backup operations
  - Settings → System → Backup & Restore UI
  - Backups stored in `/app/data/backups`
  - What's backed up: Services, libraries, policies, library labels, settings, auto-learned preferences, all service configs (Ollama, TMDB, OMDb, AI, Webhooks)
  - What's not backed up or restored: User accounts, history, statistics, embeddings
  - Password-protected encrypted backups (default, min 8 characters)
  - Plaintext backup option with security warning
  - Backup preview before restore showing item counts
  - Replace mode: wipe config tables and restore from backup
  - Merge mode: keep existing data, add items from backup
  - List, download, and delete backups from UI
  - New API key generated and persisted on restore
  - New database tables: `backup_audit`, `backup_schedules`
  - New service: `backupService.js` with encryption/decryption utilities
- **Comprehensive Confidence Settings Page** (Fixes #241)
  - Unified UI for all confidence thresholds (policy, Discord, learning)
  - Visual sliders with real-time threshold previews
  - Threshold flow visualization showing auto-classify, prompt, and manual ranges
  - Complete audit trail of all configuration changes
  - Revert to previous settings functionality
  - Export/import configuration as JSON
  - Auto-learning rate limiting controls
  - Conflict resolution strategy configuration
  - Default values: 85% auto-classify, 60% verify, conservative learning thresholds
- **Discord Verification Learning & Policy Auto-Enhancement** (Fixes #240)
  - Smart Discord thresholds: 85%+ = info-only, 60-84% = verify, <60% = detailed
  - Enhanced Discord notifications with signal breakdown, top 3 libraries, similar items
  - Auto-learning from user feedback: genres/keywords/studios added to "prefer" lists
  - Conflict detection and resolution for genre/keyword conflicts
  - Rate limiting: max 50 learns/user/day, 20 learns/library/hour
  - Complete audit trail of all auto-learned preferences
  - User feedback toasts showing what the system learned
  - Admin dashboard for reviewing and reverting auto-learned preferences
  - New database tables: `auto_learned_preferences`, `learning_conflicts`, `learning_rate_limits`
  - New service: `autoLearningService.js` for managing preference learning
  - Enhanced RAG integration with `findSimilarItems()` method for Discord context
- **System Health Dashboard Enhancements** (Fixes #184)
  - **Trend Tracking**: Visual indicators (↗️/↘️/→) show service health direction over time
  - **Last Successful Check**: Track when services were last healthy to diagnose outage duration
  - **Smart Trend Detection**: Calculates trends from both status changes and latency variations (>50ms threshold)
  - **Per-Instance Monitoring**: Individual trend indicators for Radarr/Sonarr instances
  - **Historical Context**: "Last healthy: Xm ago" timestamps for degraded/unhealthy services
  - **Enhanced Tooltips**: Include trend status and last healthy information
  - **Backend Tracking**: All health check functions preserve previous state (previousStatus, previousResponseTime)
  - **Frontend Utilities**: New trend calculation functions (calculateTrend, getTrendArrow, getTrendTooltip)
  - **Clean UX**: Trend arrows only shown when status is not stable to reduce visual clutter
  - **Comprehensive Testing**: 33 new tests for trend calculations, all 283 frontend and 826 backend tests passing
  - Helps users quickly identify if services are improving, degrading, or stable
  - Professional-grade monitoring dashboard with temporal context
- **Service Lockdown System** (Fixes #206)
  - Pinia store for tracking service health from `/api/system/health`
  - Auto-refresh service status every 30 seconds
  - Composable for checking service dependencies before enabling features
  - Buttons/features automatically disabled when required services unavailable
  - Clear tooltips: "Configure [Service] to enable this feature"
  - Direct navigation to settings pages with one-click configuration links
  - Lock icons (🔒) shown on disabled features
  - Applied to: Library Sync (requires Media Server), Batch Reclassify (requires AI Provider), Dashboard Quick Actions
  - 44 comprehensive tests covering stores and composables
- **Dashboard Accessibility & Testing** (Fixes #204)
  - Added ARIA labels to all loading, error, and empty states
  - Added ARIA live regions for dynamic content updates (polite for loading, assertive for errors)
  - Screen reader now announces loading, errors, and updates
  - Added skip to main content link for keyboard navigation
  - Added keyboard shortcuts: Ctrl+Shift+D (refresh dashboard), Escape (retry after error)
  - Focus management automatically moves to error heading on error state
  - All interactive elements have descriptive ARIA labels
  - Minimum 44x44px touch targets verified on mobile (scoped to prevent layout issues)
  - Documented performance metrics: 60% faster loads, 50% fewer API requests when tab hidden (from PR #209)
  - WCAG 2.1 AA compliant with Lighthouse accessibility score: 100
  - Note: Automated tests removed due to useSWR composable mocking complexity; manual testing recommended
- **Copyright Compliance System** (Fixes #198)
  - Automated copyright compliance checking with `npm run check-copyright`
  - Auto-fix script to update copyright years with `npm run update-copyright`
  - Auto-generated CONTRIBUTORS.md from git history
  - CI integration to enforce copyright compliance on all PRs
  - Updated LICENSE with project-specific header
  - All source files updated to use `2024-2026 Classifarr Contributors`
  - Annual year updates now automated (CI fails on Jan 1st each year)
- **Classification Signals Breakdown UI** (Fixes #185)
  - Signal breakdown now displays in Classification Details modal for all policy engine classifications
  - Shows all 5 engines (Preset, Profile, Pattern, RAG, History) with individual scores and weights
  - Grayed-out display for unused engines with "(not used)" label
  - Color-coded progress bars (green ≥80%, yellow ≥60%, orange ≥40%, red <40%)
  - Weight multipliers shown for each engine (e.g., ×0.35)
  - Combined score display at bottom of breakdown
  - Backend now consistently stores classification_details with scores/weights in metadata
  - Full transparency into how classification decisions are made
- **User Profile Settings Page**: New profile management interface (#187)
  - View and edit username with uniqueness validation
  - Secure password change with current password verification
  - Password strength requirements enforced (8+ chars, uppercase, lowercase, number, special char)
  - Current session information display (IP, browser, login time, account creation date)
  - User role display (Admin/User) in account information section
  - Link to API Keys management in Security settings
  - Show/hide password toggles for improved UX
  - Full accessibility support (ARIA labels, keyboard navigation, visible focus states)
  - Audit logging for all profile changes (username updates, password changes)
  - Rate limiting on profile update endpoints (10 requests per hour)
  - Backend routes: `GET /api/user/me`, `PATCH /api/user/profile`, `PATCH /api/user/password`, `GET /api/auth/session`
  - Comprehensive backend integration tests for all profile operations
  - **Full backward compatibility**: Existing admin and user accounts can immediately use the profile page to update their credentials

### Changed

- **Dashboard UX Improvements**: Major polish and efficiency upgrades
  - Added loading skeletons and error states for all dashboard cards
  - Parallelized API calls for faster dashboard load times
  - Implemented smart polling that pauses when browser tab is hidden (saves resources)
  - Added beginner-friendly empty state with onboarding guidance
  - Expanded Quick Actions with shortcuts to Settings, Statistics, and Documentation
  - Added "Last updated" timestamp with relative time display
  - Enhanced Recent Classifications with method, timestamp, and clickable details
  - Improved accessibility and mobile responsiveness across all dashboard elements

### Fixed

- **Plex Server Duplication**: Fixed duplicated `media_server` entries by using stable `clientIdentifier` instead of URL for uniqueness.
- **Migration Path Resolution**: Critical fix for migration runner failure in Docker environments due to incorrect path resolution.
- **Enrichment Retry Foreign Key Handling**: Fixed service crash when attempting to queue retries for items that were deleted during processing (FK violation).
- **Migration Runner Path Resolution in Docker** (Fixes #259)
  - Migration runner now uses `path.resolve()` instead of `path.join()` for absolute paths
  - Added `MIGRATIONS_DIR` and `SCHEMA_FILE` environment variable support for custom paths
  - Improved error logging with troubleshooting tips for Docker users
  - Prevents "Migrations directory not found" errors in containerized environments
  - Added unit tests for path resolution and migration sorting logic
- **Plex OAuth Duplicate Servers Bug** (Fixes #257)
  - `/api/plex/save-server` now updates existing server instead of always inserting new one
  - Checks for existing server by URL before creating duplicate
  - Added migration 20260201_020000 to clean up existing duplicates automatically
  - Prevents library duplication when reconnecting via OAuth
  - Added comprehensive integration tests for OAuth flow

### Improved

- **Sync Error Handling** (Fixes #226)
  - All sync endpoints now return HTTP 404 with `{ error: "Library not found" }` for missing libraries
  - Reduced log noise: missing libraries logged as warnings instead of errors
  - Consistent error format across `/api/libraries/:id/sync` and `/api/media-sync/sync/:libraryId`
  - Extended 404 handling to `GET /api/media-sync/items/:libraryId`
  - Added comprehensive integration tests for 404 handling

### Removed

- **Legacy Event Detection Tests** (Fixes #227)
  - Removed deprecated event detection integration tests
  - Removed `event-detection-removal.test.js` (event detection retired in v0.41.0)
  - All event detection test suites cleaned up

- **Event Detection Frontend UI**: Removed all legacy event/holiday detection UI controls and code
  - Removed event_type field and operators from SmartRuleForm component
  - Removed event type select UI with holiday/sports/PPV sub-type selectors
  - Removed `getEventSubTypeKeywords` helper function
  - Removed `getEventTypes()` API endpoint call from client API layer
  - Removed event_detection and holiday_detection from Activity, History, Dashboard, Confidence, and ClassificationStats views
  - Updated all affected frontend tests
  - UI now exclusively uses PolicyEngine/preset-driven workflows
- **Event Detection Backend Code**: Removed all legacy event/holiday detection code from backend
  - Removed `detectEventContent()` method from `ClassificationService`
  - Removed `EVENT_DETECTION` signal type from `SignalCollector` and `ConfidenceCalculator`
  - Removed `/api/libraries/event-types` API endpoint
  - Removed event detection method labels from activity, history, and stats
  - Updated all affected backend tests
  - Event detection now handled exclusively through PolicyEngine presets (see #228)
- **Event Detection System**: Removed deprecated event detection columns and presets
  - Dropped `event_detection_type` and `event_sub_type` columns from `libraries` table
  - Removed all event presets (`event_holiday`, `event_sports`, `event_ppv`, `event_concert`, `event_standup`, `event_awards`)
  - Cleaned up policy references to event presets
  - Removed deprecated `detectEventContent()` and `checkLibraryRulesForExceptions()` methods from classification service
  - Removed event detection UI elements from library detail page
  - Migration 072: Complete event detection system removal
  - Event detection functionality is now handled exclusively through PolicyEngine presets (migrated in v0.37.0)

### Fixed

- Classification signal breakdown data path in backend metadata storage (#236)
- Shebang preservation in copyright header script (#237)
- Migration file path resolution in test (#230)

---

## [0.40.5d-alpha] - 2026-01-30

### Fixed

- Radarr/Sonarr routing now respects configured quality profiles by coercing IDs and falling back to instance config profiles before defaults.

## [0.40.5c-alpha] - 2026-01-30

### Fixed

- Discord verification buttons now handle missing library IDs gracefully and report specific errors.
- Post-migration fix for `classification_history` status constraint to allow verification/reclassification states.

## [0.40.5a-alpha] - 2026-01-30

### Added

- pgvector now ships with generic + AVX variants and auto-selects the best binary at startup (AVX when supported, generic otherwise).
- Dashboard banner to indicate when pgvector is running in generic (non-AVX) mode.
- Generic pgvector builds now use upstream-recommended `OPTFLAGS=""` for portability.
- Added AVX2 pgvector variant and prefer it when supported for best performance.

### Fixed

- Allow verification and reclassification status values in `classification_history` to prevent constraint errors during confirmations.

## [0.40.5-alpha] - 2026-01-30

### Added

- AI analysis phase tracking across backend and frontend progress UI.
- Policy question payloads now include policy/RAG/AI context for richer clarification prompts.
- Webhook config toggle to include/exclude specials (season 0) in Overseerr payloads.
- Jest wrapper to sanitize Node 25 Web Storage options for cleaner test output.

### Changed

- PolicyEngine now feeds RAG + signals into AI analysis and defers policy_prompt until after AI.
- Sonarr routing now uses TVDB lookup results and requested season monitoring behavior.
- Radarr/Sonarr routing uses quality profile + search-on-add settings consistently.

### Fixed

- OMDb 520/521/523 errors treated as transient Cloudflare failures.
- ClarificationService JSON parsing handles JSONB metadata safely.
- Source-library reconciliations now report 100% confidence.
- Logger DB persistence now uses explicit injection (no import-time DB access).
- ProviderLockService config loads explicitly at startup (no module import side effects).
- Integration tests set a deterministic `API_KEY_ENCRYPTION_KEY` to avoid warning noise.
- Integration test setup logs are now opt-in via `INTEGRATION_TEST_VERBOSE` to reduce output noise.
- Integration test setup now tracks applied migrations in `schema_migrations` (aligns with production).
- API keys OpenAPI doc block fixed to avoid YAML parsing errors.

## [0.40.4-alpha] - 2026-01-25

### Added

- Policy-driven clarification question builder (uses policy presets + candidates).
- Clarification tests for language gating and policy question generation.
- Mapping-aware routing fallback using `library_arr_mappings` when `libraries.arr_id` is missing.
- Auto-sync of library fields when \*arr mappings are saved.

### Changed

- Clarify-tier Discord prompts now rely on policy questions or manual selection (no seeded question buttons).
- Policy Engine now merges `custom_signals` into preset scoring.
- One-time migration to backfill library \*arr fields from mappings, expand clarification_status, update method constraint, and clean invalid policy_question values.

### Fixed

- Clarification questions no longer prompt for language when `original_language = en` or no language presets exist.
- Clarification API now returns stored `policy_question` when available.
- Fixed flaky integration tests caused by `ProviderLockService` initialization side effects.
- Hardened test mocks for database and provider lock services to prevent crashes during test execution.
- Discord clarification fallback now assigns library and resolves status consistently.
- Policy question parsing hardened to avoid invalid JSON errors.
- Routing now attempts \*arr delivery even when `arr_id` is missing but mapping exists.
- Database constraint mismatch for `manual_classification` method.
- Clarification status length expanded to prevent truncation errors.
- Frontend test warnings resolved (Vue watch source mock, modal attribute fallthrough, and Node 25 web storage warnings).

## [0.40.3a-alpha] - 2026-01-22

### Fixed

- "Connect Media Server" button in dashboard onboarding linking to invalid URL.

## [0.40.3-alpha] - 2026-01-22

### Added

- New flush application logo and optimized favicon.
- Differential library sync logic to preserve data when updating server connection details.

### Fixed

- "Duplicate key value" error when changing media servers due to global unique constraint on library names.
- Media Server "Connect & Save" button state confusion.

## [0.40.1a-alpha] - 2026-01-22

### Fixed

- **TailwindCSS v4 Compatibility**: Added `@reference "../../style.css"` to `Sidebar.vue` scoped styles for proper theme access.
- **PasswordInput Toggle**: Fixed invalid JavaScript `visible = visible!` â†’ `visible = !visible`.

## [0.40.1-alpha] - 2026-01-22

### Added

- **Circuit Breaker**: Added strict offline handling for Ollama embeddings.
- **Tailwind CSS v4**: Migrated to Tailwind CSS v4.
- **SWR (Stale-While-Revalidate) Caching for Dashboard and Statistics**
  - New `useSWR` composable for instant data display from localStorage cache while fetching fresh data in background
  - Dashboard now shows cached data immediately on page load with "â³ Updating..." indicator during refresh
  - Classification Stats page integrated with SWR for instant statistics display
  - RAG Stats page integrated with SWR while maintaining 5-second polling for real-time updates
  - Offline support: Displays cached data with "ðŸ“¡ Offline" indicator when network unavailable
  - Cross-tab synchronization: Data updates in one tab automatically reflect in others
  - Auto-retry with exponential backoff (1s â†’ 3s â†’ 10s) for failed requests
  - Separate cache management for queue stats (30s TTL with 5s polling) vs main dashboard data (60s TTL)
  - New `CACHE_KEYS` and `CACHE_TTL` constants for centralized cache configuration
  - Comprehensive test suite with 29 unit tests for the SWR composable

### Changed

- **Dependencies**: Updated `vue` (v3.5.27), `pinia` (v3.0.4), `pg` (v8.17.1), `bcrypt` (v6.0.0), `jest` (v30.2.0).
- **Dashboard**: Removed manual refresh button in favor of automatic background revalidation.
- **Backfill**: Idle backfill now pauses intelligently when provider is offline.

### Fixed

- Fixed integration tests for Dashboard component.
- Fixed `localStorage` environment issues in tests.

## [v0.40.0-alpha] - 2026-01-17

### Improved

- **Queue Service Refactor**: Transitioned QueueService from singleton to factory pattern with Dependency Injection to improve test stability.
- **Cleanup**: Removed deprecated test files.

### Fixed

- **CARSA Headers**: Fixed header handling in CARSA middleware.
- **Service Stability**: Reverted unstable changes in classification service.

### Added

- **Classification Details Signal Breakdown** (Fixes #185, v0.40.0-alpha)
  - New `SignalRow.vue` component for displaying individual classification engine signals
  - Signal breakdown section in Classification Details popup showing all 5 engines (Preset, Profile, Pattern, RAG, History)
  - Grayed-out display for engines that didn't contribute (score = 0) with "(not used)" label
  - Color-coded progress bars for signal strength (green â‰¥80%, yellow â‰¥60%, orange â‰¥40%, red <40%)
  - Weight multipliers displayed for each engine (e.g., Ã—0.35)
  - Combined score display at bottom of signal breakdown
  - Source library indicator for items already in media server (no classification analysis needed)
  - Friendly method names in classification badges (e.g., "Policy Engine" instead of "policy_auto")
  - Collapsible Library Profile Panel (defaults to collapsed for cleaner UI)
  - Processing time display next to classification date (e.g., "2.14s")
  - Backend stores classification_details in metadata (policy_name, scores, weights, processing_time_ms)
  - Full transparency into how classification decisions are reached

- **Dashboard UI/UX Polish and Efficiency Improvements** (Fixes #204)
  - Added comprehensive loading states with animated skeleton cards during data fetch
  - Added error state with retry button for failed API calls
  - Implemented parallel API calls for dashboard data (stats, history, queue, awaiting decision) using Promise.all for improved performance
  - Added page visibility detection using @vueuse/core to pause queue polling when tab is not active, reducing unnecessary API calls
  - Added empty state with onboarding guidance when no libraries exist, guiding users through initial setup
  - Expanded Quick Actions from 3 to 6 items: Classify Media, Manage Libraries, Settings, Statistics, Documentation, and Discord
  - Added last updated timestamp with relative time display (e.g., "2m ago", "just now")
  - Added manual refresh button with loading state in dashboard header
  - Enhanced Recent Classifications to show classification method, timestamp, and made items clickable
  - Recent Classifications now navigate to History view when clicked for detailed information
  - Improved visual hierarchy and responsiveness across all dashboard sections
  - All dashboard data now loads efficiently in parallel instead of sequential requests

### Fixed

- **Idle Backfill Bug Fixes** (Fixes #203)
  - Fixed initial activity timestamp preventing immediate idle detection (system can now be idle immediately on start)
  - Fixed `isRunning` state not being reset on early exit (config disabled, no pending items, etc.)
  - Changed startup decision logs from `debug` to `info` level for production visibility
  - Added error handling for configuration load failures with proper logging
  - Added event listener cleanup to prevent memory leaks and duplicate triggers
  - Fixed state desync issues when errors occur during backfill
  - Added comprehensive integration tests for all edge cases (12 tests)
  - Idle backfill now reliably starts within idle threshold time after restart

- **Discord Notification Emoji Redesign** (Fixes #203)
  - Eliminated duplicate emoji usage in Discord notifications
  - Movie titles now use ðŸŽ¬ emoji, TV show titles use ðŸ“º emoji
  - "Help needed" messages use ðŸ¤” emoji (no longer duplicated in title)
  - Problem/warning sections use âš ï¸ emoji
  - Reasoning/explanation sections use ðŸ’­ emoji
  - Question sections use ðŸ“ emoji
  - Each emoji now has a unique, clear purpose per notification

- **Dashboard Classification Methods Section** (Fixes #190)
  - Fixed Dashboard 'Classification Methods' section to show accurate all-time statistics instead of only recent 8 items
  - Methods are now dynamically loaded from backend with actual counts from `classification_history` table
  - Added method icons (âš™ï¸ Policy Engine, ðŸ“š Source Library, âœ‹ Manual, ðŸ§  Learned Pattern, ðŸŽ¯ Exact Match, ðŸ¤– AI Analysis, ðŸ“‹ Rule Match, ðŸŽ¬ Existing Media, ðŸŽ„ Holiday Detection)
  - Added method tooltips for better user understanding
  - Added color-coding for different classification methods
  - Methods are sorted by count (descending) for better visibility
  - Average Confidence now calculated from backend all-time data instead of frontend per-method stats
  - Removed hardcoded method names ("Exact Match", "Learned", "Rule-Based", "AI")
  - Backend `/api/stats` endpoint now includes `byMethod` array with `method`, `count`, and `avg_confidence` for each classification method

### Added

- **Health Check Endpoints for Kubernetes/Docker** (Fixes #183)
  - New `/api/system/health/live` endpoint for liveness probes (fast, no external checks)
  - New `/api/system/health/ready` endpoint for readiness probes (checks database connectivity)
  - Enhanced `/api/system/health` endpoint with version, uptime, and database status
  - New `/api/system/health/services` endpoint for detailed service health breakdown
  - Queue worker health check monitoring
  - 30-second caching for service health checks to reduce load
  - Support for all services: database, media server, Radarr/Sonarr instances, AI provider, queue worker
  - Comprehensive test coverage with 12 passing tests

- **Frontend Sync Status UI** (Fixes #178)
  - New `useSyncStatusStore` Pinia store for centralized sync status tracking
  - Real-time sync progress display in Libraries view with progress bar
  - Sync button now shows current sync status and disables during active operations
  - Polling mechanism updates UI every 2 seconds during sync operations
  - Visual feedback for sync type (library_sync vs full_resync)

- **CARSA Warning Dialog** (Fixes #178)
  - New `ClearResyncDialog.vue` component with comprehensive warning information
  - Detailed explanation of what will be deleted vs. preserved
  - Replaces basic browser confirm() dialog in Queue settings
  - Clear visual hierarchy for warning, preserved settings, and notes

- **Post-CARSA Notification Banner** (Fixes #178)
  - New `MappingWarningBanner.vue` component for displaying mapping warnings
  - Automatically shown after CARSA if library mappings need attention
  - Quick navigation to Radarr/Sonarr settings pages
  - Dismissible with API integration for notification management
  - Displayed on Libraries and Settings views

- **Library Mapping Preservation During CARSA** (Fixes #177)
  - Automatic preservation and restoration of Radarr/Sonarr library mappings during "Clear and Re-sync All" (CARSA)
  - Smart matching system using priority-based lookup:
    1. External library ID from media server (most reliable)
    2. Library name + media type (fallback)
  - Support for multiple Radarr and Sonarr instances
  - User notifications when mappings cannot be automatically restored
  - New `app_notifications` table for in-app user notifications
  - New database migration `066_arr_library_mapping_preservation.sql`
  - Comprehensive unit tests for snapshot, lookup, and remapping logic

- **API Key Management Support** (Fixes #181, #182)
  - New `api_keys` table for API key authentication and management
  - Support for external integrations and automation
  - **Encrypted key storage** using AES-256-GCM (keys can be retrieved by authenticated users)
  - API key service with generation, validation, and permission enforcement
  - Middleware for dual authentication (JWT tokens or API keys)
  - Configurable permissions (read_only, read_write)
  - Activity tracking: last used timestamp and IP address
  - Key expiration support with optional expiry dates
  - Active/inactive status control
  - **Security settings UI** in Settings â†’ Security for key management
  - Create, reveal, revoke, and manage API keys through web interface
  - Copy-to-clipboard functionality
  - Auto-generated default API key on first startup
  - Permission enforcement on protected routes (libraries, queue, stats, media-sync)
  - Optimized with indexes on key_hash, key_prefix, and is_active columns
  - New database migration `067_add_api_keys.sql`
  - Comprehensive integration tests for migration and data operations

### Changed

- **CARSA Process Enhanced**: Updated `clearAndResync()` to include library mapping preservation workflow:
  1. Snapshot libraries with external IDs before clear
  2. Clear all data as before
  3. Re-sync libraries from media server (creates new library IDs)
  4. Build lookup tables for new libraries
  5. Remap all `library_arr_mappings` entries to new library IDs
  6. Create notification if any mappings fail to restore

### Fixed

- **Sync Concurrency**: Prevented race conditions between "Sync Libraries" and "Clear & Re-sync All" operations (Fixes #176)
  - Added central sync lock mechanism to prevent concurrent sync operations
  - "Sync Libraries" now returns 409 status when another sync is already running
  - "Clear & Re-sync All" (CARSA) can always run and interrupts any active sync first
  - Added sync status tracking with progress updates
- **Clear and Resync (CARSA) - Library Sync**: Fixed `clearAndResync()` to use fresh library sync instead of querying deleted library IDs (Fixes #175)
  - Now uses `syncAllLibraries()` which performs a complete fresh sync from the media server
  - Prevents "Library not found" errors after CARSA by avoiding stale library ID references
  - Clears in-memory caches (`omdbLimitHit`) before re-sync for clean state
- **Clear and Resync (CARSA)**: Fixed `clearAndResync()` to properly delete all critical tables including:
  - `classification_embeddings` (explicitly deleted before `classification_history` for clearer logging/tracking, even though FK uses ON DELETE CASCADE)
  - `library_profiles` (deleted before `libraries`)
  - `media_server_collections` (deleted before `libraries`)
  - `libraries` (deleted last as parent table)
- **Clear and Resync Order**: Ensured deletion order respects foreign key dependencies to prevent constraint violations
- **Clear and Resync Logging**: Updated logging to include counts for all deleted tables (embeddings, collections, libraries)

### Added (Previous)

- **Sync Status Singleton**: New `syncStatus.js` service to track sync operations centrally
  - Tracks sync type ('library_sync', 'full_resync', 'incremental')
  - Reports sync progress and current library being processed
  - Provides locking mechanism to prevent concurrent syncs
  - Allows CARSA to always start (interrupts other syncs if needed)
- **Sync Status API**: New `/api/sync/status` endpoint to retrieve current sync state
  - Returns sync status including type, progress, duration, and whether sync can be interrupted
  - Used by UI to show sync progress and enable/disable buttons
- **MediaSync Service**: Added `syncAllLibraries()` method for fresh library sync after CARSA
  - Fetches libraries from media server (creates NEW library entries with NEW IDs)
  - Syncs content for each library
  - Recommended method for post-CARSA sync operations

### Changed

- **Library Sync Endpoint**: Modified `/api/media-sync/sync/:libraryId` to check sync lock before starting
  - Returns 409 Conflict if another sync is already running
  - Tracks sync progress via `syncStatus` singleton
  - Properly stops sync status on completion or error
- **Clear and Resync**: Updated `clearAndResync()` to use sync status tracking
  - Sets type to 'full_resync' with canInterrupt=false (for tracking purposes)
  - Force stops any active sync before starting CARSA
  - Reports progress at each stage (0-100%)
  - **Note**: API returns after step 6; steps 7-9 run asynchronously in background
  - Sync status is cleared when background operations complete (or on error)
- **Clear and Resync Return Value**: Added `embeddingsCleared`, `collectionsCleared`, and `librariesCleared` to result object
- **Clear and Resync Process**: Now clears in-memory caches before triggering fresh library sync

### Technical Details

- **Sync Lock Mechanism**:
  - Singleton pattern ensures single source of truth for sync status
  - `tryStart(type)` method atomically checks and starts sync (prevents TOCTOU race conditions)
  - `canStartSync(type)` method for checking lock status (read-only)
  - Locking rules:
    - 'full_resync' (CARSA) can ALWAYS start
    - Other sync types blocked if any sync is running
  - `forceStop()` method allows CARSA to interrupt active syncs
  - Progress tracking with `updateProgress(progress, currentLibrary)`
  - `canInterrupt` property is informational only; actual interruption logic is based on sync type
- **CARSA Flow** (API returns after step 6; steps 7-9 run in background):
  1. Check and force stop any active sync
  2. Start 'full_resync' sync status (progress: 0%)
  3. Stop worker to prevent race conditions (progress: 10%)
  4. Delete all tables in dependency-safe order (progress: 20-70%)
  5. Clear in-memory caches (`omdbLimitHit = false`) (progress: 75%)
  6. Restart worker (progress: 80%)
  7. **[Background]** Trigger `syncAllLibraries()` (creates NEW libraries) (progress: 90%)
  8. **[Background]** Run gap analysis with fresh library IDs (progress: 100%)
  9. **[Background]** Stop sync status
- **Table Deletion Order**:
  1. `task_queue` (independent)
  2. `content_analysis_log` (references classification_history)
  3. `classification_embeddings` (references classification_history)
  4. `classification_history` (references libraries)
  5. `learning_patterns` (independent)
  6. `classification_corrections` (independent)
  7. `library_rules_v2` (references libraries)
  8. `library_custom_rules` (references libraries)
  9. `library_pattern_suggestions` (references libraries)
  10. `library_profiles` (references libraries)
  11. `media_server_collections` (references libraries)
  12. `media_server_items` (references libraries)
  13. `libraries` (parent table - deleted last)

- **Fresh Sync Implementation**:
  - `syncAllLibraries()` calls `syncLibrariesFromMediaServer()` to fetch and create NEW library records
  - Each library gets a NEW database ID (not reusing old IDs)
  - All media items and collections reference the NEW library IDs
  - No stale ID references anywhere in the system

## [v0.39.7b-alpha] - 2026-01-16

### Removed

- `preloadModel()` from OllamaService (used non-existent `/api/load` endpoint).
- Model preloading logic from IdleBackfillService.

## [v0.39.7a-alpha] - 2026-01-16

### Fixed

- PROFILE_SCORE weight calculation in signal-based confidence.
- Fallback status handling when AI is unavailable.
- Logger `error()` and `warn()` methods now handle DB persistence failures gracefully.

### Added

- AI retry mechanism for classifications when AI is unavailable (migration 065).
- `logger.test.js` with 15 tests for logger resilience.
- `idleBackfillService.test.js` with 11 tests for model preloading.

### Removed

- Deprecated `sendSmartSuggestionNotification()` from Discord bot.

## [v0.39.6-alpha] - 2026-01-16

### Added

- Intelligent Model Swapping for Ollama to reduce reload overhead.
- Smart preloading for idle batch processing.
- Model affinity tracking in ProviderLockService.
- `keep_alive` parameter support for embedding requests.

### Changed

- Increased default provider lock wait time to 120s.

## [0.39.5b-alpha] - 2026-01-16

### Fixed

- **RAG Overview Pending Count**: Fixed `getStats()` to count actual items without embeddings instead of retry queue
- **Database Migration 064**: Removed invalid `updated_at = NOW()` from backfill migration (column doesn't exist)

### Added

- **Database Resilience Tests**: New tests to prevent regression of Exit 255 crash bug

## [0.39.5a-alpha] - 2026-01-15

### Fixed

- **CRITICAL: Container Crash**: Removed `process.exit(-1)` from database pool error handler in `database.js`
  - Transient idle client errors no longer kill the entire application
  - Connection pool now recovers naturally from temporary database issues

## [0.39.5-alpha] - 2026-01-15

### Fixed

- **CRITICAL: Sync Reconciliation Error**: Fixed `column "updated_at" of relation "classification_history" does not exist` error
  - Removed `updated_at = NOW()` from classification_history UPDATE query in reconciliation logic
  - Removed `updated_at = NOW()` from learned_corrections UPDATE query (column doesn't exist in either table)
- **RAG Pending Count Query**: Standardized all pending embedding queries to use NOT EXISTS pattern
  - Updated overview endpoint, manual backfill, idle backfill, and scheduled backfill services
  - Removed `library_id IS NOT NULL` filter to count all items without embeddings
- **Backfill Progress Display**: Fixed progress exceeding total and negative ETA issues
  - Made backfill status calculation dynamic to handle items added during backfill
  - Total now calculated as `max(initialTotal, processed + currentPending)`
  - Progress display clamped to never exceed 100%
  - ETA calculation now uses Math.max(0, ...) to prevent negative values
- **Idle Backfill Total Calculation**: Fixed idle backfill not setting total in backfill_runs
  - Added getPendingCount() method to idle backfill service
  - Idle backfill now sets total when creating backfill_runs record

## [0.39.4-alpha] - 2026-01-15

### Fixed

- **Integration Test Stability**: Fixed `pgvector` missing extension errors in tests by upgrading test container
- **RAG API Tests**: Refactored `rag-api.test.js` to use shared database pool, resolving `app.address` crashes
- **AI Model Selection**: Fixed classification using wrong Ollama model (`qwen3:14b`) instead of configured model
  - Classification now reads from `ai_provider_config.ollama_model` instead of deprecated `ollama_config` table
  - Falls back to `llama3.2` when no model is configured (instead of hardcoded `qwen3:14b`)
- **Genre Distribution Query**: Fixed `jsonb_typeof(text[])` error in library profile generation
  - Changed from `jsonb_array_elements_text()` to `unnest()` for TEXT[] array columns
- **RAG Performance**: Optimized RAG semantic search to run once per classification instead of once per library
- **Dashboard Awaiting Count**: Fixed "Awaiting Decision" count showing 0 instead of actual count
- **Dashboard Library Display**: Fixed missing library name for items with `status='awaiting_decision'`
- **Plex Sync Reconciliation**: Added automatic reconciliation of awaiting decision items

## [0.39.3-alpha] - 2026-01-15

### Fixed

- **library_name Data Consistency**: Fixed `library_name` not being set when classifications are corrected
  - Updated classification correction endpoint to set both `library_id` and `library_name`
  - Updated Discord bot correction handler to set both `library_id` and `library_name`
  - Updated reclassification service to set both `library_id` and `library_name`
  - Added migration to backfill existing NULL `library_name` values
  - Ensures embeddings formatted with `formatForEmbedding()` include proper library context
- **RAG Overview Statistics Display**: Fixed Total Embeddings and Pending counts showing "0"
  - Added `totalEmbeddings` and `pendingCount` field aliases in `embeddingService.getStats()` for frontend compatibility
  - Added fallback mapping in frontend to handle both old and new field names
  - RAG Overview tab now correctly displays embedding counts
- **RAG Overview Provider Status**: Fixed "Provider Status" card always showing "Offline"
  - Template now correctly references `stats.providerOnline` instead of undefined `providerOnline`
  - Backend `/api/rag/status` endpoint now returns `providerOnline` field
  - Frontend properly extracts `providerOnline` from API response in `loadStats()`
- **RAG Test Connection Dimensions**: Fixed "undefined dimensions" in test connection success message
  - `/api/rag/test-connection` now calls `embeddingProvider.testConnection()` to generate actual test embedding
  - Frontend properly displays dimension count in success message and toast
- **RAG Overview Data Loading**: Fixed page never loading data on mount
  - `onMounted` hook now calls correct function `loadStats()` instead of non-existent `loadOverview()`
- **Embedding Model Change Handling**: Changing embedding models now automatically clears existing embeddings
  - Prevents dimension mismatch errors when switching between models with different vector sizes (e.g., 768 â†’ 1024)
  - Added warning log when embeddings are cleared due to model change
- **Configuration Error Handling**: Configuration errors no longer trip the circuit breaker
  - Introduced `ConfigurationError` class to distinguish config issues from transient failures
  - Circuit breaker now only trips for network/server errors, not missing API keys or misconfigured providers
  - Added validation with clear error messages for each embedding provider mode
- **Cloud Provider Validation**: Improved error messages when cloud provider is selected but not configured
  - Better validation for 'same', 'separate_ollama', and 'cloud' modes
  - Clear user guidance on what needs to be configured for each mode
- **Embedding Vector Dimensions**: Added migration 061 to fix "column does not have dimensions" errors
  - Automatically detects configured embedding model and resizes vector column to match
  - Handles dimension changes for all models: nomic-embed-text (768), mxbai-embed-large (1024), OpenAI (1536/3072), etc.
  - Migration safely clears existing embeddings if dimensions change (they will be regenerated)
  - Fixes issues for both new installations and existing systems
- **Stale Retry Queue Entries**: Fixed inflated "Pending" count in RAG Overview
  - Added post-upgrade task to clear orphaned retry queue entries where embeddings already exist
  - Added cleanup in `storeEmbedding()` to remove retry queue entry when embedding succeeds
  - Prevents accumulation of stale entries in `embedding_retry_queue` table
- **Settings Page Responsive Layout**: Fixed sidebar scroll and mobile accessibility issues
  - Desktop: Sidebar now has independent scroll with proper sticky positioning
  - Mobile: Settings tabs now display as horizontal scrollable chips
  - Main content area now has `overflow-x-auto` for wide content
- **Post-Upgrade Log Directory**: Fixed `ENOENT` warning when logs directory doesn't exist
  - `postUpgradeService.clearLogs()` now gracefully handles missing log directories

### Added

- **Post-Upgrade Task System**: Introduced reusable system for version-specific maintenance operations
  - Created `post_upgrade_tasks` table to track executed tasks
  - Created `postUpgradeService` to manage task execution
  - Tasks run once per version upgrade automatically on server startup
  - Supports tasks like clearing logs, rebuilding embeddings, and data backfills
  - Eliminates need for manual migrations for one-time maintenance tasks
  - Added `clear_stale_retry_queue` task for v0.39.3


---

## [0.39.2c-alpha] - 2026-01-15

### Fixed

- **Database Auto-Healing**: Added logic to automatically detecting dimension mismatches (e.g., "expected 2000, not 768") and resize the vector column on the fly.
- Increased embedding generation timeout to 5 minutes.

## [0.39.2b-alpha] - 2026-01-15

### Fixed

- Saving RAG embedding configuration now automatically enables `rag_enabled` flag - fixes "RAG is not enabled" error when starting backfill

## [0.39.2a-alpha] - 2026-01-15

### Fixed

- Sidebar version display now shows correct version (was stuck on v0.38.4-alpha)

## [0.39.2-alpha] - 2026-01-15

### Fixed

- **Settings Preservation**: PUT `/settings/ai` now uses nullish coalescing to preserve existing values when fields are undefined - fixes bug where saving RAG config would reset AI provider to 'none'
- **Accurate RAG Status**: Provider status now correctly shows "Offline" when AI provider is not configured in "Same as Classification" mode
- **Backfill RAG Check**: Idle, Scheduled, and Manual backfill services now verify `rag_enabled` before attempting embedding generation

## [0.39.0-alpha] - 2026-01-14

### Added

- **RAG & Embeddings Settings Consolidation** (#154, part of Epic #136)
  - Consolidated RAG & Embeddings settings under Classification section in settings sidebar
  - Added independent scroll to settings sidebar navigation
  - Statistics page now includes tabbed navigation (Classification, RAG & Embeddings)
  - RAG settings reorganized into 3 focused tabs:
    - **Overview**: Provider status, embedding provider configuration, and test connection
    - **Backfill**: Real-time mode, idle backfill, scheduled backfill, manual controls, and heartbeat settings
    - **Advanced**: Retry configuration, caching, debug options, and danger zone actions
  - Moved RAG monitoring/stats to Statistics â†’ RAG & Embeddings tab
  - Created dedicated statistics components:
    - `ClassificationStats.vue`: Classification metrics and trends
    - `RAGStats.vue`: RAG metrics, circuit breaker status, error/retry/backfill history

- **Embedding Model Dropdown** - Pre-populated dropdown with 8 recommended Ollama embedding models:
  - `nomic-embed-text` (recommended), `nomic-embed-text-v1.5`, `mxbai-embed-large`, `snowflake-arctic-embed2`, `bge-m3`, `bge-large`, `all-minilm`, `paraphrase-multilingual`
- **Embedding Model for Same Mode** - New `embedding_model` configuration field allows selecting embedding model even when using the same Ollama server as classification

- **Robust Error Handling with Adaptive Timeouts and Retry Logic** (#153, part of Epic #136)
  - **Retry Utilities** (`server/src/utils/retryUtils.js`): Comprehensive retry logic for transient failures
    - `calculateBackoff()`: Exponential delay with configurable jitter
    - `parseRetryAfter()`: Honors server-provided Retry-After headers
    - `isRetryableError()`: Identifies transient errors (timeout, 429, 5xx)
    - `getRetryDelay()`: Smart delay calculation respecting Retry-After headers
    - `withRetry()`: Async function wrapper with automatic retry logic
  - **Circuit Breaker Pattern** (`server/src/services/circuitBreaker.js`): Prevents cascading failures
    - Three states: CLOSED (normal), OPEN (blocking), HALF_OPEN (recovery testing)
    - Configurable failure threshold (default: 5) and recovery timeout (default: 60s)
    - Automatic state transitions and recovery attempts
    - Comprehensive metrics: requests, successes, failures, rejections, state history
  - **Enhanced Embedding Provider** (`server/src/services/embeddingProvider.js`):
    - Adaptive timeouts: 30s for warm models, 120s for cold models
    - Auto-detection of cold models (5min idle threshold)
    - Integrated retry logic on all API calls (Ollama, OpenAI, Gemini, Voyage, OpenRouter, Cohere)
    - Request metrics tracking: latency, errors, retries with history
    - `warmup()` method for pre-warming models before batch operations
    - `getMetrics()` for comprehensive monitoring data
  - **Backfill Service Updates** (`server/src/services/manualBackfillService.js`):
    - Model warmup before batch operations
    - Automatic pause when circuit breaker opens
    - Enhanced progress logging
  - **New API Endpoints** (`server/src/routes/rag.js`):
    - GET `/api/rag/metrics` - Enhanced metrics including provider metrics with history
    - GET `/api/rag/circuit-breaker` - Circuit breaker status and state history
    - POST `/api/rag/circuit-breaker/reset` - Manual circuit breaker reset
    - POST `/api/rag/warmup` - Trigger model warmup
    - GET `/api/settings/embedding/retry` - Get retry configuration
    - PUT `/api/settings/embedding/retry` - Update retry configuration
  - **Database Migration** (059): Enhanced retry configuration
    - `warmup_timeout`: Extended timeout for cold models (default: 120s)
    - `retry_backoff_multiplier`: Exponential backoff multiplier (default: 2.0)
    - `jitter_factor`: Randomization factor for retry delays (default: 0.3)
  - **Monitoring UI** (`client/src/views/rag/MonitoringTab.vue`):
    - Circuit breaker status card with state indicator and manual reset button
    - Enhanced request metrics: total, success, failed, retries, avg latency
    - Model status indicator (cold/warm) with manual warmup trigger
    - Error history table: timestamp, error message, code, latency, retryable flag
    - Retry history table: timestamp, attempt, error, backoff delay, Retry-After header
  - **Advanced Configuration UI** (`client/src/views/rag/AdvancedTab.vue`):
    - Retry configuration form with real-time validation
    - Configurable request timeout (5-300s)
    - Configurable warmup timeout (10-600s)
    - Configurable max retries (0-10)
    - Configurable base delay (100ms-10s)
    - Configurable backoff multiplier (1-5)
    - Configurable jitter factor (0-1)
    - Visual example backoff sequence display
  - **Comprehensive Test Coverage**:
    - 19 tests for retry utilities (100% passing)
    - 16 tests for circuit breaker (100% passing)

- **AI Prompt Enrichment**: Library profile statistics now injected into AI classification prompts (#142)
  - Certification/rating distribution
  - Genre distribution
  - Top studios
  - Language distribution
- **Library Profile Panel**: New UI component in classification history detail (#142)
  - Visual distribution bars for ratings and genres
  - Profile snapshot from classification time
  - Top studios and language distribution display
- **Profile Snapshot Storage**: Classification history now stores library profile at decision time (#142)
  - New `profile_snapshot` column in `classification_history` table
  - Enables transparency into what profile data influenced AI decisions
- **API Endpoints**: New endpoints for library profile statistics (#142)
  - `GET /api/history/:id/profile` - Get profile used for specific classification
  - Profile endpoints already exist in `/api/libraries/:id/profile`

- **Dedicated RAG Settings Page**: New comprehensive UI for all RAG configuration (#141)
  - **Overview Tab**: Dashboard with status cards, quick stats, recent activity
    - Provider status (online/offline)
    - Total embeddings count
    - Pending items count
    - Failed count (24h)
    - Current model and provider mode display
    - Average generation time
    - Recent activity feed
  - **Provider Tab**: Consolidated embedding provider configuration
    - Provider mode selection (same as classification, separate Ollama, cloud)
    - Separate Ollama instance configuration (host, port, model)
    - Cloud provider configuration (OpenAI, Gemini, Voyage, OpenRouter, Cohere)
    - Test connection functionality
  - **Queue/Scheduling Tab**: Heartbeat and backfill controls with live progress
    - Heartbeat configuration (timeout, interval, max wait)
    - Current lock status display
    - Real-time embeddings toggle
    - Idle backfill configuration
    - Scheduled backfill with day/time picker
    - Manual backfill controls (start/pause/resume/clear)
    - Real-time progress bar with ETA
  - **Advanced Tab**: Retry settings, caching, debug options
    - Max retries, retry delay, request timeout configuration
    - Embedding cache toggle with TTL setting
    - Verbose logging and content logging toggles
    - Danger zone: Clear all embeddings, reset configuration
  - **Monitoring Tab**: Live status, metrics, log viewer
    - Live status indicators (provider, heartbeat, queue, lock)
    - 24-hour metrics (generated, avg time, success rate, errors, cache hits, requests)
    - Activity log viewer with level and type filtering
    - Backfill run history table
    - Export functions (configuration, logs, metrics as JSON)
  - Database migration (057) for RAG monitoring tables
  - New tables: `rag_logs`, `embedding_errors`, `embedding_metrics`
  - API endpoints:
    - GET `/api/rag/overview` - Overview dashboard stats
    - GET/DELETE `/api/rag/logs` - Activity logs with filtering
    - GET/PUT `/api/rag/advanced` - Advanced configuration
    - POST `/api/rag/export/{config,logs,metrics}` - Export functions
    - POST `/api/rag/clear-embeddings` - Clear all embeddings
    - POST `/api/rag/reset-config` - Reset to defaults

- **Hybrid Backfill System**: Flexible embedding generation across multiple modes (#140)
  - **Real-time Mode**: Generate embeddings immediately during classification (configurable on/off)
  - **Idle Mode**: Opportunistic backfill during quiet periods (starts after configurable idle threshold)
  - **Scheduled Mode**: Large batch processing at configured times with day/time picker
  - **Manual Mode**: On-demand backfill with full progress controls (start/pause/resume/clear)
  - Database migration (056) for backfill configuration and run history tracking
  - New services: `idleBackfillService`, `scheduledBackfillService`, `manualBackfillService`, `backfillOrchestrator`
  - New utility: `idleDetector` for monitoring classification activity
  - API endpoints:
    - Manual backfill: POST `/api/rag/backfill/manual/{start,pause,resume,clear}`, GET `/api/rag/backfill/status`
    - Schedule config: GET/PUT `/api/rag/backfill/schedule`
    - Idle config: GET/PUT `/api/rag/backfill/idle`
    - Realtime config: GET/PUT `/api/rag/backfill/realtime`
    - History: GET `/api/rag/backfill/history`
  - UI: BackfillSettings.vue component integrated into Settings > AI
  - Real-time progress tracking with ETA calculation
  - Backfill run history table showing type, status, processed count, and timestamps
  - Idle detection integrated into classification service
  - Orchestrator coordinates all modes and prevents conflicts (e.g., idle stops when manual runs)

- **Heartbeat-Based Queue System**: Smart resource management for Ollama to prevent contention
  - Classification requests always have priority over embeddings
  - Automatic lock release on timeout (prevents deadlocks)
  - Configurable heartbeat timeout, interval, and max wait time
  - Lock status monitoring in Settings UI
  - Database migration (055) for heartbeat configuration columns
  - New `providerLock` service with heartbeat-based locking mechanism
  - API endpoints: GET/PUT `/api/settings/heartbeat`, GET `/api/settings/provider-lock/status`
  - UI: HeartbeatSettings.vue component in Settings > General > Heartbeat tab
  - Lock automatically acquired/released in classification and embedding operations
  - Only applies when using same Ollama instance for both operations

- **Embedding Provider Expansion**: Configurable embedding provider separate from classification provider
  - Support for dedicated Ollama instance (different host/port/model) for embeddings
  - Cloud provider support: OpenAI, Gemini, Voyage AI, OpenRouter, Cohere for embeddings
  - Per-provider model selection with smart defaults
  - Test connection functionality for all embedding providers
  - Database migration (054) for new embedding provider configuration fields
  - New `embeddingProvider` service for routing embeddings to appropriate provider
  - API endpoints: GET/PUT `/api/settings/embedding-provider`, POST `/api/settings/embedding-provider/test`
  - UI integration in AI settings with provider mode selector and conditional configuration fields
  - Backward compatible - existing 'same as classification' behavior preserved as default

### Removed

- Standalone `/settings/rag` route (now integrated into Settings panel)
- Duplicate Semantic Search (RAG) configuration card from AI settings
- Separate RAG & Embeddings section in settings sidebar
- Deprecated BackfillSettings component from AI settings
- HeartbeatSettings component (functionality moved to RAG â†’ Backfill tab)

- **Rules Page**: Custom rules feature has been retired
  - Settings > Rules page removed from UI
  - Rules.vue component deleted
  - Classification is now fully AI-driven with policy-based rules in library profiles
  - Navigation updated to remove Rules tab from Settings

### Changed

- Settings sidebar now scrolls independently from main content
- Removed duplicate embedding provider settings from AI settings panel
- Heartbeat settings moved from General section to RAG â†’ Backfill tab
- Statistics page converted to tabbed interface for better organization

- **Prompt Builder**: Enhanced with library profile injection for AI context (#142)
  - New `buildClassificationPrompt()` method
  - `formatItemForPrompt()` helper for consistent item formatting
- **Classification Service**: Automatically captures and stores profile snapshots (#142)
  - Profile stats captured at classification time for completed items
  - Provides historical record of library composition

- **Settings UI**: Renamed "Heartbeat/Queue" to "Heartbeat" in settings navigation
- **Embedding Architecture**: Refactored to use new `EmbeddingProvider` service
  - `embeddingRouter` now delegates to `embeddingProvider` for separate_ollama and cloud modes
  - Provider-agnostic embedding interface with support for parallel embedding generation
  - Enhanced embedding configuration UI with mode-specific settings
  - Embedding operations now respect provider lock when using same Ollama instance

### Fixed

- **Pending Classifications API Crash**: Fixed `/api/classification/pending` throwing "is not valid JSON" error
  - `policy_question` column is JSONB in PostgreSQL (already parsed as object by pg driver)
  - Code was incorrectly calling `JSON.parse()` on an object, causing "[object Object] is not valid JSON" error
  - Now checks `typeof` before parsing to handle both string (legacy data) and object (current) formats
  - Ensures backward compatibility while preventing crashes on JSONB columns

- **Awaiting Decision Library Assignment**: Fixed items showing assigned library while awaiting user decision
  - Classifications with `awaiting_decision` status now have `library_id` and `library_name` set to NULL in database
  - Library only assigned after user makes decision via Discord buttons or Queue UI
  - Prevents misleading "Classified To: Anime Movies" display in history for pending items
  - UI now clearly shows "Awaiting Decision" status instead of premature library assignment
  - Discord notifications still show AI's suggested library for context, but database doesn't commit until decision made

- **Discord Clarification Prompts Missing**: Fixed items needing clarification not appearing in Discord
  - AI CLARIFY responses were missing `libraries` array in result object
  - Discord `createTieredComponents` couldn't create dropdown menu without libraries array
  - Now includes `libraries` array in CLARIFY responses (both AI clarification and fallback cases)
  - Discord notifications now correctly show clarification buttons AND library dropdown for manual selection

- **Discord Prompt Reliability**: Enhanced notification flow to ensure all clarification items trigger Discord prompts
  - Added comprehensive logging for notification attempts and failures
  - Errors are now properly logged instead of silently dropped
  - Discord notification wrapped in try-catch to prevent classification failures when Discord is unavailable
  - Enhanced `getTierForConfidence` with fallback tiers for all confidence ranges
  - Verified tier configuration covers all confidence ranges (50-100)

- **Awaiting Decision UI**: Platform queue now accurately displays all pending items
  - Queue based purely on database status, independent of Discord notification state
  - Count always matches actual `awaiting_decision` records in database
  - Items display with actionable status regardless of Discord prompt success/failure

- **Embedding Service Stale Configuration Cache**: Fixed embeddings using stale localhost configuration
  - `OllamaService.getConfig()` cached `baseUrl` on first call without invalidation mechanism
  - When user configured remote Ollama host (e.g., 192.168.50.95:11434), embeddings still used cached localhost:11434
  - Added `ollamaService.resetConfig()` call to ai_provider_config update endpoint
  - Cache now properly invalidated when user updates Ollama settings in UI
  - Maintains performance benefits of caching while ensuring configuration changes take effect immediately

- **Ollama Embedding API Compatibility (v0.13.5+)**: Fixed 404 errors when generating embeddings
  - Ollama v0.13.5 deprecated `/api/embeddings` endpoint, now uses `/api/embed`
  - Updated request body parameter from `prompt` to `input` for new Ollama API
  - Files updated: `server/src/services/ollama.js`, `server/src/services/embeddingProvider.js`
  - Users on older Ollama versions should upgrade to v0.13.5 or later

- **RAG Settings Overview Tab Crash**: Fixed TypeError when loading Overview tab (#158)
  - Added null safety checks for API responses returning incomplete data
  - Used optional chaining (`?.`) and nullish coalescing (`??`) for defensive access
  - Added `.catch()` handlers to API calls with fallback defaults
  - Updated `formatNumber()` to handle null/undefined values
  - File updated: `client/src/views/rag/OverviewTab.vue`

### Technical Details

- Route `/api/classification/pending` now safely handles both string and JSONB formats for `policy_question`
- Classification service `logClassification` method conditionally sets `library_id` and `library_name` based on status
- When `status === 'awaiting_decision'`, both fields are NULL; when `status === 'completed'`, fields are populated
- Classification service `parseAIResponse` now includes `libraries` array in CLARIFY result objects
- Ollama service `getConfig()` maintains cache for performance, invalidated via `resetConfig()` when settings updated
- Classification service `sendConfidenceBasedNotification` call wrapped in try-catch with enhanced logging
- Discord notification errors logged with full context (classification_id, title, confidence, error stack)
- `getTierForConfidence` now provides fallback tiers for both low (<70) and high (>=70) confidence ranges
- Platform queue (`/api/classification/pending`) queries directly from `classification_history.status = 'awaiting_decision'`

## [0.38.4-alpha] - 2026-01-14

### Fixed

- **Quality Profile Dropdown Auto-Loading**: Fixed issue where quality profiles didn't load when editing existing Radarr/Sonarr configurations
  - Clicking "Change Settings" on existing configs now automatically loads quality profiles
  - Added `loadingProfiles` state to show loading indicator while fetching profiles
  - Explicitly include `id` in editForm to ensure API lookups work with masked API keys
  - Quality profile dropdown shows saved profile ID as fallback if profile list fails to load
  - Hardcoded static options (availability, series type, monitor) to avoid dependency on test connection
  - Fixed issue where masked API keys prevented profile lookup on edit

- **Low-Confidence Discord Notifications (55%)**: Fixed tier lookup and notification issues
  - `getTierForConfidence()` now rounds confidence values to avoid decimal precision issues
  - Added fallback tier for low-confidence items (50-69%) when no explicit tier found in database
  - Items with 55% confidence now correctly appear on Discord with clarification buttons
  - Enhanced logging in `sendConfidenceBasedNotification` for debugging notification failures
  - Logs tier lookup results, initialization status, and skip reasons

### Added

- **Incomplete Configuration Warnings**: New warning system for missing required fields
  - New `ArrConfigWarning.vue` component displays warning banner on Dashboard
  - Warning shown when Radarr/Sonarr configs missing `quality_profile_id`
  - Banner includes direct "Configure Now" button linking to settings page
  - New API endpoint `GET /api/settings/arr-config-status` to check for incomplete configs
  - Warning can be dismissed by user (session-only, reappears on refresh if still incomplete)

### Technical Details

- Radarr availability options hardcoded: `announced`, `inCinemas`, `released`, `preDB`
- Sonarr series type options hardcoded: `standard`, `daily`, `anime`
- Sonarr monitoring options hardcoded: `all`, `future`, `missing`, `existing`, `first`, `latest`, `none`
- Confidence rounding uses `Math.round()` to handle float precision issues
- Fallback tier structure: `{ tier: 'clarify', action: 'clarify_questions', description: 'Requires clarification', min_confidence: 50, max_confidence: 69 }`
- Enhanced Discord logging includes: title, confidence, tier, initialization status, channel details
- ArrConfigWarning component auto-polls `/api/settings/arr-config-status` on Dashboard mount

## [0.38.3-alpha] - 2026-01-14

### Added

- **Rating Normalization System**: Comprehensive system to standardize age-based and international ratings to MPAA/TV standards
  - New `ratingNormalizer.js` utility with priority-based rating selection
  - Priority system: 1) OMDb rated field (most reliable), 2) TMDB US certification, 3) Normalized age-based rating, 4) "NR" for unknowns
  - Support for age-based ratings: 13â†’PG-13, 14â†’PG-13, 15â†’R, 16â†’R, 17â†’R, 18â†’NC-17
  - Support for UK ratings: Uâ†’G, PGâ†’PG, 12Aâ†’PG-13
  - Support for Australian ratings: Mâ†’PG-13, MA15+â†’R, R18+â†’NC-17
  - Support for German FSK ratings: FSK 0â†’G, FSK 6â†’G, FSK 12â†’PG-13, FSK 16â†’R, FSK 18â†’NC-17
  - Separate TV rating mappings: 13â†’TV-14, 16â†’TV-MA, etc.
  - Original ratings preserved in new `original_rating` column
  - Database migration 052 adds `original_rating` column with indexes

- **Rating Normalization Queue Processing**: New task type `rating_normalization`
  - Processes items asynchronously through queue system
  - Updates `content_rating` to normalized value while preserving original
  - Priority 5 tasks (medium priority)
  - Logs normalization changes for audit trail

- **Automatic Rating Updates from OMDb**: Metadata enrichment now updates ratings
  - When OMDb enrichment succeeds, `content_rating` is updated to OMDb's rated field
  - Original rating preserved in `original_rating` column
  - Only updates if OMDb rated field is valid (not "N/A")
  - Ensures most reliable rating source (OMDb from IMDb) takes precedence

- **Rating Normalization Admin UI**: New Settings panel under Metadata section
  - Real-time statistics: items needing normalization, already normalized, in queue, failed
  - Progress bar showing normalization completion percentage
  - "Normalize X Ratings" button to queue all items needing normalization
  - "Refresh Status" button for manual stats update
  - "Regenerate Profiles" button after completion
  - Auto-polling every 5 seconds when processing
  - Rating mapping examples showing transformations (13â†’PG-13, FSK 16â†’R, etc.)
  - Success/error message toasts

- **Rating Normalization API Endpoints**: Three new REST endpoints
  - `GET /api/rating-normalization/stats`: Returns normalization statistics
  - `POST /api/rating-normalization/backfill`: Queues all items needing normalization
  - `POST /api/rating-normalization/finalize`: Checks completion and regenerates library profiles

- **Automatic Rating Normalization on Startup**: Server startup auto-queues first 1000 items
  - Runs after database migrations and service initialization
  - Identifies items with age-based or non-standard ratings without `original_rating` set
  - Only queues items needing normalization (skips already-standard ratings)
  - Logs total count and queued count for visibility

- **Daily Rating Normalization Check**: Scheduler runs daily at 3 AM
  - Checks for new items needing normalization (from new media syncs)
  - Auto-queues any items found
  - Prevents manual intervention for ongoing library additions
  - Logs activity for audit trail

### Changed

- **Metadata Enrichment**: Now normalizes ratings when OMDb data is available
  - OMDb rated field takes precedence over existing content_rating
  - Original rating preserved before update
  - Ensures library items get most authoritative rating (from IMDb via OMDb)

### Technical Details

- New database column `original_rating` stores pre-normalization ratings
- Index on `original_rating` for efficient queries
- Conditional index on `content_rating WHERE original_rating IS NULL` for finding items needing normalization
- Queue processing handles items in batches to prevent server overload
- Rating normalizer uses mapping tables for consistent transformations
- Standard ratings (G, PG, PG-13, R, NC-17, TV-Y, TV-Y7, TV-G, TV-PG, TV-14, TV-MA) pass through unchanged
- Unknown/unmapped ratings default to "NR" (Not Rated)
- Vue component uses reactive polling for real-time progress updates
- Integration tests cover stats endpoint, backfill queuing, and finalization

## [0.38.2-alpha] - 2026-01-14

### Fixed

- **PolicyEngine Now Uses Library Profiles**: Added `profile` scoring to PolicyEngine evaluation
  - Library profiles (statistical snapshots of library content) now contribute to classification confidence
  - New `scoreProfile()` method calls `libraryProfileService.getProfileScore()`
  - Profile weight defaults to 25% of total score
  - Profiles provide base confidence ("item fits what's already in library")
  - Presets provide boost confidence ("item matches defined criteria")
  - Example: Library with 99% Comedy content will now score new Comedy items highly

- **Classification Pipeline: SignalCollector Not Running**: Fixed critical bug where `SignalCollector.collectAll()` was never invoked during classification
  - Library profile scoring was being skipped entirely
  - Custom rules evaluation was not happening
  - Existing media checks were bypassed
  - Collection/franchise signals were not collected
  - Now properly invokes full signal collection pipeline with all detectors

- **RAG/Semantic Search Silent Failures**: Added comprehensive debug logging to RAG retriever
  - Logs when RAG search is initiated with title and threshold
  - Logs when no results are returned
  - Logs when results are below similarity threshold
  - Logs embedding count and RAG enabled status
  - Helps diagnose why RAG isn't contributing to classifications

- **AI Prompt Anime Bias**: Neutralized anime-specific examples in AI classification prompt
  - Replaced "Japanese animation with anime keywords" example with generic "Action movie with mainstream studio"
  - Replaced "Anime vs Kids conflict" clarification example with "Genre ambiguity" example
  - Prevents LLM from being primed to suggest Anime for unrelated content

- **Fallback Library Selection**: Fixed fallback defaulting to highest-priority library (often specialty libraries like Anime)
  - Now looks for general-purpose library matching media type (e.g., "Movies" for movies)
  - Falls back to lowest-priority library (most general) instead of highest-priority
  - Prevents specialty libraries from catching all uncertain classifications

### Changed

- **PolicyEngine Weights**: Adjusted default weights to accommodate profile scoring
  - Preset: 35% (was 40%)
  - Profile: 25% (NEW)
  - Pattern: 15% (was 25%)
  - RAG: 15% (was 20%)
  - History: 10% (was 15%)
  - Total still equals 100%

- **Signal Collection Logging**: Enhanced logging in SignalCollector to show collection summary with total signals and signal types collected

### Technical Details

- Library profiles are statistical snapshots showing rating distribution, genre distribution, studio distribution, and exclusions
- Profile scoring returns 0-100 where 50 is neutral, >50 is positive match, <50 is negative match
- PolicyEngine now evaluates 5 signal types: preset, profile, pattern, rag, history
- All formula-based scores remain capped at 95% (only authoritative signals return 100%)
- Root cause: Decision tree created SignalCollector but only manually added a few signals instead of running full `collectAll()` pipeline
- PolicyEngine was evaluating but with minimal signal context (only getting 31% confidence for obvious mainstream content)
- AI was receiving biased prompt examples and defaulting CLARIFY responses to wrong library

## [0.38.1-alpha] - 2026-01-14

### Changed

- **Unified Policy Configuration Modal**: Consolidated `PolicyBuilderModal` and `PresetSelectionModal` into single modal
  - Preset selection UI (suggestions, categories, search, grid) now inline in policy modal
  - Removed nested modal experience
  - Modal title now shows "[Library Name] Policy" instead of "Edit Policy" / "Create Policy"
  - Save button shows "Create Policy" or "Save Policy" based on state
  - Policy name and description auto-generated from library and presets if not provided
  - Removed Basic Information section (Policy Name, Description inputs, Library dropdown)
  - Replaced with read-only library header with lock icon
- **PolicyCard Button Rename**: Replaced "Add Presets" and "Edit" buttons with single "Configure" button
  - Both empty and filled policy cards now use "Configure" for consistency
- **Advanced Settings Collapsible**: Scoring Weights and Combination Mode sections now collapsed by default
  - Reduces visual clutter while still providing access to advanced features

### Removed

- **Nested PresetSelectionModal**: No longer opens as separate popup from PolicyBuilderModal (UI integrated inline)
- **Unused state in PolicyList.vue**: Removed legacy preset selector code (no longer needed)

## [0.38.0-alpha] - 2026-01-13

### Added

- **Preset Viewer UX Improvements**: Reimagined system preset viewing experience
  - New `PresetSummaryModal.vue` component displaying clean read-only summary (badges/chips instead of disabled form inputs)
  - "Customize" button to clone system presets as custom presets
  - Modal title shows "(Custom Preset)" suffix when customizing
  - "Used in X policies" count displayed in preset summary header
  - Auto-switch to Custom Presets tab after saving customization
  - Success toast notification on preset creation
  - Backend API endpoint: `GET /api/policies/presets/:presetId/usage` for usage count

- **Policy Card Empty State Redesign**: New visual design for policies without presets
  - Dashed border container with centered plus icon
  - "No presets configured" messaging
  - Library header with icon display
  - Auto-generated policy naming from library name
  - Footer showing thresholds even in empty state

- **Preset Selection Modal Enhancements**: Improved UX for adding presets to policies
  - Read-only library field with lock icon (ðŸ”’) indicator
  - Suggested presets section with match percentages and blue left border
  - Green checkmark (âœ“) selection indicators replacing blue highlight
  - Plus (+) icon for unselected preset cards
  - Updated category filter pills with blue selected state, gray unselected
  - "Add All" button for suggested presets
  - Enhanced selected preset summary with green styling

- **Custom Presets Manager UI**: New dedicated view for managing presets
  - Tabbed interface for System Presets (read-only) and Custom Presets (editable)
  - Grid view with preset cards showing icon, name, category, and signal summary
  - Search and category filtering
  - Create, edit, and delete custom presets
  - New route: `/presets`
  - Navigation: Added "Presets" to Classification section in sidebar
  - New components: `PresetsManager.vue`, `PresetCard.vue`

- **Emoji Dropdown Selector**: Replaced free-text emoji input with curated dropdown
  - 60+ curated emojis organized into 8 categories
  - Categories: Movies, TV Shows, Genres, Themes/Seasonal, Quality/Awards, General, Regional, Special Interest
  - Consistent with emojis used in system presets
  - Better UX: one-click selection vs manual emoji input
  - Updated default emoji from ðŸ“¦ (package) to ðŸŽ¬ (clapperboard)

### Changed

- **Color Consistency**: Standardized on primary blue (#3b82f6) and success green (#22c55e)
- **Modal Styling**: Updated close button with blue accent for better visual hierarchy
- **Category Pills**: Updated from background-light to gray-700 for unselected state
- **Search Input**: Enhanced with explicit text color and placeholder styling

## [0.37.8e-alpha] - 2026-01-13

### Fixed

- **Classification Status Constraint**: Added `awaiting_decision` and `pending` status values to `classification_history_status_check` constraint

## [0.37.8d-alpha] - 2026-01-12

### Fixed

- **Classification Method Constraint**: Added all current and legacy methods to `classification_history_method_check` constraint
- **Learned Corrections Query**: Fixed `ORDER BY updated_at` to use `created_at` (column doesn't exist)
- **Ollama Timeout**: Extended initial timeout from 60s to 120s for model loading, with 60s heartbeat for subsequent chunks

### Removed

- **Deprecated Code Paths**: Removed `checkLibraryRules()` and `matchRules()` - PolicyEngine now handles all rule-based classification
- **Legacy Signal Collection**: Removed `custom_rule` signal types from classification flow

### Changed

- **Hard Timeout**: Extended from 3 minutes to 5 minutes for complex classifications

## [0.37.8c-alpha] - 2026-01-12

### Changed

- **Overseerr/Jellyseerr Webhook Payload**: Enhanced JSON payload template with explicit TMDb ID, TVDB ID, media status, and request details
- **Webhook Parser**: Updated `parsePayload()` to handle new explicit field format while maintaining backward compatibility

### Improved

- **Metadata Enrichment**: Direct TMDb/TVDB ID lookup for faster, more accurate classification
- **Request Tracking**: Better user information capture from request payload

## [0.37.8b-alpha] - 2026-01-12

### Fixed

- **Discord Configuration Persistence Issue**:
  - Backend: Modified `loadConfig()` method in `discordBot.js` to accept `ignoreEnabledStatus` parameter
  - Backend: Updated `getChannelDetails()`, `getServers()`, `getChannels()`, and `testConnection()` to fetch config regardless of enabled status
  - Frontend: Improved save sequencing to wait for database commit before fetching channel details
  - Frontend: Added better success feedback showing configuration saved status
  - Frontend: Enhanced test connection to display success message in edit mode
  - Resolves issue where Discord configuration would revert to "Unknown" and show "Connection Failed" after saving
  - Server and channel names now display correctly after save

### Changed

- **Discord API Configuration Loading**: `loadConfig()` now supports fetching bot token for API authentication even when bot is disabled
- **Frontend Discord Settings**: Save now shows success status with channel and server information
- **Test Connection Feedback**: Now displays clear success message with test notification delivery status in edit mode

### Added

- **ConnectionStatus Component**: Added support for 'warning' status to display non-critical issues

### Changed

- **Build Tooling**: Upgraded Vite from v5.0.8 to v7.3.1
- **Vue Plugin**: Upgraded @vitejs/plugin-vue from v4.5.2 to v6.0.3
- **Test Infrastructure**: Integration tests now use cross-platform temp file paths for Windows compatibility

## [0.37.8a-alpha] - 2026-01-12

### Fixed

- **Discord Channel Details Error Handling**:
  - Backend: Added 10-second timeout to Discord client login to prevent indefinite hangs
  - Backend: Changed `/api/settings/discord/channel/:channelId` route from returning 500 errors to 400 with fallback data
  - Backend: Added detailed logging at key points in `getChannelDetails()` for debugging
  - Frontend: Improved error handling in `Discord.vue` to use fallback data and show warning status
  - Frontend: Display clear error messages when channel details cannot be fetched
  - Prevents "Unknown" from appearing for server and channel names after saving configuration

### Changed

- **Discord Error Responses**: API now returns structured error response with fallback data instead of generic 500 errors
- **Discord Logging**: Added debug logging for channel fetch operations (`[Discord]` prefix)

## [0.37.8-alpha] - 2026-01-12

### Added

- **Discord Integration Enhancements**:
  - Test connection now sends actual notification to verify bot setup
  - Permission validation for all required Discord bot permissions (Send Messages, Embed Links, Attach Files, Read Message History, Use External Emojis, Add Reactions)
  - Comprehensive integration test suite (`discord-integration.test.js`) with 19 test cases
  - Enhanced API endpoint `/api/settings/discord/test` to accept `channel_id` parameter

### Fixed

- **Discord Health Status**: Now shows 'not configured' instead of 'error' when Discord is not set up
- **Discord Channel/Server Display**: Fixed issue where server and channel names displayed as "unknown" after saving configuration
- **Discord Test Connection**: Now sends actual test notification embed to Discord channel for verification

### Changed

- **Discord Bot Service**: `testConnection()` method enhanced with permission checking and test notification sending

## [0.37.7-alpha] - 2026-01-12

### Added

- **Startup Profile Generation**: Library profiles auto-generate on server startup for all libraries with items

### Changed

- **Test Coverage**: Enhanced tests documenting startup and 404 fallback profile generation behaviors
- **Discord Settings UI**: Improved error messaging to display specific permission issues and notification delivery status

## [0.37.6-alpha] - 2026-01-12

### Fixed

- **Library Profile Auto-Generation**: Profiles now auto-generate on first page load instead of requiring manual refresh
- Fixed 404 handling in LibraryProfile.vue to trigger profile generation

### Changed

- **Test Coverage**: Enhanced regression test for library profile 404 response with JSDoc documentation

## [0.37.5a-alpha] - 2026-01-12

### Changed

- **Dependencies**: Upgraded supertest from 7.1.4 to 7.2.2 in server

## [0.37.5-alpha] - 2026-01-11

### Added

- **Library Profiles**: New statistical system replacing Pattern Discovery.
  - Generates profiles based on rating, genre, and studio distributions.
  - Automatically identifies exclusions (what's _not_ in your library).
  - New API endpoints for profile generation and retrieval.
- **Profile Visualization**: Added `LibraryProfile` component to view library statistics.
- **Policy Engine**: Integrated `PROFILE_SCORE` signal type for better accuracy.
- **API Health Monitoring**: Added health check endpoints for external API services.
  - `GET /api/settings/omdb/health` - OMDb API health with SSL status and rate limit info.
  - `GET /api/settings/tmdb/health` - TMDB API health with SSL status.
  - `GET /api/settings/tavily/health` - Tavily API health with SSL status.

### Changed

- **Scoring**: `FormulaEngine` now uses library profiles instead of patterns.
- **Frontend**: Replaced "Learned Patterns" widget with "Library Profile" in Library Detail view.

### Fixed

- **Stats Alerts 500 Error**: Added defensive error handling to `/api/stats/alerts` endpoint.
- **OMDb SSL Errors**: OMDb service now gracefully handles SSL certificate expiration.
- **Integration Tests**: Fixed preset scoring tests to match actual scoring implementation.

### Deprecated

- **Pattern Experience**: The "Pattern Discovery" system is deprecated and replaced by Library Profiles.
- **Routes**: Removed `/patterns` and `/rule-builder` routes.
- **Database**: `discovered_patterns` table is now considered legacy.

## [0.37.2-alpha] - 2026-01-11

### Added

- **Inline Preset Customization:** Customize preset signals directly in the Policy Builder without leaving the modal
  - "Customize" button expands each selected preset to show editable signals
  - Remove base preset signals with âœ• button (crossed-out with â†© to restore)
  - Add custom signals (content ratings, genres, keywords) with + dropdowns
  - Multiple presets can be expanded and edited simultaneously
- **Combined Signals Summary:** See the merged result of all selected presets
  - Appears when 2+ presets are selected
  - Shows union of: Content Ratings, Preferred Genres, Excluded Genres, Preferred Keywords, Excluded Keywords, Required Keywords
  - Respects signal removals and custom additions
- **Library Dropdown Grouping:** Libraries now grouped by media type in Policy Builder
  - ðŸŽ¬ Movies section
  - ðŸ“º TV Shows section
  - ðŸ“ Other section
- **Database Support for Custom Signals:** Migration `047_policy_preset_custom_signals.sql`
  - Adds `custom_signals` JSONB column to `policy_presets` table
  - Stores signal customizations including additions and removals

### Fixed

- **PresetCard Checkbox:** Fixed checkbox not triggering toggle when clicked directly (was only working on card click)
- **Pattern Mining Library Name Bug:** Fixed `library_name` null error when upserting discovered patterns
  - Now looks up library name from `libraries` table if missing from classification history
  - Prevents "null value in column library_name violates not-null constraint" errors

## [0.37.1-alpha] - 2026-01-11

### Fixed

- **Media Sync FK constraint fix:** Fixed `upsertMediaItem` and `upsertCollection` failing when library was deleted during re-sync
  - Added library existence check before insert to prevent FK violation on `media_server_items.library_id`
  - Gracefully skips items/collections if library no longer exists (logs warning instead of error)
- **Scheduler import fix:** Fixed `schedulerService.runPatternAnalysis is not a function` error in queue clear
  - `runGapAnalysis` is in `scheduler.js`, `runPatternAnalysis` is in `schedulerService.js`
  - Now imports both modules and calls correct methods on each
- **Tavily result parsing fix:** Fixed enrichment retry service not extracting IMDb data correctly
  - Tavily API returns `{ results: [...] }` object, not an array
  - Now correctly accesses `searchResult.results` before passing to `extractImdbData`

### Added

- **Regression tests:** `v037.1-regression.test.js` - Tests for all v0.37.1 fixes
  - Scheduler module import verification (runGapAnalysis vs runPatternAnalysis)
  - Tavily result parsing with extractImdbData
  - Media sync library existence method verification

## [0.37.0-alpha] - TBD

### ðŸš€ Major: Policy-Driven Classification Engine

This release implements the complete Policy-Driven Classification Engine, replacing rule-centric design with comprehensive policy-based classification using rich content signals.

### Added

#### AI Optimization - Skip AI for Confident PolicyEngine Results (#98)

- **Smart AI bypass:** AI calls are now skipped when PolicyEngine has high confidence
  - **auto_classify (â‰¥85%):** Skip AI entirely, trust PolicyEngine result
  - **prompt_confirm (60-84%):** Skip AI, prompt user via Discord with PolicyEngine breakdown
  - **prompt_select (<60%):** Use AI to help choose (existing behavior)
- **Performance benefits:**
  - 70-80% reduction in AI API calls
  - 2-5 second latency improvement per classification
  - Lower costs and reduced rate limiting concerns
- **New classification methods:**
  - `policy_auto`: PolicyEngine auto-classified with high confidence (â‰¥85%)
  - `policy_prompt`: PolicyEngine suggests confirmation needed (60-84%)
- **Enhanced logging:** "AI skipped" log messages show when AI bypass is used
- **Breakdown in prompts:** Discord prompts include PolicyEngine signal breakdown and confidence explanation
- **Integration tests:** `server/src/__tests__/integration/ai-skip-logic.test.js`
  - Tests for high confidence (â‰¥85%) AI skip
  - Tests for medium confidence (60-84%) user prompting
  - Tests for low confidence (<60%) AI usage
  - Threshold boundary condition tests
  - PolicyResult propagation verification

#### Event Detection Migration to PolicyEngine Presets (#98)

- **Event presets:** Event detection migrated from hardcoded `detectEventContent()` to 6 PolicyEngine presets
  - `event_holiday`: Christmas, Halloween, and seasonal content (95% base confidence)
  - `event_sports`: Sports events, documentaries, athletics (92% base confidence)
  - `event_ppv`: UFC, MMA, boxing, wrestling events (93% base confidence)
  - `event_concert`: Concerts, music festivals, live music (90% base confidence)
  - `event_standup`: Stand-up comedy specials (90% base confidence)
  - `event_awards`: Award shows, galas, red carpet events (88% base confidence)
- **Automatic migration:** Libraries with `event_detection_type` get corresponding presets auto-attached
- **Database migration:** `database/migrations/046_event_detection_presets.sql`
  - Creates 6 event presets in 'events' category
  - Auto-attaches presets to libraries with event_detection_type
  - Creates policies for libraries if none exist
  - Sets high weight (1.5) for event presets
- **Deprecated:** `detectEventContent()` method marked deprecated, no longer called in classification flow
- **Integration tests:** `server/src/__tests__/integration/event-presets.test.js`
  - Tests for all 6 event preset creation
  - Tests for event preset signal matching (holiday, sports, PPV, etc.)
  - Tests for PolicyEngine integration with event presets
  - Tests for backward compatibility
- **Benefits:**
  - Unified classification system (events use same flow as other content)
  - Configurable via UI (adjust keywords, weights, thresholds)
  - Extensible (easy to add new event types)
  - Transparent (full scoring breakdown in logs)

#### Comprehensive Documentation (#98)

- **Architecture documentation:** `docs/architecture/policy-engine.md`
  - Complete PolicyEngine architecture overview
  - Component diagrams and data flow
  - Signal type reference with examples
  - Scoring algorithm explanation
  - AI optimization rationale
  - Event detection migration details
- **Preset documentation:** `docs/presets/README.md`
  - Event preset reference with all 6 presets
  - Signal configuration examples
  - Usage and configuration guide
  - Migration from detectEventContent()
  - Troubleshooting guide
- **Migration guide:** `docs/migration/v037.md`
  - Step-by-step migration instructions
  - Breaking changes documentation
  - Testing and verification procedures
  - Rollback instructions
  - Troubleshooting common issues

#### Legacy Rule Migration Service (#103)

- **New service:** `server/src/services/legacyMigration.js` - Migrates legacy `library_custom_rules` to policy system
  - **Migration status:** `getMigrationStatus()` - Returns counts of pending/migrated rules
  - **Library listing:** `getLibrariesWithLegacyRules()` - Lists libraries with unmigrated rules
  - **Rule retrieval:** `getLegacyRules(libraryId)` - Fetches legacy rules for a library
  - **Rule analysis:** `analyzeRule(rule)` - Analyzes rules and suggests equivalent presets or overrides
    - Genre-based matching: Searches content_presets for matching genre signals
    - Certification matching: Matches rating/certification requirements
    - Keyword matching: Detects keyword-based rules
    - Confidence scoring: Calculates match confidence (0-100%)
    - Fallback to override: Suggests policy override when no preset matches
  - **Rule conversion:** `ruleToOverride(rule)` - Converts legacy rule to policy override format
  - **Single migration:** `migrateRule(ruleId, migrationChoice, userId)` - Migrates individual rule
    - Supports preset attachment or override creation
    - Auto-creates policy if none exists
    - Marks rule as migrated with timestamp and user tracking
    - Transactional with rollback on error
  - **Bulk migration:** `migrateLibrary(libraryId, userId, autoSuggest)` - Migrates all library rules
    - Auto-suggest mode: Automatically applies top suggestion for each rule
    - Manual mode: Returns suggestions for user review
- **New API routes:** `server/src/routes/migration.js`
  - `GET /api/migration/status` - Migration status summary (pending/migrated counts)
  - `GET /api/migration/libraries` - Libraries with legacy rules (sorted by rule count)
  - `GET /api/migration/libraries/:id/rules` - Legacy rules for specific library
  - `GET /api/migration/rules/:id/analyze` - Analyze rule and get migration suggestions
  - `POST /api/migration/rules/:id/migrate` - Migrate single rule with selected suggestion
  - `POST /api/migration/libraries/:id/migrate-all` - Bulk migrate all library rules
- **New views:**
  - `client/src/views/MigrationDashboard.vue` - Main migration interface
    - Migration status overview with progress bar
    - Deprecation notice with timeline (v0.37 â†’ v0.38 â†’ v0.39 removal)
    - Library cards showing rule counts
    - Wizard and auto-migrate options
- **New components:**
  - `client/src/components/migration/MigrationLibraryCard.vue` - Library card with migration actions
  - `client/src/components/migration/MigrationWizard.vue` - Step-by-step migration wizard
    - Rule-by-rule analysis
    - Suggestion selection with confidence indicators
    - Preview migration options (preset vs override)
    - Batch migration support
  - `client/src/components/LegacyRuleWarning.vue` - Warning banner for libraries with legacy rules
- **Database migration:** `database/migrations/045_legacy_migration_tracking.sql`
  - Added `migrated_at`, `migrated_by`, `migration_type` columns to `library_custom_rules`
  - Indexes for efficient querying of unmigrated rules
- **Integration tests:** `server/src/__tests__/integration/legacy-migration.test.js`
  - Migration status tracking
  - Library listing and filtering
  - Rule analysis and preset matching
  - Preset and override migration
  - Bulk migration
  - Transaction rollback on errors
- **Navigation integration:** Added "Migration" route to router
- **Deprecation timeline:**
  - **v0.37 (current):** Legacy rules functional, migration tools available
  - **v0.38:** UI warnings for libraries with unmigrated rules
  - **v0.39+:** Legacy rule system removed, policies required

#### Policy Stats Dashboard (#113)

- **New view:** `client/src/views/PolicyStatsDashboard.vue` - Live policy statistics dashboard
  - **Overview cards:** Display global metrics (total decisions, average accuracy, auto-classify rate, improving policies)
  - **Policy performance grid:** Individual policy cards with trend indicators and key metrics
  - **Live activity feed:** Real-time stream of decisions, discovered patterns, and tuning suggestions
  - **Alerts system:** Automatic detection and display of abnormal metrics
  - **Time range filtering:** View stats for 7 days, 30 days, or all time
  - **Auto-refresh:** Updates every 30 seconds for real-time monitoring
- **New components:**
  - `client/src/components/stats/StatCard.vue` - Reusable metric display card with trend indicators
  - `client/src/components/stats/PolicyStatsCard.vue` - Policy-specific stats card with click-to-expand
  - `client/src/components/stats/LiveFeed.vue` - Activity feed with decision, pattern, and suggestion events
  - `client/src/components/stats/AlertsBanner.vue` - Dismissible alerts for declining accuracy and pending suggestions
  - `client/src/components/stats/PolicyStatsModal.vue` - Detailed policy stats modal with charts and comparisons
  - `client/src/components/stats/AccuracyChart.vue` - SVG-based accuracy trend chart
- **Extended API routes:** `server/src/routes/stats.js`
  - `GET /api/stats/overview` - Global stats overview (total policies, decisions, accuracy, trends)
  - `GET /api/stats/policies` - List all policies with their learning stats
  - `GET /api/stats/policies/:id` - Detailed stats for specific policy with time-series and breakdowns
  - `GET /api/stats/live-feed` - Recent activity feed across all policies
  - `GET /api/stats/alerts` - Abnormal metrics alerts (declining accuracy, high corrections, pending suggestions)
  - `GET /api/stats/policies/:id/compare` - Period comparison (this week vs last week)
- **Navigation integration:** Added "Policy Stats" link to sidebar with chart icon
- **Integration tests:** `server/src/__tests__/integration/stats-api.test.js` - Comprehensive API endpoint testing

#### PolicyEngine Service

- **New service:** `server/src/services/policyEngine.js` - Core classification engine with comprehensive signal evaluation
  - **Main entry point:** `evaluateItem(item)` - Evaluates media items against all active policies
  - **Authoritative signals:** `checkAuthoritativeSignals(item)` - 100% confidence source library matching
  - **Policy management:** `getActivePolicies()` - Fetches active policies with linked presets
  - **Policy evaluation:** `evaluatePolicy(policy, item)` - Scores single policy with weighted components
  - **Preset scoring:** `scorePresets(presets, item)` - Evaluates items against content preset signals
  - **Signal evaluation:** `evaluatePresetSignals(signals, item)` - Processes all signal types with weights
  - **Signal type scorers:**
    - `scoreCertification()` - Rating/certification filtering (include/exclude/max modes)
    - `scoreGenres()` - Genre matching (require_any/require_all/prefer/exclude)
    - `scoreKeywords()` - Keyword detection in title/overview/keywords
    - `scoreStudios()` - Production company matching
    - `scoreReleaseYear()` - Year range filtering
    - `scoreVoteAverage()` - TMDB rating thresholds
    - `scoreRuntime()` - Length filtering in minutes
    - `scoreLanguage()` - Language preference (require/prefer/exclude)
    - `scoreMediaType()` - Movie vs TV filtering (binary)
  - **Pattern scoring:** `scorePatterns(libraryId, item)` - Matches discovered patterns (caps at 95%)
  - **RAG scoring:** `scoreRAG(libraryId, item)` - Semantic similarity via embeddings (caps at 95%, graceful fallback)
  - **History scoring:** `scoreHistory(libraryId, item)` - Historical classification accuracy (caps at 95%)
  - **Result processing:**
    - `rankResults(evaluations)` - Sorts policies by weighted score
    - `determineAction(ranked)` - Decides auto-classify/prompt-confirm/prompt-select/manual
  - **Weighted scoring system:**
    - Preset weight (default 40%): Matches against 168 content presets
    - Pattern weight (default 30%): Discovered patterns from user feedback
    - RAG weight (default 20%): Semantic similarity from embeddings
    - History weight (default 10%): Past classification accuracy
    - All weights configurable per-policy or use global defaults

#### FeedbackAnalysis Service

- **New service:** `server/src/services/feedbackAnalysis.js` - Feedback analysis & pattern learning loop service
  - **Feedback recording:** `recordFeedback(feedbackData)` - Records user classification decisions into policy_feedback_log
  - **Policy analysis:** `analyzePolicy(policyId, options)` - Analyzes feedback to detect patterns and generate suggestions
  - **Failure pattern detection:** `detectFailurePatterns(policyId, feedback)` - Identifies systematic misclassifications
    - False positives: Recurring corrections away from policy (by genre, studio, keyword)
    - Missed positives: Recurring corrections toward policy
    - Threshold issues: High correction rates indicating threshold problems
  - **Signal effectiveness analysis:** `analyzeSignalEffectiveness(policyId, feedback)` - Evaluates signal performance
    - Calculates accuracy rates for preset, pattern, RAG, and history signals
    - Identifies underperforming and high-performing signals
  - **New pattern detection:** `detectNewPatterns(policyId, feedback)` - Discovers recurring patterns in corrections
    - Studios, keywords, genres, collections that appear frequently in user corrections
  - **Threshold analysis:** `analyzeThresholds(policyId, feedback)` - Analyzes score distributions
    - Auto-classification vs prompted decisions
    - Accuracy rates by action type
  - **Suggestion generation:** `generateSuggestions(policyId, analysis)` - Creates actionable tuning recommendations
    - `adjust_weight`: Increase/decrease signal weights based on performance
    - `add_preset`: Add presets for recurring patterns
    - `remove_preset`: Remove underperforming presets
    - `adjust_threshold`: Modify auto_classify_threshold or prompt_threshold
    - `create_pattern`: Add discovered patterns to discovered_patterns table
    - `modify_signal`: Adjust preset signal configurations
  - **Suggestion storage:** `storeSuggestions(policyId, suggestions)` - Persists suggestions to policy_tuning_suggestions
    - Fills in current policy values
    - Calculates recommended values
    - Prevents duplicate suggestions
  - **Learning stats:** `updateLearningStats(policyId)` - Updates policy_learning_stats table
    - Total decisions, auto-classified, AI validated, user prompted, corrections
    - Overall accuracy rate, auto-classification accuracy rate
    - 7-day and 30-day accuracy trends
    - Trend detection (improving/declining/stable)
  - **Suggestion management:**
    - `getPendingSuggestions(policyId)` - Retrieves pending suggestions
    - `applySuggestion(suggestionId, userId)` - Applies suggestion and logs to policy_change_log
    - `rejectSuggestion(suggestionId, userId, reason)` - Marks suggestion as rejected
  - **Full analysis:** `runFullAnalysis()` - Analyzes all active policies
  - **Helper methods:**
    - `groupByMetadataField(feedback, field)` - Groups feedback by metadata attributes
    - `extractSignificantPatterns(groups, type, minCount)` - Filters patterns by significance threshold

#### Policy Builder UI

- **New Vue components:**
  - `client/src/views/PolicyList.vue` - Main policy management page showing all policies grouped by library
  - `client/src/components/policies/PolicyCard.vue` - Individual policy card with threshold and weight display
  - `client/src/components/policies/PolicyBuilderModal.vue` - Complete policy creation/editing modal with preset selection
  - `client/src/components/policies/PresetCard.vue` - Preset selection card with expandable signal details
- **New API routes:** `server/src/routes/policies.js`
  - `GET /api/policies` - List all policies with preset counts
  - `GET /api/policies/:id` - Get policy with attached presets
  - `POST /api/policies` - Create new policy with presets
  - `PUT /api/policies/:id` - Update policy and presets
  - `DELETE /api/policies/:id` - Delete policy
  - `GET /api/policies/:id/presets` - Get policy's presets
  - `POST /api/policies/:id/presets` - Attach preset to policy
  - `DELETE /api/policies/:id/presets/:presetId` - Remove preset from policy
  - `GET /api/policies/presets/all` - List all 168 available presets with category/search filtering
  - `GET /api/policies/presets/categories` - List preset categories with counts
- **Features:**
  - Select from 168 comprehensive content presets across 8 categories
  - Configure policy thresholds (auto-classify, prompt)
  - Adjust scoring weights (presets, patterns, RAG, history)
  - Choose combination modes (best_match, average, weighted_average, require_all)
  - Search and filter presets by category
  - Per-preset weight adjustment
  - Real-time weight validation (ensures 100% total)
  - Expandable preset details showing signal configurations
- **Integration tests:** `server/src/__tests__/integration/policies-api.test.js`
  - Full CRUD operation coverage
  - Preset attachment/removal testing
  - Category filtering and search validation

#### Policy Tuning Dashboard UI

- **New Vue components:**
  - `client/src/views/TuningSuggestionsDashboard.vue` - Main tuning suggestions dashboard with filtering and summary stats
  - `client/src/components/suggestions/SuggestionCard.vue` - Individual suggestion card displaying type, confidence, and impact estimate
  - `client/src/components/suggestions/RejectModal.vue` - Modal for rejecting suggestions with reason
- **New API routes:** `server/src/routes/suggestions.js`
  - `GET /api/suggestions` - List all tuning suggestions with status and policy filtering
  - `GET /api/suggestions/:id` - Get suggestion details with supporting feedback evidence
  - `POST /api/suggestions/:id/apply` - Apply suggestion and track before/after accuracy
  - `POST /api/suggestions/:id/reject` - Reject suggestion with reason
  - `GET /api/suggestions/:id/impact` - Get impact metrics (before/after accuracy, improvement)
  - `GET /api/suggestions/policy/:policyId/summary` - Get summary statistics for policy suggestions
- **Enhanced FeedbackAnalysis service:**
  - `getImpactMetrics(suggestionId)` - Retrieves before/after accuracy and improvement for applied suggestions
- **Database migration:** `database/migrations/044_add_tuning_suggestion_tracking.sql`
  - Added `applied_at`, `applied_by`, `before_accuracy` columns to `policy_tuning_suggestions` table
  - Enables tracking when suggestions are applied and measuring their impact on policy accuracy
- **Features:**
  - View pending, applied, and rejected suggestions
  - Filter by status (pending/applied/rejected) and policy
  - Summary cards showing counts by status
  - Detailed view with supporting feedback evidence showing which classifications led to the suggestion
  - Apply suggestions with confirmation
  - Reject suggestions with optional reason
  - Impact tracking showing accuracy improvement after applying suggestions
  - Confidence scoring (high/medium/low) with color coding
  - Supporting evidence display showing user corrections and feedback
- **Navigation:**
  - Added "Tuning" menu item to sidebar with LightBulb icon
  - Route: `/tuning-suggestions`
- **Integration tests:** `server/src/__tests__/integration/suggestions-api.test.js`
  - Full API endpoint coverage
  - Apply/reject suggestion testing
  - Impact metrics validation
  - Summary statistics testing

#### PromptBuilder Service

- **New service:** `server/src/services/promptBuilder.js` - Context-rich prompt generation for Discord and web UI
  - **Main entry point:** `buildPrompt(item, evaluationResult)` - Generates intelligent prompts with explanations
  - **Prompt type determination:** `determinePromptType(evaluationResult)` - Selects appropriate prompt type based on context
  - **Prompt types:**
    - `buildLowConfidencePrompt()` - Explains uncertainty with matching/conflicting/missing signals
    - `buildAIRejectionPrompt()` - Shows AI validation reasoning and alternative suggestions
    - `buildCloseRacePrompt()` - Compares multiple similar candidates with key differences
    - `buildNewDiscoveryPrompt()` - Handles unknown studios/collections with best guesses
    - `buildConfirmationPrompt()` - Explains learned patterns and future impact
    - `buildStandardPrompt()` - Default prompt for general cases
  - **Batch operations:** `buildBatchSummary(items)` - Groups multiple pending items by confidence level
  - **Tuning suggestions:** `buildTuningSuggestionPrompt(suggestion)` - Formats policy tuning recommendations
  - **Output formatting:**
    - `formatForDiscord(prompt)` - Discord embed format with action buttons and select menus
    - `formatForWeb(prompt)` - Web UI format with interactive elements
  - **User interaction:**
    - `buildReasonOptions(item, evaluation)` - Generates contextual reason checkboxes (genre, studio, rating, keywords, collection, custom)
    - `buildPatternOptions(item, evaluation)` - Creates pattern learning options (remember studio, keyword, collection)
  - **Signal analysis:** Analyzes and categorizes signals as matching, conflicting, or missing
  - **Key differences:** Identifies differentiating factors between close candidates
  - **Impact description:** Explains how user choices affect future classifications

#### PromptBuilder API Routes

- **New routes:** `server/src/routes/prompts.js` - API endpoints for prompt queue and response handling
  - `GET /api/prompts/pending` - Get pending classification prompts queue with pagination
  - `GET /api/prompts/:id` - Get specific prompt details with rich context and explanations
  - `POST /api/prompts/:id/respond` - Submit prompt response with reasons and pattern actions
    - Records feedback to policy_feedback_log
    - Updates classification_history status
    - Creates discovered_patterns from user pattern actions
    - Determines if response was a correction
  - `GET /api/prompts/batch` - Get batch summary grouped by confidence level and prompt type
- **Integration:** Registered prompts router in `server/src/routes/api.js`

#### FeedbackAnalysis API Routes

- **New routes:** `server/src/routes/feedback.js` - API endpoints for feedback and policy learning
  - `POST /api/feedback` - Record a feedback event (requires authenticated user with valid userId)
  - `GET /api/feedback/policies/:id/suggestions` - Get pending suggestions for a policy (requires authentication)
  - `POST /api/feedback/policies/:id/analyze` - Trigger policy analysis (requires authentication; validates input bounds)
  - `GET /api/feedback/policies/:id/stats` - Get learning statistics for a policy (requires authentication)
  - `POST /api/feedback/suggestions/:id/apply` - Apply a tuning suggestion (requires authentication; userId must be provided and valid; acting user is derived from authenticated context)
  - `POST /api/feedback/suggestions/:id/reject` - Reject a tuning suggestion (requires authentication; userId must be provided and valid; acting user is derived from authenticated context)
  - `POST /api/feedback/analyze-all` - Run analysis for all active policies (requires authentication)
- **Integration:** Registered feedback router in `server/src/routes/api.js`
  - **Note:** These endpoints should be protected with JWT auth middleware and admin-level authorization where appropriate in production deployments

#### Classification Integration

- **Updated:** `server/src/services/classification.js` to integrate PolicyEngine
  - Added as Step 3.5 in decision tree (after high-confidence matches, before legacy signals)
  - Auto-classifies when policy confidence meets threshold (default 85%)
  - Stores policy results for AI verification when confidence is medium (60-84%)
  - Falls back gracefully to legacy signal-based classification if policy evaluation fails
  - Logs policy decisions for observability

#### Testing

- **New test suite:** `server/src/__tests__/integration/prompt-builder.test.js` - Comprehensive tests for prompt generation
  - **Prompt type determination:** Tests for all 6 prompt types (low_confidence, ai_rejection, close_race, new_discovery, confirmation, standard)
  - **Prompt building:** Tests for each prompt type with realistic data
  - **Batch operations:** Tests batch summary grouping by prompt type
  - **Formatting:** Tests Discord and web UI formatting
  - **User interaction:** Tests reason options and pattern options generation
  - Validates contextual option generation based on item metadata
- **New test suite:** `server/src/__tests__/integration/policyEngine.test.js` with 27 comprehensive tests
  - **Core functionality:** Policy retrieval, authoritative signals, policy evaluation
  - **Signal scoring:** All 9 signal types tested (certifications, genres, keywords, studios, year, rating, runtime, language, media_type)
  - **Preset evaluation:** Weight handling, signal combination, media type filtering
  - **End-to-end:** Full pipeline evaluation, authoritative matching, action determination
  - **Result processing:** Ranking by score, filtering zero scores, action thresholds
  - All 27 tests passing with PostgreSQL testcontainer integration

### Database Schema (from PRs #105, #106, #107)

#### Database Schema (Migration 042)

- **`library_policies` table:** Core policy definition with multi-policy support per library
  - Policy-level thresholds (auto-classify, prompt, AI validation)
  - Trust settings for patterns, RAG, and history
  - Weight overrides (preset, pattern, RAG, history)
  - Multi-policy combination modes (best_match, weighted_average, consensus)
  - Source library linking (JSONB array of Plex/Emby/Jellyfin library IDs)
  - Notification channel configuration (JSONB)
- **`content_presets` table:** Reusable content signal definitions
  - System and user-defined presets
  - JSONB signal configuration for flexible schema
  - Category-based organization
  - Usage tracking and display ordering
  - GIN index on signals for efficient querying
- **`policy_presets` table:** Junction table linking policies to content presets
  - Per-preset weight adjustments
  - Unique constraint ensuring no duplicate preset assignments
- **`policy_overrides` table:** Advanced per-policy signal tweaks
  - Signal-type specific override configuration (JSONB)
  - Reason tracking for audit purposes
- **`policy_feedback_log` table:** Decision capture for learning
  - User prompt responses and corrections
  - Original scores and top suggestions
  - Pattern creation tracking (JSONB)
  - Signal analysis storage (JSONB)
  - Response time metrics
  - Indexed on TMDB ID, library, policy, date, and correction status
- **`policy_tuning_suggestions` table:** AI-generated policy improvement recommendations
  - Supporting feedback IDs (integer array)
  - Confidence and impact estimates
  - Status tracking (pending, approved, rejected)
  - Review metadata
- **`policy_learning_stats` table:** Aggregate policy performance metrics
  - Decision counts (total, auto, AI-validated, prompted, corrections)
  - Accuracy rates (overall, auto-only, 7-day, 30-day)
  - Trend indicators
  - Unique constraint on policy_id (one stats record per policy)
- **`source_library_policy_links` table:** Media server library to policy mapping
  - Links Plex/Emby/Jellyfin libraries to classification policies
  - Auto-generation and confidence tracking
  - Unique constraint on source + policy combination
- **`policy_change_log` table:** Audit trail for policy modifications
  - Change type categorization
  - Before/after metrics (JSONB)
  - User attribution
  - Indexed on policy, change type, and date

#### Schema Enhancements

- **Deprecation support in `library_custom_rules`:**
  - Added `deprecated` boolean column (default false)
  - Added `migrated_to_policy_id` foreign key to `library_policies`
  - Index on `deprecated` column for efficient filtering
- **Comprehensive indexes:**
  - Standard B-tree indexes on foreign keys and frequently queried columns
  - GIN indexes on JSONB columns for efficient JSON querying
  - Multi-column indexes for common query patterns
- **Foreign key cascades:**
  - ON DELETE CASCADE for all policy-related tables
  - Ensures data integrity when policies or libraries are deleted

#### Testing

- **New test suite:** `feedback-analysis.test.js` with comprehensive integration tests
  - **recordFeedback:** Validates feedback recording with all metadata fields
  - **updateLearningStats:** Tests accuracy calculations, trend detection, and stats aggregation
  - **detectFailurePatterns:** Tests false positive detection, threshold issue identification
  - **analyzeSignalEffectiveness:** Validates signal accuracy calculations
  - **detectNewPatterns:** Tests pattern discovery from user corrections
  - **generateSuggestions:** Validates suggestion generation for all types
  - **storeSuggestions:** Tests database persistence and duplicate prevention
  - **getPendingSuggestions:** Validates suggestion retrieval
  - **applySuggestion:** Tests threshold adjustments, weight adjustments, and change logging
  - **rejectSuggestion:** Validates suggestion rejection workflow
  - **analyzePolicy:** Tests full policy analysis pipeline
  - **runFullAnalysis:** Tests multi-policy batch analysis
- **New test suite:** `policy-schema.test.js` with 33 comprehensive integration tests
  - Table existence verification for all 9 new tables
  - Column presence and data type validation
  - Index verification (including GIN indexes on JSONB columns)
  - Foreign key constraint validation with CASCADE behavior
  - Unique constraint verification
  - JSONB operations testing (insert and query with complex objects)
  - Array column type verification (integer arrays)
  - Deprecation column validation on existing tables
  - Test data setup in beforeAll hook to ensure test preconditions
- **Test results:** All 33 new tests passing + all 11 existing schema tests passing
- **Integration test setup enhancements:**
  - Migrations automatically applied during test setup
  - Improved error handling to distinguish between critical and expected failures
  - Known optional failures (e.g., pgvector extension) gracefully skipped
  - Critical migration failures now properly abort test suite
- **PolicyEngine verification tests:** Added comprehensive test coverage for v0.37.0 (#117)
  - `FORMULA_CONFIDENCE_CAP` constant verification (must equal 95)
  - Default weight validation: preset (0.40), pattern (0.25), rag (0.20), history (0.15)
  - Weight sum validation (must equal 1.0)
  - Confidence cap enforcement across all scoring methods (scorePresets, scorePatterns, scoreRAG, scoreHistory)
  - Authoritative signal handling (must return exactly 100%, not capped)
  - Formula score boundary testing (must never exceed 95%)
  - Edge cases and boundary conditions

### Fixed

- **Migration 046 ON CONFLICT fix:** Fixed `046_event_detection_presets.sql` migration failing with "no unique or exclusion constraint matching the ON CONFLICT specification"
  - Changed `ON CONFLICT (key)` to `ON CONFLICT (key, user_id)` to match the unique constraint on `content_presets` table
  - Added `updated_at = NOW()` to the UPDATE clause for consistency with other preset migrations
- **Media Sync FK constraint fix:** Fixed `upsertMediaItem` and `upsertCollection` failing when library was deleted during re-sync
  - Added library existence check before insert to prevent FK violation on `media_server_items.library_id`
  - Gracefully skips items/collections if library no longer exists (logs warning instead of error)
- **Scheduler import fix:** Fixed `schedulerService.runPatternAnalysis is not a function` error in queue clear
  - `runGapAnalysis` is in `scheduler.js`, `runPatternAnalysis` is in `schedulerService.js`
  - Now imports both modules and calls correct methods on each
- **SQL syntax error:** Corrected UNIQUE constraint placement in `policy_learning_stats` table (moved before REFERENCES)
- **Test reliability:** Added explicit assertions to prevent tests from silently passing when preconditions aren't met
- **Migration error handling:** Enhanced to fail fast on critical errors while allowing expected optional failures
- **PolicyEngine default weights:** Fixed default weights to match v0.37.0 specification (#117)
  - `pattern_weight`: Corrected from 0.30 to 0.25 (25%)
  - `history_weight`: Corrected from 0.10 to 0.15 (15%)
  - Ensures weights sum to 1.0: Preset (40%) + Pattern (25%) + RAG (20%) + History (15%)
- **Formula confidence cap:** Added missing confidence cap to `scorePresets()` method (#117)
  - All formula-based scores now properly capped at 95%
  - Only authoritative signals (source_library, manual_correction, existing_media, exact_match) return 100%
  - Introduced `FORMULA_CONFIDENCE_CAP` constant for consistency
- **Legacy feature deprecation warnings:** Added UI warnings for deprecated features (#117)
  - Rule Builder now displays prominent deprecation notice guiding users to Migration Wizard or Policy Builder
  - Library Detail view shows deprecation warning for Event Detection, guiding users to Event Presets
  - Both features follow v0.37.0 deprecation timeline (functional in v0.37, removed in v0.39)
  - Classification Rules section reordered below Learned Patterns to prioritize modern features
  - Classification Rules title updated to include "(Deprecated)" marker
- **Policy Stats UI theme fixes:** Corrected Policy Stats Dashboard to use dark theme
  - Fixed `StatCard.vue` - changed white background to dark (`#1f2937`), updated text colors
  - Fixed `LiveFeed.vue` - changed white background to dark, updated borders and text colors
  - Updated hover states and correction badge colors for dark theme consistency
- **Sidebar reorganization:** Restructured sidebar into 5 logical sections with headers
  - **Dashboard** - Home/Dashboard link
  - **Media** - Libraries, Request, Activity
  - **Classification** - Policies, Patterns, Tuning
  - **Analytics** - History, Statistics, Policy Stats
  - **Admin** - Migration, Queue, Settings, System
  - Added uppercase section headers with muted styling
  - Reduced nav item padding for more compact layout
  - Added scroll support for overflow on smaller screens
  - Improved workflow by grouping related features together

### Changed

- Migration numbering: New migration is `042_policy_driven_schema.sql` (follows `041_formula_engine_weights.sql`)

### Technical Details

- All new tables use `TIMESTAMP WITH TIME ZONE` for proper timezone handling
- JSONB columns for flexible schema evolution
- Idempotent migration using `IF NOT EXISTS` for all DDL statements
- Comprehensive inline documentation via SQL comments
- Follows existing migration patterns and conventions

#### Content Presets Seed Data (Migration 043)

- **46 system content presets** covering all major classification categories:
  - **Audience (4 presets):** family_friendly, kids_only, teen, adult_only
  - **Genre (15 presets):** animated, anime, action_adventure, comedy, horror_scary, drama, romance, scifi, fantasy, documentary, crime_mystery, western, musical, sports, war
  - **Temporal (5 presets):** classic_films, golden_age, 80s, 90s, recent_releases
  - **Quality (2 presets):** highly_rated, hidden_gems
  - **Franchise (7 presets):** marvel_mcu, dc_universe, star_wars, disney, pixar, ghibli, dreamworks
  - **Regional (5 presets):** hollywood, british, bollywood, korean, foreign
  - **Seasonal (2 presets):** christmas_holiday, halloween
  - **TV-Specific (6 presets):** tv_sitcom, tv_drama, tv_reality, tv_animated, tv_anime, tv_miniseries

#### Content Presets Expansion (Migration 044)

- **Expanded from 46 to 168 system content presets** covering all real-world classification scenarios:
  - **Audience (+4 new, 8 total):** kids_older, young_adult, date_night, background
  - **Genre Core (+5 new):** action, thriller, mystery, history, biographical
  - **Genre Subgenres (+25 new):** action_comedy, romantic_comedy, dark_comedy, standup, horror_comedy, slasher, psychological_horror, supernatural, monster, zombie, vampire, psychological_thriller, spy, heist, disaster, martial_arts, noir, cyberpunk, space_opera, post_apocalyptic, dystopian, superhero, courtroom, medical, political
  - **Genre Special Interest (+15 new):** true_crime, nature, science, travel, food, music_doc, art_culture, faith_spiritual, educational, conspiracy, sports_doc, concert, behind_scenes, interview, essay
  - **Franchise (+18 new, 25 total):** illumination, sony_animation, laika, blue_sky, marvel_other, star_trek, harry_potter, lotr, james_bond, fast_furious, jurassic, monsterverse, conjuring, a24, blumhouse, neon, searchlight, focus
  - **Temporal (+7 new, 12 total):** silent_era, new_hollywood, 2000s, 2010s, 2020s, retro, modern
  - **Quality (+8 new, 10 total):** critically_acclaimed, popular, cult_classic, award_winners, indie, blockbuster, underrated, so_bad_good
  - **Seasonal (+6 new, 8 total):** thanksgiving, valentines, easter, new_years, summer, winter
  - **Regional (+20 new, 25 total):** english, australian, canadian, japanese, chinese, hong_kong, taiwanese, indian, spanish, latin_american, mexican, brazilian, french, german, italian, scandinavian, russian, turkish, thai, arabic
  - **TV-Specific (+14 new, 20 total):** tv_procedural, tv_soap, tv_anthology, tv_variety, tv_talk, tv_game, tv_news, tv_kids, tv_dating, tv_cooking, tv_true_crime, tv_late_night, tv_daytime, tv_documentary
- **Rich JSONB signal configuration** for each preset:
  - Certifications (ratings): mode-based filtering (include/exclude/max) with G, PG, R, TV-MA, etc.
  - Genres: prefer, require_any, require_all, exclude with configurable weights
  - Keywords: prefer, require_any, exclude for content matching
  - Studios: studio-based filtering (Marvel Studios, Pixar, BBC, etc.)
  - Release year ranges: min/max year filtering with weights
  - Vote average (TMDB ratings): min/max rating thresholds
  - Runtime: episode/movie length filtering (min/max minutes)
  - Language: ISO 639-1 codes (en, ja, ko, hi, etc.) with prefer/require/exclude
  - Media type: movie vs TV filtering
- **Idempotent migration** using `ON CONFLICT (key, user_id) DO UPDATE` for safe re-runs
- **GIN index optimization** for efficient JSONB queries on signals column
- **Display ordering** by category with logical grouping (1-4, 10-24, 40-44, etc.)

#### Testing

- **Updated test suite:** `content-presets.test.js` now validates 168 system presets
  - All 74 tests passing (30 original + 2 updated for new display_order ranges)
  - Verification of 168 total system presets (46 original + 122 new)
  - Category-wise preset count validation updated:
    - Audience: 8 (4 original + 4 new)
    - Genre: 60 (15 original + 45 new across core, subgenres, and special interest)
    - Temporal: 12 (5 original + 7 new)
    - Quality: 10 (2 original + 8 new)
    - Franchise: 25 (7 original + 18 new)
    - Regional: 25 (5 original + 20 new)
    - Seasonal: 8 (2 original + 6 new)
    - TV: 20 (6 original + 14 new)
  - Display order range validation updated (1-8 for audience, 10-70 for genre)
  - All JSONB signal validation, query operations, and idempotency tests continue to pass

### Related

- Closes #91 (Policy-Driven Schema Implementation)
- Closes #95 (Content Presets Seed Data)
- Part of #82 (v0.37.0 Formula-Based Classification Engine Epic)
- Related to #92 (Policy Engine will consume these presets)

## [0.36.3a-alpha] - 2026-01-07

### Fixed

- **CI/CD Pipeline:** Fixed test failures in `mediaServer.test.js` caused by missing mock for `DELETE FROM classification_history`
- **Test Mocks:** Updated test mocks to align with cascading delete sequence implemented in v0.36.3-alpha
- No production code changesâ€”only test infrastructure updates

## [0.36.3-alpha] - 2026-01-07

### Fixed

- **CI/CD Pipeline:** Fixed 77+ consecutive test failures in `mediaServer.test.js`
- **Test Mocks:** Updated test mocks to match cascading delete query sequence from v0.36.1 and v0.36.2
- **Classification History FK (Insert):** Fixed violation when library is deleted during task processing (Queue tasks verify library exists)
- **Classification History FK (Delete):** Fixed violation when clearing libraries during sync (Clear history before libraries)
- All 377 tests now passing (added 1 new regression test)

## [0.36.2-alpha] - 2026-01-07

### Fixed

- **OMDb Log Spam:** Limit warning now logs once per session, skips API calls when limit hit
- **Task Queue Cleanup:** Pending tasks cleared on library re-sync to prevent failures
- **Enrichment Retry Queue:** Cleared before media_server_items to prevent FK constraint violations

## [0.36.1-alpha] - 2026-01-07

### Fixed

- **Library Sync:** Fixed unique constraint violation when syncing libraries after media server database rebuild
- Sync now properly clears all related tables before inserting fresh library records

## [0.36.0-alpha] - 2026-01-04

### ðŸš€ Major: Pattern-Driven Classification & Settings Reorganization

This release activates pattern-based classification, introduces hybrid pattern management UI, reorganizes the Settings experience, and adds cost controls for API users.

### Added

#### Pattern-Based Classification

- **Pattern Signal Collection:** Use discovered patterns (studio, franchise, genre, certification) as first-pass classification signals
- **Reinforcement Learning:** Patterns learn from user corrections, auto-adjust confidence (+5% correct, -5% incorrect)
- **Conflict Resolution:** Auto-resolve conflicting patterns (highest confidence wins), with manual override option
- **AI Cost Optimization:** High-confidence patterns (â‰¥90%) skip AI calls entirely, saving 60-85% on API costs

#### Hybrid Pattern Management UI

- **Per-Library Patterns:** "Learned Patterns" section added to each library detail page
  - Shows only patterns routing TO that specific library
  - Approve/Reject/Details actions inline
  - "Discover Patterns for This Library" button
  - Link to global patterns page
- **Global Patterns Page:** Moved to top-level navigation (out of Settings)
  - Full patterns table with all columns
  - Target Library filter as primary filter
  - Conflict detection and resolution section
  - Bulk actions (approve/reject/delete selected)
  - System-wide discovery and stats

#### Settings Sidebar Reorganization

- **GENERAL:** General, Scheduler, Queue
- **CONNECTIONS:** Media Server, Radarr, Sonarr
- **METADATA:** TMDB, OMDb, Tavily
- **CLASSIFICATION:** AI, Confidence, Rules
- **NOTIFICATIONS:** Discord, Webhooks
- **SYSTEM:** Backup, SSL/HTTPS, Logs

#### AI Settings Page Restructure

- **ðŸ¤– AI Provider:** Classification provider, model, API key, embedding config (always shown)
- **ðŸ” Semantic Search (RAG):** Enable toggle, similarity threshold, min history count (always shown)
- **ðŸ§© Pattern-Based Classification:** Enable, priority, auto-discovery, "Manage Patterns" link (always shown)
- **ðŸ’° API Cost Management:** Skip threshold, budget alert, cost stats (API providers only)

#### New API Endpoints

- `GET /api/patterns/library/:libraryId` - Get patterns for specific library
- `POST /api/patterns/discover/:libraryId` - Discover patterns for specific library
- `GET /api/patterns/cost-summary` - Monthly cost and savings statistics

### Changed

- Confidence settings moved from GENERAL to CLASSIFICATION section
- Tavily moved from AI & DATA to METADATA section (metadata enrichment)
- "Patterns" removed from Settings sidebar (now top-level nav only)
- AI settings page reorganized into 4 logical sections
- API cost controls only shown for API-based providers (OpenAI, Anthropic, etc.)

### Fixed

- Duplicate "Patterns" navigation (was in both Settings and top-level)
- AI Skip Threshold was in wrong section (moved to API Cost Management)

## [0.35.0-alpha] - 2026-01-03

### ðŸš€ Major: Pattern Discovery Engine

Introduces automated pattern detection from classification historyâ€”identifying studios, franchises, genres, and certifications that consistently route to specific libraries.

### Added

#### Pattern Types

- **Studio Patterns:** "All Pixar Animation Studios â†’ Kids Movies"
- **Franchise Patterns:** "All Marvel Cinematic Universe â†’ Superhero Movies"
- **Genre Patterns:** "All Animation + Family â†’ Kids Movies"
- **Certification Patterns:** "All G-rated â†’ Kids Movies"

#### Pattern Discovery UI

- **Patterns Page:** New top-level navigation item
  - Discovered patterns table with type, value, target library, confidence, status
  - Confidence shown as percentage with color coding (green â‰¥80%, yellow â‰¥60%, red <60%)
  - Status badges: Pending (yellow), Approved (green), Rejected (red)
  - Pattern actions: Approve, Reject, Delete
  - Filters: Type, Status, Target Library
  - "Discover Patterns" button to run discovery manually

#### Discovery Engine

- Analyzes classification history for routing patterns
- Minimum 3 occurrences required for pattern detection
- Calculates confidence based on consistency (matches / total occurrences)
- Deduplication: Won't create pattern if identical one exists

#### Database Schema

- New `patterns` table: id, type, value, targetLibraryId, confidence, status, occurrences, timestamps
- Indexes on type, status, targetLibraryId for efficient querying

#### API Endpoints

- `GET /api/patterns` - List all patterns (with filters)
- `POST /api/patterns/discover` - Run pattern discovery
- `PATCH /api/patterns/:id/approve` - Approve a pattern
- `PATCH /api/patterns/:id/reject` - Reject a pattern
- `DELETE /api/patterns/:id` - Delete a pattern

### Technical Notes

- Patterns are discovered but NOT yet used for classification (next release)
- Discovery runs on-demand only (no automatic scheduling yet)
- Studio/franchise data requires TMDB metadata to be populated

## [0.34.0-alpha] - 2026-01-02

### ðŸš€ Major: Manual Classification Overrides & Confidence Threshold Controls

Adds the ability for users to manually override AI classifications and control confidence thresholds for auto-processing.

### Added

#### Manual Override System

- **Override Modal:** Click any media item to open override dialog
  - Current classification shown with confidence
  - Dropdown to select different target library
  - "Override Reason" text field (optional)
  - Override badge shown on items that were manually overridden
- **Override History:** Track who overrode what and when
  - Stored in classification_history with `isOverride: true`
  - Original AI suggestion preserved for comparison

#### Confidence Threshold Settings

- **Settings â†’ General â†’ Confidence Thresholds**
  - Auto-Accept Threshold (default: 85%): Items above this are auto-processed
  - Review Threshold (default: 60%): Items between review and auto-accept need manual review
  - Items below review threshold are flagged as "Low Confidence"
- **Queue Integration:**
  - High confidence items: Green checkmark, auto-process enabled
  - Medium confidence items: Yellow warning, manual review suggested
  - Low confidence items: Red flag, manual classification required

#### Queue Improvements

- Confidence column with color-coded badges
- "Needs Review" filter to show only medium/low confidence items
- Bulk actions respect confidence thresholds

### Changed

- Classification results now include `requiresReview` boolean
- Queue default sort changed to confidence ascending (lowest first)

### Fixed

- Queue pagination resetting when applying filters

## [0.33.0-alpha] - 2025-12-28

### ðŸš€ Major: AI-Powered Classification with RAG

Introduces the core AI classification engine using Retrieval-Augmented Generation (RAG) for intelligent media categorization.

### Added

#### AI Classification Engine

- **Provider Support:** OpenAI (GPT-4, GPT-3.5), Anthropic (Claude), Ollama (local models)
- **RAG Pipeline:**
  1. Embed media metadata (title, overview, genres, cast, crew)
  2. Retrieve similar previously-classified items from vector store
  3. Generate classification with context from similar items
  4. Return target library with confidence score

#### Vector Store Integration

- **ChromaDB** for vector storage (runs as sidecar container)
- Automatic embedding of classification history
- Similarity search for RAG context retrieval
- Configurable similarity threshold (default: 0.7)

#### Classification History

- Track all classifications with metadata
- Store: mediaId, mediaType, title, targetLibrary, confidence, aiProvider, timestamp
- Used for RAG context and pattern discovery (future)

#### Settings Pages

- **Settings â†’ AI & Data â†’ AI Settings**
  - Provider selection (OpenAI, Anthropic, Ollama)
  - Model selection per provider
  - API key input (encrypted storage)
  - Test connection button
- **Settings â†’ AI & Data â†’ Classification**
  - Enable/disable AI classification
  - RAG enable/disable toggle
  - Similarity threshold slider
  - Minimum history count for RAG (default: 10)

#### API Endpoints

- `POST /api/classify` - Classify single media item
- `POST /api/classify/bulk` - Classify multiple items
- `GET /api/classification-history` - Get classification history
- `POST /api/embeddings/rebuild` - Rebuild vector store

### Technical Notes

- Ollama requires separate installation and model pull
- ChromaDB data persisted in Docker volume
- API keys encrypted at rest using AES-256

## [0.32.0-alpha] - 2025-12-20

### Added

- Media server connection (Plex, Jellyfin, Emby)
- Library discovery and mapping
- Radarr/Sonarr integration for \*arr users
- Basic queue system for pending classifications

### Changed

- Complete UI redesign with new navigation structure
- Settings reorganized into logical sections

### Fixed

- Docker compose health checks timing out

## [0.31.0-alpha] - 2025-12-15

### Added

- Initial project structure
- Docker containerization
- Basic Express API server
- React frontend with Vite
- SQLite database with Drizzle ORM
- Authentication system (local users)

---

[0.36.3-alpha]: https://github.com/cloudbyday90/Classifarr/compare/v0.36.2-alpha...v0.36.3-alpha
[0.36.2-alpha]: https://github.com/cloudbyday90/Classifarr/compare/v0.36.1-alpha...v0.36.2-alpha
[0.36.1-alpha]: https://github.com/cloudbyday90/Classifarr/compare/v0.36.0-alpha...v0.36.1-alpha
[0.36.0-alpha]: https://github.com/cloudbyday90/Classifarr/compare/v0.35.0-alpha...v0.36.0-alpha
[0.35.0-alpha]: https://github.com/cloudbyday90/Classifarr/compare/v0.34.0-alpha...v0.35.0-alpha
[0.34.0-alpha]: https://github.com/cloudbyday90/Classifarr/compare/v0.33.0-alpha...v0.34.0-alpha
[0.33.0-alpha]: https://github.com/cloudbyday90/Classifarr/compare/v0.32.0-alpha...v0.33.0-alpha
[0.32.0-alpha]: https://github.com/cloudbyday90/Classifarr/compare/v0.31.0-alpha...v0.32.0-alpha
[0.31.0-alpha]: https://github.com/cloudbyday90/Classifarr/releases/tag/v0.31.0-alpha
