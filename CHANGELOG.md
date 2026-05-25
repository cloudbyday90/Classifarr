# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Archived changelogs: [May 2026 Early](docs/changelog/CHANGELOG-2026-05-early.md) | [April 2026](docs/changelog/CHANGELOG-2026-04.md) | [March 2026](docs/changelog/CHANGELOG-2026-03.md)

## [Unreleased]

### Added

- **Policy candidate diagnostics** — policy candidates now carry a modular `candidate_diagnostics` object recording viability reason, source flags, and driver list for operator debugging.
- **Weak-overlap policy race escalation** — candidates surviving only on compatibility/profile evidence now degrade to manual review or prompt_select instead of false-positive confirms.
- **Policy-overlap telemetry** — live in-memory metrics tracking weak evidence, manual review recommendations, and top overlapping library pairs via `/api/stats/overview`.
- **Persisted overlap snapshots** — `policy_overlap_metrics_snapshots` table stores aggregate counts for restart-safe trend inspection via `/api/stats/policies/overlap-history`.
- **V8 module compile cache** — `module.enableCompileCache()` in `server/src/index.mjs` speeds up server startups.
- **Root `scripts/run-jest.mjs` wrapper** — delegates to server Jest with `cwd` hardening so it works from workspace root.
- **Knip full static analysis gate in CI** — `server/knip.json` runs all issue types (unused files, exports, dependencies, unlisted, binaries, duplicates, unresolved) as errors; uses `--cache` for speed. Prevents dead code, phantom deps, and duplicate exports from accumulating.
- **Knip production-mode CI step** — second Knip run with `--production` surfaces dead production code and unused production dependencies that are only reachable through tests. Uses `!` suffixed entry/project patterns per knip.dev best practices. Promoted to blocking (exit-code gated) after annotating 37 test-only exports with `/** @internal */` JSDoc tags.
- **`npm ls` dependency tree validation in CI** — greps for missing/invalid entries after `npm ci` to catch undeclared transitive dependency usage.
- **Changelog conventions guide** — `docs/CHANGELOG-CONVENTIONS.md` documents entry format, archival strategy, and separation from release notes.
- **ESM modular extractions** (35+ sub-modules extracted across services and routes, following named-export + callback-injection patterns):
  - Discord: `discordNotificationBuilder`, `discordInteractionHandler`, `discordConnectionManager`, `discordChannelPermissions`, `discordTieredEmbedBuilder`, `discordNotificationComponents`, `discordConfidenceNotification`, `discordClassificationNotification`, `discordCorrectionHandler`, `discordVerificationHandler`, `discordClarificationHandler`, `discordPatternExtractionService`, `discordLibrarySelectionHandler`, `systemAlertService`
  - Health checks: `healthCheckImageEmbeddings`, `healthCheckRAG`, `healthCheckArrServices`, `healthCheckExternalApis`, `healthCheckCoreServices`, `healthCheckInfrastructure`
  - Policy engine: `policyEngineUtils`, `policyEngineSignalScoring`, `policyEngineSourceScoring`, `policyEngineQueries`, `policyEngineEvaluation`
  - Classification: `classificationAiRepair`, `classificationAiParseHelpers`, `classificationAiFailureUtils`, `classificationRagLoopPhases`, `classificationRagLoopRollout`, `classificationRagLoopConfig`, `classificationPhaseUtils`, `classificationPhaseProgress`, `classificationPersistenceRagEvents`, `classificationPersistenceRetryLineage`, `classificationRoutingArrRadarr`, `classificationRoutingArrSonarr`, `classificationEvidenceQueries`, `classificationEvidencePurge`
  - Routes: `librariesRouteCrud`, `librariesRouteLabels`, `librariesRouteRules`, `librariesRouteArrConfig`, `librariesRoutePatterns`, `librariesRouteRuleSuggestions` (+3 sub-modules), `policiesRouteHelpers`, `policiesRoutePresets`, `policiesRoutePolicyRead`, `policiesRoutePolicyWrite`, `policiesRoutePolicyPresets`, `classificationRouteHistory`, `classificationRouteSecondPass`, `classificationRouteCorrections`, `classificationRoutePending`, `settingsRoute*` (6 modules), `statsRoute*` (3 modules), `patternsRoute*` (3 modules), `systemRoute*` (3 modules)
  - Embeddings/RAG: `embeddingProviderConfig`, `embeddingProviderAdapters`, `embeddingProviderMetrics`, `embeddingProviderDispatch`, `embeddingProviderModels`, `embeddingCloudAdapterHelper`, `embeddingServiceErrors`, `embeddingServiceImage`, `ragRetrieverSearch`, `ragRetrieverQuery`, `ragRetrieverText`, `ragRetrieverSemanticSearch`, `ragLoopResilienceConfig`
  - AI/LLM: `aiPromptBuilderFormatters`, `cloudLLMHelpers`, `cloudLLMModels`, `cloudLLMEmbeddings`, `cloudLLMChat`, `promptBuilderConstants`, `promptBuilderTypeHelpers`
  - Services: `ollamaConnection`, `ollamaGeneration`, `ollamaRecommendedModels`, `ollamaModelWarming`, `ollamaPreflightUtils`, `ollamaScheduledPreflight`, `backupEncryption`, `backupRestore`, `backupRestoreTables`, `autoLearningConfidence`, `autoLearningPreferenceWriters`, `autoLearningQueries`, `schedulerOperationalTasks`, `schedulerAutoLearnRules`, `schedulerServiceRagBackfill`, `schedulerServiceTasks`, `schedulerServiceCrud`, `reclassificationBatchSchema`, `reclassificationBatchProcessing`, `reclassificationBatchQueries`, `reclassificationMoves`, `reclassificationQueries`, `manualBackfillRun`, `scheduledBackfillProcessing`, `idleBackfillConfig`, `idleBackfillProcessing`, `mediaPatternExtraction`, `patternMiningDiscovery`, `imageEmbeddingConfig`, `imageEmbeddingProviders`, `fileOperationsUtils`, `fileOperationsCopy`, `webhookConfigCrud`, `webhookLogging`, `webhookSecretManagement`, `queueCarsaLibraryRemap`, `queueCarsaCleanup`, `queueMaintenanceQueries`, `queueTaskProcessorRating`, `queueTaskProcessorEnrichment`, `queueTaskProcessorIndexing`, `mediaSyncUpsert`, `mediaSyncQueries`, `feedbackAnalysis*` (4 modules), `legacyMigrationAnalysis`, `legacyMigrationConversion`, `enrichmentRetryScheduler`, `enrichmentRetryExecutor`, `enrichmentRetryStats`, `enrichmentRetryProcessing`, `policyQuestionBuilderUtils`, `policyQuestionBuilderQuestions`, `policyQuestionBuilderQueries`, `ragDiagnosticsLoop`, `ragDiagnosticsPatterns`, `ragOperationsConfig`, `ragOperationsData`, `aiSettingsPersistenceConfig`, `aiSettingsPersistenceEffects`, `clarificationUtils`, `clarificationQuestionManager`, `clarificationThresholdManager`, `clarificationPolicyResolution`, `clarificationPendingQueries`, `confidenceCalculationUtils`, `confidenceCalculationEngineDefaults`, `confidenceCalculationEngine`, `confidenceSettingsPersistence`, `feedbackAnalysisSuggestionApply`, `feedbackAnalysisSuggestionStore`, `libraryProfileComputations`, `libraryProfileQueries`, `ragRetrieverFormatters`, `ragFusion`, `ragRetrieverSearch`, `tmdbHelpers`, `omdbQuota`, `omdbHealth`, `omdbResponse`, `omdbLookup`, `aiResponseParserResults`, `aiResponseParserOptions`
  - Shared: `stringUtils` (`isBlank`/`sanitizeRuntimeSignature`), `baseIntegrityService` (5 integrity services), `arrServiceBase` (Sonarr/Radarr factory), `promptBuilderTypes`, `promptBuilderFormatters`

### Changed

- **Removed 22 dead exports and 1 dead file** — Knip-reported unused exports removed following 2026 ESM best practices: named exports only for tree-shaking, no redundant factory/singleton wrappers, no unused aggregator objects. Removed `optionalAuth`, `aiResponseDiagnosticsService`, `buildLibraryIdMap`, `createClassificationEvidenceComparisonService`, `createClassificationEvidenceTelemetryService`, `classificationMetadataEnrichmentService`, `buildDisabledHealthState`, `createMediaPatternAnalyzer`, `buildPlexService`, `createRagGraphExtractor`, `createWebSocketService`, `createHttpClient`, `INTERNAL_TO_PINO_LEVEL`, `getDb`, `createTaskResult`, `withRAGErrorHandling`, `isRecoverable`, `isDeferredRetryReason`, `ragLoopPayloadValidation` aggregator, `constants` re-export, and 3 duplicate `DEFAULT_*` named exports from `operationController.mjs`. Deleted empty `arrConfigSupport.mjs` route helper and its placeholder test.
- **Removed dead `closeDatabasePool` export** — exported from `cliRuntime.mjs` but never imported anywhere (not even tests). Also made `failCli` module-private (only used internally).
- **Hardened Knip config** — replaced 6 `ignoreIssues` entries (covering both exports and files) with proper JSDoc tags per knip.dev best practices: `@public` for namespace-accessed exports Knip can't trace through class properties, `@alias` for duplicate object wrappers, `@internal` for script-only and future infrastructure modules. Only 4 file-level entries remain for modules consumed exclusively by `src/scripts/` (outside production entry graph).
- **Deduplicated `safeParseJsonObject`** — three identical copies existed across `classificationRetryPayloads.mjs`, `classificationRouteHelpers.mjs`, and `classificationOutcomeService.mjs`. Consolidated to single canonical source in `utils/classificationRetryPayloads.mjs`; route helpers re-export via `export { safeParseJsonObject } from` and outcome service imports directly.
- **Structural duplicate audit and consolidation** — scanned entire `server/src/` for functions defined in 2+ files. Resolved 8 duplicates across two passes:
  - `measureTime` (3 copies) → exported from `healthCheckServiceShared.mjs`
  - `isPlainObject` (3 copies) → exported from `utils/stringUtils.mjs`
  - `createStatusMap` + `summarizeOldestByStatus` (2 copies each) → exported from `queueMaintenanceQueries.mjs`
  - `safeParsePolicyQuestion` (2 copies) → re-exported from `classificationRouteHelpers.mjs`
  - `parseIntParam` (2 identical copies) → re-exported from `evidenceRouteHelpers.mjs`
  - `safeParseJson` (2 copies) → re-exported from `clarificationUtils.mjs` (keeps logging variant)
  - `parsePayload` (2 copies) → consolidated into `utils/queueHelpers.mjs` with robust result validation
  - `checkAbort` (2 copies) → extracted to `utils/abortUtils.mjs` (no circular dependency — `ragRetriever.mjs` → `ragRetrieverSemanticSearch.mjs` is one-directional)
  - Left `normalizePresetAttachmentWeight` (2 copies) in place — intentional behavioral divergence (engine normalizes to `1.0`, route helper preserves `NaN` for validation)
- **Near-duplicate structural audit (pass 3)** — scanned `server/src/` with jscpd (Rabin-Karp token matching) + manual AST analysis for near-duplicates (same logic, different variable names). Resolved 4 structural near-duplicates (~50 lines eliminated):
  - `formatVectorString` (6 instances across `embeddingServiceStorage.mjs`, `ragRetrieverSemanticSearch.mjs`, `ragRetrieverSearch.mjs`) → extracted to `utils/embeddingUtils.mjs`
  - `extractToken` (duplicated inline in `apiKeyAuth.mjs`) → reused exported `extractToken` from `auth.mjs` with `/** @public */` tag for Knip production mode
  - "Library not found" 404 response (6 instances across `librariesRouteCrud.mjs`, `librariesRouteArrConfig.mjs`, `librariesRouteRuleAutoGenerate.mjs`, `librariesRouteRuleSuggestSmart.mjs`) → consolidated into `requireRow()` helper from new `routes/routeHelpers.mjs`
  - TMDB integrity warning catch blocks (3 instances in `tmdb.mjs`) → extracted `handleTmdbProviderFailure()` into `tmdbHelpers.mjs`; `tmdb.mjs` no longer imports `metadataProviderIntegrityService` directly
- **Removed orphaned classification evidence telemetry chain** — `classificationEvidenceTelemetryService.mjs` and `classificationEvidenceComparisonService.mjs` were production code with zero production consumers (only imported by their own test files). Deleted both modules and their tests (~330 lines removed). Downstream dependencies (`classificationEvidenceService.mjs`, `classificationEvidenceRepository.mjs`) remain — they have 14+ and 5+ other production importers respectively.

- **Replaced `fileURLToPath`+`dirname` with `import.meta.dirname`** — native ESM property stable since Node.js v21.2.0, project engine >= 24.11.0.
- **Hardened Docker PostgreSQL build** — Alpine pgvector dual-version build without `pg_versions`/`pg_config` symlink warnings.
- **Updated `npm ci --omit=dev`** in Dockerfile — replaced legacy `--only=production` flag.
- **Added repo-level legacy npm CLI flag guard** — `scripts/check-npm-cli-flags.mjs` scanned in CI via `npm run lint`.
- **Hardened manual + scheduled + idle backfill with early provider-readiness guards** — unconfigured systems skip advisory lock acquisition instead of contending uselessly.
- **Fixed `run-jest.mjs` to always spawn Jest with `cwd=serverDir`** — prevents 178 spurious failures when invoked from workspace root.

### Fixed

- **Fixed CI `glob` module resolution failure** — added `glob` as explicit server devDependency (was only in overrides, not resolvable in isolated `npm ci`).
- **Fixed `undici` phantom dependency in `httpClient.mjs`** — promoted from override-only to explicit server dependency; `import { Agent } from 'undici'` requires the npm package per Node.js docs (no `node:undici` prefix exists).
- **Reorganized changelog with monthly archival** — main `CHANGELOG.md` compressed from 1,648 → ~120 lines; older versions archived to `docs/changelog/`.
- **Fixed spurious `same_mode_without_primary_provider` integrity warning** — early-return guard when `primary_provider='none'` on unconfigured systems.
- **Fixed `runtimeLifecycle.test.mjs` timer leak** — mocked `setTimeoutFn` prevents real 10-second timer after Jest completes.
- **Fixed CVE-2026-46625** — override `js-cookie` to >=3.0.7 (prototype hijack in `assign()`).
- **Fixed CVE-2026-8723** — override `qs` to >=6.15.2 (stringify DoS on null/undefined values).
- **Honest preset signal semantics** — `identity` vs `compatibility` signal types prevent niche policies from false-positive matches on broad signals.
- **Restored same-mode provider resolution** on `embeddingProvider` instance — fixed `POST /api/rag/text-models` regression.

## [0.46.4a-beta] - 2026-05-19

### Changed

- Bumped root `axios`, server `express-rate-limit`, server `pg`, client `axios`, client `vue-router`, client `@vitejs/plugin-vue`, client `vite`, client `vue-tsc`, client+server `eslint`, client+server `@types/node`, CI `github/codeql-action`, client `postcss`, Docker base image to `node:24.15.0-alpine3.23`.

### Security

- Forced `ws` to 8.20.1 — resolves CVE-2026-45736 (uninitialized memory disclosure in `websocket.close()`).
- Hash-pinned `actions/upload-artifact` to `v7.0.1` commit in CI workflow.

### Fixed

- **Discord notification drift** surfaces once at startup; repeated skips/failures deduped by state.
- **TMDB config drift** now follows one-warning-per-state pattern with deduped runtime probes.
- **Ollama preflight failures** emit deduped runtime warnings instead of per-poll spam.
- **AI/embedding provider drift** surfaces as one startup warning plus deduped runtime availability/fallback warnings.
