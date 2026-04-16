# implementation_plan_classification_decomposition.md
# classification.js Decomposition — 6-Phase Extraction Plan

## Context

`server/src/services/classification.js` is the largest remaining singleton in the codebase at **~4,500 lines**. It is the core classification decision pipeline, coordinating metadata enrichment, policy evaluation, RAG second-pass, AI classification, result persistence, and *arr routing. This plan decomposes it into six focused services following the same pattern used for `queueService`, `rag.js`, `settings.js`, command center, and `classificationRetryService`.

## Findings from 4-Agent Analysis

### Structure Summary
The file contains 3 mega-methods plus 5 groupings of helpers:

| Method | Lines | Complexity |
|---|---|---|
| `evaluateRagLoopSecondPass()` | ~987 | ⭐⭐⭐⭐⭐ |
| `runDecisionTree()` | ~799 | ⭐⭐⭐⭐⭐ |
| `routeToArr()` | ~357 | ⭐⭐⭐ |
| `aiClassify()` | ~322 | ⭐⭐⭐⭐ |
| `logClassification()` | ~113 | ⭐⭐⭐ |
| `persistRagLoopStageEvents()` | ~112 | ⭐⭐⭐ |

### Anti-Patterns Identified
1. **No config service** — 18+ direct `db.query()` calls for runtime config with no in-memory caching
2. **AI routing not fully delegated** — `aiClassify()` owns the classify → parse → repair loop; `aiRouter` should own the full contract
3. **Inline `require()` in `logClassification()`** — `ragGraphExtractor` is required inside the method body (late binding)
4. **Fire-and-forget learning writes** — `setImmediate` pattern reinforcement has no error propagation
5. **Duplicate metadata enrichment paths** — Three separate enrichment methods invoked at different phases with no dedup guard
6. **Library rules v2 ownership ambiguous** — Rules evaluated independently in classification.js AND potentially by policyEngine
7. **Confidence threshold logic scattered** — Auto-routing gate is checked in `classify()` not in `runDecisionTree()`
8. **Strategy selection inconsistency** — First-pass uses no strategy selection; second-pass uses `selectRetryStrategy()`

### Test Coverage Gaps (Critical)
| Method | Test Status |
|---|---|
| `classify()` | ❌ NO unit tests |
| `parseOverseerrPayload()` | ❌ NO tests |
| `runDecisionTree()` steps 1–5 | ❌ NOT TESTED |
| `routeToArr()` | ❌ NO tests |
| `aiClassify()` isolated | ❌ Only mocked in route tests |
| `enrichWithTMDB()` | ❌ NO tests |
| `enrichWithWebSearch()` | ❌ NO tests |
| `checkLearnedCorrections()` | ❌ NO tests |
| `evaluateRagLoopSecondPass()` | ✅ 80+ tests (Issue #275) |
| `withTimeout()`, `mergeMetadataForRecheck()` | ✅ Covered |

---

## Proposed Services (6 Extractions)

### 1. `classificationMetadataService.js` — PHASE 1 (SAFEST)
**Single Responsibility:** Metadata gathering, enrichment, parsing, and merging.

**Functions to extract (~250 lines):**
- `parseOverseerrPayload(payload)` — normalize Overseerr / Plex gap / legacy formats
- `enrichWithTMDB(tmdbId, mediaType)` — full TMDB detail + certifications fetch
- `enrichWithWebSearch(metadata)` — Tavily IMDB, content advisory, anime enrichment
- `mergeMetadataForRecheck(originalMetadata, enrichedMetadata)` — intelligent merge (keeps longer, more items)
- `mightBeAnime(metadata)` — keyword/language/genre anime detector
- `detectEventTypesFromMetadata(metadata)` — holiday/sports/PPV/concert/standup/awards detection

**Why first:** Zero internal classification dependencies. Only external I/O (TMDB, Tavily). 100% testable with fixtures. Smallest blast radius.

**Tests to add:**
- `parseOverseerrPayload` — all 3 payload format variants, null title fallback, JSON-string `requested_seasons`, TVDB/itemId extraction
- `enrichWithTMDB` — movie vs. TV, certification extraction, missing credits fallback
- `enrichWithWebSearch` — IMDB path, anime detection path, 432 quota error handling

---

### 2. `classificationUtilsService.js` — PHASE 2 (PURE UTILITIES)
**Single Responsibility:** Error handling, timeouts, retry logic, and diagnostics.

**Functions to extract (~200 lines):**
- `withTimeout(operationOrPromise, timeoutMs, message)`
- `withRetryableDbConflict(operation, options)`
- `isAiTransientAvailabilityError(error)`
- `sleep(ms)`
- `resolveRagLoopTimeout(config)`
- `buildParseDiagnostics({mode, attemptCount, failureReason, ...})`
- `buildPendingRetryResult({confidence, libraries, ...})`
- `resolveRetryReason(error)`

**Why second:** Pure utility functions. No classification domain dependencies. Can immediately be reused by other services.

**Tests to add:**
- `withRetryableDbConflict` — backoff timing, max-retries exhaustion, non-retryable error passthrough
- `isAiTransientAvailabilityError` — network timeout, rate limit codes, non-transient errors
- `buildPendingRetryResult` — all field combinations, transient vs. hard error

---

### 3. `classificationRoutingService.js` — PHASE 3 (CLEANEST SEAM)
**Single Responsibility:** Route accepted items to Radarr or Sonarr.

**Functions to extract (~350 lines):**
- `routeToArr(metadata, library)` — full Radarr/Sonarr add flow
- `resolveRoutingConfig(library)` — merge library with arr_mappings
- `resolveDefaultQualityProfile(arrType, baseUrl, apiKey)`
- `resolveDefaultRootFolder(arrType, baseUrl, apiKey)`
- `normalizeSettings(settings)`
- `normalizeQualityProfileId(value)`
- `isSettingsEmpty(settings)`
- `suggestSeriesType(metadata, appliedLabels)`

**Why third:** Completely orthogonal to decision logic. Routing always happens after classification is decided. No back-references. Testable against mock Radarr/Sonarr HTTP clients.

**Tests to add:**
- `routeToArr` — Radarr path, Sonarr path, TVDB ID resolution, existing media pre-check, race condition post-check, network error handling
- `resolveRoutingConfig` — missing arr_mapping fallback, settings merge priority

---

### 4. `classificationAiService.js` — PHASE 4 (HIGHEST ROI)
**Single Responsibility:** AI interaction — prompt building, LLM calls, response parsing, repairs.

**Functions to extract (~400 lines):**
- `aiClassify(metadata, libraries, signalContext, options)`
- `buildAiRepairPrompt({response, libraries, signalContext, mode})`
- `attemptAiResponseRepair({response, libraries, signalContext, mode, model, temperature})`
- `normalizeAiResponseLine(value)`

**Anti-pattern fix:** Move the full classify → parse → repair contract into this service so `aiRouter` is properly delegating. Remove the inline parse/repair logic from the parent class.

**Why fourth:** Highest testability gain — prompt building and response parsing are deterministic. LLM interactions are the most fragile (network, model drift, rate limits) and most in need of isolation.

**Tests to add:**
- `aiClassify` — Ollama path, remote provider path, provider lock acquisition
- `aiClassify` verify mode vs classify mode
- `attemptAiResponseRepair` — bad response → repair → success; repair also fails → fallback
- `normalizeAiResponseLine` — whitespace trimming, multiline truncation

---

### 5. `classificationPersistenceService.js` — PHASE 5
**Single Responsibility:** Persist classification outcomes to the database.

**Functions to extract (~350 lines):**
- `logClassification(metadata, result, startTime)` — INSERT to `classification_history`
- `persistRagLoopStageEvents(classificationId, metadata, result)` — INSERT to `rag_loop_stage_events`
- `rebindRetryLineage(classificationId, metadata)` — link retry to upstream records
- `deriveClassificationPersistenceState(result)` — determine status / pendingReason
- `ensureDecisionQuestion({metadata, result, policyResult, ...})` — build clarification if needed
- `normalizePolicyQuestion(value)` — parse + stamp policy question before persist
- `retryClassification(classificationId)` — wrapper for classificationRetryService

**Anti-pattern fix:** Remove the inline `require('./ragGraphExtractor')` from `logClassification()` — move to top-level import.

**Tests to add:**
- `logClassification` — field mapping to DB columns, classification_id return, embedding async path
- `deriveClassificationPersistenceState` — all status variants (completed, awaiting_decision, pending_retry)
- `ensureDecisionQuestion` — low-confidence trigger, policy-based trigger, already-has-question guard

---

### 6. `classificationRagLoopService.js` — PHASE 6 (HIGHEST COMPLEXITY)
**Single Responsibility:** Second-pass RAG retrieval, conflict detection, and rollout automation.

**Functions to extract (~900 lines):**
- `evaluateRagLoopSecondPass(metadata, libraries, baselineResult, policyResult, signalContext, ragContext)`
- `maybeApplyRolloutAutomation({config, decision, correlationId, sampleRecorded})`
- `persistAutoFallbackBreachCount({nextBreachCount, breachDetected})`
- `buildAutoFallbackIncidentPayload({incidentId, ...})`
- `getRecentFallbackDiagnostics(limit)`
- `buildRagLoopSummary(result)`
- `buildFreshSecondPassBaseResult(baselineResult)`
- `buildPolicyRecheckCandidate({baselineResult, libraries, policyResult, ...})`
- `buildAiRerunCandidate({baselineResult, aiRerunMatch, ...})`

**Why last:** Most complex (987 lines, 10+ nested sub-stages). Existing test coverage is already high (80+ tests for Issue #275). Requires careful dependency injection to avoid circular refs: RAG loop calls `aiClassify` and `policyEngine.evaluateItem()` — pass both as injected functions rather than importing classification.js back.

**Tests to add:**
- Gate decisions at each sub-stage (config disabled, rollout_mode = shadow / apply)
- Breach counter persistence (increment, ceiling logic)
- Rollout automation transitions (apply → shadow → fallback)

---

## What Remains in `classification.js` (Facade Orchestrator)

After all 6 phases, `classification.js` retains only orchestration and decision logic:
- `classify(overseerrPayload)` — public entry point, pipeline coordinator
- `runDecisionTree(metadata, mediaType, taskId)` — master decision logic tree
- `checkExactMatch()`, `checkLearnedCorrections()`, `checkLibraryRules()` — early-exit checks
- `matchRules()`, `metadataMatchesLabel()`, `evaluateCustomRule()`, `evaluateSingleCondition()` — rule scoring helpers (decision signals called by `runDecisionTree`)
- Lightweight config getters: `getTavilyConfig()`, `isRealtimeEmbeddingEnabled()`, `getRagLoopConfig()`, `getCurrentAppVersion()`, `getCurrentImageTag()`

**Target size after decomposition: ~800–1,000 lines** (down from ~4,500).

---

## Dependency Injection Pattern (Avoid Circular Refs)

Each extracted service should **accept inputs as arguments** and **return result structs**. They must NOT import `classification.js`. For methods that call other extracted services (e.g., RAG loop calling `aiClassify`):

```javascript
// Instead of importing classification.js:
const result = await classificationAiService.aiClassify(metadata, libraries, ...);

// Pass as dependency:
async evaluateRagLoopSecondPass({ metadata, libraries, ..., aiClassifyFn }) {
  const aiResult = await aiClassifyFn(metadata, libraries, ...);
}
```

---

## Extraction Order & Risk

| Phase | Service | Size | Risk | Notes |
|---|---|---|---|---|
| 1 | `classificationMetadataService` | ~250 lines | **LOW** | No internal deps; start here |
| 2 | `classificationUtilsService` | ~200 lines | **LOW** | Pure utilities; reusable immediately |
| 3 | `classificationRoutingService` | ~350 lines | **LOW** | Orthogonal to decision logic |
| 4 | `classificationAiService` | ~400 lines | **MEDIUM** | LLM calls; needs mock isolation |
| 5 | `classificationPersistenceService` | ~350 lines | **MEDIUM** | DB writes; test with rollback |
| 6 | `classificationRagLoopService` | ~900 lines | **HIGH** | Needs DI for aiClassify + policyEngine |

---

## Progress

- [x] Phase 1 — classificationMetadataService
- [x] Phase 2 — classificationUtilsService
- [x] Phase 3 — classificationRoutingService
- [ ] Phase 4 — classificationAiService
- [ ] Phase 5 — classificationPersistenceService
- [ ] Phase 6 — classificationRagLoopService
