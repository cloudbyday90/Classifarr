# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Embedding/backfill availability, status, and config now flow through shared server and client contracts instead of duplicated per-mode logic** — provider availability is persisted in the database, backfill and availability status are exposed through shared presenters, the canonical backfill config/status routes now anchor the API surface, and the RAG UI now consumes named API helpers instead of scattering raw route strings across tabs. (`server/src/services/embeddingAvailabilityService.js`, `server/src/utils/embeddingAvailabilityPresenter.js`, `server/src/utils/backfillStatusPresenter.js`, `server/src/routes/rag.js`, `client/src/api/index.js`, `client/src/utils/embeddingAvailabilityUi.js`, `client/src/utils/backfillStatusUi.js`, `client/src/views/RAGSettings.vue`, `client/src/views/rag/*.vue`)

- **Confidence and rollout-safety settings now use the shared client API surface instead of hard-coded `/api/...` paths** — the confidence settings page now reads/writes confidence history/export/revert and RAG fallback incident state through named API helpers, keeping that older settings surface aligned with the same client-contract cleanup used across the RAG tabs. (`client/src/api/index.js`, `client/src/views/settings/Confidence.vue`, `client/src/__tests__/settings/Confidence.test.js`)

- **Older stats/history/admin client surfaces now use shared API helpers instead of bypassing auth/refresh handling with direct `fetch('/api/...')` calls** — policy stats dashboard/detail views, classification library-profile lookup, ARR config warnings, and legacy-rule warnings now all flow through the shared client API module rather than hand-rolling direct API requests. (`client/src/api/index.js`, `client/src/views/PolicyStatsDashboard.vue`, `client/src/components/stats/PolicyStatsModal.vue`, `client/src/components/history/LibraryProfilePanel.vue`, `client/src/components/settings/ArrConfigWarning.vue`, `client/src/components/LegacyRuleWarning.vue`, `client/src/__tests__/ArrConfigWarning.test.js`)

- **The legacy migration UI now uses named migration API helpers instead of scattering raw `/migration/...` route calls across the dashboard and wizard** — migration status/library listing, rule loading, analysis, single-rule migration, and library-wide migration now all delegate through the shared client API layer. (`client/src/api/index.js`, `client/src/views/MigrationDashboard.vue`, `client/src/components/migration/MigrationWizard.vue`)

- **Dead legacy settings code has been pruned from the client tree** — the orphaned `Confidence.vue.old` backup file was removed after the live confidence settings page was fully migrated onto the shared client API helpers. (`client/src/views/settings/Confidence.vue.old`)

- **The legacy embedding retry queue has been fully retired from the live schema and runtime path** — text embedding generation now relies solely on the canonical “missing embedding” work queries plus shared provider-availability cooldowns, stats preserve `pendingRetries` as a compatibility field, the obsolete startup cleanup task was removed, and a safe follow-up migration now drops the dead queue table while bringing the schema snapshot into line. (`server/src/services/embeddingService.js`, `server/src/services/classificationRetryService.js`, `server/src/services/postUpgradeService.js`, `database/migrations/20260328_020500_drop_embedding_retry_queue.sql`, `database/schema/current.sql`)

- **Embedding execution and circuit-breaker ownership are now centered in `embeddingProvider` instead of split between router and provider** — provider-mode failures now trip the same canonical breaker instance used for legacy `same` mode, legacy `same` execution and recovery probes now also run through `embeddingProvider`, router-side fallback no longer double-counts provider failures, the last duplicate same-mode provider-resolution helper was removed from the router, and the router/routes/manual backfill now read/reset breaker state through one facade instead of reaching into `embeddingProvider.circuitBreaker` directly. (`server/src/services/embeddingCircuitBreaker.js`, `server/src/services/circuitBreaker.js`, `server/src/services/embeddingRouter.js`, `server/src/services/embeddingProvider.js`, `server/src/services/manualBackfillService.js`, `server/src/routes/rag.js`)

- **The final stale cache-reset residue from the old embedding router/provider split has been removed** — `embeddingRouter` and `embeddingProvider` no longer pretend to own local config caches they do not actually use, and the router regression setup no longer resets phantom cache fields from the pre-refactor implementation. (`server/src/services/embeddingRouter.js`, `server/src/services/embeddingProvider.js`, `server/src/__tests__/embeddingRouter.test.js`)

- **Text embedding recommendation metadata now has one canonical owner instead of being split across router, provider discovery, and client defaults** — the shared recommendation catalog now lives with `embeddingProvider`, the canonical text-model metadata flow serves it from the RAG API, and the text-embedding settings tab fetches and normalizes that server-owned list instead of shipping its own stale embedded model catalog. (`server/src/services/embeddingProvider.js`, `server/src/routes/rag.js`, `client/src/api/index.js`, `client/src/views/rag/TextEmbeddingsTab.vue`)

- **Text embedding model metadata now flows through one provider-aware endpoint instead of a split “recommendations here, discovery there” contract** — the canonical `POST /api/rag/text-models` route now resolves the active text-embedding provider, returns the right recommendation set for `same`, `separate_ollama`, or `cloud` mode, and lets the text-embedding UI fetch both provider-aware recommendations and discovered cloud models from one path. (`server/src/routes/rag.js`, `client/src/api/index.js`, `client/src/views/rag/TextEmbeddingsTab.vue`)

- **Image embedding model metadata now has the same canonical contract shape as text embeddings** — the image tab now uses `POST /api/rag/image-models-metadata` for both active-config cache reads and live local/cloud model refreshes through the canonical API surface. (`server/src/routes/rag.js`, `server/src/__tests__/integration/rag-api.test.js`, `client/src/api/index.js`, `client/src/views/rag/ImageEmbeddingsTab.vue`)

- **The API docs now spell out the canonical RAG and embeddings contract instead of leaving operators to infer it from deprecation notices** — the API README now highlights the normalized status/config, text-model, image-model, and manual backfill endpoints that new integrations should target. (`docs/api/README.md`)

- **RAG API docs now have a dedicated contract linter instead of relying only on generic Markdown style checks** — `scripts/check-rag-api-docs.js` verifies that the canonical endpoint section in `docs/api/README.md` stays aligned with the helper-owned RAG route modules, and it is exposed as `npm run lint:docs:rag-api`. (`scripts/check-rag-api-docs.js`, `scripts/__tests__/check-rag-api-docs.test.js`, `package.json`, `README.md`)

- **RAG documentation and release messaging now describe the canonical-only API surface instead of narrating removed transition routes as current behavior** — the remaining release-note wording was tightened so current docs focus on the lock-aware manual backfill lifecycle and canonical endpoints rather than deleted alias routes. (`RELEASE_NOTES.md`, `CHANGELOG.md`)

- **Dead cache-matching residue from the old image model route split has been removed from `rag.js`** — the route layer now relies only on the canonical image metadata lookup helper instead of carrying both the new lookup path and an unused pre-refactor cache matcher. (`server/src/routes/rag.js`)

- **The last direct `/rag/...` client calls in the RAG UI were moved behind named API helpers** — `RAGStats`, `AdvancedTab`, and `GraphTab` now use explicit shared API methods for detailed stats, circuit breaker actions, warmup, exports, advanced settings, promotion readiness, graph fill rate, and destructive RAG actions, and the dead duplicate metrics-export helper in `RAGStats` was removed. (`client/src/api/index.js`, `client/src/views/statistics/RAGStats.vue`, `client/src/views/rag/AdvancedTab.vue`, `client/src/views/rag/GraphTab.vue`)

- **The shared client API module no longer silently overrides its own settings helpers or re-implements the same queue calls under multiple code paths** — `getSettings` and `updateSettings` now keep their category-aware contract instead of being shadowed later in the file, and the queue alias methods now delegate through shared request helpers so pending-task and retry/cancel behavior stays consistent across Activity, Queue, and Command Center surfaces. (`client/src/api/index.js`)

- **The shared client API module no longer exports dead queue-era aliases that the live UI does not call** — unused `retryTask` and `cancelTask` wrappers were removed after the Queue and Command Center surfaces were confirmed to use the canonical `retryQueueTask` and `cancelQueueTask` methods directly. (`client/src/api/index.js`)

- **The shared client API module no longer carries an unused retry-queue backfill wrapper** — `backfillRetryQueue` was removed after confirming that no live client surface calls it, while the still-active `processRetryQueue` path remains as the current operator action used by Activity and Command Center. (`client/src/api/index.js`)

- **The live client enrichment-retry action now uses current terminology instead of older queue-centric naming** — the shared API surface and the Activity/Command Center callers now use `processEnrichmentRetries`, which better matches the actual operator action of retrying enrichment work for OMDb/Tavily instead of exposing an implementation-flavored `processRetryQueue` label. (`client/src/api/index.js`, `client/src/views/Activity.vue`, `client/src/views/CommandCenter.vue`)

- **The live client AI-activity contract now uses provider-agnostic naming instead of exposing old Ollama-specific terminology** — the shared API surface now exposes `getAiGenerationStatus`, the Command Center data layer now treats that payload as generic AI-generation activity, the Activity screen no longer uses `ollamaStatus` naming in its live state, and the dead unused `getRetryStats` client export was removed. (`client/src/api/index.js`, `client/src/composables/useCommandCenterData.js`, `client/src/views/Activity.vue`, `client/src/views/CommandCenter.vue`)

- **The live client queue-pending contract now has one canonical method instead of a split raw-response alias** — `Activity` now uses the same `getQueuePending` helper as the Queue and Command Center surfaces, and the last duplicate `getPendingTasks` wrapper was removed from the shared API module. (`client/src/api/index.js`, `client/src/views/Activity.vue`, `client/src/views/__tests__/Activity.spec.js`)

- **The shared client API module no longer carries a long tail of dead wrappers for screens that no longer exist or paths the UI never calls** — unused auth-session, library-label, pattern-management, extra provider-config, webhook-detail, suggestion-detail, and reclassification-list helpers were removed after confirming they had no live client callers or client test mocks. (`client/src/api/index.js`)

- **Setup, heartbeat, and ARR-config status calls now go through named client API helpers instead of raw low-level requests** — the route guard, Setup banner, Command Center data layer, and RAG settings/backfill screens now use explicit helper methods for setup status, heartbeat settings/health, and ARR config status rather than hand-rolling `fetch('/api/...')` or generic `api.get('/...')` calls. (`client/src/api/index.js`, `client/src/router/index.js`, `client/src/composables/useCommandCenterData.js`, `client/src/components/SetupBanner.vue`, `client/src/views/RAGSettings.vue`, `client/src/views/rag/BackfillTab.vue`)

- **The first `rag.js` decomposition pass started by extracting backfill plumbing into a focused route helper module** — manual backfill option parsing, shared embedding-availability/backfill-status resolution, and canonical backfill config reads/writes now live in `ragBackfillHelpers.js`, reducing the amount of non-route machinery owned directly by `server/src/routes/rag.js` without changing endpoint contracts. (`server/src/routes/rag.js`, `server/src/routes/helpers/ragBackfillHelpers.js`)

- **The second `rag.js` decomposition pass extracts text/image model metadata resolution into its own helper module** — provider-aware text-model recommendation/discovery logic, image-model lookup/cache resolution, and image-model cache persistence now live in `ragModelMetadataHelpers.js`, leaving the route file to focus more on HTTP handling while preserving the canonical text and image model endpoints. (`server/src/routes/rag.js`, `server/src/routes/helpers/ragModelMetadataHelpers.js`)

- **The third `rag.js` decomposition pass extracts status, overview, and metrics payload assembly into a dedicated helper module** — pgvector/settings lookups, provider/image status synthesis, overview counters, detailed metrics aggregation, and the health/cost summary payloads now live in `ragStatusHelpers.js`, so `rag.js` keeps the route contract while shedding another large block of query/presenter logic. (`server/src/routes/rag.js`, `server/src/routes/helpers/ragStatusHelpers.js`)

- **The operational RAG route cluster now has helper-owned route registration instead of staying inline in `rag.js`** — logs, advanced settings, retry settings, exports, image-model cache, and destructive maintenance endpoints are now registered from `ragOperationsHelpers.js`, which moves this part of the RAG surface from “helper-backed logic” to actual module-owned routing while preserving the existing API and validation behavior. (`server/src/routes/rag.js`, `server/src/routes/helpers/ragOperationsHelpers.js`)

- **The backfill RAG route cluster now also has helper-owned route registration** — manual backfill controls, live status, canonical config, and backfill history are now registered from `ragBackfillHelpers.js`, so `rag.js` no longer carries that full endpoint block inline while keeping the same request contracts and presenter-backed responses. (`server/src/routes/rag.js`, `server/src/routes/helpers/ragBackfillHelpers.js`)

- **The last direct backfill-history query has been folded into the extracted helper layer** — `registerRagBackfillRoutes()` now stays pure HTTP wiring, while the backfill history payload is resolved alongside the other helper-owned backfill/config methods instead of reaching into `db` from the route-registration function. (`server/src/routes/rag.js`, `server/src/routes/helpers/ragBackfillHelpers.js`)

- **Backfill history lookup now has one shared helper owner instead of a duplicated private query in the status composer** — `ragStatusHelpers` now consumes the same helper-owned backfill history payload used by the backfill route cluster, keeping that query logic out of both route registration and the status helper’s private internals. (`server/src/routes/rag.js`, `server/src/routes/helpers/ragBackfillHelpers.js`, `server/src/routes/helpers/ragStatusHelpers.js`)

- **RAG metrics payload assembly now has one helper implementation instead of parallel collector loops** — `ragStatusHelpers` now builds both the detailed and public metrics payloads from the same shared operation/provider metrics collector, removing the last duplicated metrics-shaping path in that helper. (`server/src/routes/helpers/ragStatusHelpers.js`)

- **The diagnostics and discovery RAG route cluster now also has helper-owned route registration** — loop fallback/promotion diagnostics, circuit-breaker routes, warmup/errors, migration controls, discovered-pattern actions, and graph fill-rate diagnostics are now registered from `ragDiagnosticsHelpers.js`, so the main route file no longer owns that operational block inline while preserving the same endpoint behavior. (`server/src/routes/rag.js`, `server/src/routes/helpers/ragDiagnosticsHelpers.js`)

- **The remaining core RAG route block now also has helper-owned route registration** — connection tests, text/image model metadata endpoints, embedding test, and the top-level status/overview/health/cost/metrics routes are now registered from `ragCoreHelpers.js`, turning `rag.js` into a small composition module instead of a mixed registration/logic file. (`server/src/routes/rag.js`, `server/src/routes/helpers/ragCoreHelpers.js`)

- **The post-decomposition cleanup trimmed the last stale composition residue from `rag.js`** — the route composition file no longer carries an unused backfill-helper destructure after the helper-owned registration split, keeping the module purely focused on wiring. (`server/src/routes/rag.js`)

- **The old RAG transition routes have been removed instead of being preserved as a parallel legacy surface** — obsolete backfill alias/config slices and old model/cache routes were deleted so the codebase now exposes only the canonical RAG/backfill/model endpoints, and the route helpers/docs/linter were collapsed back onto that modernized API contract. (`server/src/routes/helpers/ragBackfillHelpers.js`, `server/src/routes/helpers/ragCoreHelpers.js`, `server/src/routes/helpers/ragOperationsHelpers.js`, `server/src/routes/rag.js`, `scripts/check-rag-api-docs.js`, `scripts/__tests__/check-rag-api-docs.test.js`, `docs/api/README.md`)

### Fixed

- **Embedding outages now pause work across processes instead of retrying the same failed provider path indefinitely** — provider-offline state is DB-backed through the new safe availability migration, cooldown/probe state is shared across workers, router-side fallback/circuit-breaker handling now stops spamming repeat failures, classification/backfill entry points respect the shared availability state, and the UI reports cooldown/probe state consistently so operators can see why embeddings are paused. (`database/migrations/20260327_235000_add_embedding_provider_availability.sql`, `server/src/config/database.js`, `server/src/services/embeddingRouter.js`, `server/src/services/embeddingService.js`, `server/src/services/embeddingAvailabilityService.js`, `server/src/services/classification.js`, `server/src/services/idleBackfillService.js`, `server/src/services/manualBackfillService.js`, `server/src/services/scheduledBackfillService.js`, `server/src/services/schedulerService.js`, `server/src/routes/rag.js`, `client/src/views/rag/OverviewTab.vue`, `client/src/views/rag/BackfillTab.vue`, `client/src/views/statistics/RAGStats.vue`)

- **The dedicated RAG API docs linter now validates only the canonical decomposed route surface** — after removing the old transition routes, it now checks the helper-owned canonical endpoints directly instead of trying to track a parallel legacy route layer. (`scripts/check-rag-api-docs.js`, `scripts/__tests__/check-rag-api-docs.test.js`)

- **Operational docs and generic middleware tests now use the canonical manual backfill route and modern request shape** — current examples now reference `POST /api/rag/backfill/manual/start` with `batchSize`, and the generic malformed-JSON middleware test no longer mounts a removed RAG alias route. (`docs/issue-275-phase-8-completion.md`, `docs/issue-275-release-runbook.md`, `server/src/__tests__/errorHandler.test.js`)

### Tests

- Added coverage for the new embedding availability presenter/service, router/service outage handling, consolidated backfill status/config contracts, the canonical RAG API surface, and the client helper migrations across the RAG settings tabs. (`server/src/__tests__/embeddingAvailabilityPresenter.test.js`, `server/src/__tests__/backfillStatusPresenter.test.js`, `server/src/__tests__/embeddingAvailabilityService.test.js`, `server/src/__tests__/embeddingRouter.test.js`, `server/src/__tests__/embeddingService.test.js`, `server/src/__tests__/embeddingService.rich.test.js`, `server/src/__tests__/idleBackfillService.test.js`, `server/src/__tests__/manualBackfillService.test.js`, `server/src/__tests__/scheduledBackfillService.test.js`, `server/src/__tests__/schedulerService.test.js`, `server/src/__tests__/integration/rag-api.test.js`, `client/src/__tests__/BackfillTab.test.js`, `client/src/__tests__/OverviewTab.test.js`, `client/src/__tests__/RAGSettingsTabPersistence.test.js`, `client/src/__tests__/GraphTab.test.js`, `client/src/__tests__/AdvancedTab.issue275.test.js`, `client/src/__tests__/settings/Confidence.test.js`)

- Updated embedding, post-upgrade, and RAG API regressions to pin both the first-stage runtime removal and the later schema retirement of the dead `embedding_retry_queue` path while preserving the existing stats compatibility field. (`server/src/__tests__/embeddingService.test.js`, `server/src/__tests__/postUpgradeService.test.js`, `server/src/__tests__/integration/rag-api.test.js`)

- Updated router, provider, circuit-breaker, manual backfill, embedding-service, and RAG API regressions to pin the new shared embedding breaker ownership, provider-owned legacy `same` execution/probe paths, the removal of the router’s duplicate same-mode resolver seam, and the quieter non-persistent internal breaker diagnostics. (`server/src/__tests__/embeddingRouter.test.js`, `server/src/__tests__/embeddingProvider.test.js`, `server/src/__tests__/circuitBreaker.test.js`, `server/src/__tests__/manualBackfillService.test.js`, `server/src/__tests__/embeddingService.test.js`, `server/src/__tests__/integration/rag-api.test.js`)

- Expanded direct helper-level coverage for the new RAG route composition modules so the decomposition is pinned below the large integration test surface, including the extracted backfill/config wiring, model-metadata resolution, operations, and status payload helpers. (`server/src/__tests__/ragCoreHelpers.test.js`, `server/src/__tests__/ragDiagnosticsHelpers.test.js`, `server/src/__tests__/ragBackfillHelpers.test.js`, `server/src/__tests__/ragModelMetadataHelpers.test.js`, `server/src/__tests__/ragOperationsHelpers.test.js`, `server/src/__tests__/ragStatusHelpers.test.js`)

- Updated the RAG API integration coverage and the dedicated docs-linter tests to assert the canonical-only RAG surface after removing the old transition routes. (`server/src/__tests__/integration/rag-api.test.js`, `scripts/__tests__/check-rag-api-docs.test.js`)

---

## [v0.45.0-beta] — 2026-03-22

Package version: `0.45.0-beta`

### Changed

- **`settings.js` has been broken back down into coherent route clusters instead of remaining a single admin/config megafile** — ARR, AI, Ollama, metadata providers, Discord, webhook, SSL, path testing, provider-lock, setup, general/category, and confidence/history/import-export routes now delegate through focused helpers with route-specific coverage. This makes the critical settings surface materially easier to reason about and reduces the risk of duplicate-contract regressions. (`server/src/routes/settings.js`, `server/src/routes/helpers/*.js`)

- **Queue orchestration is now split into focused services instead of one oversized `queueService` implementation** — read-model queries, route-facing mutations, manual admin actions, CARSA orchestration, worker-loop control, task processing, metadata-enrichment substeps, and refill selection/payload building now live behind dedicated services while `queueService` remains the public facade. (`server/src/services/queueService.js`, `server/src/services/queueReadModel.js`, `server/src/services/queueMutationService.js`, `server/src/services/queueAdminService.js`, `server/src/services/queueCarsaService.js`, `server/src/services/queueWorkerLoopService.js`, `server/src/services/queueTaskProcessorService.js`, `server/src/services/queueRefillService.js`, `server/src/services/queueOmdbEnrichmentService.js`, `server/src/services/queueTavilyEnrichmentService.js`, `server/src/services/queueTmdbResolutionService.js`, `server/src/services/queueClassificationHistoryService.js`)

- **Command Center is now split along real UI seams instead of keeping most logic inline in one view** — the main page now delegates shared data loading, Quick Add state, and Needs Attention actions through composables, and the extracted Quick Add, Processing Details, and Needs Attention panels now own their own component boundaries. (`client/src/views/CommandCenter.vue`, `client/src/composables/useCommandCenterData.js`, `client/src/composables/useQuickAdd.js`, `client/src/composables/useNeedsAttentionActions.js`, `client/src/components/command-center/*.vue`)

- **Custom presets are now first-class attachable policy inputs instead of a side-path separate from the preset catalog** — policy attachment reads now flow through the unified content-preset catalog, the policy builder exposes custom presets again as attachable inputs, and migration `20260321_134500_migrate_custom_presets_into_content_presets.sql` backfills legacy custom presets into the live model. (`server/src/utils/presetCatalog.js`, `server/src/routes/policies.js`, `server/src/routes/presets.js`, `client/src/api/presets.js`, `client/src/components/policies/PolicyBuilderModal.vue`, `database/migrations/20260321_134500_migrate_custom_presets_into_content_presets.sql`)

### Fixed

- **Manual queue task actions now fail cleanly instead of half-committing or returning ambiguous success** — `retry`, `dismiss`, `cancel`, and manual `classify` now validate positive task ids, return explicit `400`/`404`/`409` outcomes, and route manual classification through the queue facade instead of leaving non-transactional work inside the route layer. (`server/src/routes/queue.js`, `server/src/services/queueMutationService.js`, `server/src/services/queueAdminService.js`, `server/src/services/queueService.js`)

- **The integration harness is now both faster and safer to operate** — integration runs now fail once at Docker/Testcontainers preflight instead of cascading, reuse one container plus a migrated template database per run, clone isolated per-suite databases from that template, record expected warning/error log output as part of pass conditions, and use per-run runtime ownership so overlapping integration invocations do not tear each other down. (`server/jest.integration.config.js`, `server/scripts/run-jest.mjs`, `server/src/__tests__/integration/global-setup.js`, `server/src/__tests__/integration/global-teardown.js`, `server/src/__tests__/integration/runtime.js`, `server/src/__tests__/integration/setup.js`)

- **Command Center interaction edges are now more truthful and less stale-prone** — batch `Confirm All` now surfaces routing warnings the same way single-item resolution already did, the mobile processing sheet closes when its selected task disappears instead of silently switching to another task, the alerts jump-link now points to a real anchor, and Quick Add clears stale selections/results when the query changes so old TMDB picks cannot be submitted against new input. (`client/src/views/CommandCenter.vue`, `client/src/composables/useNeedsAttentionActions.js`, `client/src/composables/useQuickAdd.js`, `client/src/components/command-center/QuickAddPanel.vue`)

- **AI settings and metadata-provider settings now preserve existing state on partial updates instead of resetting adjacent fields** — same-mode embedding identity changes now invalidate stale embeddings correctly, `/settings/ai/test` and `/settings/ai/models` share a stable key-fallback/error contract, the AI settings page reports partial-save outcomes honestly, and partial saves across AI/Ollama/TMDB/Tavily/OMDb/ARR/Discord/webhook/SSL now preserve stored secrets, URLs, limits, and flags instead of rebuilding them from defaults or masked values. (`server/src/routes/helpers/aiSettingsHandlers.js`, `server/src/routes/helpers/ollamaSettingsHandlers.js`, `server/src/routes/helpers/metadataProviderSettingsHandlers.js`, `server/src/routes/helpers/arrConfigHandlers.js`, `server/src/routes/helpers/discordSettingsHandlers.js`, `server/src/routes/helpers/webhookSettingsHandlers.js`, `server/src/routes/helpers/sslSettingsHandlers.js`, `client/src/views/settings/AI.vue`)

- **Policy/preset write paths now reject more invalid or misleading states** — partial policy updates validate merged weights instead of allowing invalid totals through stored values plus overrides, preset payload normalization is centralized, and attachable preset flows now use the same server-side catalog semantics across policy and preset routes. (`server/src/routes/policies.js`, `server/src/routes/presets.js`, `server/src/utils/presetCatalog.js`, `client/src/api/presets.js`)

- **The metadata-enrichment and retry stack now reports Tavily-backed enrichment state consistently** — holiday/anime Tavily enrichment keys now count the same way as the older Tavily flags, so queue results, retry stats, and library-facing status all agree on whether enrichment actually happened. (`server/src/utils/metadataEnrichment.js`, `server/src/services/classificationRetryService.js`, `server/src/services/queueService.js`, `server/src/routes/libraries.js`)

- **Existing local image-embedding health now distinguishes “up but still warming” from fully ready, and the shared frontend service-status layer now treats that service as first-class** — the health check keeps the current unauthenticated `/health` path but now also consults `/ready` when available, reporting local image embeddings as `degraded` during warmup instead of flattening every successful process check to `connected`. Older sidecars that do not expose `/ready` remain compatible, the shared service-status store now maps the existing `imageEmbeddings` backend summary/details instead of dropping them, and the shared lockdown/settings helpers now recognize `imageEmbeddings` and point to the real RAG & Embeddings settings tab. (`server/src/services/healthCheckService.js`, `client/src/stores/serviceStatus.js`, `client/src/constants/serviceConfig.js`)

- **Metadata enrichment now preserves source-library identity all the way through persistence and task completion** — the final enrichment write no longer drops `source_library_id` / `source_library_name` when rebuilding `content_analysis`, so later classification fast paths can still detect exact source-library matches, and completed enrichment tasks now report the self-healed source library name instead of the stale incoming payload value. (`server/src/services/queueTaskProcessorService.js`)

- **Queue bulk actions and retry endpoints now report bad inputs and backend failures honestly** — bulk clear/retry/cancel routes no longer treat database failures as harmless zero-count success, pending/failed list routes now reject invalid positive `limit` values instead of coercing them, retry-queue processing validates both `limit` and `enrichmentType`, and `/queue/ollama-status` now resolves through the queue facade instead of bypassing it from the route layer. (`server/src/routes/queue.js`, `server/src/services/queueMutationService.js`, `server/src/services/queueService.js`)

- **Queue read endpoints and backfill actions now use stable, truthful response contracts** — queue read-model queries no longer swallow database failures behind `200` responses, pending/failed and retry-process routes now cap `limit` values instead of accepting unbounded reads, `reprocess-completed` and `clear-and-resync` now return the same structured success shape as the rest of the queue mutation surface, and retry backfill now explicitly reports that it queues Tavily fallback work for items missing OMDb data. (`server/src/services/queueReadModel.js`, `server/src/services/queueMutationService.js`, `server/src/services/queueCarsaService.js`, `server/src/services/enrichmentRetryService.js`, `server/src/routes/queue.js`)

- **Startup gap analysis no longer crashes on a circular `queueService` facade during runtime initialization** — the scheduler now resolves `queueService` lazily inside `runGapAnalysis()`, and queue CARSA resync now lazily resolves the scheduler before invoking background gap analysis. This removes the startup-time circular dependency that could surface as `queueService.refillQueue is not a function` on the first scheduler run after boot. (`server/src/services/scheduler.js`, `server/src/services/queueCarsaService.js`)

- **Preset suggestions and labels are now more consistent across policy and preset flows** — attachable custom presets now participate in library-based preset suggestions instead of being invisible to the builder’s suggestion rail, suggested custom presets are explicitly marked as yours in the policy builder, and the presets manager now uses the same “Built-in” / “My Presets” language instead of mixing “system”, “custom”, and “attachable” labels for the same objects. (`server/src/routes/policies.js`, `client/src/components/policies/PolicyBuilderModal.vue`, `client/src/views/PresetsManager.vue`)

- **`settings.js` no longer keeps a one-off inline ARR status aggregation after the route-splitting pass** — `GET /settings/arr-config-status` now lives with the rest of the ARR helper logic instead of remaining as the last bespoke ARR block inside the main settings router. (`server/src/routes/settings.js`, `server/src/routes/helpers/arrConfigHandlers.js`)

- **Settings helper writes now fail more cleanly and invalidate dependent runtime/cache state consistently** — `PUT /settings` and category writes now commit through one transaction before refreshing runtime settings, ARR helper routes now reject invalid non-positive ids before querying config tables, and confidence revert/import now clear the same auto-learning cache that direct confidence updates already invalidate. (`server/src/routes/helpers/generalSettingsHandlers.js`, `server/src/routes/helpers/arrConfigHandlers.js`, `server/src/routes/helpers/confidenceSettingsHandlers.js`)

- **Metadata enrichment now self-heals missing source library names before it completes or writes history** — when enrichment payloads only carry `source_library_id`, the queue processor now resolves the current library name from the libraries table so persisted metadata, completed task results, and `source_library` history reasons do not degrade to blank or `undefined` labels. (`server/src/services/queueTaskProcessorService.js`)

- **Live classification generation now honors the configured AI provider path instead of hardwiring Ollama generation** — `ClassificationService.aiClassify()` now resolves the active provider through the shared AI router, keeps the existing streamed generation path for Ollama, and uses the router’s cloud-provider path for OpenAI/Gemini/OpenRouter/LiteLLM/custom classification without changing prompt or parse behavior. (`server/src/services/classification.js`, `server/src/services/aiRouter.js`)

- **Retry-time classification-history updates now follow the same persistence rules as the main classification write path** — retry success no longer leaves premature library assignments on `awaiting_decision` rows, low-confidence retry results are persisted as pending instead of completed-with-library, and fallback clarification payloads are stored through the `policy_question` column even when the parser only returned `clarification`. (`server/src/services/classification.js`)

- **Scheduler-driven classification retries now use the same clean retry model as manual retries instead of mutating old history rows in place** — the retry queue no longer mixes “create a fresh classification task” with late updates to the original `classification_history` row. Automated retries now delegate through the shared retry service, enqueue a new classification task with scheduler-specific source tags, and retire the old dual-history semantics. (`server/src/services/classification.js`, `server/src/services/classificationRetryService.js`)

- **Requeued classification retries now carry forward their retry state instead of resetting the scheduler limit on every attempt** — manual and scheduler-driven retries now enqueue the prior `retry_count` / `max_retries` into the fresh classification task payload, and transient AI failures increment that carried-forward count when they persist the next `pending_retry` row. This makes `max_retries` converge again instead of allowing retry loops to restart from zero on each requeue. (`server/src/services/classification.js`, `server/src/services/classificationRetryService.js`)

- **Classification retry no longer severs request and webhook audit lineage when it replaces the old history row** — retry now preserves linked `media_requests` and `webhook_log` row ids in the requeued payload and rebinds those rows to the newly-persisted `classification_history` entry after the retry run completes, instead of nulling the links permanently when the old classification row is deleted. (`server/src/services/classification.js`, `server/src/services/classificationRetryService.js`)

- **Classification retry cleanup no longer risks resetting enrichment state on the wrong media item when `itemId` is missing** — fallback `media_server_items` lookup now uses `source_library_id` as a hard discriminator for TMDB and title/year resolution when that source identity is available, instead of picking the newest matching title across every library. (`server/src/services/classificationRetryService.js`)

- **Classification retry duplicate detection now catches title/year-only queued work even when the retried row later has a TMDB id** — retry still checks TMDB identity first, but if no queued task matches by TMDB it now falls back to the existing title/year dedupe path before queueing a fresh classification task. This closes the idempotency gap where the same item could be queued twice under different identity shapes. (`server/src/services/classificationRetryService.js`)

- **Manual classification retry no longer purges exact-match learning unless an operator explicitly opts into it** — the manual `/api/classification/retry` path now preserves learned exact-match routing by default, matching scheduler retry behavior, while still allowing callers to request a learning purge intentionally through `options.purgeLearning: true`. (`server/src/routes/classification.js`, `server/src/services/classificationRetryService.js`)

- **Full library syncs now prune ghost media and collection rows that disappeared remotely instead of leaving stale cache entries behind** — successful non-incremental syncs now treat the fetched library contents as the source of truth, delete unseen `media_server_items` and `media_server_collections` for that library, and keep incremental syncs on the old non-pruning path. This prevents reconciliation and existing-media lookups from seeing items that no longer exist on the media server. (`server/src/services/mediaSync.js`)

- **Manual RAG backfill pause/resume now honors process ownership instead of restarting work without reacquiring the advisory lock** — `resume()` now reacquires the manual-backfill advisory lock before processing continues, cleanly refuses to resume if another process owns that run, and the legacy `/api/rag/backfill/start` route now delegates through the same manual backfill service instead of bypassing the lock-aware lifecycle with its own inline batch loop. (`server/src/services/manualBackfillService.js`, `server/src/routes/rag.js`)

- **Backfill modes now share one ownership boundary instead of competing over the same pending embedding work** — manual, idle, and scheduled backfill now coordinate through a shared backfill-owner advisory lock, the orchestrator now awaits manual status correctly before starting idle work, manual `clear` now cancels safely instead of wiping live run state out from under an active loop, and idle-config writes now refresh the live service state immediately instead of drifting until the next run. (`server/src/config/database.js`, `server/src/services/backfillOrchestrator.js`, `server/src/services/manualBackfillService.js`, `server/src/services/idleBackfillService.js`, `server/src/services/scheduledBackfillService.js`, `server/src/routes/rag.js`)

- **Manual backfill now uses its stored batch-size setting and both start routes speak the same request contract** — `manual_backfill_batch_size` is now a live default instead of dead config, `/api/rag/backfill/start` and `/api/rag/backfill/manual/start` both accept either `batchSize` or legacy `limit`, and both routes now reject invalid non-positive sizes instead of silently diverging in behavior. (`server/src/services/manualBackfillService.js`, `server/src/routes/rag.js`)

- **Manual backfill history now keeps the same moving total the live progress UI uses** — when new pending work appears during a manual run, the service now grows the tracked `total` in memory and persists that expanded denominator back to `backfill_runs` before completion/cancellation/failure. This keeps active status, run history, and later DB-backed reporting aligned instead of freezing history at the startup snapshot total. (`server/src/services/manualBackfillService.js`)

- **`/api/queue/retry-process` no longer advertises unsupported TMDB retry execution** — the manual retry-processing contract now accepts only `tavily` and `omdb`, matching the actual enrichment retry service branches, instead of silently treating `tmdb` requests as Tavily work. TMDB retry rows can still exist in stats, but they are no longer exposed as a supported manual processing mode until a real TMDB retry processor exists. (`server/src/routes/queue.js`)

- **Explicit bearer tokens now win over stale browser auth cookies instead of being shadowed by them** — auth middleware now prefers a provided `Authorization: Bearer ...` token before falling back to `access_token` cookies, so Swagger, browser-based admin tools, and scripted same-browser clients stop failing valid header-auth requests just because an expired cookie is still present. (`server/src/middleware/auth.js`, `server/src/middleware/apiKeyAuth.js`)

- **Refresh-token rotation no longer strands otherwise valid sessions when server-side rotation fails mid-request** — `/auth/refresh` now creates the replacement token before revoking the old one, returns a server error instead of a misleading auth failure when rotation persistence breaks, and revokes the newly-created token on cleanup so the failure path does not leave two live refresh tokens behind. (`server/src/routes/auth.js`)

- **Non-remember-me sessions now die immediately on restart instead of remaining usable until their short-lived access token expires** — access tokens now carry session persistence metadata, startup invalidation marks a cutoff for non-persistent access tokens, and auth verification rejects pre-restart non-remember-me access tokens while preserving remember-me sessions across restarts as intended. (`server/src/services/auth.js`, `server/src/routes/auth.js`)

- **Default CORS behavior no longer reflects arbitrary origins when no allowlist is configured** — cross-origin requests now receive no CORS approval unless an explicit allowlist or wildcard policy exists, while same-origin and non-browser requests continue to work without relying on reflected credentialed origins. (`server/src/index.js`, `server/src/utils/corsPolicy.js`)

- **The Discord `✓ Correct` action now performs a real verification instead of only editing the message footer** — clicking the confirm button now routes through the same verification flow as `verify_yes`, so Discord confirmations persist backend state, trigger learning, and follow the normal routing/verification contract instead of acting like a cosmetic acknowledge. (`server/src/services/discordBot.js`)

- **Discord correction and clarification clicks now treat duplicate/stale interactions as idempotent instead of replaying side effects** — correction now early-exits when the selected library already matches the stored one, clarification now short-circuits already-resolved selections, and known `resolvePolicyQuestion()` `400`/`404`/`409` outcomes no longer fall back into legacy row mutation. This prevents duplicate correction rows, repeated learning/routing, and stale-click rewrites after a Discord double-click or retry. (`server/src/services/discordBot.js`)

- **Discord server and channel discovery now always cleans up temporary clients, even on failure paths** — config-discovery calls now destroy their short-lived Discord clients from a `finally` block instead of only on the happy path, so failed login and missing-server lookups do not leave temporary clients hanging around longer than needed. (`server/src/services/discordBot.js`)

- **Strict language routing now applies consistently to English content too** — the policy engine no longer skips strict language conflicts just because the item language is English, and the policy-question builder now surfaces those English conflict cases instead of suppressing the clarification path. This keeps strict `exclude: ['en']` and similar language-runtime rules honest across both ranking and follow-up prompts. (`server/src/services/policyEngine.js`, `server/src/services/policyQuestionBuilder.js`)

- **Policy preset combination modes are now real runtime behavior instead of a cosmetic saved field** — `best_match`, `average`, `weighted_average`, and `require_all` now actually change how attached preset scores combine inside the policy engine, and policy routes now reject unsupported `combination_mode` values instead of persisting dead settings the engine would ignore. (`server/src/services/policyEngine.js`, `server/src/routes/policies.js`)

- **Policy weight editing now matches the actual runtime scoring model again** — `profile_weight` is back in the editable policy contract, server-side weight validation now sums the same five live components the engine uses, and the policy builder’s advanced weight UI now includes profile scoring instead of showing a misleading four-weight “100%” total against a five-weight runtime. (`server/src/routes/policies.js`, `client/src/components/policies/PolicyBuilderModal.vue`)

- **Very low-confidence policy matches now fall back to real manual review instead of being mislabeled as guided selection** — the policy engine now keeps `prompt_select` for the documented mid-band only and returns `manual` once the top score drops below the prompt-select floor, so weak policy hints are no longer surfaced as if they were still strong enough for a meaningful top-3 choice. (`server/src/services/policyEngine.js`)

- **Persisted policy `combination_mode` now survives the database round trip into live evaluation** — DB-backed policy reads now load `combination_mode` alongside the other policy fields, so stored non-`best_match` modes actually reach runtime scoring instead of silently collapsing back to the default when `getActivePolicies()` rebuilds policy objects. (`server/src/services/policyEngine.js`)

- **Pending policy-question resolution now enforces current library validity instead of accepting any existing library id** — clarification resolution now rejects inactive libraries, wrong-media-type libraries, stale policy questions, and library choices that are no longer present in the current question option set before writing history or learned patterns. Discord stale-question responses now tell the user to retry from current queue state instead of incorrectly claiming the item was already processed. (`server/src/services/clarificationService.js`, `server/src/routes/classification.js`, `server/src/services/discordBot.js`)

- **AI-failure fallback paths no longer persist empty `awaiting_decision` rows without a real policy question** — when classification falls back to low-confidence signal/manual selection because AI generation failed, the service now attaches a real policy/manual-selection question before persistence instead of relying on confidence alone to mark the row as `awaiting_decision`. This keeps pending queue items actionable in both the policy-signal and legacy signal branches. (`server/src/services/classification.js`)

- **Adopted second-pass results no longer leak stale clarification state back into persistence** — second-pass policy recheck and AI rerun candidates now clear inherited `policy_question` / `clarification` / `pending_reason` state before materializing a new result, `ensureDecisionQuestion()` now prefers the adopted result’s updated `policyResult` when rebuilding a decision question, and completed classifications no longer persist stray pending-question fields just because they were present on the baseline result. (`server/src/services/classification.js`)

- **Second-pass conflict detection now actually blocks adoption instead of acting like advisory metadata** — when pass2 retrieval still shows an unresolved cross-library conflict, the comparator now refuses adoption and the resolver preserves the baseline result even if policy recheck or similarity/confidence deltas would otherwise have upgraded the candidate. This makes the conflict detector operationally meaningful instead of logging “conflict persists” while still switching libraries. (`server/src/utils/ragLoopHelpers.js`, `server/src/services/classification.js`)

- **Low-confidence second pass is no longer silently disabled by non-actionable policy results** — the RAG-loop gate now distinguishes real policy context from placeholder/manual/no-op policy payloads, so low-confidence AI outcomes can still enter the second pass when policy evaluation returned no usable ranked candidate or prompt path. This preserves policy-first behavior for actual prompt/select/confirm cases while unblocking the fallback improvement path for effectively policyless items. (`server/src/utils/ragLoopHelpers.js`, `server/src/services/classification.js`)

- **Second-pass AI rerun now uses verification mode instead of asking the model to classify the item again** — the rerun path no longer overrides `aiClassify()` into a fresh `classify` prompt when signal context already exists. It now uses the stricter verify-mode contract, making the second pass behave more like a bounded validation step and less like a second stochastic opinion. (`server/src/services/classification.js`)

- **Second-pass observability now reports successful and fallback stages more truthfully** — successful `applied` stage events are no longer suppressed before logging/metric emission, the `rag_candidate` fallback stage is now recognized as a first-class second-pass stage instead of collapsing to `unknown`, and trace-build failures now degrade consistently across gate-skip and mainline branches instead of sometimes disappearing or nulling the trace silently. (`server/src/utils/ragLogger.js`, `server/src/utils/ragErrorHandler.js`, `server/src/utils/ragLoopHelpers.js`, `server/src/services/classification.js`)

- **Two previously dead second-pass rollout knobs now have real runtime effect** — `rag_loop_use_hybrid_on_retry=false` now shifts auto retry selection back to semantic search instead of silently continuing to choose hybrid anyway, and `policy_learning_include_shadow_feedback=true` now actually bypasses the unconditional shadow-mode learning block so shadow feedback can participate when the remaining learning guards also allow it. (`server/src/utils/ragLoopHelpers.js`)

- **Second-pass metadata enrichment now actually respects its configured attempt budget at the orchestration layer** — the second-pass TMDB enrichment path no longer hardcodes `attempts: 0` into the eligibility gate and then runs as a one-shot call. It now retries recoverable enrichment failures up to `policy_recheck_metadata_max_attempts`, emits explicit retry events, and honors `0` as a true skip/attempt-cap setting instead of leaving the knob effectively half-wired. (`server/src/services/classification.js`)

- **Two more second-pass control knobs now match their visible contract instead of acting like dead settings** — `rag_loop_max_passes=1` now stops the second pass at the gate instead of still running a hidden second pass, and `policy_recheck_max_attempts` now bounds the actual policy-recheck stage with `0` producing an explicit skip instead of silently falling back to the old hardcoded retry behavior. (`server/src/utils/ragLoopHelpers.js`, `server/src/services/classification.js`)

- **Authoritative second-pass TMDB enrichment now replaces weak partial metadata instead of only filling completely empty fields** — policy recheck no longer carries forward thin one-tag genre/keyword arrays, stub overviews, or shorter original-title/collection/company/cast data just because those fields were technically non-empty. The merge now prefers meaningfully richer authoritative TMDB values while preserving stronger existing metadata when enrichment is actually weaker. (`server/src/services/classification.js`)

- **Second-pass diagnostics, conflict handling, and adopted RAG context now reason over the same evidence pool** — when pass2 candidate retrieval returns a different pool than the live hybrid/semantic match list, the second pass no longer mixes one pool for diagnostics and another for conflict checks or policy recheck cache. Candidate-backed pass2 evidence now stays internally consistent across diagnostics, conflict detection, policy recheck, and adopted `ragContext`. (`server/src/services/classification.js`)

- **Classification rows now persist a compact second-pass summary alongside the full trace** — `classification_details.rag_loop_summary` now stores a query-friendly snapshot of mode/trigger/strategy, adoption decision, pass1/pass2 match counts and top similarities, and final outcomes for the key second-pass stages. This makes later quality-cohort analysis possible without parsing the full trace event array for every row. (`server/src/services/classification.js`)

- **Later human and retry outcomes are now linked back onto the original classification row for second-pass quality analysis** — verification, manual/policy resolution, correction, and retry flows now write a compact `classification_details.outcome_link` payload onto the original `classification_history` row, retry keeps the original row as `reclassified` instead of deleting it, and replacement classifications now back-link into that original row through retry lineage. This gives the second-pass summary a durable truth signal instead of losing it when the item is corrected or requeued. (`server/src/services/classificationOutcomeService.js`, `server/src/services/classification.js`, `server/src/services/clarificationService.js`, `server/src/services/classificationRetryService.js`, `server/src/services/discordBot.js`, `server/src/routes/classification.js`)

- **There is now a first query/report surface for evaluating whether second pass is helping** — `GET /api/classification/second-pass-evaluation` cohorts recent classifications into baseline, pass2-ran-not-adopted, and pass2-adopted buckets, then reports linked verification/correction/resolution/retry outcomes and rates for each cohort. This gives operators a direct read on whether second-pass adoption correlates with fewer corrections or retries instead of only showing that the feature ran. (`server/src/routes/classification.js`)

- **Second-pass evaluation is now surfaced directly in the Classification statistics UI** — the existing Classification analytics tab now includes a dedicated Second-Pass Evaluation section with 7/30/90-day windows, cohort cards for baseline vs pass2 outcomes, and correction/verification/resolution/retry rates so operators can inspect whether second-pass adoption is actually reducing downstream correction pressure. (`client/src/views/statistics/ClassificationStats.vue`, `client/src/api/index.js`)

- **History drill-down now exposes the same second-pass story at the individual row level** — the classification detail modal now shows both the existing targeted re-check trace and the new linked follow-up outcome, including outcome type/source, final library, actor, and retry replacement ids when present. This makes it possible to move from cohort-level suspicion in Statistics to concrete item-level inspection in History without leaving the history workflow. (`client/src/views/History.vue`)

- **Linked classification outcomes now preserve first/latest state and multi-step paths instead of collapsing everything into one flat snapshot** — follow-up outcome recording now keeps a transition path with first/latest outcome markers while still maintaining `outcome_link` as the compatibility view, the second-pass evaluation report now distinguishes first-outcome vs latest-outcome breakdowns and multi-step paths, and the Statistics/History UI now surfaces that richer maturity model through multi-step counts plus first/latest/timestamp detail in the row drill-down. (`server/src/services/classificationOutcomeService.js`, `server/src/routes/classification.js`, `client/src/views/statistics/ClassificationStats.vue`, `client/src/views/History.vue`)

- **Resumed manual backfills now preserve active-run ownership until the worker actually stops** — `resume()` now launches the worker through the same tracked promise path as `start()`, so `cancel()` and `clear()` correctly wait for a resumed run to finish before resetting state or releasing ownership instead of dropping back to `idle` while work can still be in flight. (`server/src/services/manualBackfillService.js`)

- **Idle provider-offline backoff no longer holds the shared backfill-owner lock for five hidden minutes** — when the embedding provider reports `PROVIDER_OFFLINE`, idle backfill now records a cooldown and exits immediately instead of sleeping inside the lock-owning run. That lets manual and scheduled backfill take ownership promptly while still suppressing immediate idle retry storms during provider outages. (`server/src/services/idleBackfillService.js`)

- **Scheduled backfill shutdown now stops active runs instead of only clearing the timer that launches future runs** — the scheduled worker now tracks an in-flight stop flag, exits active batch loops when shutdown is requested, and records the interrupted run as `cancelled` instead of quietly continuing until max duration or queue exhaustion after the scheduler has been “stopped.” (`server/src/services/scheduledBackfillService.js`)

- **Language-conflict policy questions no longer name conflicting libraries that get truncated out of the selectable options** — the policy question builder now keeps the primary ranked candidate anchored first, promotes conflicting libraries ahead of lower-priority ranked fallbacks, and expands the option count enough to preserve every named language-conflict library in the rendered choices. (`server/src/services/policyQuestionBuilder.js`)

- **Attached preset weights are now constrained to positive values instead of silently accepting zero/negative scoring multipliers** — policy create/update and direct preset-attachment routes now reject non-positive preset weights, and the policy engine normalizes any legacy invalid attachment weights to `1.0` at runtime so stored bad rows cannot collapse or invert weighted preset scoring. (`server/src/routes/policies.js`, `server/src/services/policyEngine.js`)

- **Verify-mode AI confirmation can no longer silently re-route an item to a different library** — `CONFIRM|n|...` is now only accepted when `n` matches the suggested library from signal context. If the AI “confirms” a different library, the parser now turns that into an explicit clarification/disagreement result instead of treating it as a successful verification. (`server/src/services/aiResponseParser.js`)

- **Resolved policy-question rows no longer keep stale pending decision payloads after completion** — policy-question resolution now clears `policy_question` alongside `pending_reason` when a human selection completes the row, so completed history entries stop carrying obsolete pending-choice state into detail views and analytics. (`server/src/services/clarificationService.js`)

- **Fallback/manual-review prompts now always include the implied default library as an actual selectable option** — malformed/unknown AI responses no longer pick a default library and then truncate it out of the fallback option list. The fallback builder now promotes the default suggestion to the first selectable option before applying the four-option cap. (`server/src/services/aiResponseParser.js`)

- **Second-pass evaluation now separates cohort maturity from quality rates instead of conflating them** — the evaluation API now returns both per-total and per-linked-outcome rates, while the Statistics UI surfaces linked-outcome sample size and maturity explicitly and uses per-linked-outcome corrected/retried rates for the cohort comparison. This prevents newer cohorts from looking artificially “better” just because fewer rows have had time to produce follow-up outcomes. (`server/src/routes/classification.js`, `client/src/views/statistics/ClassificationStats.vue`)

### Tests

- Added focused route-helper coverage for each extracted `settings.js` cluster, including new suites for AI, ARR, confidence, Discord, general/category, metadata providers, Ollama, path testing, provider lock, setup, SSL, and webhook routes. (`server/src/__tests__/settings-*.test.js`, `server/src/__tests__/settings-routes.test.js`)

- Added queue/service coverage for the refactored queue seams and route hardening, including read-model, mutation, admin/manual classification, facade delegation, refill assumptions, and enrichment sub-service behavior. (`server/src/__tests__/queueReadModel.test.js`, `server/src/__tests__/queueMutationService.test.js`, `server/src/__tests__/queueAdminService.test.js`, `server/src/__tests__/queueService.test.js`, `server/src/__tests__/queue-routes.coverage.test.js`)

- Expanded classification-retry coverage to pin the new retry-state carry-forward, lineage preservation/rebinding, source-library-safe media-item resolution, TMDB-to-title duplicate detection fallback, and manual retry learning-preservation defaults. (`server/src/__tests__/services/classificationRetryService.test.js`, `server/src/__tests__/classification.test.js`, `server/src/__tests__/classification-routes.test.js`, `server/src/__tests__/scheduler.test.js`)

- Added focused second-pass materialization regressions covering stale clarification cleanup on adopted pass-2 candidates, updated policy-context question building, and dropping stray pending-question fields for completed results. (`server/src/__tests__/classification.test.js`)

- Added second-pass conflict regressions to pin the new hard-stop behavior at both the helper and orchestration layers, ensuring unresolved pass2 conflicts preserve the baseline result even when other adoption gates would otherwise pass. (`server/src/__tests__/ragLoopHelpers.test.js`, `server/src/__tests__/classification.test.js`)

- Added focused backfill ownership regressions covering the async orchestrator/manual status bug, the shared owner lock on idle and scheduled backfill, the new safe manual clear/cancel lifecycle, and the new backfill advisory-lock constant. (`server/src/__tests__/backfillOrchestrator.test.js`, `server/src/__tests__/manualBackfillService.test.js`, `server/src/__tests__/idleBackfillService.test.js`, `server/src/__tests__/scheduledBackfillService.test.js`, `server/src/__tests__/database-resilience.test.js`)

- Expanded manual backfill route/service coverage to pin the stored `manual_backfill_batch_size` default and the normalized `batchSize`/`limit` compatibility across both manual backfill start endpoints. (`server/src/__tests__/manualBackfillService.test.js`, `server/src/__tests__/integration/rag-api.test.js`)

- Added second-pass gating regressions covering present-but-non-actionable policy results, so `ai_low_confidence` still triggers when policy evaluation returned only placeholder/manual context with no real ranked candidate or prompt path. (`server/src/__tests__/ragLoopHelpers.test.js`, `server/src/__tests__/classification.test.js`)

- Added a second-pass AI rerun regression to pin verify-mode execution at the orchestration layer instead of silently falling back to another full classify prompt. (`server/src/__tests__/classification.test.js`)

- Added second-pass observability regressions covering happy-path `applied` stage logging, `rag_candidate` stage normalization, pass2 success metric emission, and the updated trace/stage behavior through both unit and integration flow coverage. (`server/src/__tests__/ragLogger.test.js`, `server/src/__tests__/classification.test.js`, `server/src/__tests__/integration/rag-loop-flow.test.js`)

- Added focused second-pass evaluation regressions covering the new `perTotal` / `perLinkedOutcome` rate split in the backend report and the maturity-aware cohort rendering in the statistics UI. (`server/src/__tests__/classification-routes.test.js`, `client/src/__tests__/ClassificationStats.test.js`)

- Added focused helper regressions for the now-live `rag_loop_use_hybrid_on_retry` and `policy_learning_include_shadow_feedback` knobs so those settings stop being inert contract surface. (`server/src/__tests__/ragLoopHelpers.test.js`, `server/src/__tests__/classification.test.js`)

- Added second-pass orchestration regressions for metadata-enrichment retry budgeting, including recoverable retry-before-apply behavior and the explicit `attempt_cap_reached` skip path when metadata-enrichment attempts are configured to `0`. (`server/src/__tests__/classification.test.js`)

- Added second-pass regressions for the newly live `rag_loop_max_passes` and `policy_recheck_max_attempts` knobs, covering full-pass gate suppression, configured policy-recheck retry counts, and the explicit `attempt_cap_reached` skip path when policy recheck attempts are set to `0`. (`server/src/__tests__/classification.test.js`, `server/src/__tests__/ragLoopHelpers.test.js`)

- Added direct and orchestration-level coverage for second-pass metadata merge quality, including replacement of weak partial metadata with richer authoritative TMDB values and preservation of stronger existing metadata when enrichment is actually worse. (`server/src/__tests__/classification.test.js`)

- Added a second-pass consistency regression proving that diagnostics, policy recheck cache, and adopted `ragContext` now all use the same pass2 evidence pool instead of diverging between hybrid matches and semantic candidate retrieval. (`server/src/__tests__/classification.test.js`)

- Added persistence coverage for the new compact `rag_loop_summary`, including both the stored second-pass summary shape and the explicit `null` behavior for rows that never ran the second pass. (`server/src/__tests__/classification.test.js`)

- Fixed the remaining queue unit-suite isolation issue so `queueService.test.js` and `enrichmentPipeline.test.js` now pass in the same Jest invocation instead of depending on singleton/mock load order. (`server/src/__tests__/queueService.test.js`, `server/src/__tests__/enrichmentPipeline.test.js`)

- Added integration-harness regressions covering runtime-file ownership and preserved the expected warning/error log evidence as actual test pass conditions. (`server/src/__tests__/integration-runtime.test.js`, `server/src/__tests__/integration/queue-robustness.test.js`, `server/src/__tests__/integration/sync-error-logging.test.js`, `server/src/__tests__/integration/queue-api.test.js`)

- Added direct frontend coverage for the extracted Command Center seams, including Quick Add utility/composable/component tests and Needs Attention helpers, along with regressions for routing warnings, mobile processing-sheet behavior, and alert-link correctness. (`client/src/__tests__/quickAdd.test.js`, `client/src/__tests__/QuickAddPanel.test.js`, `client/src/__tests__/needsAttention.test.js`, `client/src/__tests__/commandCenterActionModules.test.js`, `client/src/__tests__/commandCenterContextModules.test.js`, `client/src/__tests__/commandCenterRealtimeMobile.test.js`, `client/src/__tests__/commandCenterShell.test.js`)

### Docs

- Updated repo documentation to reflect the current release/versioning flow, migration system, and integration-test logging baseline, and recorded the settings/queue/Command Center cleanup work as unreleased engineering changes instead of backfilling them into an already-cut release. (`README.md`, `release.md`, `database/migrations/README.md`, `docs/testing/coverage.md`, `docs/testing/integration-log-inventory.md`, `docs/interesting_findings.md`)

- Clarified the current preset terminology and corrected the Issue 330 plan to distinguish already-landed image-embedding observability enhancements from the still-unimplemented secure sidecar auth/key flow. (`README.md`, `docs/presets/README.md`, `docs/issue-330-implementation-plan.md`)

### Security

- **Validation and compliance gates are green again on the current dependency graph** — local npm audit checks for both `server/` and `client/` now return zero vulnerabilities after refreshing the lockfiles and minor/patch package ranges, and the repo-wide copyright/header check is passing again after restoring the missing project headers on newly-added service, route, test, and Vue files. (`server/package-lock.json`, `client/package-lock.json`, `scripts/check-copyright.js`)

### Dependencies

- **Client:** refreshed patch/minor toolchain and runtime packages to the current safe line, including `vue` `^3.5.30`, `@vitejs/plugin-vue` `^6.0.5`, `vitest` `^4.1.0`, and `@vitest/coverage-v8` `^4.1.0`. (`client/package.json`, `client/package-lock.json`)

- **Server:** refreshed patch/minor maintenance packages to the current safe line, including `eslint` `^10.1.0`, `express-rate-limit` `^8.3.1`, `jest` `^30.3.0`, and `nodemon` `^3.1.14`. (`server/package.json`, `server/package-lock.json`)

### Fixed

- **Coverage/test health is back to passing on the ratcheted baseline after the recent refactor wave** — the remaining server branch-coverage regression was recovered with additional focused route-helper coverage across the extracted settings surfaces, so `npm run test:ci` is green again without relaxing `docs/testing/coverage-baseline.json`. (`server/src/__tests__/settings-ai-routes.test.js`, `server/src/__tests__/settings-discord-routes.test.js`, `server/src/__tests__/settings-metadata-provider-routes.test.js`, `docs/testing/coverage-baseline.json`)

- **The settings/ARR code-health and integration test suite are aligned with the newer helper/service contracts again** — annotated intentional ARR SQL interpolation no longer trips static code-health checks, and sync-lock integration mocks now match the structured queue-service return shape used by the refactored queue layer. (`server/src/routes/helpers/arrConfigHandlers.js`, `server/src/__tests__/integration/sync-lock.test.js`, `server/src/__tests__/codeHealth.test.js`)

### Tests

- **Full validation now passes against the current tree again** — repo-wide unit/integration tests, client build, CI coverage, copyright compliance, and local audit checks were all rerun after the latest backfill/classification/settings/auth/runtime changes and are passing together. (`npm test`, `npm run build`, `npm run test:ci`, `npm run check-copyright`, `npm --prefix server audit`, `npm --prefix client audit`)

---

## [v0.44.2c-beta] — 2026-03-15

Package version: `0.44.2-c.beta`

### Fixed

- **Resolving a policy question after a duplicate click or stale UI refresh is now handled more cleanly** — when the same classification has already been completed or routed to the same library, the clarification service now treats the follow-up resolve request as an idempotent success instead of surfacing a stale-row conflict. Genuine stale resolutions still return `409`, but expected client-side races and double-submits no longer trigger internal error logging or noisy bug reports. (`server/src/services/clarificationService.js`)

- **Image embeddings no longer show up as a system outage when the feature is only draft-configured or effectively off** — the health check now treats image embeddings as `disabled` when the image weight is off and as `not configured` when a local/cloud target has been saved but the feature has no validated image-embedding usage yet. The RAG status API now exposes an explicit `image.status`, and the RAG status strip, overview, and image settings tab render that state instead of falling back to a misleading `Offline`/`Unhealthy` label for setup-pending installs. (`server/src/services/healthCheckService.js`, `server/src/routes/rag.js`, `client/src/views/RAGSettings.vue`, `client/src/views/rag/ImageEmbeddingsTab.vue`, `client/src/views/rag/OverviewTab.vue`)

- **Queued classification work is now serialized at active processing time without blocking multiple pending policy questions** — the queue worker now skips dequeuing a new `classification` task only while another classification task is already in `processing`. `awaiting_decision` items no longer pause the queue, so users can accumulate multiple policy questions while still preventing overlapping active classification runs from piling on top of each other. (`server/src/services/queueService.js`)

- **Malformed `CLARIFY` responses with only one surviving library option now degrade deterministically instead of silently falling through** — the AI response parser now converts single-option or zero-option `CLARIFY` payloads into an explicit `contract_violation` clarification result with parser metadata, rather than relying on later fallback behavior after deduplication or out-of-range option mapping. (`server/src/services/aiResponseParser.js`)

- **Command Center no longer misreports pending manual decisions as a worker pause condition** — queue stats now reserve `classificationPaused` for actual dispatch-check failures instead of treating `awaiting_decision` items as a queue stop, so the worker stays `Active` while multiple policy questions remain open. (`server/src/services/queueService.js`, `client/src/views/CommandCenter.vue`)

- **Pending policy questions are now flagged when their policy/library context changed after generation** — classification logging stamps each policy question with a lightweight context version derived from the relevant libraries, policies, and attached preset definitions. Pending-item reads compare that version to current policy context and mark questions as stale instead of silently treating old prompts as current. Command Center now warns that a stale question should be retried before confirming. (`server/src/services/classification.js`, `server/src/services/clarificationService.js`, `server/src/utils/policyQuestionContext.js`, `client/src/views/CommandCenter.vue`, `server/src/routes/policies.js`)

### Tests

- Added clarification regression coverage for duplicate-resolution idempotency and for expected `400`/`409` resolve rejections being logged as non-fatal warnings instead of internal errors. (`server/src/__tests__/clarification.test.js`)

- Added image-embedding health/status regressions covering draft local configs, validated-but-unreachable setups, and the new setup-pending UI state in the RAG overview. (`server/src/__tests__/healthCheckService.test.js`, `server/src/__tests__/integration/rag-api.test.js`, `client/src/__tests__/OverviewTab.test.js`)

- Added queue regressions covering classification dequeue serialization while another classification is already processing and ensuring `awaiting_decision` rows do not block fresh classification work. (`server/src/__tests__/queueService.test.js`, `server/src/__tests__/integration/queue-robustness.test.js`)

- Added parser and UI regressions covering single-option `CLARIFY` degradation to `contract_violation`, shared queue dispatch-check pause stats, and Command Center messaging staying truthful while pending manual-review items remain open. (`server/src/__tests__/services/aiResponseParser.test.js`, `server/src/__tests__/queueService.test.js`, `client/src/__tests__/commandCenterActionModules.test.js`)

- Added queue/pending-question regressions covering stale pending-question flags, policy-question context extraction/staleness helpers, and queue settings remaining focused on worker/retry/cleanup behavior instead of pending-decision pausing. (`server/src/__tests__/queueService.test.js`, `server/src/__tests__/classification-routes.test.js`, `server/src/__tests__/policyQuestionContext.test.js`, `client/src/__tests__/settings/QueueCarsa.test.js`, `client/src/__tests__/commandCenterActionModules.test.js`)

---

## [v0.44.2b-beta] — 2026-03-14

Package version: `0.44.2-b.beta`

### Fixed

- **Resolving pending policy questions no longer fails on a bind-count mismatch in the `genre_pattern` learning path** — the clarification flow now uses separate bind arrays for the 3-parameter `UPDATE learning_patterns` query and the 4-parameter `INSERT INTO learning_patterns` query, fixing the post-release regression that surfaced as `bind message supplies 4 parameters, but prepared statement "" requires 3`. (`server/src/services/clarificationService.js`)

### Tests

- Added stricter clarification regression coverage that validates SQL placeholder counts across the full successful `resolvePolicyQuestion()` path, so bind-array shape mistakes in this flow fail in tests instead of only appearing against real PostgreSQL. (`server/src/__tests__/clarification.test.js`)

---

## [v0.44.2a-beta] — 2026-03-14

Package version: `0.44.2-a.beta`

### Fixed

- **Resolving policy questions no longer depends on a missing `learning_patterns` conflict constraint** — the clarification flow now updates an existing `genre_pattern` row first and only inserts when no matching row exists, avoiding the unsupported expression-based `ON CONFLICT` target that triggered `there is no unique or exclusion constraint matching the ON CONFLICT specification` during manual selections such as routing an item to `Movies`. (`server/src/services/clarificationService.js`)

- **Pending resolution now rejects stale rows, invalid direct-library selections, and malformed `generate_rule` payloads before they turn into deeper service or database failures** — the resolve route now validates `generate_rule` as a real boolean value and verifies that `library_id` exists, while `resolvePolicyQuestion()` itself now locks only `awaiting_decision` rows and returns explicit `404`/`409`/`400` errors for missing classifications, already-resolved items, and invalid library IDs. This hardens both the API route and direct callers such as Discord confirmations. (`server/src/routes/classification.js`, `server/src/services/clarificationService.js`)

- **`genre_pattern` learning writes are now serialized per library/media/genre without requiring a new schema constraint** — the clarification transaction takes a transaction-scoped advisory lock before the update-or-insert genre learning step, preventing concurrent confirmations from creating duplicate learning rows on existing installs that do not have a uniqueness key for those records. (`server/src/services/clarificationService.js`)

- **`task_queue` dashboard stats and restart cleanup are now safer on high-throughput installs** — the live classification queue stats query now uses a filtered aggregate instead of a grouped status scan, a new automatic migration adds `task_queue (task_type, status)` for that hot read path, and the built-in finished-row cap is reduced from 50,000 to 10,000 so completed `metadata_enrichment` rows do not dominate the table by default. Existing installs pick up the index automatically on upgrade and are trimmed down by the normal startup/scheduled cleanup paths without manual intervention. (`server/src/services/queueService.js`, `server/src/services/scheduler.js`, `database/migrations/20260314_213000_add_task_queue_task_type_status_index.sql`, `.env.example`)

### Tests

- Added and expanded regression coverage for:
  - stale and invalid pending-resolution paths (`clarification.test.js`, `classification-routes.test.js`)
  - queue stats query shape and lower built-in finished-row cap (`queueService.test.js`, `scheduler.test.js`)
  - concurrent-safe `genre_pattern` writes without schema changes (`clarification.test.js`)

---

## [v0.44.2-beta] — 2026-03-14

Package version: `0.44.2-beta`

### Changed

- **List-style metadata is now normalized consistently across the runtime stack instead of being parsed ad hoc per service** — introduced `server/src/utils/metadataNormalization.js` and routed ingest, classification, prompt building, policy scoring, retry payloads, clarification, queue refill, profiles, embeddings, RAG extraction, pattern discovery, feedback analysis, formula evaluation, and migration helpers through shared normalization for `genres`, `keywords`, `tags`, and `collections`. This removes a broad class of silent false negatives caused by mixed provider shapes like `['Documentary']`, `[{ name: 'Documentary' }]`, `[{ tag: 'Documentary' }]`, and JSON-stringified arrays. (`server/src/utils/metadataNormalization.js`, `server/src/services/*.js`, `server/src/routes/*.js`)

- **Repo guardrails now block reintroducing ad hoc metadata parsing in new server code** — `README.md` now documents the required normalization helpers, and `server/src/__tests__/codeHealth.test.js` rejects new raw `JSON.parse(...genres|keywords|tags|collections...)` and direct `metadata.<field>.map(...toLowerCase())` handling. This turns the metadata-shape hardening into an enforced engineering rule rather than a one-off cleanup. (`README.md`, `server/src/__tests__/codeHealth.test.js`)

- **Release version surfaces are back in sync with the standard hyphenated prerelease naming used by the workflow** — root, client, and server package versions now align on `0.44.2-beta`, and the public UI label is `v0.44.2-beta`, removing the stale root `0.42.0-alpha` output and the earlier dotted prerelease variant mismatch. (`package.json`, `package-lock.json`, `client/package.json`, `client/package-lock.json`, `server/package.json`, `server/package-lock.json`, `client/src/constants/appVersion.js`)

### Fixed

- **Resolving policy questions could fail at runtime with `could not determine data type of parameter $3`** — the clarification flow now casts the `genre_pattern` JSON placeholder explicitly when writing learned genre patterns, preventing PostgreSQL from rejecting manual selections such as routing a pending item to `Movies`. Adjacent JSON-builder queries in mapping code were hardened with explicit casts as well. (`server/src/services/clarificationService.js`, `server/src/services/libraryMappingService.js`)

- **Pending-question resolution accepted malformed IDs deep into the service layer instead of rejecting them cleanly** — the resolve route now validates both `classificationId` and `library_id` as positive integers and returns `400` for invalid payloads before touching the database. (`server/src/routes/classification.js`)

- **Metadata-shape mismatches caused both noisy UI text and weakened learning/pattern support in edge cases** — clarification matching, context rendering, Discord feedback learning, queue refill, media pattern analysis, pattern mining, scheduler anime detection, and other secondary paths now use the same normalized list handling as the main classifier, eliminating hidden inconsistencies where discovery and matching logic previously disagreed. (`server/src/services/contextManager.js`, `server/src/services/discordBot.js`, `server/src/services/mediaPatternAnalyzer.js`, `server/src/services/patternMiningService.js`, `server/src/services/scheduler.js`)

### Tests

- Added and expanded regression coverage for:
  - metadata normalization helpers and mixed-shape arrays (`metadataNormalization.test.js`)
  - clarification resolution typing, invalid ID handling, and mixed-shape metadata (`clarification.test.js`, `classification-routes.test.js`)
  - prompt building, policy scoring, embeddings, content analysis, queue refill, profile generation, feedback analysis, media sync, pattern mining, and legacy migration mixed-shape handling
  - repo-level code-health enforcement for new raw metadata parsing patterns

- Release gate verification completed:
  - `npm --prefix server run lint:security`
  - `npm --prefix server run lint:tests`
  - `npm run lint:docs`
  - `npm run test:ci`
  - `npm --prefix server run test:integration`

---

## [v0.44.1a.beta] — 2026-03-13

Package version: `0.44.1-a.beta`

### Changed

- **Preset suggestions now return honest lexical `suggestion_score` metadata instead of misleading `% match` semantics** — the scorer in `server/src/routes/policies.js` now uses normalized whole-token overlap and compact phrase checks, removing substring false positives like `Comedy and Standup` suggesting `Scandinavian` because both contain `and`. The API now emits `suggestion_score`, `suggestion_reasons`, and `suggestion_warnings`, while preserving `match_score` / `match_reasons` as compatibility aliases for existing callers. The client preset picker UI now labels this field as `Suggestion score` instead of `% match`. (`server/src/routes/policies.js`, `client/src/components/policies/PolicyBuilderModal.vue`, `client/src/components/policies/PresetSelectionModal.vue`)

- **Language/regional preset semantics are advisory by default unless explicitly marked `strict: true`** — runtime evaluation in `policyEngine.js` now treats `language.require_any` / `language.exclude` as score-shaping signals by default rather than hidden hard gates. Only explicit `strict: true` preserves blocking behavior and language-conflict exclusion from ranked results. The policy builder and preset attachment API now preserve explicit strictness decisions via `customSignals`, and attached presets are annotated with `runtime_semantics` metadata such as `advisory_defaulted`, `strict_override`, and `strict_inherited`. (`server/src/services/policyEngine.js`, `server/src/routes/policies.js`, `server/src/utils/policySignals.js`, `client/src/components/policies/PolicyBuilderModal.vue`)

- **Automatic targeted preset cleanup is now the default upgrade behavior for legacy-incompatible attachments** — one-time migration `20260313_233000_auto_drop_legacy_incompatible_policy_presets.sql` removes only attached presets that still carry legacy language constraints but do not have an explicit strict decision under the new runtime model. The migration writes `settings.key = 'preset_semantics_v2_auto_drop_report'` only when something was actually removed, so fresh installs and untouched configs remain silent. The Policies UI reads that audit row and shows a dismissible upgrade notice; users can reapply corrected presets manually. (`database/migrations/20260313_233000_auto_drop_legacy_incompatible_policy_presets.sql`, `client/src/components/policies/PolicyBuilderModal.vue`)

### Fixed

- **Language-conflict clarification questions could center the wrong library even when ranking was correct** — the clarification builder previously let a conflicting lower-ranked library become option 1 and the text anchor in `policy_question`, producing prompts like “Comedy and Standup normally requires Swedish titles” even when `Movies` was the top candidate. The builder now preserves ranked candidate order, anchors wording on the top-ranked library, and renders multi-language conflicts honestly. Additional metadata is stored in the policy question payload to make the anchor and ranking explicit. (`server/src/services/policyQuestionBuilder.js`)

- **Malformed classify-mode AI prose could still influence user-facing routing prompts after breaking the response contract** — `aiResponseParser.js` no longer extracts a lead library from malformed narrative classify responses. Instead, classify mode now returns deterministic `contract_violation` clarification anchored to the suggested/default library. Verify mode keeps disagreement salvage behavior. This hardens the parser against the production incidents that emitted free-text responses like “The media is a documentary about nature in Costa Rica…” and failed with `parseFailureReason: no_format_matched`. (`server/src/services/aiResponseParser.js`)

### Tests

- Added and updated regression coverage for:
  - preset suggestion substring false-positive removal and compatibility aliases (`policies-routes.coverage.test.js`)
  - advisory vs strict language preset runtime behavior (`policyEngine.presetSemantics.test.js`)
  - truthful candidate ordering and conflict wording (`policyQuestionBuilder.test.js`)
  - classify-mode malformed AI contract fallback behavior (`aiResponseParser.test.js`)
  - dismissible preset-migration banner behavior in the policy builder (`PolicyBuilderModal.test.js`)

- Local production-like verification completed:
  - rebuilt `docker compose` without cache
  - recreated the `classifarr` container
  - confirmed migration `20260313_233000_auto_drop_legacy_incompatible_policy_presets.sql` applied successfully
  - confirmed fresh/no-policy local instance wrote no `preset_semantics_v2_auto_drop_report` row
  - confirmed manually attached presets persist and are not auto-removed on post-upgrade runtime paths

---

## [0.44.1-beta] — 2026-03-13

### Security

- **`undici` < 7.24.0 — high severity (multiple CVEs)** — WebSocket 64-bit length overflow ([GHSA-f269-vfmq-vjvj](https://github.com/advisories/GHSA-f269-vfmq-vjvj)), HTTP request/response smuggling ([GHSA-2mjp-6q6p-2qxm](https://github.com/advisories/GHSA-2mjp-6q6p-2qxm)), unbounded memory consumption in WebSocket permessage-deflate decompression ([GHSA-vrm6-8vpv-qv8q](https://github.com/advisories/GHSA-vrm6-8vpv-qv8q)), unhandled exception via invalid `server_max_window_bits` ([GHSA-v9p9-hfj2-hcw8](https://github.com/advisories/GHSA-v9p9-hfj2-hcw8)), CRLF injection via `upgrade` option ([GHSA-4992-7rv2-5pvq](https://github.com/advisories/GHSA-4992-7rv2-5pvq)), unbounded memory via response buffering in `DeduplicationHandler` ([GHSA-phc3-fgpg-7m6h](https://github.com/advisories/GHSA-phc3-fgpg-7m6h)). Updated `undici` 7.0.0–7.23.x → 7.24.1 in both `server/` and `client/` via `npm audit fix`. Transitive dependency (surfaced through Node.js http tooling). Zero test regressions.

### Dependencies

- **Server + Client:** `undici` → 7.24.1 (patch — security only).

### Fixed

- **Discord interaction handlers crashed the process when responses arrived after the 3-second token deadline** — All five interaction handlers (`processVerification`, `processCorrection`, `processClarificationResponse`, `showLibrarySelection`, `processQuestionResponse`) now call `deferUpdate()` immediately at entry, extending Discord's response window from 3 seconds to 15 minutes. Subsequent response calls use `editReply()` for success embeds and `followUp()` for early-exit messages (calling `reply()` or `update()` after `deferUpdate()` always throws `InteractionAlreadyReplied`). All catch-block replies are wrapped in `try/catch` so that an expired token on an error message does not produce an unhandled rejection. `processVerification` also gains an idempotency guard: duplicate button clicks for items already at `verified` or `routed` status return a friendly ephemeral message instead of re-routing.
  (`server/src/services/discordBot.js`)

- **`verifyToken()` swallowed `TokenExpiredError`, causing expired access tokens to return HTTP 403 instead of 401** — `verifyToken()` previously caught all JWT errors and re-threw a generic `Error`, discarding the original `error.name`. The `authenticateToken` and `authenticateTokenOrApiKey` middleware then returned `403` for every JWT failure — including routine expiry. Because the Axios response interceptor only retries on `401`, silently refreshing an expired access token never triggered; "Remember Me" sessions appeared broken even though the refresh token was valid. Fix: `verifyToken()` now lets the original `JsonWebTokenError`/`TokenExpiredError` propagate. Both middleware functions now return `401` for `TokenExpiredError` (triggering client-side silent refresh) and `403` for all other JWT failures.
  (`server/src/services/auth.js`, `server/src/middleware/auth.js`, `server/src/middleware/apiKeyAuth.js`)

- **CLARIFY AI responses used free-text library names as option tokens, allowing hallucinated names to silently drop options** — `CONFIDENT` and `CONFIRM` have always used numeric library indices (e.g. `CLARIFY|...|1|2`), but `CLARIFY` used free-text names (`CLARIFY|...|Documentaries|Movies`). The LLM frequently hallucinated names that did not match any library, causing `mapOptionsToLibraries()` to drop them silently. The user never saw a clarification question. Fix: both `aiPromptBuilder.js` and the inline CLARIFY prompt in `classification.js` now use `<library_number_1>|<library_number_2>|<library_number_3_optional>`. A new `_resolveOptionsFromTokens()` helper resolves bare integers to libraries by index; non-integer tokens fall back to the existing text-matching path for backward compatibility with in-flight responses.
  (`server/src/services/aiPromptBuilder.js`, `server/src/services/classification.js`, `server/src/services/aiResponseParser.js`)

- **`metadata_enrichment` task re-queued every item on every cycle (infinite loop)** — `refillQueue()` selects items where `metadata->'content_analysis'->>'source' IS DISTINCT FROM 'metadata_enrichment'`. A second `content_analysis` assignment inside the enrichment task handler overwrote the original object (which carried `source: 'metadata_enrichment'`) with one that lacked the key. Every item without OMDb data was consequently re-selected on the next cycle. Fix: add `source: 'metadata_enrichment'` to the reassigned `content_analysis` object.
  (`server/src/services/queueService.js`)

### Tests

- **Discord interaction handlers** — New test file `discordBot.interactions.test.js` with 32 tests covering all five handlers: `deferUpdate` called before any async/DB work; `editReply` used (not `update`/`reply`) for success paths; `followUp` used (not `reply`) for early exits; catch blocks call `followUp` (not `reply`); no process crash when both `deferUpdate` and `followUp` throw; `processVerification` idempotency guard for `verified`/`routed` statuses.
- **`verifyToken` error propagation** — Updated `auth.service.test.js`: replaced the old test that expected a normalised string message with two new tests that assert the original error's `.name` is preserved (`JsonWebTokenError` / `TokenExpiredError`).
- **401 / 403 split in middleware** — Updated `apiKeyAuth.test.js`: malformed-JWT test now correctly models a `JsonWebTokenError`; added `TokenExpiredError → 401` test. Added integration test in `auth-routes.test.js` that generates a real expired JWT (`expiresIn: -1`) and expects `401` with a message matching `/expired/i`.
- **`_resolveOptionsFromTokens` numeric index resolution** — Added 4 tests: numeric CLARIFY tokens resolve to correct libraries; out-of-range index is silently dropped; mixed integer/text tokens fall back to text matching; forward-compat path preserved for pre-prompt-change responses. (`aiResponseParser.test.js`)
- **`metadata_enrichment` source key regression** — Added regression test: enriched item carries `source: 'metadata_enrichment'` after the second `content_analysis` assignment so `refillQueue()` does not re-select it. (`queueService.test.js`)

---

## [0.44.0-beta] — 2026-03-13

### Security

- **`flatted` < 3.4.0 — high severity DoS** ([GHSA-25h7-pfq9-p65f](https://github.com/advisories/GHSA-25h7-pfq9-p65f)) — unbounded recursion in `flatted.parse()` could be triggered by a crafted circular-reference payload, causing a stack overflow. Transitive dependency via `eslint → file-entry-cache → flat-cache`. Updated `flat-cache` which pulled `flatted` from 3.3.3 → 3.4.1. (`server/`)

### Dependencies

- **Server:** `pg` 8.19.0 → 8.20.0 (+ `pg-pool`, `pg-protocol`, `pg-connection-string` sub-packages); `express-rate-limit` 8.2.1 → 8.3.1; `axios` 1.13.5 → 1.13.6; `eslint` 10.0.2 → 10.0.3; `jest` 30.2.0 → 30.3.0. All patch/minor — zero test regressions (3 476/3 476 passing).
- **Client:** `vue` 3.5.29 → 3.5.30; `axios` 1.13.5 → 1.13.6; `postcss` 8.5.6 → 8.5.8; `@vitejs/plugin-vue` 6.0.4 → 6.0.5; `vitest` + `@vitest/coverage-v8` 4.0.18 → 4.1.0. All patch/minor — zero test regressions (1 257/1 257 passing). `vite` 7.3.1 → 8.0.0 (major — Rolldown bundler replaces esbuild + Rollup; zero config-breaking changes for this project; `build.target` pinned to `baseline-widely-available`; vendor chunk splitting via `build.rolldownOptions.output.manualChunks` function — Vue ecosystem separated into cacheable `vue-vendor` chunk).

### Fixed

- **Genre learning from policy clarifications was non-functional** — `checkLearnedPatterns()` silently ignored its `metadata` argument (parameter was named `_metadata`, the leading `_` caused it to never be used), so every genre check returned `null` regardless of learned data. Renamed to `metadata` and added proper SQL filtering by `metadata.genres` (using PostgreSQL `ANY($1::text[])`) and `metadata.media_type`, with an early return when genres array is empty. (`services/classification.js`)

- **`resolvePolicyQuestion()` only wrote item-level `exact_match` patterns, never genre-level ones** — After a user confirms a library choice, clarification now also writes one `genre_pattern` row per genre in the item's metadata. Each insert uses `ON CONFLICT` upsert (increments `usage_count`, caps `confidence` at 95) so repeated confirmations reinforce the pattern rather than duplicating rows. (`services/clarificationService.js`)

### Tests

- **`checkLearnedPatterns`** — Added 5 unit tests: returns `null` when metadata has no genres; returns `null` when genres array is empty (no DB call); returns `null` when no matching DB rows; returns library match when a `genre_pattern` row exists with `success_rate ≥ 70`; SQL params are `[genres, media_type]`. (`classification.test.js`)
- **`resolvePolicyQuestion` genre_pattern writing** — Added 3 unit tests: writes one `genre_pattern` INSERT per genre (2 genres → 2 INSERTs); stores genre in lowercase; skips genre INSERTs when `metadata.genres` is absent. (`clarification.test.js`)
- **Code health test suite** (`codeHealth.test.js`) — New static-analysis test file with 10 check categories (1 319 tests): syntax validity via `vm.Script` (catches truncated files); test file closure; stub method detection; mock chain completeness; `console.log` in service files; hardcoded credentials; `eval()`/`new Function()`; `process.exit()` in service files; string-interpolated SQL queries. Path handling normalised to forward slashes so all filters work correctly on Windows. Legitimate PostgreSQL `SET LOCAL` / DDL interpolation sites annotated with `// sql-interpolation: <reason>` suppression comments.

- **Remember Me sessions still kicked to login on access-token expiry** — The Vue Router `beforeEach` guard used a raw `fetch('/api/auth/me')` call that bypasses the Axios interceptor. When the 48-hour access token expired the guard received 401 and redirected to `/login` without ever attempting to use the valid 30-day refresh token. The guard now calls `api.getMe()` through the shared Axios client so the existing 401 interceptor silently refreshes the access token and retries — the user stays logged in for the full remember-me window. (`client/src/router/index.js`)

- **AI clarification option dropped when LLM wraps library name in quotes** — `mapOptionsToLibraries()` normalised option text by stripping list-prefix artefacts and noise words, but did not remove surrounding quote characters that LLMs sometimes produce (e.g. `"Documentaries"` instead of `Documentaries`). The quote-strip step is now applied first (before prefix stripping), and the second-pass partial match now also uses the cleaned string instead of the raw lowercased value, fixing the regression where `optLower.includes(libLower)` was tested against an unstripped, quote-wrapped value. (`aiResponseParser.js`)

- **task_queue slow INSERT on high-volume instances** — `_backgroundDrainIfBloated()` (startup drain) and `runTaskQueueCleanup()` (nightly scheduler at 3:15 AM) both now apply a count-based cap (`TASK_QUEUE_MAX_TOTAL_ROWS`, default 50 000) in addition to the existing age-based retention drain. Previously, if all completed/failed rows were within the 7-day retention window both cleanup paths exited immediately, allowing the table to accumulate 250 000+ rows and cause slow index-maintenance on INSERT (~600 ms spikes). The startup drain also consolidates its two count round-trips into one query. (`queueService.js`, `scheduler.js`)

- **task_queue INSERT-autovacuum lag** — Added `autovacuum_vacuum_insert_scale_factor = 0.02` and `autovacuum_vacuum_insert_threshold = 500` storage parameters to `task_queue`. PostgreSQL 13+ tracks INSERT activity separately and will not refresh `reltuples` (the query planner's row-count estimate) until the insert threshold fires. The default `0.20` insert scale factor allowed the planner to under-estimate table size by 50 000+ rows on a high-volume instance, causing poor index-plan selection. New threshold fires after ~5 000 inserts on a 250 K-row table instead of 50 000. (`database/migrations/20260313_120000_task_queue_insert_autovacuum.sql`)

### Tests

- **`mapOptionsToLibraries` — quote stripping** — Added 4 tests: matches library when option is wrapped in double quotes; single quotes; prefix + quotes combined; drops quoted option when stripped name still has no match. (`aiResponseParser.test.js`)
- **`_backgroundDrainIfBloated`** — Added 5 unit tests covering: early-return when neither threshold is exceeded; age-based delete + VACUUM; count-based trim of oldest rows; combined age+count trigger label; non-fatal VACUUM failure path. (`queueService.test.js`)
- **`runTaskQueueCleanup`** — Added 5 unit tests covering: no-op when both age and row-count are healthy; age-based drain with VACUUM; count-based cap trim of oldest rows with cap-exceeded warning; combined age+count path with single VACUUM; non-fatal VACUUM failure. (`scheduler.test.js`)
- **Client code health test suite** (`client/src/__tests__/codeHealth.test.js`) — New static-analysis test file with 14 check categories (850 tests): JSON validity with dynamic project-wide file discovery (catches new files automatically); `package.json` schema (required fields, valid semver version, `engines.node` specified, no wildcard `*` dep versions); `package-lock.json` lockfileVersion >= 3 (npm 7+ reproducible installs); PWA manifest W3C required fields (`name`, `short_name`, `start_url`, `display`, `icons`); monorepo version consistency (client and server `package.json` versions match); Vue SFC required blocks; no mixed Options API + `<script setup>`; no `console.log()` in production code; `v-html` XSS safety review; `v-for` `:key` enforcement; no `eval()`/`new Function()`; no hardcoded credentials; TODO stub count tracking; test file closure. Also fixed `PROJECT_ROOT` constant (was 4 `..` levels, pointing above the repo root — now corrected to 3) and re-encoded `ci-jobs.json` from UTF-16 LE to UTF-8 (file was previously unreadable by any JSON tooling).

### Schema

- **`database/schema/current.sql` regenerated** — Snapshot now includes all migrations through `20260313_120000_task_queue_insert_autovacuum.sql`: RAG graph relationship columns (`director_name`, `primary_studio_name`, `genre_names`, `cast_ids`, `cast_names`) and GIN/B-tree indexes on `classification_history`; RAG graph config columns on `ai_provider_config`; `task_queue` retention index (`idx_task_queue_cleanup`) and updated storage parameters; `remember_me` column on `refresh_tokens`; `failed_login_count` / `locked_until` columns and `idx_users_locked_until` index on `users`.

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

> [!NOTE]
> Older changelog entries have been moved to [CHANGELOG_backup.md](CHANGELOG_backup.md) to keep this file concise.
