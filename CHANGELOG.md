# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- None yet.

### Changed

- None yet.

### Fixed

- None yet.

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

> [!NOTE]
> Older changelog entries have been moved to [CHANGELOG_backup.md](CHANGELOG_backup.md) to keep this file concise.
