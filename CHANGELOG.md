# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **`classificationMetadataService` extracted (Phase 1 of 6)** — Seven metadata-related methods extracted from `classification.js` into a focused `classificationMetadataService` module: `parseOverseerrPayload`, `enrichWithTMDB`, `getTavilyConfig`, `enrichWithWebSearch`, `detectEventTypesFromMetadata`, `mightBeAnime`, `mergeMetadataForRecheck`. Original methods replaced with thin delegation wrappers; all existing `jest.spyOn()` call sites remain compatible. 73 new unit tests added. (`server/src/services/classificationMetadataService.js`, `server/src/__tests__/classificationMetadataService.test.js`, `server/src/services/classification.js`)

- **`classificationUtilsService` extracted (Phase 2 of 6)** — Eight pure utility functions extracted from `classification.js` into a self-contained `classificationUtilsService` module: `resolveRagLoopTimeout`, `withTimeout`, `sleep`, `withRetryableDbConflict`, `isAiTransientAvailabilityError`, `buildParseDiagnostics`, `buildPendingRetryResult`, `resolveRetryReason`. Module carries all constants it needs (`RAG_LOOP_MIN/MAX_TIMEOUT_MS`, `RETRY_DELAY_MS`, `AI_PARSE_CONTRACT_VERSION`). Original methods replaced with thin delegation wrappers. 101 new unit tests added. (`server/src/services/classificationUtilsService.js`, `server/src/__tests__/classificationUtilsService.test.js`, `server/src/services/classification.js`)

- **`classificationRoutingService` extracted (Phase 3 of 6)** — Eight routing functions extracted from `classification.js` into a focused `classificationRoutingService` module: `normalizeSettings`, `normalizeQualityProfileId`, `isSettingsEmpty`, `resolveDefaultQualityProfile`, `resolveDefaultRootFolder`, `resolveRoutingConfig`, `routeToArr`, `suggestSeriesType`. Module owns the full Radarr/Sonarr add flow including settings resolution, profile/root-folder cache lookups, season monitoring normalisation, pre-checks, and race-condition 400/409 handling. Original methods replaced with thin delegation wrappers; all existing `jest.spyOn()` call sites remain compatible. 102 new unit tests added. (`server/src/services/classificationRoutingService.js`, `server/src/__tests__/classificationRoutingService.test.js`, `server/src/services/classification.js`)

- **`classificationAiService` extracted (Phase 4 of 6)** — Four AI interaction functions extracted from `classification.js` into a focused `classificationAiService` module: `normalizeAiResponseLine`, `buildAiRepairPrompt`, `attemptAiResponseRepair`, `aiClassify`. Module owns the full AI classification pipeline including prompt assembly, provider lock acquisition, Ollama streaming, cloud provider dispatch, transient-error retry logic, response parsing, and optional repair pass. Original methods replaced with thin delegation wrappers; all existing `jest.spyOn()` call sites remain compatible. 61 new unit tests added. (`server/src/services/classificationAiService.js`, `server/src/__tests__/classificationAiService.test.js`, `server/src/services/classification.js`)

- **Test harness hardening** — Fixed cross-file mock contamination in `--runInBand` mode: removed `{ virtual: true }` from `queueService.test.js`'s tavily mock (real file; virtual flag caused factory to bleed into later test files' module registries) and added missing `searchIMDB`/`formatForAI` properties to match the full tavily service shape. Updated `classificationMetadataService.test.js` `enrichWithWebSearch` `beforeEach` to use individual `mockReset()` calls instead of `jest.clearAllMocks()`, preventing stale `mockResolvedValueOnce` queue leakage between tests.

### Planned

- **`classification.js` decomposition — 2 phases remaining** — Phases 1–4 complete. Remaining: `classificationPersistenceService` (DB persistence, state derivation, retry lineage rebinding), `classificationRagLoopService` (second-pass RAG evaluation, rollout automation). After all extractions the orchestrator facade (`classify()` + `runDecisionTree()`) will shrink from ~4,500 lines to ~800–1,000 lines. Detailed plan in `docs/implementation_plan_classification_decomposition.md`.

### Changed

- **npm dependencies refreshed** — `axios` updated to `1.15.0` across root, server, and client (fixes SSRF via `no_proxy` hostname normalisation bypass and unrestricted cloud metadata exfiltration via header injection chain); `dotenv` updated to `17.4.2` in root and server; `testcontainers` / `@testcontainers/postgresql` updated to `11.14.0` in server; client tooling updated: `vite` `8.0.3→8.0.8`, `vitest` / `@vitest/coverage-v8` `4.1.2→4.1.4`, `@vitejs/plugin-vue` `6.0.5→6.0.6`, `jsdom` `29.0.1→29.0.2`, `postcss` `8.5.8→8.5.9`, `globals` `17.4.0→17.5.0`. GitHub Actions updated: `docker/login-action` `4.0.0→4.1.0`, `docker/build-push-action` `7.0.0→7.1.0`. 0 vulnerabilities confirmed across all manifests. (`package.json`, `server/package.json`, `client/package.json`, `.github/workflows/ci.yml`)

## [v0.45.3-beta] — 2026-04-04

Package version: `0.45.3-beta`

### Added

- **Evidence admin screen** — New `Evidence` view with summary cards, filter/search bar, paginated table, and per-row diagnose/decay/promote/purge controls; backed by a new `/api/evidence` route with admin authentication. (`client/src/views/Evidence.vue`, `server/src/routes/evidence.js`, `client/src/api/evidence.js`)

- **Test coverage expansion** — Focused unit tests added for all PolicyEngine scoring functions, FeedbackAnalysis DB-backed methods, and healthCheckService service-check functions; coverage added across all new evidence unification service, script, route, and backup/restore seams.

### Changed

- **Learned pattern and evidence unification complete** — `classification_evidence` table introduced; `checkLearnedPatterns` early-return shortcut removed; PolicyEngine now scores related evidence through `scoreRelatedEvidence()`; reinforcement unified through a dedicated façade; all writes target `classification_evidence` as primary; legacy tables retained during compatibility window. Related evidence summaries flow into AI prompts and clarification question payloads. Backup and restore updated to include `classification_evidence` rows with library ID remapping. (`classificationEvidenceService.js`, `classificationEvidenceRepository.js`, `classificationEvidenceReinforcementService.js`, `policyEngine.js`, `classification.js`, `backupService.js`)

- **Compatibility and reporting layer for unified evidence** — `evidenceCompatibilityMapper` normalizes scope and provenance to legacy method values; `evidenceHistoryReadModel` provides a read model for history, activity, and stats surfaces; method labels updated in `History.vue`, `Activity.vue`, `ClassificationStats.vue`, and the stats API.

- **Client API decomposed into domain modules** — The monolithic API singleton replaced by focused domain modules (`core`, `queue`, `rag`, `libraries`, `mediaServer`, `classification`, `settings`, `stats`, `requestsNotifications`, `system`, `admin`, `presets`, `evidence`); all GET reads normalized at module boundaries, removing Axios response-envelope handling from views, stores, and composables. (`client/src/api/`)

- **Command Center decomposed** — Processing details, operational actions, and shell/controller state extracted to dedicated composables; heavy presentation sections moved to `ProcessingPanel.vue` and `CommandCenterOverviewSections.vue`. (`client/src/composables/`, `client/src/components/command-center/`)

- **Classification retry service decomposed** — Payload shaping, state-reset persistence, and post-commit follow-up work extracted to `classificationRetryPayloads`, `classificationRetryStateService`, and `classificationRetryFollowupService`. (`server/src/services/`)

- **RAG route decomposed into helper modules** — `rag.js` split into focused helpers for backfill, model metadata, status, operations, diagnostics, and core routing; old transition routes removed. (`server/src/routes/helpers/`)

- **Database slow-query telemetry** — Pool checkout latency (`poolWait`) and query execution time (`exec`) now logged separately instead of as one combined duration. (`server/src/config/database.js`)

- **All ESLint warnings resolved** — 35 warnings eliminated across server and client.

- **npm dependencies refreshed** — All server and client dependencies updated; 0 vulnerabilities confirmed.

- **CI/CD maintenance** — Node 24 runner, full-SHA GitHub Actions pins, Dependabot grouping with weekly update schedule.

### Fixed

- **Embedding lock-contention** — Provider-lock timeouts now surface as `PROVIDER_BUSY` deferred behavior; backfill runners no longer count skipped busy attempts as progress. (`embeddingService.js`, `providerLock.js`)

- **Queue worker AI-unavailable gate** — Classification tasks no longer dequeue during AI cooldown windows; `classificationPauseReason` surfaced through the queue read model. (`queueWorkerLoopService.js`)

- **Axios supply chain compromise** — Not affected; already pinned to clean `1.14.0`. (GHSA-fw8c-xr5c-95f9)

- **Copyright compliance** — `swaggerSpec.js` was missing its GPL-3.0 header; all 803 source files now pass.

- **VS Code TS server errors** — `.tmp/` excluded from workspace file tracking so the TS server no longer scans `node_modules` under `.tmp/pr-verify/`. (`.vscode/settings.json`)

## [v0.45.2-beta] — 2026-03-29

Package version: `0.45.2-beta`

### Changed

- **Client and server npm dependencies were refreshed to the current baseline, and the client lint/tooling stack was modernized** — the client now includes Vue `3.5.31`, Vite `8.0.3`, `vitest` `4.1.2`, `@vitest/coverage-v8` `4.1.2`, `axios` `1.14.0`, `eslint-plugin-vue` `10.8.0`, `globals` `17.4.0`, `@eslint/js` `10.0.1`, and `eslint` `10.1.0`, while the server and root package manifests now use `axios` `1.14.0`. (`package.json`, `package-lock.json`, `client/package.json`, `client/package-lock.json`, `server/package.json`, `server/package-lock.json`)

- **CI and container maintenance defaults were tightened to better match current Node/npm and workflow practices** — GitHub Actions now target the rolling Node `24` line with lockfile-based npm caches, the copyright workflow now uses `npm ci`, Trivy SARIF uploads now use `github/codeql-action` v4, the CI Postgres service is pinned to `17.7-alpine3.23`, and the Docker build/runtime stages now use `node:24.14.1-alpine3.23`. (`.github/workflows/ci.yml`, `.github/workflows/copyright-compliance.yml`, `.github/workflows/trivy.yml`, `Dockerfile`)

- **Workflow dependency hygiene is now hardened and automated** — third-party and GitHub-hosted workflow actions are now pinned to full commit SHAs instead of floating tags, and Dependabot now watches both GitHub Actions and the root/client/server npm manifests so future maintenance updates arrive as reviewable PRs instead of manual drift. (`.github/workflows/*.yml`, `.github/dependabot.yml`)

- **Dependabot update flow is now grouped and scheduled for lower-noise maintenance** — GitHub Actions and npm updates now run on a weekly Monday cadence with explicit Eastern Time scheduling, dependency labels, pull-request caps, and grouped root/client/server update streams so routine maintenance arrives as a smaller set of reviewable PRs instead of one package bump at a time. (`.github/dependabot.yml`)

- **Dependency and release maintenance policy is now documented in-repo** — the repo now includes a dedicated maintenance guide covering update grouping, full-SHA GitHub Actions pinning, verification expectations, and version/runtime policy, and the main README links it from the documentation index. (`docs/maintenance.md`, `README.md`)

## [v0.45.1-beta] — 2026-03-28

Package version: `0.45.1-beta`

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

- **Dependency policy now explicitly pins the currently patched transitive security fixes instead of waiting on stale lockfiles or upstream lag** — root/server/client manifests now override `brace-expansion` to `5.0.5`, `server` also pins `path-to-regexp` to `8.4.0`, and the root tooling manifest pins `smol-toml` to `1.6.1` while `markdownlint-cli2` still depends on the older vulnerable release. (`package.json`, `server/package.json`, `client/package.json`)

- **The Vue 3 + Vite client now has a first-class ESLint contract instead of relying only on tests and builds** — the frontend uses a flat-config ESLint setup with `@eslint/js` and `eslint-plugin-vue` on the client codebase, the new `client` lint scripts are wired into the package manifest, and the related pass cleaned out dead imports, dead helpers, and unused catch parameters across the UI so the client lint surface is fully green without relaxing the real correctness checks. (`client/package.json`, `client/eslint.config.js`, `client/src/api/index.js`, `client/src/**/*.vue`, `client/src/**/*.test.js`)

- **Frontend linting now participates in the normal root and CI verification flow instead of living as a standalone local command** — the root package now exposes `lint`, `lint:server`, and `lint:client`, the CI workflow runs client ESLint after installing frontend dependencies, and the README now documents the shared local verification entry points. (`package.json`, `.github/workflows/ci.yml`, `README.md`)

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

- Added targeted branch coverage for the shared RAG helpers and SSL/presenter seams that were dragging the server ratchet just below baseline, including direct route-registration tests for diagnostics/operations/core flows, deeper metadata/status helper permutations, and direct certificate-validation helper tests. (`server/src/__tests__/ragCoreHelpers.test.js`, `server/src/__tests__/ragDiagnosticsHelpers.test.js`, `server/src/__tests__/ragOperationsHelpers.test.js`, `server/src/__tests__/ragModelMetadataHelpers.test.js`, `server/src/__tests__/ragStatusHelpers.test.js`, `server/src/__tests__/sslSettingsHandlers.test.js`, `server/src/__tests__/settings-ssl-routes.test.js`, `server/src/__tests__/backfillStatusPresenter.test.js`, `server/src/__tests__/embeddingAvailabilityPresenter.test.js`)

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

---

> [!NOTE]
> Older changelog entries have been moved to [CHANGELOG_backup.md](CHANGELOG_backup.md) to keep this file concise.
