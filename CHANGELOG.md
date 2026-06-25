# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Archived changelogs: [May 2026 Late](docs/changelog/CHANGELOG-2026-05-late.md) | [May 2026 Early](docs/changelog/CHANGELOG-2026-05-early.md) | [April 2026](docs/changelog/CHANGELOG-2026-04.md) | [March 2026](docs/changelog/CHANGELOG-2026-03.md)

## [Unreleased]

### Added

- **Brave Search and Serper.dev Web Search Adapters** — activated Brave and
  Serper behind the provider-neutral contract, registry, quota-aware router,
  settings test action, result normalizer, and error taxonomy. Added bounded
  regional settings, Brave strict Safe Search, deterministic post-normalization
  domain filtering, and fixture-backed request/response coverage.
- **Provider-Routed Web Search Enrichment and Retry** — migrated classification
  metadata enrichment, queue enrichment, OMDb fallback, and retry execution
  from direct Tavily services onto the quota-aware provider router. New evidence
  is stored as provider-neutral `web_search_*` metadata while historical
  `tavily_*` evidence, states, and retry rows remain readable and compatible.
  Added bounded purpose-specific requests, typed fallback behavior, generic
  Command Center and dashboard language, and a database state-constraint
  migration for the new provider-neutral enrichment states.
- **Web Search Provider Usage Cache** — added provider-neutral cached search infrastructure with deterministic SHA-256 cache identities, bounded TTLs, DB-backed normalized-response storage, zero-cost cache-hit usage events, expired-entry cleanup, fresh-install schema coverage, and architecture documentation for the Tavily/Brave/Serper provider framework.
- **Web Search Provider Usage Retention** — added provider-neutral usage/cache retention with a configurable `web_search_provider_usage_retention_days` setting, current-month quota protection, bounded usage-row purge batches, scheduled expired-cache cleanup, fresh-install schema coverage, and architecture documentation for the retention policy.
- **Web Search Provider Retention Seed Reconciliation** — added an explicit data-only reconciliation migration so fresh-install schema snapshots include the default `web_search_provider_usage_retention_days` setting even though the original retention migration also contains DDL.
- **Web Search Provider Route Decision History** — added sanitized provider-route decision persistence with candidate order, selected/final provider, attempts, outcomes, trace IDs, and bounded metadata; surfaced recent decisions in the Web Search Providers Route Diagnostics panel without exposing queries, API keys, cache keys, provider configs, or response bodies.
- **Purpose-Aware Web Search Provider Quality Calibration** — added provider-purpose quality scoring from recent live-search usage signals, with minimum sample requirements, capped priority penalties, effective-priority routing, and diagnostics UI visibility for score, sample count, and applied penalty.
- **Web Search Provider Route Decision Retention** — added configurable 30-day retention for sanitized route-decision history with bounded indexed purge batches, daily scheduler integration, fresh-install seed coverage, and architecture documentation for the retention policy.
- **Web Search Provider Health and Cooldown History** — added sanitized provider health-event persistence for live-search success, error, and cooldown transitions; wired provider usage updates into best-effort health history writes; and surfaced recent provider health events in Route Diagnostics without exposing queries, credentials, provider configs, cache keys, or raw responses.
- **Web Search Provider Health Retention** — added configurable 30-day retention for sanitized provider health/cooldown events with bounded indexed purge batches, daily scheduler integration, fresh-install seed coverage, and architecture documentation for the retention policy.
- **Web Search Provider Outcome Feedback Loop** — added derived downstream outcome feedback from sanitized provider route decisions joined to classification outcomes, feeding provider quality calibration with a capped purpose-aware penalty when enough provider-backed classifications later fail or are corrected. Route Diagnostics now surfaces outcome fit without exposing queries, credentials, cache keys, provider configs, classification IDs, or raw responses.
- **Purpose-Specific Web Search Calibration Controls** — added bounded per-purpose calibration policies for provider quality routing, with database-backed lookback windows, minimum samples, maximum priority penalties, outcome weights, and an enable switch. The Web Search Providers settings page now exposes these safe controls without raw scoring JSON, credentials, queries, cache entries, or provider response data.
- **Web Search Purpose Coverage Report** — added a read-only settings report showing which web-search purposes have explicit calibration policies and which are using default fallback behavior, sourced from the canonical provider contract purpose list without exposing provider secrets, queries, cache keys, route traces, or raw responses.
- **Quota-Aware Web Search Provider Routing** — added provider-neutral routing policy and router services that select the first eligible adapter-backed provider by priority while skipping disabled, unconfigured, cooldown-active, quota-exhausted, or adapterless providers with structured reasons. Added daily/monthly usage aggregation and architecture documentation for the next Brave/Serper activation slice.
- **Web Search Provider Route Diagnostics** — added a secure settings read model and Route Diagnostics card showing the selected/eligible provider, deterministic candidate order, skipped reasons, quota counters, cache/request totals, and cooldowns. The browser-facing projection excludes credentials, provider configuration, search content, cache identities, trace IDs, and raw provider errors.

## [0.47.5c-beta] - 2026-06-17

### Added

- **Local AI Policy Sweep Cleanup Utility** — added `scripts/cleanup-local-ai-policy-sweep.mjs` and the `test:local:ai-policy-sweep:cleanup` npm script to remove sweep-created DB artifacts (classification history, linked queue tasks, webhook logs, media requests, notifications, clarification responses, embeddings) so sweep fixtures can be safely re-run without manual SQL cleanup.
- **Schema Snapshot Integrity Guard** — `migration:check` now validates that `database/schema/current.sql` contains required pgvector infrastructure (text HNSW index `idx_embeddings_hnsw` and image HNSW index `idx_embeddings_image_hnsw`); fails fast with an actionable message when the snapshot is stale, preventing fresh-install regressions from going undetected.

### Fixed

- **RAG Health Degraded on Fresh Installs — Missing Text HNSW Index** — `idx_embeddings_hnsw` was absent from `database/schema/current.sql` since a column recreation in an earlier migration dropped it and the snapshot was never regenerated. Fresh installations via the schema snapshot fast-path started with a missing text vector index, causing the RAG health panel to report `Degraded` with `Missing indexes: text`. Added repair migration `20260617_180000_repair_missing_text_hnsw_index.sql`, regenerated the authoritative schema snapshot, and added the integrity guard in `migration:check` to prevent recurrence.

### Changed

- **Animated-Only Strict Preset Refines Anime Exclusion** — `animated_only_strict` now explicitly excludes anime-signaled keywords (`anime`, `manga`, `shonen`, `seinen`, `shojo`, `japanese animation`) under `strict: true` so the preset routes only Western/non-anime animated movies and hard-blocks anime-signaled items as policy conflicts rather than passing them as general animation.
- **Docker Compose Healthcheck Start Period Extended** — `HEALTHCHECK --start-period` increased from 60s to 120s in both `Dockerfile` and `docker-compose.yml`; an explicit `healthcheck:` stanza was added to the compose file so the timing is tunable without an image rebuild. Covers pg_upgrade paths, fresh-install schema loads, and slow-I/O hosts.
- **Smart Compose `--wait` Rebuild Lifecycle** — added `docker:smart:up:wait` npm script that passes `--wait` to `docker compose up` (blocks until container health check passes); `docker:smart:rebuild` updated to use it so the full rebuild-validate cycle returns a reliable exit code instead of detaching immediately.

## [0.47.5b-beta] - 2026-06-17

### Added

- **Active Classification & Queue Visibility in Processing Panel** — the Command Center Processing Panel now shows real-time classification details (title, phase, progress bar, media type, pending queue count, AI telemetry, and up-next queue) when a task is in progress, and a queued-waiting state when workers are busy but items are pending.
- **Scoped Local AI Policy Sweep Auth** — added `/api/auth/token/exchange-local-sweep` endpoint that exchanges an admin API key for a short-lived (60–900s), audience-scoped JWT (`classifarr:local-ai-policy-sweep`) with API-prefix restrictions enforced by auth middleware, following RFC 8725/7519/6750 BCP.
- **Strict Animated-Only Policy Preset** — added `animated_only_strict` system preset with strict genre/keyword constraints so non-animated items fail policy validation instead of silently passing, backed by a database migration (`20260617_120000`).
- **Local AI Policy Sweep Harness** — added a local-only harness (`scripts/local-ai-policy-sweep.mjs`) that submits real classification requests across multiple models, validates response contracts, verifies queue lifecycle, and persists history, with a paired cleanup utility and npm scripts (`test:local:ai-policy-sweep`, `test:local:ai-policy-sweep:cleanup`).
- **Strict Genre Hard-Block Test Coverage** — added a test confirming that `strict: true` on `require_any` genres produces a score of 0 when no required genre matches, preventing soft-advisory misclassification of animated-only libraries.

### Changed

- **RAG Embedding Provider Busy Graceful Degradation** — semantic search now treats embedding provider lock timeouts (`PROVIDER_LOCK_TIMEOUT`) as a degraded empty result (logged at INFO) instead of a hard error, preventing transient lock contention from failing active classifications. Hard failures still propagate when `throwOnError` is enabled.
- **Rolldown INVALID_ANNOTATION Warning Suppression** — added `onwarn` handler in Vite config to suppress `INVALID_ANNOTATION` warnings from `@vueuse/core@14.3.0` during build, where Rolldown (Vite 8's bundler) flags misplaced `/*#__PURE__*/` annotations that Rollup silently ignores.
- **Dependency Updates (Dependabot PRs #457, #458)** — applied `@playwright/test` 1.60.0 → 1.61.0 in client, and `knip` 6.16.1 → 6.17.1 in server.

### Fixed

- **Provider Lock Timeout in Semantic Search** — `isProviderBusyError` was not handled in the semantic search error path, causing a provider lock timeout to be logged as a fatal search failure and potentially aborting classification. The busy path now returns an empty result set and logs at INFO, matching the existing pattern in embedding, backfill, and classification persistence services.

## [0.47.5a-beta] - 2026-06-16

### Fixed

- **OMDb 401 Error-Log Noise** — an invalid OMDb API key or exhausted daily quota produced an HTTP 401 that was logged at ERROR level with a full stack trace, once per enrichment item, flooding the error log (5+ entries per cycle). Since a 401 is a recoverable configuration/quota condition that the queue already handles by pausing OMDb enrichment, it is now logged at WARN without a stack trace and deduplicated (30-minute window) so repeated 401s collapse to a single entry.
- **Transient Database Connection Timeouts** — early reads (JWT secret, classification dispatch-blocker check, image-embedding config) intermittently failed with "Connection terminated due to connection timeout" during startup bursts or brief Postgres unavailability, since pool connection acquisition had no retry. Added a bounded exponential-backoff retry around the idempotent connection-acquisition step (`pool.connect()`) in `query`, `withTransaction`, and `withSessionAdvisoryLock` — query execution is never retried, preserving exactly-once semantics for non-idempotent writes. The backoff uses an unref'd timer so a pending retry never holds the process (or test teardown) open. Tunable via `POSTGRES_CONNECT_RETRIES` (default 2) and `POSTGRES_CONNECT_RETRY_DELAY_MS` (default 250ms); follows the retry-with-backoff pattern for transient infrastructure errors. The retry warning skips DB persistence to avoid writing to a database that is currently failing. `healthCheck()` deliberately keeps failing fast without retry to report true connectivity.
- **Plex Library Fetch Timeout** — `getLibraries` had no explicit request timeout and fell back to the 30s HTTP default, long enough for a slow or unreachable Plex server to hold the entire `/api/media-server/sync` transaction open before aborting (and, in turn, trigger downstream sync failures). Added an explicit 10s timeout matching the existing `getLibraryItems` call so an unreachable Plex fails fast instead of stalling the sync.
- **Reasoning Model Classification Stalls (qwen3 family)** — reasoning/"thinking" models such as `qwen3.5:4b` were forced through Ollama's constrained-JSON decoding grammar, which fought their internal `<think>` reasoning tokens and produced generation stalls (`ESTALL` after 120s), hard timeouts (`ETIMEDOUT` after 300s), and prose-leak parse failures (`narrative_no_format_match`). Added a centralized `isReasoningModel()` detector (now including the `qwen3` family) so reasoning models bypass the rigid grammar and run free-form, relying on the existing strip → parse → repair pipeline to shape the structured answer.
- **Reasoning Model Stall Budgets** — reasoning models now receive larger streaming stall budgets (240s first-token, 90s heartbeat, 600s hard cap) versus the default 120s/60s/300s, since thinking models legitimately take longer to first token and emit more total tokens. Budgets are now overridable per call instead of hardcoded.
- **"No Library Configured" Mislabel on Retry Items** — queued-for-retry items showed the misleading "No Library Configured" routing label even when libraries were configured. The label reflected a missing *selected* library on an unfinished classification, not a configuration problem.
- **Queued-for-Retry Items Invisible in Command Center** — items in `pending_retry` state (queued after an AI failure) were never surfaced in the Command Center "Needs Attention" panel because the pending-classifications query only returned `awaiting_decision` rows. The panel now lists queued-for-retry items with their failure reason and a dedicated Retry Classification action.
- **Auto-Retry Dead-Letter Gap** — classifications that exhausted their automatic retry budget (`retry_count >= max_retries`) previously remained stuck in `pending_retry` indefinitely, never re-selected by the scheduler nor marked terminally failed. The retry scheduler now dead-letters exhausted items to a terminal `failed` state with a clear reason and `retry_after` cleared, following the dead-letter queue pattern (Azure Service Bus `MaxDeliveryCountExceeded`, AWS retry-with-backoff fail-after-N). Dead-lettered items remain visible in History and recoverable via manual retry.
- **Manual Retry Budget Reset** — operator-initiated "Retry Classification" actions now reset `retry_count` to 0, granting a fresh set of automatic attempts once the underlying AI issue is resolved, mirroring the DLQ operator-resubmit pattern. Scheduler auto-retries continue to carry the count forward so the automatic loop stays bounded by `max_retries`.

### Changed

- **Post-Upgrade Log Clear (v0.47.5a-beta)** — added a one-time `clear_logs` post-upgrade task so the upgrade starts with a clean logging state. Unresolved `error_log` rows and all `app_log` rows are cleared along with on-disk `.log` files; resolved (operator-reviewed) error entries are preserved.
- **Dependency Updates (Dependabot PRs #450–#453)** — applied open dependency bumps and refreshed all three lockfiles: root `axios` 1.17.0 → 1.18.0 (redirect/URL hardening security fixes); client runtime `axios` 1.18.0 and `vue` 3.5.35 → 3.5.38; client tooling `@tailwindcss/postcss`/`tailwindcss` 4.3.0 → 4.3.1, `@types/node` 25.9.2 → 25.9.3, `@vitest/coverage-v8`/`vitest` 4.1.8 → 4.1.9, `eslint` 10.4.1 → 10.5.0, `vue-tsc` 3.3.4 → 3.3.5; server tooling `@testcontainers/postgresql` 12.0.1 → 12.0.2, `@types/node` 25.9.2 → 25.9.3, `eslint` 10.4.1 → 10.5.0, `eslint-plugin-n` 18.0.1 → 18.1.0, `eslint-plugin-security` 4.0.0 → 4.0.1. Validated with the full server unit suite (13,123 tests) and clean security lint.
- **Domain Regex Lint Hardening** — the `eslint-plugin-security` 4.0.1 bump flagged the bounded domain-validation regex in `webSearchProviderContract.mjs` as potentially unsafe. Added a justified `eslint-disable` documenting why it cannot catastrophically backtrack (bounded labels separated by a mandatory literal `.`, plus an upstream Zod `.max(253)` length cap), restoring a zero-warning security lint.
- **Local knip lint scripts** — added `lint:knip` and `lint:knip:production` npm scripts to `server/package.json` matching the exact flags CI uses (`--reporter compact --no-progress --cache`), and updated the CI workflow to call these scripts instead of raw `npx knip` so local and CI checks stay identical. Follows the official knip CI guide recommendation to use `npm run` over `npx`.
- **Foundation web search provider knip ignores** — added temporary `ignoreIssues` entries for 4 web search provider framework files (`tavilyWebSearchProvider.mjs`, `webSearchProviderContract.mjs`, `webSearchProviderErrorTaxonomy.mjs`, `webSearchProviderStorage.mjs`) that are not yet wired into production code. These should be removed once the framework is consumed by the classification pipeline.
- **Tavily Provider Modernization** — added a provider-native Tavily client that uses bearer-token request headers, optional project tracking, bounded search payloads, and metadata-preserving provider errors. The legacy `tavilyService` now acts as a compatibility facade while the provider framework calls the modern client directly. Added `docs/architecture/tavily-modernization.md` with the research, tradeoffs, final stack, validation, and next migration targets.
- **Web Search Providers Settings UI** — replaced the Tavily-only settings page with a provider-neutral Web Search Providers page backed by provider-neutral settings routes and storage. Tavily saves now mirror to legacy `tavily_config`, Brave/Serper can be staged without raw JSON, provider tests are adapter-gated, masked keys are never echoed back on save, and `tab=tavily` remains a compatibility alias. Added `docs/architecture/web-search-providers-settings-ui.md` with research, tradeoffs, validation, and follow-up targets.
## [0.47.5-beta] - 2026-06-14

### Fixed

- **Media Server Library Sync Deletion** — fixed library sync failures when removed media-server libraries still had completed classification history by marking those history rows failed before the library delete can null the foreign key.
- **Web Search Provider Fresh-Install Seeds** — reconciled provider-neutral web-search seed data so fresh installs and upgraded installs both receive Tavily, Brave, and Serper provider rows while preserving migrated legacy Tavily settings.
- **AI Provider 404 Handling** — preserved HTTP status metadata from Ollama generation failures and classified provider/model-not-found responses as controlled AI availability failures, preventing missing-model 404s from being logged as hard classification errors.
- **Mapped Library Auto-Routing** — hardened successful classification routing so high-confidence or policy-auto results invoke the routing resolver even when libraries rely on modern `library_arr_mappings` instead of legacy `arr_type` fields, and added route-decision diagnostics for skipped or attempted routing.
- **Rating Normalization Count & Stale Mismatch** — fixed double-counting of ratings in the "Needs Normalization" and "Already Normalized" categories by making the count queries mutually exclusive. Added normalization of OMDb and TMDB metadata ratings during prioritization, and a post-upgrade database cleanup task to reset stale rating normalizations for re-processing.
- **Sync-Normalization Loop Resolution** — resolved the sync-normalization ping-pong loop by conditionalizing database updates on conflict, ensuring raw rating syncs only update local ratings when values have actually changed on the media server (comparing them case-insensitively and trimmed of whitespace).

### Changed

- **Web Search Provider Bridge Design Note** — documented the provider seed-reconciliation bridge, fresh-install parity requirements, official-source research, security constraints, and next Tavily/Web Search modernization targets.
- **Web Search Provider Hardening Plan** — added the Web Search Provider Framework roadmap and implemented the first provider-neutral normalization slice so Tavily web evidence is bounded, URL-filtered, provider-traceable, and ready for future Brave/Serper adapters.
- **Web Search Normalizer Hardening** — hardened normalized web-search evidence with HTML/script cleanup, control-character removal, rank/score/date normalization, Brave-style result extraction, and warning metadata for dropped or corrected provider fields.
- **Web Search Provider Contract Validation** — added a runtime provider contract validator plus a contract-compatible Tavily wrapper so future Brave/Serper adapters must expose bounded request, capability, and normalized-response shapes before routing can consume them.
- **Web Search Provider Error Taxonomy** — added provider-neutral error classification for auth, quota, rate-limit, invalid-request, provider-5xx, timeout, network, SSL, and malformed-response failures, including sanitized messages and `Retry-After` parsing for future cooldown routing.
- **Web Search Provider Config and Usage Storage** — added provider-neutral web-search config and usage tables, legacy Tavily projection/backfill, masked provider-config read models, usage/error recording, and schema snapshot coverage for future quota-aware routing.

## [0.47.4c-beta] - 2026-06-13

### Fixed

- **Enrichment State Real-Time Sync** — added immediate synchronization of media server item enrichment statuses when enrichment tasks are enqueued, cancelled, retried, or dismissed, ensuring stats like the "Basic Enriched" count update immediately in the UI.
- **Media Server Settings Navigation** — corrected the tab ID in the "Configure Media Server" CTA redirect from `media-server` to `mediaserver`, ensuring the link takes the user directly to the media server connection settings.
- **OMDb Enrichment Queue Refill** — allowed gap analysis queue refill to identify and re-queue items missing OMDb metadata when the OMDb provider becomes active, ensuring items previously enriched without OMDb data are properly filled in to complete their metadata profiles.
- **Rating Normalization Queue Refill** — allowed items that were previously normalized to be re-queued when new OMDb or TMDB metadata ratings become available, ensuring standard rating normalization is updated automatically.
- **Basic Enriched Status Hint** — added an info icon to the "Basic Enriched" status badge/stats card in the UI to guide users on configuring the OMDb API key for full metadata profiles.
- **Media Server Save Button** — enabled the global "Connect & Save" button when a valid media server configuration is loaded or active, and ensured it activates during setup wizard steps (Plex, Jellyfin, Emby) to act as a universal submit action.

### Changed

- **Password Manager Autocomplete Exclusions** — configured the shared `PasswordInput` component to default to `autocomplete="off"` and added standard ignore attributes (`data-lpignore="true"` and `data-1pass-no-save="true"`). This prevents browsers and password managers from prompting to save or update site login credentials when entering API keys and secrets in settings.
- **Quick Start Image Tracking** — changed the README Docker Compose example and release workflow to keep `ghcr.io/cloudbyday90/classifarr:latest`, matching the checked-in compose files so users can receive new images by pulling/recreating without editing compose each release.

## [0.47.4b-beta] - 2026-06-13

### Fixed

- **Initial Account Setup Redirect Loop** — stopped authenticated system-health polling and expired-session redirects from running on login/setup routes, preventing fresh installs from being pushed to `/login?expired=true` while creating the first admin account.
- **Plain HTTP Browser Console Noise** — only emits COOP/OAC browser isolation headers when HTTPS header enforcement is enabled, preserving standard security headers while preventing LAN HTTP warnings about untrustworthy origins.

## [0.47.4a-beta] - 2026-06-13

### Added

- **Policy Builder State Extraction Design Note** — added `docs/architecture/policy-builder-state-extraction.md` with official-source research, recommendation tradeoffs, final implementation stack, security boundaries, validation notes, and next design targets.
- **Policy Intent Contract Design Note** — added `docs/architecture/policy-intent-contract.md` with official-source research, recommendation tradeoffs, final implementation stack, security boundaries, validation notes, and next design targets.
- **Policy Builder Intent-First UI Design Note** — added `docs/architecture/policy-builder-intent-first-ui.md` with official-source research, recommendation tradeoffs, final implementation stack, security boundaries, validation notes, and next design targets.

### Changed

- **Policy Builder State Extraction** — moved deterministic policy builder form state, selected starter-template state, custom signal helpers, intent signal helpers, validation, and save-payload construction into `usePolicyBuilderState.js` while preserving the existing legacy preset-compatible save payload.
- **Policy Intent Contract** — added server-owned `policy_intent_contract` metadata to policy read/create/update responses. The contract derives purpose, hard limits, helpful hints, avoid rules, review behavior, template provenance, warnings, and unsupported legacy preset signals without changing preset-backed policy storage or triggering migration.
- **Policy Builder Intent-First UI** — added a policy intent editor to `PolicyBuilderModal` so operators can add identity signals, compatibility signals, strict rating constraints, boosters, and exclusions directly. The editor uses a modular client-side intent projection while continuing to save through the existing structured `customSignals` policy payload.

### Fixed

- **Docker PostgreSQL Startup Loop** — kept the default Compose PostgreSQL runtime tmpfs hardened with `noexec` and made optimized pgvector runtime staging symlink-based. Startup now points `/run/postgresql/pgvector/vector.so` at the immutable image-layer AVX/AVX2 binary when safe, falls back to the generic image-layer `vector.so` if staging fails, and avoids restarting during the RAG embeddings migration. Also fixed the BIGINT classification-history migration to avoid PostgreSQL 18's ambiguous `smallint[] @> smallint[]` operator resolution.
- **Debug Rule Insert Route Hardening** — required read-write API permissions for the non-production library rule debug insert endpoint so a read-only API key cannot mutate rule data even in development/test deployments.

## [0.47.4-beta] - 2026-06-13

### Added

- **Streamlined *arr Setup Design Note** — added `docs/best_practices_esm_and_modular_services.md` detailing research recommendations, pros/cons, and final architecture decisions for Vue 3 composables and Node.js ES Module service design.
- **useArrConfig Shared Composable** — created `client/src/composables/useArrConfig.js` to manage reactive state, connection testing, and saving/transition operations for both Radarr and Sonarr instances.
- **Final Outcome Signal Snapshot Separation Design Note** — added `docs/architecture/final-outcome-signal-snapshot-separation.md` with official-source research, recommendation tradeoffs, final implementation stack, security boundaries, validation notes, and next design targets.
- **Policy Configuration Modernization Design Note** — added `docs/architecture/policy-configuration-modernization.md` with official-source research, recommendation tradeoffs, final implementation stack, security boundaries, validation notes, and next design targets.
- **Policy Candidate Evidence Calibration Design Note** — added `docs/architecture/policy-candidate-evidence-calibration.md` with official-source research, calibration tradeoffs, final implementation stack, security boundaries, validation notes, and next design targets.
- **Policy Constraint Semantics Design Note** — added `docs/architecture/policy-constraint-semantics.md` with official-source research, strict/advisory policy constraint tradeoffs, final implementation stack, security boundaries, validation notes, and next design targets.
- **RAG Evidence Quality Gating Design Note** — added `docs/architecture/rag-evidence-quality-gating.md` with official-source research, quality-gate tradeoffs, the final implementation stack, security boundaries, and the next design targets.
- **RAG Evidence Snapshot Observability** — RAG loop traces now persist bounded, sanitized pass-one/pass-two neighbor evidence and per-pass library counts in classification metadata. The History detail modal renders the snapshot alongside profile scoring and targeted re-check traces so future classification incidents can be diagnosed without direct PostgreSQL inspection.
- **Policy Evidence Hardening Design Note** — added `docs/architecture/policy-evidence-hardening.md` documenting the root cause, official-source research, recommendation tradeoffs, final implementation stack, outcome, and next design targets.
- **pgvector Retrieval Recall Design Note** — added `docs/architecture/pgvector-retrieval-recall-tuning.md` with official-source research, recommendation tradeoffs, final implementation stack, security constraints, validation commands, and the next three high-value design targets.
- **pgvector Recall Audit Mode** — added admin-only `GET /api/rag/retrieval/recall-audit` to compare bounded HNSW approximate nearest-neighbor results against exact search (`SET LOCAL enable_indexscan = off`) for sampled classification embeddings. Added `docs/architecture/pgvector-recall-audit-mode.md` with the design, tradeoffs, security boundaries, validation notes, and follow-up design items.
- **Decision Trace Correlation** — added W3C-compatible decision trace context for classification outcomes, including persisted `classification_details.decision_trace`, RAG loop `trace_context`, stage-log trace metadata, and a History detail panel that exposes trace ID, UUID correlation ID, traceparent, and compact decision stages. Added `docs/architecture/decision-trace-correlation.md` with the official-source research, recommendation tradeoffs, final stack, security boundaries, validation notes, and next design targets.
- **Decision Trace Stage Timing** — added bounded child spans for targeted re-check stages (`gate`, `enrichment`, `retrieval_pass2`, `policy_recheck`, `ai_rerun`, and `rag_candidate`) with span IDs, parent span IDs, duration, outcome, reason code, and sanitized scalar attributes. RAG traces, decision trace metadata, stage-log metadata, and the History detail modal now expose stage timing before any full telemetry exporter is introduced. Added `docs/architecture/decision-trace-stage-timing.md` with official-source research, tradeoffs, final stack, security boundaries, validation notes, and next design targets.

### Changed

- **Streamlined *arr Instance Setup** — refactored Radarr and Sonarr settings views to use `useArrConfig.js` composable, removing duplicate logic and implementing a clean one-pass configuration flow. Running a successful **Test Connection** now automatically saves settings to the database and transitions to edit mode to expose library mappings. Also updated both Radarr and Sonarr connection test handlers to populate `additionalInfo` with root folder and quality profile counts, enabled deletion of any configured instance (including the last remaining one), and integrated step-by-step setup instructions for both forms.
- **History Detail Outcome/Snapshot Separation** — split the History detail modal into explicit final outcome and original signal snapshot concepts. The signal panel now shows snapshot source, snapshot date, final outcome summary, and snapshot score instead of reusing the final row confidence for diagnostic evidence.
- **Policy Configuration Modernization** — added a structured `configuration_view` to policy read/create/update responses that projects merged preset and custom signals into identity signals, compatibility signals, strict constraints, boosters, exclusions, and bounded configuration warnings. Custom signal runtime constraint aliases are now normalized before persistence.
- **Policy Candidate Evidence Calibration** — calibrated weak policy candidates before ranking so compatibility-only, profile-only, and RAG-only evidence cannot outrank stronger identity or multi-source candidates purely through high raw scores. Ranked candidates now preserve `raw_score` and bounded `score_calibration` diagnostics for explainability.
- **Policy Constraint Semantics** — added explicit strict runtime constraint evaluation for policy preset signals while keeping existing policy scoring advisory by default. Strict constraints now work across genres, keywords, studios, language, media type, certifications, release year, vote average, and runtime; failing constraints are excluded from ranking and persisted as bounded `policy_constraints` diagnostics.
- **RAG Evidence Quality Gating** — added deterministic RAG neighbor quality scoring that demotes evidence without trusted final outcome provenance, resolved library identity, or compatible profile evidence. Policy candidate diagnostics now include bounded `rag_evidence_quality` details, and RAG suggestions/dynamic weights use quality-adjusted similarity.
- **Dead Exports Removed** — removed unused `decisionTraceContext` and `decisionTraceSpanCollector` namespace exports from their respective modules. All consumers already import the individual functions directly; the aggregated objects were flagged by knip as dead code.
- **Dependabot Maintenance Rollup (server tooling)** — bumped `@types/node` from 25.9.1 to 25.9.2 and `knip` from 6.16.0 to 6.16.1 in server dev dependencies. Closes #448.
- **Dependabot Maintenance Rollup (server runtime)** — bumped `morgan` from 1.10.1 to 1.11.0 and `undici` from 8.3.0 to 8.4.0 in server runtime dependencies. Closes #447.
- **Dependabot Maintenance Rollup (client tooling)** — bumped `@types/node` from 25.9.1 to 25.9.2 and `vue-tsc` from 3.3.3 to 3.3.4 in client dev dependencies. Closes #446.

### Fixed

- **RAG Evidence Library Identity Resolution** — resolved RAG neighbor library names from the live `libraries` table when legacy `classification_history.library_name` values are null, and added stable `Library #id` fallbacks in server trace sanitization, AI context formatting, and the History RAG evidence snapshot. This prevents stale denormalized rows from appearing as “Unknown library” evidence during policy/profile re-check diagnosis.
- **Policy Evidence Anchor Hardening** — added candidate eligibility diagnostics so hard profile exclusions and weak evidence (`rag_improved`, `profile_only`, broad compatibility-only signals) cannot become primary policy anchors or second-pass adoption targets. This fixes the failure mode where a RAG-only `Family` candidate could lead the question despite an `R` rating exclusion, and where a generic `Comedy` signal could over-influence a specialized `Comedy and Standup` destination.
- **pgvector Retrieval Recall Tuning** — centralized pgvector HNSW recall controls, raised candidate-gathering `ef_search` defaults, expanded bounded vector candidate windows, and enabled query-local iterative HNSW scans by default. This reduces the chance that policy/profile re-checks only evaluate a narrow RAG candidate set before deterministic evidence can reject weak matches.
- **pgvector Distance Ordering for HNSW Eligibility** — changed semantic retrieval's candidate CTE to order by `ce.embedding <=> query_vector` directly instead of sorting by an aliased similarity expression, keeping the pgvector HNSW index eligible for approximate nearest-neighbor scans.
- **Knip Production Dead Export** — removed unused `calibratePolicyCandidates` (plural) batch wrapper from `policyCandidateCalibration.mjs`; production code already calls `calibratePolicyCandidate` (singular) directly via `policyCandidateRanker.mjs`. Updated test to match. Eliminates both the knip `--production` unused-export and the ESLint `no-unused-vars` CI failures.
- **Client ESLint Unused Vars** — removed unused destructured `configs` and `loadConfigs` variables from `useArrConfig.test.js` caught by ESLint `no-unused-vars`.

## [0.47.3-beta] - 2026-06-06

### Changed

- **Dead Exports Removed** — removed unused `decisionTraceContext` and `decisionTraceSpanCollector` namespace exports from their respective modules. All consumers already import the individual functions directly; the aggregated objects were flagged by knip as dead code.

### Fixed

- **Policy Evidence Anchor Hardening** — added candidate eligibility diagnostics so hard profile exclusions and weak evidence (`rag_improved`, `profile_only`, broad compatibility-only signals) cannot become primary policy anchors or second-pass adoption targets. This fixes the failure mode where a RAG-only `Family` candidate could lead the question despite an `R` rating exclusion, and where a generic `Comedy` signal could over-influence a specialized `Comedy and Standup` destination.
- **pgvector Retrieval Recall Tuning** — centralized pgvector HNSW recall controls, raised candidate-gathering `ef_search` defaults, expanded bounded vector candidate windows, and enabled query-local iterative HNSW scans by default. This reduces the chance that policy/profile re-checks only evaluate a narrow RAG candidate set before deterministic evidence can reject weak matches.
- **pgvector Distance Ordering for HNSW Eligibility** — changed semantic retrieval's candidate CTE to order by `ce.embedding <=> query_vector` directly instead of sorting by an aliased similarity expression, keeping the pgvector HNSW index eligible for approximate nearest-neighbor scans.

### Added

- **RAG Evidence Snapshot Observability** — RAG loop traces now persist bounded, sanitized pass-one/pass-two neighbor evidence and per-pass library counts in classification metadata. The History detail modal renders the snapshot alongside profile scoring and targeted re-check traces so future classification incidents can be diagnosed without direct PostgreSQL inspection.
- **Policy Evidence Hardening Design Note** — added `docs/architecture/policy-evidence-hardening.md` documenting the root cause, official-source research, recommendation tradeoffs, final implementation stack, outcome, and next design targets.
- **pgvector Retrieval Recall Design Note** — added `docs/architecture/pgvector-retrieval-recall-tuning.md` with official-source research, recommendation tradeoffs, final implementation stack, security constraints, validation commands, and the next three high-value design targets.
- **pgvector Recall Audit Mode** — added admin-only `GET /api/rag/retrieval/recall-audit` to compare bounded HNSW approximate nearest-neighbor results against exact search (`SET LOCAL enable_indexscan = off`) for sampled classification embeddings. Added `docs/architecture/pgvector-recall-audit-mode.md` with the design, tradeoffs, security boundaries, validation notes, and follow-up design items.
- **Decision Trace Correlation** — added W3C-compatible decision trace context for classification outcomes, including persisted `classification_details.decision_trace`, RAG loop `trace_context`, stage-log trace metadata, and a History detail panel that exposes trace ID, UUID correlation ID, traceparent, and compact decision stages. Added `docs/architecture/decision-trace-correlation.md` with the official-source research, recommendation tradeoffs, final stack, security boundaries, validation notes, and next design targets.
- **Decision Trace Stage Timing** — added bounded child spans for targeted re-check stages (`gate`, `enrichment`, `retrieval_pass2`, `policy_recheck`, `ai_rerun`, and `rag_candidate`) with span IDs, parent span IDs, duration, outcome, reason code, and sanitized scalar attributes. RAG traces, decision trace metadata, stage-log metadata, and the History detail modal now expose stage timing before any full telemetry exporter is introduced. Added `docs/architecture/decision-trace-stage-timing.md` with official-source research, tradeoffs, final stack, security boundaries, validation notes, and next design targets.

## [0.47.2a-beta] - 2026-06-05

### Fixed

- **Ollama Preflight Probe Timeout Too Short for Cold Starts** — increased `DEFAULT_PROBE_TIMEOUT_MS` from 15s to 120s (2 minutes) so the generation readiness probe survives cold model loads that take 30-90 seconds on larger models. Existing installs with `OLLAMA_PROBE_TIMEOUT_MS` already set in `.env` are unaffected; new installs and upgrades get the longer default automatically. Updated `.env.example` documentation accordingly.

## [0.47.2-beta] - 2026-06-05

### Fixed

- **jsdom "Not implemented: navigation" Test Warning** — suppressed the spurious `Not implemented: navigation to another Document` console warning emitted during client test runs. Root cause was `Logs.vue` `exportLogs()` creating a temporary anchor element and calling `a.click()` to trigger a blob download, which jsdom interprets as page navigation. Fixed by spying on `HTMLAnchorElement.prototype.click` in the `exportLogs` test to prevent the real jsdom navigation handler from firing.
- **Canonical Classification History Outcomes** — changed `/api/classification/history` to return one canonical final row per media identity instead of every intermediate classification event. The server now groups rows by `tmdb_id` + `media_type` with a title/year fallback, ranks terminal user/outcome rows ahead of retry/source observations, and attaches the full `history_events` lifecycle to the selected row. The History detail modal now renders that lifecycle so retries, policy rechecks, manual resolutions, and source-library sync observations remain inspectable without presenting duplicate titles as separate outcomes.
- **RAG-Only Policy Promotion Guard** — downgraded `rag_improved` policy candidates to weak viability and blocked pure retrieval fallback candidates from becoming the final policy-prompt result. RAG can still improve a candidate and inform rechecks, but an automated final outcome now needs corroborating policy/profile/history/pattern evidence or a manual/user decision.
- **Library Profile Rating Normalization** — normalized ratings when generating `library_profiles.rating_distribution` so raw age ratings such as `16`, `17`, and `18` fold into canonical TV ratings like `TV-MA`. Profile scoring also normalizes legacy persisted distributions and exclusion ratings at read time, preventing stale mixed buckets from suppressing rating affinity while upgraded installs are being repaired.

### Added

- **Post-Upgrade Library Profile Regeneration** — added a one-time post-upgrade task for `0.47.2-beta` that regenerates active library profiles only when stale, non-canonical rating buckets are present. Existing installs repair themselves on startup instead of requiring manual PostgreSQL commands; fresh installs continue to pre-seed post-upgrade tasks as complete, and already-normalized profiles are marked complete without regeneration.
- **Profile Scoring Observability** — added bounded, versioned profile scoring diagnostics that persist with policy candidate diagnostics and render in the History detail modal. Operators can now inspect the rating normalization, profile distribution percentage, genre and keyword score deltas, and exclusion hits used for the original classification without rerunning scoring against a later profile state. Added `docs/architecture/profile-scoring-observability.md` with official-source research, recommendation tradeoffs, the final implementation stack, and follow-up design items.

### Changed

- **Dependabot Maintenance Rollup** — locally applied and validated the open Dependabot PR equivalents for client runtime (`axios` 1.17.0 with SSRF config hardening, auth redirect, and proxy TLS fixes), client tooling (`@vue/test-utils` 2.4.11, `eslint-plugin-vue` 10.9.2), server tooling (`knip` 6.16.0), and pinned GitHub Actions SHAs for `actions/checkout` v6.0.3 (SHA-256 repo support) and `github/codeql-action` v4.36.2 (exponential backoff, bundle v2.25.6).
- **Dead Export Removed** — removed unused `computeProfileScore()` export from `libraryProfileComputations.mjs` (callers use `computeProfileScoreDetails()` directly). Removed stale `socket.io` entry from `server/knip.json` `ignoreDependencies` (knip 6.16.0 now resolves the DI-injected import correctly).
