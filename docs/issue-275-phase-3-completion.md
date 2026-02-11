# Issue 275 Phase 3 Completion

Date: 2026-02-11

## Scope
This document closes Phase 3 in `docs/issue-275-task-list.md`:
- bounded second-pass retrieval loop wiring in classification
- deterministic pass-2 helpers (expansion, conflict detection/resolution, strategy selection, comparator)
- policy-first targeted re-check path with measurable adoption gates
- shadow/apply rollout decision semantics with non-invasive shadow behavior
- promotion metrics collection and learning-eligibility guard foundations

## Implemented Components

### 1) Retrieval candidates + deterministic expansion in `ragRetriever`
- Updated `server/src/services/ragRetriever.js`:
  - `semanticSearch(metadata, limit, options)` now supports:
    - threshold filtering toggle (`applyThreshold`)
    - pass-aware query mode (`pass`)
    - expanded pass-2 retrieval text (`useExpandedQuery` + expansion options)
  - Added `semanticSearchCandidates(...)` for unfiltered top-K diagnostics.
  - Added `buildRetrievalText(...)` to compose deterministic pass-2 query text from verifiable metadata.
  - Kept existing thresholded pass-1 behavior unchanged by default.

### 2) Core deterministic helper layer
- Added `server/src/utils/ragLoopHelpers.js`:
  - trigger precedence gate (`shouldTriggerSecondPass`)
  - metadata completeness + enrichment eligibility (`getMetadataCompleteness`, `isMetadataEnrichmentEligible`)
  - deterministic expansion (`expandRetrievalMetadata`)
  - verifiable evidence extraction (`extractVerifiableEvidence`)
  - conflict detection (`detectRagConflict`)
  - retry strategy selector (`selectRetryStrategy`)
  - policy re-check acceptance gate (`evaluatePolicyRecheckGate`)
  - centralized pass comparator (`comparePassResults`)
  - conflict resolver (`resolveConflictDecision`)
  - rollout mode gate (`applyOrShadowDecision`)
  - bounded trace builder with truncation (`buildRagLoopTrace`)
  - learning eligibility guard (`isLearningEligible`)

### 3) Bounded pass-2 orchestration in classification flow
- Updated `server/src/services/classification.js`:
  - Added `getRagLoopConfig()` using Phase 2 normalization contract.
  - Added bounded loop helpers (`resolveRagLoopTimeout`, `withTimeout`, metadata merge/build helpers).
  - Added `evaluateRagLoopSecondPass(...)` orchestrator:
    - policy-first trigger on `prompt_select` when enabled
    - secondary AI low-confidence trigger when policy context is unavailable
    - optional bounded enrichment before pass 2
    - deterministic strategy-driven pass-2 retrieval
    - targeted policy re-check with measurable improvement gates
    - bounded AI rerun gate (max call budget + material improvement requirement)
    - centralized comparator + conflict resolver + rollout decision gate
    - trace generation and attachment
  - Wired orchestrator into both policy-signal and legacy signal AI result paths.
  - Persisted `classification_details.rag_loop_trace` in `logClassification(...)`.
  - Enriched TMDB metadata mapping with `belongs_to_collection`, `production_companies`, and `cast` for pass-2 evidence completeness.

### 4) Promotion metrics collector
- Added `server/src/services/ragLoopMetricsCollector.js`:
  - records shadow/apply samples, would-upgrade/applied counts, error deltas, and latency deltas
  - exposes snapshot and promotion readiness check (`canPromote(...)`)
  - integrated recording from classification pass-2 orchestration

## Validation Evidence

### New tests
- `server/src/__tests__/ragLoopHelpers.test.js`
  - trigger precedence, conflict boundaries, strategy selection, comparator, shadow semantics, expansion/learning guards
- `server/src/__tests__/ragLoopMetricsCollector.test.js`
  - shadow/apply metric accumulation and promotion gate logic
- Updated `server/src/__tests__/ragRetriever.test.js`
  - unfiltered candidate retrieval behavior
  - deterministic expanded pass-2 query composition
- Updated `server/src/__tests__/classification.test.js`
  - shadow non-invasive behavior
  - apply-mode adoption path through policy re-check comparator gates

### Commands executed
- `npm --prefix server run lint:tests` (pass)
- `npm --prefix server test -- ragLoopHelpers.test.js ragLoopMetricsCollector.test.js ragRetriever.test.js classification.test.js` (pass)
- `npm --prefix server test` (pass)
- `npm --prefix client test` (pass)
- `npm --prefix server run test:integration` (pass)

## Phase 3 Status
Phase 3 is complete for Issue 275 core retrieval-loop implementation scope and validated across unit, integration, and regression test suites.
