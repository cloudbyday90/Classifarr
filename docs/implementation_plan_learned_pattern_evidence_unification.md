# Implementation Plan: Learned Pattern and Evidence Unification

**Status:** Phase 7 Complete — compatibility window in effect; legacy tables retained pending production observability review  
**Date:** 2026-04-04  
**Scope:** Classification runtime, policy scoring, learning/reinforcement, operator visibility, and downstream method semantics

---

## 1. Problem Statement

Classifarr currently has more than one "pattern learning" system, and they do not behave the same way.

Today:

1. `learning_patterns` stores older correction-memory artifacts such as `exact_match` and `genre_pattern`
2. `discovered_patterns` stores newer mined/reinforced pattern artifacts such as `studio`, `franchise`, `genre`, and `certification`
3. Feedback/profile learning also influences classification behavior through separate services and scoring paths

This creates an inconsistent operator and runtime model for "similar or related item confidence":

- some learned evidence can bypass AI entirely
- some learned evidence only contributes as a weighted policy sub-score
- some learned evidence is visible to operators
- some learned evidence is not
- some learned evidence is reinforced across multiple user-confirmation flows
- some learned evidence is only written from one narrow path

The result is architectural drift, duplicated behavior, and confidence semantics that are hard to reason about or evolve safely.

---

## 2. Current State

### 2.1 Active Runtime Paths

#### `learning_patterns`

Primary reads:
- [classification.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classification.js)
  - `checkExactMatch(...)`
  - `checkLearnedPatterns(metadata)`

Current behavior:
- `exact_match` is treated as authoritative and returns immediately
- `genre_pattern` can also return early as `method: 'learned_pattern'` when confidence is `>= 80`
- the legacy signal path also feeds learned patterns into the old signal/calculator stack at a much lower weight

Primary writes:
- [clarificationService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/clarificationService.js)
  - writes `exact_match`
  - writes and increments `genre_pattern`
- [classification.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/routes/classification.js)
  - writes `exact_match` on correction flows
- [discordBot.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/discordBot.js)
  - writes `exact_match`
- [queueAdminService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/queueAdminService.js)
  - writes `exact_match`

Current limitations:
- `checkLearnedPatterns()` currently only queries `genre_pattern`
- `genre_pattern` is only written from policy-question resolution
- retry purge only removes `exact_match`, not broader related evidence

#### `discovered_patterns`

Primary reads and scoring:
- [patternSignalCollector.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/patternSignalCollector.js)
- [policyEngine.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyEngine.js)

Primary writes and reinforcement:
- [patternMiningService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/patternMiningService.js)
- [patternReinforcementService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/patternReinforcementService.js)
- [feedbackAnalysis.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/feedbackAnalysis.js)
- [prompts.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/routes/prompts.js)

Operator/API surface:
- [patterns.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/routes/patterns.js)

Current behavior:
- contributes only as the `pattern` component inside policy scoring
- does not bypass the modern policy path
- has its own reinforcement and decay lifecycle through `pattern_match_log`

Current limitations:
- separate lifecycle from `learning_patterns`
- separate trust semantics from `learning_patterns`
- migration history says it is deprecated in favor of profiles, but runtime code still depends on it

### 2.2 Current Confidence and AI-Skip Semantics

- `exact_match` is authoritative
- `learned_pattern` can still bypass both PolicyEngine and the main confidence calculator
- `discovered_patterns` only affects the `pattern` score inside PolicyEngine
- the legacy signal path still injects `learned_pattern` into [confidenceCalculator.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/confidenceCalculator.js) at low weight

This means related-item learning currently has two incompatible meanings:

- authoritative shortcut (`learning_patterns`)
- weighted supporting signal (`discovered_patterns`)

### 2.3 Downstream Method Semantics

Client and reporting surfaces currently expose `learned_pattern` as a distinct classification method:

- [History.vue](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/History.vue)
- [Activity.vue](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/Activity.vue)
- [Dashboard.vue](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/Dashboard.vue)
- [ClassificationStats.vue](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/statistics/ClassificationStats.vue)

However, in practice this method currently means "matched a learned genre pattern," not a broader learned-similarity concept.

### 2.4 Current AI, RAG, and Policy-Question Interactions

The current system does not use learned evidence as one coherent cross-cutting input.

#### AI analysis

Primary runtime surfaces:
- [classification.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classification.js)
- [aiPromptBuilder.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/aiPromptBuilder.js)
- [aiResponseParser.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/aiResponseParser.js)
- [contextManager.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/contextManager.js)

Current behavior:
- high-confidence `learned_pattern` results bypass the AI path entirely
- AI only sees learned evidence indirectly when it has already been summarized into `signalContext`
- AI does not currently receive first-class evidence rows, provenance, or scope-level explanations

Implication:
- learned evidence is currently more likely to suppress AI than to inform AI

#### RAG

Primary runtime surfaces:
- [classification.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classification.js)
- [policyEngine.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyEngine.js)
- RAG retrieval helpers and diagnostics routes

Current behavior:
- `ragContext` is built from embedding similarity matches, not from `learning_patterns`
- `discovered_patterns` also do not directly populate RAG retrieval; they are a separate scoring surface
- RAG diagnostics can show `discovered_patterns`, but that is for operator inspection rather than runtime retrieval

Implication:
- learned evidence and RAG are currently parallel systems, not a shared evidence graph

#### Policy questions and operator review

Primary runtime surfaces:
- [policyQuestionBuilder.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyQuestionBuilder.js)
- [clarificationService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/clarificationService.js)

Current behavior:
- policy questions can be generated using policy result context, AI context, and RAG summaries
- policy-question resolution writes human-confirmed learning back into `learning_patterns`
- the question builder does not yet explain evidence provenance as a unified model

Implication:
- policy questions are one of the best human-confirmed evidence sources, but the runtime does not expose that evidence consistently upstream

### 2.5 Current Fragmentation Summary

Today, the three most important confidence-support systems are still separated:

- `learning_patterns`
  - exact memory
  - genre-only learned shortcut
- `discovered_patterns`
  - mined pattern support for PolicyEngine
- `ragContext`
  - semantic similarity support for policy, AI, and operator review

The unification plan should explicitly decide which of these become:

- authoritative memory
- scored related evidence
- retrieval-only similarity context
- operator-only diagnostics

---

## 3. Goals

- Create one coherent evidence model for exact-match and related-item learning
- Keep `exact_match` as the only hard-bypass path
- Turn "similar or related item confidence" into one scored signal family
- Standardize evidence writes across confirmation/correction flows
- Standardize purge/reset semantics
- Improve operator visibility into evidence quality and provenance
- Preserve current behavior during migration through compatibility phases

---

## 4. Non-Goals

- Rewriting the full PolicyEngine in the first phase
- Removing library profiles or RAG scoring
- Changing manual review UX in the same initial rollout
- Performing a big-bang schema cutover without a compatibility window
- Promoting AI-only outcomes to authoritative learned memory

---

## 5. Design Principles

1. **Exact match remains special**
   - Only exact, human-confirmed evidence should be allowed to bypass the scored classification flow.

2. **Related evidence is scored, not authoritative**
   - Genre, studio, franchise, certification, and similar-item evidence should improve confidence but should not act as hidden hard overrides.

3. **Provenance matters**
   - Human-confirmed evidence and mined/AI-only evidence must not share the same trust semantics.

4. **One scoring path for related evidence**
   - Related-item learning must not be applied twice through separate shortcut and weighting paths.

5. **Compatibility before deletion**
   - New schema and services should coexist with old storage until parity and observability are proven.

---

## 6. Target Architecture

### 6.1 New Shared Evidence Layer

Introduce a new canonical service boundary:

- `classificationEvidenceService`

Responsibilities:
- exact-match lookup
- related-evidence lookup
- evidence upsert
- reinforcement/decay
- purge/reset
- backfill compatibility reads

### 6.1A Component Strategy

This implementation should follow the same decomposition patterns used in recent releases instead of adding more behavior to existing monoliths.

Recent examples worth copying:

- state extraction from large orchestrators:
  - [classificationRetryStateService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classificationRetryStateService.js)
  - [classificationRetryFollowupService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classificationRetryFollowupService.js)
- policy/presentation helper extraction:
  - [ragStatusPresentation.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/routes/helpers/ragStatusPresentation.js)
  - [ragModelMetadataPolicy.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/routes/helpers/ragModelMetadataPolicy.js)
- client shell/action decomposition:
  - [useCommandCenterOperations.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/composables/useCommandCenterOperations.js)
  - [useCommandCenterShell.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/composables/useCommandCenterShell.js)
  - [ProcessingPanel.vue](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/components/command-center/ProcessingPanel.vue)
- normalized API boundary work:
  - [core.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/api/core.js)
  - the extracted domain API modules under [client/src/api](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/api)

The same rule should apply here:

- keep orchestrators thin
- separate read-models from write/update logic
- normalize DTOs at boundaries
- isolate compatibility mapping in dedicated adapters
- keep operator/admin views on top of purpose-built API/read models

### 6.1B Components To Reuse or Extend

The following existing components should be extended rather than bypassed:

#### Runtime scoring/orchestration

- [policyEngine.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyEngine.js)
  - keep as the top-level scoring/orchestration entrypoint
  - do not add more direct storage logic to it
- [patternSignalCollector.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/patternSignalCollector.js)
  - likely becomes a compatibility adapter for mined/pattern-derived candidate signals
- [classification.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classification.js)
  - keep as the top-level runtime orchestrator, but route learned-evidence logic through a dedicated service

#### Write-path confirmation flows

- [clarificationService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/clarificationService.js)
  - canonical rich confirmation flow
- [classification.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/routes/classification.js)
- [discordBot.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/discordBot.js)
- [queueAdminService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/queueAdminService.js)
  - all should become thin callers into shared evidence-writing components

#### Retry / reset / backup compatibility

- [classificationRetryService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classificationRetryService.js)
- [backupService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/backupService.js)
- [queueCarsaService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/queueCarsaService.js)
  - must be updated as first-class evidence lifecycle participants, not afterthoughts

#### Operator/reporting surfaces

- [History.vue](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/History.vue)
- [Activity.vue](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/Activity.vue)
- [Dashboard.vue](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/Dashboard.vue)
- [ClassificationStats.vue](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/statistics/ClassificationStats.vue)
- [patterns.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/routes/patterns.js)
  - these should consume a compatibility/read-model layer rather than raw table semantics

### 6.1C New Server Components To Build

The following components should be added as distinct modules. This is the core build list.

#### 1. `classificationEvidenceService`

Role:
- top-level façade for exact and related evidence

Responsibilities:
- read exact memory
- collect related evidence
- dispatch write/reinforcement/purge operations to narrower collaborators
- hide compatibility reads from legacy tables during rollout

Why separate:
- mirrors the recent pattern where one orchestration service delegates to narrower state/followup helpers

#### 2. `classificationEvidenceRepository`

Role:
- low-level storage adapter for `classification_evidence`

Responsibilities:
- CRUD and query helpers
- canonical key construction helpers
- backfill-safe reads

Why separate:
- keeps SQL out of orchestration services
- makes dual-read/dual-write behavior testable without forcing it into `classificationEvidenceService`

#### 3. `classificationEvidenceKeyBuilder`

Role:
- canonical evidence-key normalization

Responsibilities:
- normalize genre, studio, franchise, certification, and exact keys
- centralize the genre-key fix currently split between mining and collection paths

Example:

```javascript
buildGenreKey(['Documentary', 'Nature']);
// => 'genre:documentary|nature'
```

Why separate:
- key-shape drift is one of the current failure modes
- this should not be duplicated across migration scripts, miners, collectors, and writers

#### 4. `classificationEvidenceWriteService`

Role:
- handles confirmed writes from human-facing flows

Responsibilities:
- upsert exact evidence
- upsert related evidence
- apply provenance rules
- serve as the only shared write boundary for:
  - [clarificationService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/clarificationService.js)
  - [classification.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/routes/classification.js)
  - [discordBot.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/discordBot.js)
  - [queueAdminService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/queueAdminService.js)

Why separate:
- prevents the current multi-writer drift where the same user intent creates different memory shapes

#### 5. `classificationEvidenceReinforcementService`

Role:
- unify reinforcement and decay semantics

Responsibilities:
- strengthen matching evidence after confirmed outcomes
- decay conflicting evidence
- update usage/success metrics

Why separate:
- same pattern as [classificationRetryStateService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classificationRetryStateService.js): keep orchestration thin and state mutation centralized

#### 6. `classificationEvidenceLifecycleService`

Role:
- scope-aware purge/reset/restore lifecycle logic

Responsibilities:
- retry purge
- relearn purge
- reset tooling
- restore merge/dedupe behavior

Primary callers:
- [classificationRetryService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classificationRetryService.js)
- [backupService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/backupService.js)
- [queueCarsaService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/queueCarsaService.js)

Why separate:
- lifecycle semantics are currently inconsistent and should not be sprinkled across unrelated services

#### 7. `policyDecisionBuilder`

Role:
- normalize PolicyEngine outputs into one stable DTO

Responsibilities:
- produce the stable top-level result shape
- attach `topCandidate`, `scores`, `weights`, `breakdown`, `thresholds`, and `debug`
- shield downstream consumers from action-specific shape drift

Why separate:
- follows the same “presentation/policy extraction” pattern used in the RAG helper refactors

#### 8. `policyScoringContextBuilder`

Role:
- shared assembly of policy scoring inputs

Responsibilities:
- build shared context such as:
  - pre-fetched RAG cache
  - related evidence summary
  - optional profile cache later
- make `evaluateItem()` in [policyEngine.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyEngine.js) smaller and more testable

Why separate:
- current `evaluateItem()` is overloaded with orchestration and scoring concerns

#### 9. `relatedEvidenceScorer`

Role:
- aggregate unified related evidence into one policy score family

Responsibilities:
- convert evidence rows into:
  - per-library score
  - support count
  - top components
  - debug payload

Why separate:
- the current `pattern` slot is too narrow and lossy
- this scorer becomes the main bridge from unified evidence into PolicyEngine

#### 10. `minedPatternCandidateService`

Role:
- preserve mined/discovered pattern generation as candidate generation, not runtime truth

Responsibilities:
- receive inputs from:
  - [patternMiningService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/patternMiningService.js)
  - [feedbackAnalysis.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/feedbackAnalysis.js)
- create or update candidate evidence records or promotion requests

Why separate:
- keeps “candidate generation” apart from “promoted runtime scoring”

#### 11. `evidenceCompatibilityMapper`

Role:
- compatibility adapter for legacy methods and analytics

Responsibilities:
- map unified evidence outcomes back to:
  - legacy `method` values where needed
  - compatibility stats categories
  - cost-savings groupings

Why separate:
- avoids scattering compatibility logic across routes, Discord, stats, and client views

#### 12. `evidenceHistoryReadModel`

Role:
- specialized read model for history/activity/dashboard/stats

Responsibilities:
- produce stable evidence metadata for operator/reporting surfaces
- attach:
  - `winningEvidence`
  - `authoritativeEvidence`
  - `relatedEvidenceSummary`
  - compatibility `methodLabel`

Why separate:
- follows the read-model pattern we have been using in recent backend refactors

### 6.1D New Route and Admin Components To Build

#### 1. `evidence` route surface

Recommended route:
- `server/src/routes/evidence.js`

Purpose:
- dedicated operator/admin surface for unified evidence

Why new route instead of overloading [patterns.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/routes/patterns.js) immediately:
- `patterns.js` is currently coupled to mined/discovered pattern admin semantics
- unified evidence includes exact memory, related evidence, candidate evidence, and lifecycle actions

Suggested endpoints:
- `GET /evidence/summary`
- `GET /evidence`
- `GET /evidence/:id`
- `POST /evidence/:id/decay`
- `POST /evidence/:id/promote`
- `POST /evidence/purge`

#### 2. `evidenceDiagnosticsService`

Role:
- operator/debug read model

Responsibilities:
- compare:
  - PolicyEngine
  - related evidence
  - RAG
  - history
- explain agreement/disagreement

Why separate:
- diagnostics should not be coupled to runtime-scoring classes

### 6.1E New Client Components To Build

These should follow the same component/composable split used in the Command Center refactor.

#### 1. Unified evidence admin screen

Suggested new view:
- `client/src/views/Evidence.vue`

Supporting components:
- `client/src/components/evidence/EvidenceSummaryPanel.vue`
- `client/src/components/evidence/EvidenceTable.vue`
- `client/src/components/evidence/EvidenceDetailDrawer.vue`

Supporting composables:
- `client/src/composables/useEvidenceData.js`
- `client/src/composables/useEvidenceActions.js`
- `client/src/composables/useEvidenceFilters.js`

Why this shape:
- mirrors the recent extraction pattern where state, actions, and presentation are intentionally separated

#### 2. History evidence detail panel

Suggested component:
- `client/src/components/history/HistoryEvidencePanel.vue`

Purpose:
- show evidence metadata without forcing [History.vue](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/History.vue) to absorb more logic

#### 3. Method/evidence compatibility mapper

Suggested utility/composable:
- `client/src/utils/evidenceMethodLabels.js`

Purpose:
- centralize method-label compatibility for:
  - [History.vue](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/History.vue)
  - [Activity.vue](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/Activity.vue)
  - [Dashboard.vue](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/Dashboard.vue)
  - [ClassificationStats.vue](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/statistics/ClassificationStats.vue)

### 6.1F Component Build Order

To stay robust, the build should happen in layers.

#### Foundation layer

Build first:
- `classificationEvidenceRepository`
- `classificationEvidenceKeyBuilder`
- `classificationEvidenceService`
- `classificationEvidenceWriteService`

#### Lifecycle and compatibility layer

Build second:
- `classificationEvidenceLifecycleService`
- `evidenceCompatibilityMapper`
- `evidenceHistoryReadModel`

#### Policy integration layer

Build third:
- `policyDecisionBuilder`
- `policyScoringContextBuilder`
- `relatedEvidenceScorer`

#### Operator/admin layer

Build fourth:
- `server/src/routes/evidence.js`
- `evidenceDiagnosticsService`
- `Evidence.vue` and its composables/components

### 6.1G Components We Should Explicitly Avoid Building

To keep the system robust, avoid these anti-patterns:

- a giant `classificationEvidenceManager` that owns storage, scoring, reinforcement, compatibility, and UI payloads
- a direct `PolicyEngine` rewrite that combines evidence unification and score-model redesign in one step
- a generic “migration helper” module that also becomes runtime logic
- reusing [patterns.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/routes/patterns.js) as the long-term unified evidence admin route without first decoupling it from discovered-pattern CRUD semantics

### 6.2 Proposed Canonical Table

Introduce a new table:

- `classification_evidence`

Suggested columns:

- `id`
- `scope`
- `media_type`
- `library_id`
- `tmdb_id` nullable
- `evidence_key`
- `evidence_data jsonb`
- `provenance`
- `confidence`
- `usage_count`
- `success_rate`
- `status`
- `created_by`
- `created_at`
- `updated_at`
- `last_seen_at`
- optional `source_classification_id`
- optional `source_system`

#### Example DDL Shape

Illustrative shape only; exact column types and indexes can be finalized in Phase 1:

```sql
CREATE TABLE classification_evidence (
  id SERIAL PRIMARY KEY,
  scope VARCHAR(50) NOT NULL,
  media_type VARCHAR(20),
  library_id INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  tmdb_id BIGINT,
  evidence_key TEXT NOT NULL,
  evidence_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance VARCHAR(50) NOT NULL,
  confidence NUMERIC(5,2) NOT NULL DEFAULT 0,
  usage_count INTEGER NOT NULL DEFAULT 0,
  success_rate NUMERIC(5,2),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_by VARCHAR(100),
  source_classification_id INTEGER,
  source_system VARCHAR(50),
  last_seen_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

#### Example Uniqueness Rules

The table should support scope-specific uniqueness so we do not recreate the ambiguity of the legacy tables:

```sql
-- Exact item memory
UNIQUE (scope, tmdb_id, media_type)
WHERE scope = 'item_exact';

-- Related evidence
UNIQUE (scope, media_type, library_id, evidence_key)
WHERE scope IN ('genre', 'studio', 'franchise', 'certification');
```

### 6.3 Scope Values

Recommended scopes:

- `item_exact`
- `genre`
- `studio`
- `franchise`
- `certification`
- `profile_affinity`

Additional scopes can be added later if they reflect real runtime evidence rather than implementation detail.

### 6.4 Provenance Values

Recommended provenance:

- `human_confirmed`
- `policy_confirmed`
- `discord_confirmed`
- `retry_confirmed`
- `manual_correction`
- `mined`
- `ai_only`

### 6.5 Trust Semantics

- `scope = item_exact` + human-confirmed provenance:
  - authoritative
  - may bypass AI

- all other scopes:
  - scored evidence only
  - never authoritative by themselves

- `mined` and `ai_only`:
  - must stay non-authoritative
  - may graduate in confidence only after later human-confirmed reinforcement

### 6.6 Example Evidence Rows

#### Exact Human-Confirmed Memory

```json
{
  "scope": "item_exact",
  "media_type": "movie",
  "library_id": 58,
  "tmdb_id": 550,
  "evidence_key": "tmdb:550",
  "evidence_data": {
    "title": "Fight Club",
    "resolved_from": "policy_question"
  },
  "provenance": "policy_confirmed",
  "confidence": 100,
  "usage_count": 1,
  "success_rate": 100,
  "status": "active"
}
```

#### Related Genre Evidence

```json
{
  "scope": "genre",
  "media_type": "movie",
  "library_id": 58,
  "evidence_key": "genre:documentary",
  "evidence_data": {
    "genre": "documentary"
  },
  "provenance": "human_confirmed",
  "confidence": 84,
  "usage_count": 6,
  "success_rate": 91,
  "status": "active"
}
```

#### Mined Studio Evidence

```json
{
  "scope": "studio",
  "media_type": "movie",
  "library_id": 12,
  "evidence_key": "studio:a24",
  "evidence_data": {
    "studio": "A24",
    "sample_size": 14
  },
  "provenance": "mined",
  "confidence": 72,
  "usage_count": 14,
  "success_rate": 78,
  "status": "candidate"
}
```

---

## 7. Runtime Model After Unification

### 7.1 Classification Entry Flow

Target flow in [classification.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classification.js):

1. Source library / existing media checks
2. Exact evidence lookup
   - authoritative exact match may return immediately
3. PolicyEngine evaluation
4. Related evidence contributes as one scored signal family inside PolicyEngine
5. AI / RAG / review flow continues based on scored result

### 7.2 What Changes

Current:
- `genre_pattern` may early-return as `learned_pattern`

Target:
- related evidence never early-returns
- it feeds one scored path
- history and UI can still show that related evidence materially improved confidence, but not as a hidden bypass

### 7.3 Method Semantics

Recommended future method labeling:

- `exact_match`
- `policy_auto`
- `policy_supported_by_related_evidence`
- `ai_verified`
- `manual_classification`

The existing `learned_pattern` label should be retired after compatibility and migration are complete.

### 7.4 Example Before / After Runtime Behavior

#### Scenario A: Today

Input:
- movie
- genres: `["Documentary"]`
- no exact match
- `learning_patterns.genre_pattern` exists with confidence `85`

Current outcome:
- [classification.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classification.js) returns early
- method becomes `learned_pattern`
- PolicyEngine and its `pattern/profile/rag/history` balancing are bypassed

#### Scenario A: Target

Input:
- same metadata

Target outcome:
- exact lookup misses
- related evidence service returns a `genre` evidence signal for the candidate library
- PolicyEngine incorporates that evidence into one scored path
- item may still auto-classify if the total scored result is high enough, but not because related evidence secretly bypassed the system

#### Scenario B: Exact Human-Confirmed Match

Input:
- `tmdb_id = 550`
- `item_exact` evidence exists with confirmed provenance

Target outcome:
- exact lookup remains authoritative
- item returns immediately as `exact_match`
- no AI or policy scoring required

#### Scenario C: Mined Similarity Without Human Confirmation

Input:
- studio `A24`
- mined `studio:a24` evidence exists with confidence `72`

Target outcome:
- contributes as related evidence only
- cannot bypass AI
- can help the item cross a policy threshold only in combination with other signals

### 7.5 Proposed Scoring Contract

Related evidence should enter PolicyEngine as one composed evidence family, with an explainable breakdown:

```json
{
  "relatedEvidence": {
    "score": 68,
    "topLibraryId": 58,
    "components": [
      { "scope": "genre", "key": "genre:documentary", "confidence": 84, "weight": 0.45 },
      { "scope": "studio", "key": "studio:neon", "confidence": 61, "weight": 0.20 },
      { "scope": "franchise", "key": "franchise:planet-earth", "confidence": 79, "weight": 0.35 }
    ]
  }
}
```

That keeps the scoring explainable in history and diagnostics without creating another hidden shortcut path.

### 7.5A PolicyEngine Hardening Requirements

Before unified evidence is allowed to expand policy scoring, [policyEngine.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyEngine.js) needs to be treated as a dependency that must be hardened, not just reused.

Current fragility observed in the codebase:

- [policyEngine.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyEngine.js) mixes:
  - policy loading
  - media-type filtering
  - RAG prefetch
  - per-policy scoring
  - strict language exclusion
  - ranking
  - final action selection
- PolicyEngine result shapes are not uniform across actions
- score semantics differ between [policyEngine.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyEngine.js) and [formulaEngine.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/formulaEngine.js)
- some config semantics are currently unsafe:
  - explicit `0` can fall back to defaults in the legacy formula path
  - `rag_weight = 0` can still trigger RAG prefetch logic
- pattern scoring currently collapses rich signals into a single top-confidence value

Implication:
- unified evidence should not be added as "just another score channel" until the engine contract is more explicit

### 7.5B Current PolicyEngine Fragility Findings

#### 1. Contract inconsistency by action

Current issue:
- `auto_classify` and `prompt_confirm` often carry top-level `library`, `scores`, `weights`, and `breakdown`
- `prompt_select` and `manual` lean more heavily on `ranked` and may omit top-level values

Why this matters:
- [classification.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classification.js)
- [policyQuestionBuilder.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyQuestionBuilder.js)
- [discordBot.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/discordBot.js)

all assume slightly different shapes.

#### Example: current shape drift

```json
{
  "action": "auto_classify",
  "library": { "library_id": 58, "library_name": "Documentaries" },
  "confidence": 87,
  "scores": { "preset": 82, "profile": 66, "pattern": 71, "rag": 18, "history": 25 },
  "weights": { "preset": 0.35, "profile": 0.25, "pattern": 0.15, "rag": 0.15, "history": 0.10 },
  "breakdown": [...]
}
```

```json
{
  "action": "prompt_select",
  "confidence": 64,
  "ranked": [
    {
      "library_id": 58,
      "library_name": "Documentaries",
      "score": 64,
      "scores": { "preset": 82, "profile": 66, "pattern": 71, "rag": 18, "history": 25 },
      "weights": { "preset": 0.35, "profile": 0.25, "pattern": 0.15, "rag": 0.15, "history": 0.10 }
    }
  ]
}
```

Even when the ranked row is rich, downstream code may only inspect top-level fields and silently lose the detail.

#### 2. Exclusion logic is split

Current issue:
- strict language conflict is partly handled during preset evaluation
- additional conflict exclusion happens later during policy evaluation/ranking

Why this matters:
- a policy may appear to "score zero"
- or may be filtered after it scored non-zero
- the debug story is harder than it needs to be

#### 3. Silent error collapse

Current issue:
- many scoring functions resolve to `0` on failure
- `0` currently means any of:
  - no evidence
  - neutral evidence
  - disabled evidence
  - collector/service error

Why this matters:
- diagnostics are weakened
- parity testing becomes noisy
- future unified evidence rollouts can hide real regressions behind apparently valid `0` scores

#### 4. Lossy pattern and support semantics

Current issue:
- pattern scoring currently uses the top matching pattern confidence only
- support count, scope diversity, and provenance are discarded before they reach the final policy score

Why this matters:
- unified related evidence needs richer aggregation than a single top-hit
- the current pattern slot is too lossy to become the long-term related-evidence slot unchanged

#### 5. Formula inconsistency with the legacy engine

Current issue:
- [formulaEngine.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/formulaEngine.js) and [policyEngine.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyEngine.js) do not agree on missing-data neutrality, especially for history and weight handling

Why this matters:
- migration and compatibility testing become ambiguous
- operator confidence settings are harder to interpret if two engines use different normalization assumptions

### 7.5C Target PolicyEngine DTO

PolicyEngine should return one stable DTO regardless of action.

#### Proposed normalized result shape

```json
{
  "action": "prompt_select",
  "method": "policy_engine",
  "confidence": 64,
  "topCandidate": {
    "libraryId": 58,
    "libraryName": "Documentaries",
    "policyId": 7,
    "policyName": "Docs Policy",
    "score": 64
  },
  "ranked": [
    {
      "libraryId": 58,
      "libraryName": "Documentaries",
      "policyId": 7,
      "policyName": "Docs Policy",
      "score": 64,
      "scores": {
        "preset": 82,
        "profile": 66,
        "related_evidence": 71,
        "rag": 18,
        "history": 25
      },
      "weights": {
        "preset": 0.35,
        "profile": 0.25,
        "related_evidence": 0.15,
        "rag": 0.15,
        "history": 0.10
      },
      "agreement": {
        "contributingSignals": 4,
        "multiplier": 1.12,
        "boostAmount": 5.14
      },
      "thresholds": {
        "autoClassify": 85,
        "prompt": 60
      }
    }
  ],
  "scores": {
    "preset": 82,
    "profile": 66,
    "related_evidence": 71,
    "rag": 18,
    "history": 25
  },
  "weights": {
    "preset": 0.35,
    "profile": 0.25,
    "related_evidence": 0.15,
    "rag": 0.15,
    "history": 0.10
  },
  "breakdown": [
    { "type": "preset", "score": 82, "weight": 0.35 },
    { "type": "profile", "score": 66, "weight": 0.25 },
    { "type": "related_evidence", "score": 71, "weight": 0.15 },
    { "type": "rag", "score": 18, "weight": 0.15 },
    { "type": "history", "score": 25, "weight": 0.10 }
  ],
  "debug": {
    "rawWeightedScore": 58.86,
    "normalizedScore": 58.86,
    "agreementBoostedScore": 64,
    "excludedPolicies": [
      {
        "policyId": 11,
        "reason": "strict_language_conflict"
      }
    ]
  }
}
```

Benefits:
- all consumers can read one shape
- `classification.js` no longer needs to reconstruct signal context from a partial result
- stats/history logging can persist one canonical debug payload

### 7.5D Proposed Scorer Contract

Each scoring family should return a richer internal contract before PolicyEngine collapses it into the final DTO.

#### Proposed scorer result

```json
{
  "channel": "related_evidence",
  "score": 71,
  "status": "match",
  "reason": "matched genre + franchise evidence",
  "supportCount": 2,
  "components": [
    { "scope": "genre", "key": "genre:documentary", "confidence": 84, "provenance": "policy_confirmed" },
    { "scope": "franchise", "key": "franchise:planet-earth", "confidence": 79, "provenance": "human_confirmed" }
  ],
  "debug": {
    "libraryId": 58,
    "topConfidence": 84,
    "aggregatedScore": 71
  }
}
```

Recommended `status` values:
- `match`
- `neutral`
- `missing`
- `disabled`
- `error`
- `excluded`

This allows PolicyEngine to distinguish:
- no evidence
- not applicable
- system failure
- explicit exclusion

### 7.5E Formula Hardening Rules

Unified evidence should land on top of a stricter formula contract.

#### Rule 1: explicit zero must stay zero

Current bad behavior:

```javascript
const weight = config.rag_weight || 0.15;
```

If `rag_weight = 0`, the engine behaves as if the weight were `0.15`.

Target behavior:

```javascript
const weight = config.rag_weight ?? 0.15;
```

This applies to:
- legacy formula weight loading
- PolicyEngine feature gating
- any future related-evidence channel weights

#### Rule 2: agreement should not count trivial positives blindly

Current bad behavior:
- any positive score contributes to agreement boost

Example:

```json
{
  "scores": {
    "preset": 88,
    "profile": 2,
    "pattern": 1,
    "rag": 0,
    "history": 0
  },
  "agreement": {
    "contributingSignals": 3,
    "multiplier": 1.12
  }
}
```

This overstates consensus.

Target behavior:
- agreement should use one of:
  - minimum effective score threshold
  - normalized support threshold
  - provenance-aware contribution threshold

#### Rule 3: neutral, missing, and error must not collapse into the same value

Current bad behavior:
- missing profile data and a profile service failure can both end up as `0`

Target:

```json
{
  "channel": "profile",
  "score": 0,
  "status": "error",
  "reason": "profile_service_failed"
}
```

vs

```json
{
  "channel": "profile",
  "score": 0,
  "status": "neutral",
  "reason": "profile_below_positive_threshold"
}
```

#### Rule 4: support-aware channels should not be top-hit only forever

Current pattern behavior:
- top pattern confidence wins

Target related-evidence behavior:
- aggregate top-N support with diminishing returns
- preserve the top component in debug output
- keep the final public score bounded and explainable

### 7.5F PolicyEngine Hardening Phases

These PolicyEngine phases are not a separate delivery track. They map directly into the implementation phases below so the code plan stays coherent:

- **Phase PE-1** maps to **Phase 1**
  - DTO normalization and contract hardening
- **Phase PE-2** maps to **Phase 2**
  - formula, weight, and gating cleanup while runtime remains legacy-authoritative
- **Phase PE-3** maps to **Phase 3**
  - decomposition, scorer contracts, exclusion unification, and diagnostics while still in dual-write/shadow mode
- **Phase PE-4** maps to **Phase 4**
  - related-evidence scoring cutover and legacy learned-pattern retirement

The main phases should therefore be treated as carrying both the evidence migration work and the PolicyEngine hardening work together.

#### Phase PE-1: Contract hardening

Scope:
- normalize PolicyEngine result DTO
- keep current public behavior and thresholds
- no scoring-behavior change yet

Deliverables:
- one stable result shape for all actions
- one extractor in [classification.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classification.js)
- contract tests for each action shape

#### Phase PE-2: Formula and gating fixes

Scope:
- fix zero-weight semantics
- fix RAG prefetch gating
- add scorer status metadata internally

Deliverables:
- explicit `0` means disabled
- RAG prefetch matches policy intent
- debug outputs distinguish missing/neutral/error

#### Phase PE-3: Scoring decomposition

Scope:
- split evaluation stages
- unify exclusion handling
- introduce scorer result contracts

Deliverables:
- smaller PolicyEngine methods
- clearer diagnostics
- safer insertion point for unified related evidence

#### Phase PE-4: Related-evidence cutover

Scope:
- replace or alias `pattern` with `related_evidence`
- keep compatibility metadata for history/stats

Deliverables:
- one scored related-evidence family
- no hidden learned-pattern shortcut
- stable downstream DTO

### 7.5G PolicyEngine Test Additions

Add explicit coverage for:

1. action-shape contract tests
   - `auto_classify`
   - `prompt_confirm`
   - `prompt_select`
   - `manual`

2. zero-weight semantics
   - `rag_weight = 0`
   - `pattern_weight = 0`
   - legacy formula weights set to zero intentionally

3. agreement-threshold semantics
   - tiny positive scores should not necessarily trigger the same multiplier as strong multi-signal agreement

4. exclusion diagnostics
   - strict language conflict should be returned as an explicit excluded-policy reason

5. downstream contract tests
   - real PolicyEngine output consumed by:
     - [classification.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classification.js)
     - [policyQuestionBuilder.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyQuestionBuilder.js)
     - [discordBot.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/discordBot.js)
     - stats/history logging

### 7.6 Evidence-Aware AI and RAG Expansion Opportunities

Unification should not stop at policy scoring. Once evidence is normalized, the system can use it more safely in AI and review flows.

#### Option A: Evidence-aware AI verification

Goal:
- let AI understand why the system already leans toward a library without silently overriding the scored path

Proposed behavior:
- include a compact, provenance-aware related-evidence summary in `signalContext`
- pass only the top few evidence components, not raw table dumps
- preserve the rule that AI cannot change exact-match authority and cannot treat related evidence as an override

Example prompt payload fragment:

```json
{
  "signalContext": {
    "confidence": 74,
    "suggestedLibrary": { "id": 58, "name": "Documentaries" },
    "relatedEvidence": [
      { "scope": "genre", "key": "genre:documentary", "provenance": "policy_confirmed", "confidence": 84 },
      { "scope": "studio", "key": "studio:pbs", "provenance": "mined", "confidence": 61 }
    ]
  }
}
```

Guardrails:
- do not expose low-signal evidence noise to the prompt
- do not let AI "upgrade" mined evidence into authoritative memory
- do not add related evidence both to a scored policy result and as a persuasive free-text instruction that biases AI twice

#### Option B: Evidence-aware policy questions

Goal:
- improve manual clarification quality by showing operators why the system is leaning toward a library

Proposed behavior:
- extend question payloads with concise related-evidence rationale
- show provenance and confidence, not just a method label
- distinguish exact memory from related evidence and from RAG similarity

Example question rationale:

```json
{
  "reason": "Two libraries are close. Related evidence favors Documentaries.",
  "relatedEvidence": [
    { "scope": "genre", "label": "Documentary", "confidence": 84, "provenance": "policy_confirmed" },
    { "scope": "franchise", "label": "Planet Earth", "confidence": 79, "provenance": "human_confirmed" }
  ]
}
```

Guardrails:
- avoid presenting mined evidence as if it were confirmed memory
- keep the payload short enough for Discord/UI question surfaces

#### Option C: Evidence-aware RAG diagnostics, not evidence-driven retrieval

Goal:
- improve operator understanding of why semantic matches and related evidence agree or disagree

Proposed behavior:
- keep embedding retrieval independent
- add evidence overlays to diagnostics and review screens
- show when RAG similarity and related evidence reinforce each other or diverge

Recommended boundary:
- use unified evidence to annotate RAG outcomes
- do not fold evidence rows directly into embedding retrieval ranking in the first rollout

#### Option D: Policy confidence shaping

Goal:
- replace the narrow `pattern` sub-score with a broader `related_evidence` family

Proposed behavior:
- `related_evidence` becomes one explained policy component
- legacy `pattern` score can be compatibility-mapped until stats/UI catch up

Guardrails:
- preserve score explainability and historical comparisons
- ensure old analytics do not suddenly appear to drop because only the label changed

### 7.7 What We Should Explicitly Avoid

The new model should not:

- reintroduce hidden related-evidence bypasses
- let AI confirm a library solely because the prompt contains strong-sounding mined evidence
- make RAG retrieval dependent on mutable learned evidence in Phase 1-3
- keep both `learned_pattern` and `related_evidence` active as separate runtime truths
- migrate ambiguous legacy rows as authoritative without provenance review

---

## 8. Migration Strategy

### 8.0 Additional Expansion Themes

The current runtime shows three adjacent but separate concerns that should be addressed explicitly in the rollout plan instead of being treated as one generic "pattern" migration:

1. **Authoritative memory**
   - exact item memory and any future hard-bypass cases
2. **Scored related evidence**
   - genre, studio, franchise, certification, and similar-family evidence
3. **AI / RAG / operator explanation**
   - how scored evidence is exposed to AI prompts, policy questions, diagnostics, and UI surfaces without turning it back into a hidden override

These are related, but they should not share the same trust rules or rollout timing.

### Phase 0: Reliability and Migration Pre-Work

Purpose:
- validate the implementation strategy against source-backed database, rollout, and observability best practices
- verify that the current dependency and test stack can support the planned phases without introducing avoidable platform churn
- identify risks early enough to change phase order before runtime behavior changes begin
- produce go/no-go checks for Phase 1 through Phase 3

Non-goals:
- no production behavior changes
- no schema cutover
- no scoring formula changes
- no UI or method-label changes

#### 0.1 Source-Backed Best-Practice Review

Phase 0 should explicitly anchor the plan against external guidance for the two highest-risk areas we will touch:

1. **Database migration safety**
   - PostgreSQL `ALTER TABLE` guidance documents that many table-shape changes can take stronger locks than expected, including `ACCESS EXCLUSIVE` in common cases. The plan should therefore prefer additive rollouts, deferred validation, and migration sequences that avoid broad table rewrites wherever possible.
   - PostgreSQL also documents that `CREATE INDEX CONCURRENTLY` avoids blocking writes, but it takes longer and cannot run inside a transaction block. That means any schema step that needs concurrent indexes must be treated as a distinct operational step, not assumed to fit inside a generic transactional migration wrapper.
   - PostgreSQL lock-mode documentation should be treated as the baseline for migration risk review. If a step requires a strong lock, that must be called out in the phase gate instead of being discovered during rollout.

2. **Migration rollout reliability**
   - Modern migration guidance for dual-write and shadow-read systems is staged, not “flip everything at once.” The useful model here is:
     - `off`
     - `dualwrite`
     - `shadow`
     - `live`
     - `rampdown`
     - `complete`
   - That staged model maps well to this project even without adopting an external migration platform. The important lesson is that shadow comparison and live cutover are separate phases.
   - Migration metrics guidance also emphasizes consistency rate, latency delta, and error rate as first-class migration health signals. Phase 0 should convert those into local observability requirements for evidence reads and writes.

Reference sources reviewed for Phase 0:
- PostgreSQL `ALTER TABLE`: <https://www.postgresql.org/docs/current/sql-altertable.html>
- PostgreSQL `CREATE INDEX`: <https://www.postgresql.org/docs/current/sql-createindex.html>
- PostgreSQL lock behavior: <https://www.postgresql.org/docs/15/sql-lock.html>
- LaunchDarkly migration stages: <https://launchdarkly.com/docs/guides/flags/migrations>
- LaunchDarkly migration metrics: <https://launchdarkly.com/docs/home/flags/migration-metrics>

#### 0.2 Why Phase 0 Matters for This Project

This migration touches four reliability-sensitive surfaces at once:
- **runtime classification correctness**
- **policy scoring consistency**
- **operator-facing reporting and diagnostics**
- **database lifecycle operations such as backup, retry reset, and migration/backfill**

Without Phase 0, the project risks solving the conceptual architecture while still failing on rollout mechanics. The end goal is not just a better evidence model; it is a safer path to that model with no ambiguous cutover state.

#### 0.3 Verified Dependency Baseline

Current repo dependencies are sufficient for the planned pre-cutover work.

Verified existing support:
- root tooling in [package.json](../package.json)
  - markdown linting and migration helper scripts already exist
- server runtime in [server/package.json](../server/package.json)
  - `pg` is already present for new queries, migrations, comparators, and evidence services
  - Express/Jest stack is already present for route, service, and contract coverage
- server test tooling in [server/package.json](../server/package.json)
  - `pg-mem` is available for fast unit-style DB behavior tests
  - `testcontainers` and `@testcontainers/postgresql` are already available for migration and integration verification
  - `supertest` is already available for route-level compatibility tests

Phase 0 dependency conclusion:
- **No new runtime dependency is required** for Phase 1 through the early part of Phase 3.
- **No ORM or query-builder addition is warranted.**
- **No external feature-flag SDK is required** if rollout state is kept in local config/settings or a controlled internal switch.
- **No new observability vendor dependency is required** if we add structured comparison logging and counters through the existing server logging stack.

Dependencies that should be avoided unless a later phase proves they are necessary:
- ORM / schema abstraction layers
- external feature-flag or migration-control SDKs
- background job framework added solely for backfill orchestration
- separate metrics platform dependency introduced before local shadow comparisons exist

#### 0.4 Pre-Work Reliability Risks and Challenges

1. **Lock-heavy schema steps**
   - Risk:
     A naive evidence-table rollout could add constraints or indexes in ways that block writes or stall classification traffic.
   - Challenge:
     The migration may need additive table creation first, then separate index creation, then later constraint validation.
   - Phase 0 response:
     classify each proposed migration step as transactional, non-transactional, or operationally isolated.

2. **Migration-runner assumptions**
   - Risk:
     The repo’s migration workflow may assume fully transactional SQL files, which conflicts with `CREATE INDEX CONCURRENTLY`.
   - Challenge:
     An otherwise-correct schema design can still fail operationally if migration execution semantics are wrong.
   - Phase 0 response:
     verify whether concurrent-index steps need dedicated migrations or explicit operator-run scripts.

3. **Dual-write inconsistency**
   - Risk:
     Writing to legacy tables and the new evidence model without a comparison contract can silently drift.
   - Challenge:
     It is not enough to dual-write; we need a structured way to detect mismatches.
   - Phase 0 response:
     define comparison payloads, mismatch logging, and acceptable divergence rules before Phase 2 begins.

4. **Compatibility drift in reporting**
   - Risk:
     history, dashboard, pattern admin, and stats screens currently assume legacy method names and pattern categories.
   - Challenge:
     read compatibility must survive longer than write compatibility.
   - Phase 0 response:
     enumerate all compatibility consumers before the new DTO or evidence terminology changes anything downstream.

5. **Over-scoping the first live phase**
   - Risk:
     combining schema work, runtime read cutover, reinforcement changes, and UI renaming in one phase raises rollback complexity sharply.
   - Challenge:
     the architecture is interdependent, but rollout safety requires narrower slices.
   - Phase 0 response:
     keep Phase 1 contract-only, keep Phase 2 schema-plus-dual-write, and delay runtime scoring cutover until shadow-read evidence is trustworthy.

6. **PolicyEngine contract instability**
   - Risk:
     related-evidence migration is coupled to PolicyEngine DTO hardening. If that contract is unstable, downstream consumers inherit migration risk.
   - Challenge:
     the evidence plan and PolicyEngine hardening plan are separate documents conceptually, but they intersect operationally.
   - Phase 0 response:
     require PolicyEngine DTO normalization and zero-weight semantics review before any scored related-evidence cutover.

7. **Lifecycle semantic mismatch**
   - Risk:
     retry reset, purge, backup/restore, and admin tooling currently do not align on what constitutes learned state.
   - Challenge:
     runtime correctness is not enough if lifecycle flows restore or purge the wrong evidence scopes.
   - Phase 0 response:
     establish exact purge and restore semantics as part of the pre-work gate, not as an afterthought.

#### 0.5 Reliability Checks by Area

Database readiness checks:
- classify every planned migration step as one of:
  - additive transactional
  - additive non-transactional
  - validation/cleanup
  - cutover/removal
- determine whether `classification_evidence` needs any concurrent indexes at creation time
- determine whether unique constraints should begin as indexes first and become constraints later, or remain index-backed uniqueness rules
- determine whether backfill requires batching to avoid write amplification

Runtime readiness checks:
- define rollout stages for new evidence writes and reads
- define the authoritative source at each stage
- define how exact-match read behavior is protected while related-evidence logic remains shadow-only
- define mismatch logging format for shadow reads and dual writes

Compatibility readiness checks:
- identify all consumers of:
  - `method = 'learned_pattern'`
  - pattern-oriented reporting surfaces
  - backup/export/import of `learning_patterns`
  - retry purge/reset semantics
- define compatibility adapters required before renaming any runtime concept

Test readiness checks:
- verify the current test stack can cover:
  - migration DDL behavior
  - backfill idempotency
  - dual-write comparisons
  - shadow-read comparisons
  - backup/restore compatibility
  - retry purge semantics
- classify which of those are unit tests, integration tests, and migration/operational tests

Dependency readiness checks:
- verify no new package is needed for rollout switches
- verify no new package is needed for migration comparisons
- verify logging and testcontainers are sufficient for rollout observability and migration validation

#### 0.6 Phase 0 Deliverables

Phase 0 should produce:

1. **Migration reliability checklist**
   - every schema step classified by lock and transaction expectation

2. **Rollout stage contract**
   - explicit stage meanings for `off`, `dualwrite`, `shadow`, `live`, `rampdown`, `complete`

3. **Dependency decision record**
   - a written confirmation that the current Node/Postgres/test stack is sufficient, or a narrow list of justified additions if it is not

4. **Compatibility surface inventory**
   - routes, services, reporting, backup, retry, and UI components that depend on legacy method/pattern semantics

5. **Phase-gate matrix**
   - go/no-go checks for entering Phase 1, Phase 2, and Phase 3

#### 0.7 Example Phase 0 Review Output

Example target review artifact:

```json
{
  "phase0Review": {
    "db": {
      "requiresConcurrentIndexStep": true,
      "constraintStrategy": "additive_then_validate",
      "nonTransactionalSteps": [
        "create_index_concurrently_classification_evidence_lookup"
      ]
    },
    "rollout": {
      "stages": ["off", "dualwrite", "shadow", "live", "rampdown", "complete"],
      "legacyAuthoritativeUntil": "phase3_live",
      "comparisonMetrics": ["consistency_rate", "latency_delta_ms", "error_rate"]
    },
    "dependencies": {
      "newRuntimeDepsRequired": false,
      "newTestDepsRequired": false,
      "existingStackSufficient": true
    },
    "risks": [
      "access_exclusive_lock_on_constraint_rollout",
      "concurrent_index_requires_non_transactional_execution",
      "policyengine_contract_instability",
      "reporting_compatibility_drift",
      "retry_purge_semantics_mismatch"
    ]
  }
}
```

#### 0.8 Go / No-Go Criteria Before Phase 1

Do not begin Phase 1 until the following are explicitly answered:
- which schema changes are safe in transactional migrations
- which schema changes require isolated operational steps
- whether the migration runner can support those isolated steps cleanly
- how dual-write mismatch detection will be logged and reviewed
- what the authoritative read source is at each rollout stage
- which legacy consumers must be kept compatible through the shadow and live phases
- whether current dependencies remain sufficient without platform expansion

Phase 0 is complete only when the plan is reliable enough to protect the end goal, not merely descriptive enough to explain it.

### Phase 1: Refactor and Contract Stabilization

Phase 1 is intentionally a **refactor-first phase**. It should not introduce new runtime semantics or new scoring behavior. The goal is to extract the seams, normalize the contracts, and make the old and new systems coexist cleanly enough for Phase 2 and Phase 3 to stay operationally boring.

Primary goals:
- define the `classificationEvidenceService` boundary
- define exact and related evidence DTOs
- normalize purge, reinforcement, and comparison contracts
- isolate legacy-table reads behind adapters instead of scattered direct access
- prepare PolicyEngine and lifecycle consumers for later cutover without changing outcomes
- complete PolicyEngine contract hardening so later evidence work lands on a stable result shape

Phase 1 should feel similar to the service/composable extractions performed over the last few releases:
- thin orchestration at the top level
- dedicated state/read-model helpers
- compatibility wrappers instead of immediate behavioral rewrites
- heavy test additions before runtime cutover

Non-goals:
- no new table reads in the live classification path
- no PolicyEngine scoring changes
- no learned-pattern shortcut removal yet
- no UI terminology cutover

Deliverables:
- `classificationEvidenceService` contract defined and implemented as a wrapper/service boundary
- legacy read/write adapters defined for `learning_patterns` and `discovered_patterns`
- evidence comparison DTO defined for shadow phases
- purge/reset contract defined for retry, admin, backup, and restore flows
- PolicyEngine input/output touchpoints documented and normalized enough for later evidence injection
- normalized PolicyEngine DTO for all actions without changing scoring behavior

Files likely involved:
- [classification.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classification.js)
- [policyEngine.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyEngine.js)
- [clarificationService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/clarificationService.js)
- [classificationRetryService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classificationRetryService.js)
- [classificationRetryStateService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classificationRetryStateService.js)
- [classificationRetryFollowupService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classificationRetryFollowupService.js)
- [patternSignalCollector.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/patternSignalCollector.js)
- [backupService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/backupService.js)

#### Phase 1 Refactor Strategy

Recommended extraction pattern:

1. **Evidence service boundary**
   - create `classificationEvidenceService` as the single entry point for:
     - exact-match lookup
     - related-evidence lookup
     - write/upsert
     - reinforcement/decay
     - purge/reset
   - internally, this service may still read legacy tables during Phase 1

2. **Legacy adapters**
   - create focused adapters so legacy semantics stop leaking through the codebase:
     - `learningPatternEvidenceAdapter`
     - `discoveredPatternEvidenceAdapter`
   - these adapters convert legacy rows into normalized evidence DTOs

3. **Lifecycle cleanup**
   - stop embedding evidence purge semantics directly in retry/admin flows
   - move those decisions behind `classificationEvidenceService.purgeEvidence(...)`

4. **Compatibility contracts**
   - define a normalized comparison payload now, before dual-write starts
   - define a stable internal method taxonomy even if UI labels remain unchanged

5. **PolicyEngine contract hardening**
   - normalize `policyEngine.js` result shape across `auto_classify`, `prompt_confirm`, `prompt_select`, and `manual`
   - extract the result-building logic so downstream callers stop depending on action-specific field drift
   - keep thresholds and current winners unchanged

#### Phase 1A: PolicyEngine Contract Hardening

Phase 1 should explicitly include **PE-1**.

Scope:
- normalize PolicyEngine result DTO
- keep current public behavior and thresholds
- add one stable extraction path in [classification.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classification.js)

Recommended extracted components:
- `policyDecisionBuilder`
- `policyEngineResultNormalizer`

Deliverables:
- one stable result shape for all actions
- one extraction path for downstream runtime consumers
- contract tests for each action shape

Example target internal DTO:

```json
{
  "action": "prompt_select",
  "method": "policy_engine",
  "confidence": 64,
  "topCandidate": { "libraryId": 12, "libraryName": "Documentaries" },
  "ranked": [],
  "scores": {},
  "weights": {},
  "breakdown": {},
  "thresholds": {},
  "debug": {}
}
```

#### Proposed Service Interface

Illustrative Phase 1 interface:

```javascript
class ClassificationEvidenceService {
  async findExactMatch({ tmdbId, mediaType, source = 'legacy' }) {}

  async collectRelatedEvidence({
    metadata,
    candidateLibraryIds = null,
    source = 'legacy',
    includeCandidates = false
  }) {}

  async upsertExactEvidence({
    tmdbId,
    mediaType,
    libraryId,
    provenance,
    createdBy,
    sourceClassificationId,
    data
  }) {}

  async upsertRelatedEvidence({
    scope,
    mediaType,
    libraryId,
    evidenceKey,
    evidenceData,
    provenance,
    confidence,
    createdBy,
    sourceClassificationId
  }) {}

  async reinforceEvidence({ classificationId, finalLibraryId, actor, source }) {}
  async decayConflictingEvidence({ classificationId, finalLibraryId, actor, source }) {}
  async purgeEvidence({ tmdbId, mediaType, scopes = [], actor, reason }) {}
  async compareLegacyAndEvidence({ metadata, candidateLibraryIds = null }) {}
}
```

#### Example Phase 1 Compatibility DTO

```json
{
  "exactMatch": {
    "matched": true,
    "libraryId": 12,
    "source": "learning_patterns",
    "provenance": "human_confirmed"
  },
  "relatedEvidence": [
    {
      "scope": "genre",
      "libraryId": 12,
      "score": 0.82,
      "source": "learning_patterns",
      "provenance": "policy_confirmed",
      "status": "active"
    }
  ],
  "comparison": {
    "legacyResultHash": "abc123",
    "evidenceResultHash": null,
    "consistent": null
  }
}
```

#### Proposed File Changes

- add:
  - `server/src/services/classificationEvidenceService.js`
  - `server/src/services/learningPatternEvidenceAdapter.js`
  - `server/src/services/discoveredPatternEvidenceAdapter.js`
  - `server/src/services/classificationEvidenceComparisonService.js`
  - `server/src/services/policyDecisionBuilder.js`
  - `server/src/services/policyEngineResultNormalizer.js`
  - `server/src/__tests__/services/classificationEvidenceService.test.js`
  - `server/src/__tests__/services/learningPatternEvidenceAdapter.test.js`
  - `server/src/__tests__/services/discoveredPatternEvidenceAdapter.test.js`
  - `server/src/__tests__/services/policyDecisionBuilder.test.js`
- refactor to consume contracts, not raw semantics:
  - [classification.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classification.js)
  - [policyEngine.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyEngine.js)
  - [clarificationService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/clarificationService.js)
  - [classificationRetryService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classificationRetryService.js)
  - [backupService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/backupService.js)

#### Phase 1 Exit Criteria

- no direct new-table dependency in runtime classification
- all planned evidence consumers can speak a normalized internal DTO
- purge/reset logic is defined centrally instead of duplicated by caller
- legacy adapters exist and are covered by contract tests
- no change in live classification method distribution
- PolicyEngine returns one stable DTO regardless of action

### Phase 2: Schema Introduction, Backfill, and Compatibility Cleanup

> **STATUS: Complete.** `classification_evidence` migration exists (`20260404_120000_add_classification_evidence.sql`). `backfill_classification_evidence.js` and `verify_classification_evidence_backfill.js` scripts created in `scripts/` with transform tests in `server/src/__tests__/services/`. `classificationEvidenceService.purgeEvidence()` now shadow-deletes from `classification_evidence` after each legacy purge. `backupService.js` exports `classification_evidence` rows on backup and restores them on import (replace-mode also purges via `classificationEvidenceRepository.purgeAll()`). PolicyEngine and formulaEngine already used `??` for all weight defaults — no PE-2 changes required. Runtime still reads legacy sources only.

Phase 2 is still a **mostly existing-code phase**. It introduces new storage, but the work should remain additive, migration-safe, and compatibility-heavy. This phase is about preparing durable persistence and cleanup mechanisms, not changing who wins at runtime.

Primary goals:
- add `classification_evidence`
- backfill both legacy tables into the new model
- add operational cleanup and verification paths
- add compatibility mappers for backup/export/reporting surfaces
- keep legacy runtime reads authoritative
- complete PolicyEngine formula and gating cleanup while runtime still reads legacy evidence

Non-goals:
- no classification read cutover
- no PolicyEngine evidence cutover
- no retirement of `learning_patterns` or `discovered_patterns`

Deliverables:
- new additive migration for `classification_evidence`
- deterministic backfill script and backfill verification
- compatibility export/import strategy for backup and restore
- shadow comparison support for legacy vs evidence rows
- operational documentation for reruns, idempotency, and rollback
- explicit zero-weight and RAG gating semantics in PolicyEngine/formula handling

Backfill mapping:
- `learning_patterns.exact_match` -> `scope = item_exact`
- `learning_patterns.genre_pattern` -> `scope = genre`
- `discovered_patterns.studio` -> `scope = studio`
- `discovered_patterns.franchise` -> `scope = franchise`
- `discovered_patterns.genre` -> `scope = genre`
- `discovered_patterns.certification` -> `scope = certification`

Important:
- preserve provenance in backfill where possible
- mark uncertain legacy rows conservatively rather than over-trusting them
- treat approved/confirmed and mined/candidate rows differently even if they map to the same scope
- make the backfill idempotent and safe to rerun

#### Proposed Backfill Rules

From `learning_patterns`:
- `pattern_type = 'exact_match'`
  - `scope = item_exact`
  - `provenance = human_confirmed` unless source metadata proves otherwise
  - `confidence = 100`
  - `status = active`

- `pattern_type = 'genre_pattern'`
  - `scope = genre`
  - `evidence_key = 'genre:' || lower(pattern_data->>'genre')`
  - `provenance = policy_confirmed`
  - `status = active`

From `discovered_patterns`:
- `pattern_type = 'studio' | 'franchise' | 'genre' | 'certification'`
  - `scope = pattern_type`
  - `provenance = mined`
  - `status = candidate` unless current row is explicitly promoted and we choose to preserve promotion state separately

#### Example Backfill Transform

Legacy row:

```json
{
  "pattern_type": "genre_pattern",
  "media_type": "movie",
  "library_id": 58,
  "pattern_data": { "genre": "documentary" },
  "confidence": 85,
  "usage_count": 3,
  "success_rate": 100
}
```

Backfilled row:

```json
{
  "scope": "genre",
  "media_type": "movie",
  "library_id": 58,
  "evidence_key": "genre:documentary",
  "evidence_data": { "genre": "documentary" },
  "provenance": "policy_confirmed",
  "confidence": 85,
  "usage_count": 3,
  "success_rate": 100,
  "status": "active"
}
```

#### Compatibility and Cleanup Work in Phase 2

This is where most non-runtime cleanup should happen:
- backup/export paths should learn how to serialize `classification_evidence`
- restore/import paths should support replay into the new table without breaking legacy compatibility
- retry/admin purge flows should stop assuming only `exact_match` is meaningful learned state
- reporting adapters should gain a compatibility layer for legacy and future method/evidence terminology
- migration scripts should produce verification summaries instead of relying on manual SQL inspection

#### Phase 2A: PolicyEngine Formula and Gating Cleanup

Phase 2 should explicitly include **PE-2** because it is still primarily cleanup of existing logic.

Scope:
- fix zero-weight semantics
- fix RAG prefetch gating
- add internal scorer status metadata without changing public scoring outcomes

Required fixes:
- explicit `0` must remain disabled and must not fall back to defaults
- `rag_weight = 0` must prevent unnecessary RAG prefetch work
- internal scorer/debug state should distinguish:
  - `match`
  - `neutral`
  - `missing`
  - `error`
  - `excluded`

Example expected semantics:

```json
{
  "channel": "rag",
  "configuredWeight": 0,
  "prefetchExecuted": false,
  "status": "disabled"
}
```

#### Proposed File Changes

- add migration:
  - `database/migrations/YYYYMMDD_HHMMSS_add_classification_evidence.sql`
- add deterministic backfill and verification scripts:
  - `scripts/backfill_classification_evidence.js`
  - `scripts/verify_classification_evidence_backfill.js`
- add tests:
  - `scripts/__tests__/backfill_classification_evidence.test.js`
  - `scripts/__tests__/verify_classification_evidence_backfill.test.js`
  - service-level backfill mapping tests
- update compatibility/lifecycle surfaces:
  - [backupService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/backupService.js)
  - [classificationRetryService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classificationRetryService.js)
  - [queueAdminService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/queueAdminService.js)
  - reporting/admin routes that surface patterns or learned state
  - [formulaEngine.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/formulaEngine.js)
  - [policyEngine.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyEngine.js)

#### Phase 2 Exit Criteria

- `classification_evidence` exists and is backfilled
- backfill is rerunnable and verifiable
- backup and restore semantics are defined for the new table
- purge/reset flows understand exact vs related evidence scopes
- runtime classification still reads legacy sources only
- PolicyEngine zero-weight and RAG gating semantics are explicit and tested

### Phase 3: Dual Write, Shadow Comparison, and Cleanup Tranche Completion

> **STATUS: ✅ COMPLETE** — All Phase 3 deliverables implemented and tested.
>
> **Dual-write paths confirmed active:**
> - `classificationEvidenceService.rememberExactMatch()` — dual-writes `item_exact` rows for human-confirmed outcomes. Called by `clarificationService.js`, `discordBot.js`, and `queueAdminService.js`.
> - `classificationEvidenceService.reinforceGenrePatterns()` — dual-writes `genre` rows. Called through reinforcement paths in `classificationEvidenceReinforcementService`.
> - All legacy callers (`classification.js` route, `discordBot.js`, `queueAdminService.js`) already routed through the facade — no bespoke write logic scattered in callers.
>
> **Shadow comparison and telemetry:**
> - `classificationEvidenceComparisonService.js` — full mismatch detection for exact and related evidence. (Previously existed.)
> - `classificationEvidenceTelemetryService.js` (NEW) — fire-and-forget wrapper; logs structured mismatch summaries; never blocks hot path.
>
> **Compatibility and reporting layer:**
> - `evidenceCompatibilityMapper.js` (NEW) — single source of truth mapping scope+provenance → legacy `method` values (`exact_match`, `learned_pattern`, `policy_auto`). Exports `toMethod`, `toLabel`, `toMethodLabel`, `isAuthoritative`, `buildCompatibilityPayload`.
> - `evidenceHistoryReadModel.js` (NEW) — read model for history/activity/dashboard/stats surfaces. Provides `getItemSummary`, `getRowSummary`, `getLibrarySummary` with full `winningEvidence`, `authoritativeEvidence`, `relatedEvidenceSummary`, `methodLabel`, `isAuthoritative` payloads. All errors are swallowed; surfaces never break.
>
> **PolicyEngine decomposition:**
> - `policyEvaluationPipeline.js`, `policyExclusionService.js`, `policyCandidateRanker.js` — all existed and were complete.
>
> **Tests (all passing):**
> - `server/src/__tests__/services/evidenceCompatibilityMapper.test.js` — 24 assertions
> - `server/src/__tests__/services/classificationEvidenceTelemetryService.test.js` — 8 assertions
> - `server/src/__tests__/services/evidenceHistoryReadModel.test.js` — 15 assertions
>
> **Non-goals met**: runtime still reads from legacy sources only; no cutover of `checkLearnedPatterns()`; no removal of legacy tables.

Phase 3 completes the refactor/cleanup tranche. It introduces dual-write and shadow-read comparison, but it should still avoid changing who is authoritative at runtime. This is the final phase that should be dominated by existing-code rewiring, reconciliation, and cleanup.

Primary goals:
- dual-write from existing confirmation/correction flows
- add shadow-read comparison without changing classification decisions
- centralize mismatch logging and reconciliation
- finish cleanup of legacy direct-write paths
- complete PolicyEngine decomposition so related-evidence cutover has a stable insertion point

Non-goals:
- no live read cutover
- no removal of `checkLearnedPatterns()` yet
- no promotion of related evidence into final scoring yet

Start dual-writing only from confirmation/correction flows first:
- [clarificationService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/clarificationService.js)
- [classification.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/routes/classification.js)
- [discordBot.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/discordBot.js)
- [queueAdminService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/queueAdminService.js)

Do not make classification read from the new table yet.

#### Proposed Write Rules

- human-confirmed exact item outcomes:
  - write `item_exact`
- human-confirmed broader category outcomes:
  - write related evidence such as `genre`
- mined pattern creation:
  - may write `mined` evidence rows, but never authoritative rows
- retry reset or admin purge:
  - must call centralized evidence purge semantics, not local one-off deletion logic

#### Shadow Comparison Goals

Phase 3 should add comparison instrumentation such as:
- legacy exact result vs evidence exact result
- legacy related pattern set vs evidence related set
- mismatch reason classification:
  - missing backfill
  - provenance mismatch
  - status mismatch
  - normalization mismatch

Example shadow comparison record:

```json
{
  "classificationId": 89231,
  "exact": {
    "legacyLibraryId": 12,
    "evidenceLibraryId": 12,
    "consistent": true
  },
  "related": {
    "legacyKeys": ["genre:documentary"],
    "evidenceKeys": ["genre:documentary", "studio:a24"],
    "consistent": false,
    "reason": "extra_evidence_candidate_not_used_by_legacy"
  }
}
```

#### Phase 3A: PolicyEngine Decomposition and Scorer Contracts

Phase 3 should explicitly include **PE-3**.

Scope:
- split PolicyEngine evaluation stages
- unify exclusion handling
- introduce scorer result contracts while still sourcing runtime truth from legacy-compatible channels

Recommended extracted components:
- `policyEvaluationPipeline`
- `policyExclusionService`
- `policyCandidateRanker`
- `policyScoreDebugger`

Recommended stage split:
- `loadPolicyCandidates`
- `buildSharedContext`
- `evaluatePolicy`
- `applyExclusions`
- `rankPolicies`
- `determineAction`

Recommended scorer contract:

```json
{
  "channel": "pattern",
  "score": 63,
  "status": "match",
  "reason": "top_pattern_confidence",
  "supportCount": 2,
  "components": []
}
```

Important:
- this phase can still keep the outward score label `pattern` for compatibility
- the goal is to make related-evidence cutover a plug-in replacement, not to change the winner yet

#### Proposed File Changes

- dual-write exact and related evidence from:
  - [clarificationService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/clarificationService.js)
  - [classification.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/routes/classification.js)
  - [discordBot.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/discordBot.js)
  - [queueAdminService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/queueAdminService.js)
- optionally mirror mined patterns from:
  - [patternMiningService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/patternMiningService.js)
- add shadow comparison and logging:
  - `server/src/services/classificationEvidenceComparisonService.js`
  - `server/src/services/classificationEvidenceTelemetryService.js`
  - related test suites for dual-write and comparison mismatches
  - `server/src/services/policyEvaluationPipeline.js`
  - `server/src/services/policyExclusionService.js`
  - `server/src/services/policyCandidateRanker.js`
  - `server/src/__tests__/services/policyEvaluationPipeline.test.js`

#### Cleanup Required Before Leaving Phase 3

- remove direct legacy writes from callers wherever `classificationEvidenceService` now owns the behavior
- remove duplicate purge semantics from retry/admin flows
- consolidate comparison logging into one service instead of ad hoc caller logging
- ensure backup/restore and reporting compatibility paths are exercised against dual-written data

#### Phase 3 Exit Criteria

- dual-write is enabled for all targeted human-confirmation flows
- shadow comparison is running and producing explainable mismatch data
- no caller still owns bespoke evidence-write logic for the targeted flows
- no runtime decision path is yet using the new table authoritatively
- the project is ready to begin net-new behavior phases in Phase 4 and beyond
- PolicyEngine stages and scorer contracts are decomposed enough for related-evidence cutover

### Phase 4: Runtime Read Cutover

> **STATUS: Phase 4A, 4B, 4C, and 4D complete.** The `checkLearnedPatterns` early-return shortcut has been removed from `classification.js`. Related evidence is now collected via `classificationEvidenceService.collectRelatedEvidence()` and passed to `policyEngine.evaluateItem()` as `options.relatedEvidence`. PolicyEngine's `evaluatePolicy()` now accepts and uses this evidence for the `pattern` scoring channel via the new `scoreRelatedEvidence()` method. The `LEARNED_PATTERN` injection in `signalCollector.js` has been fully retired (Phase 4B); `checkLearnedPatterns` has been removed from the `detectors` object. A compact `relatedEvidenceSummary` is now built in `classification.js` via `buildRelatedEvidenceSummary()` and threaded through `policySignalContext` and the legacy `signalContext`; it flows into `aiPromptBuilder.formatPolicySignals()` as a new advisory section in the AI prompt, and into `policyQuestionBuilder.build()` where it is included as `meta.related_evidence_summary` in clarification question payloads (Phase 4C). Observability logging added in `policyEngine.js` (debug, per-policy pattern path taken) and `classification.js` (info, related evidence collected) (Phase 4D). Suite: 404/404 targeted.

Change reads in `classification.js` and `policyEngine.js`:

- keep exact-match authoritative
- stop early-returning on learned related patterns
- consume related evidence through one scored path

Deliverables:
- replace `checkLearnedPatterns()` shortcut semantics
- eliminate duplicate learned-pattern injection from legacy fallback path
- execute the PolicyEngine related-evidence cutover on top of the hardened DTO, gating, and scorer stages

#### Proposed Runtime Changes

In [classification.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classification.js):

- keep:
  - exact lookup before policy flow
- remove:
  - early return on `genre_pattern` / `learned_pattern`
- add:
  - one call to `classificationEvidenceService.collectRelatedEvidence(...)`
  - pass the result into PolicyEngine or its scoring inputs

In [signalCollector.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/signalCollector.js):

- remove the duplicate learned-pattern legacy signal once the policy path owns related evidence

In [policyEngine.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyEngine.js):

- add a dedicated related-evidence scoring component or replace the current `pattern` sub-score with one composed evidence family

#### Phase 4A: PolicyEngine Related-Evidence Cutover

Phase 4 is where **PE-4** lands.

Scope:
- replace or alias `pattern` with `related_evidence`
- keep compatibility metadata for history/stats while runtime behavior changes
- cut over only after DTO, gating, and decomposition work from Phase 1 to Phase 3 is complete

Deliverables:
- one scored related-evidence family
- no hidden learned-pattern shortcut
- stable downstream DTO remains intact during cutover

#### Proposed Runtime Split

The runtime should explicitly separate:

- `findExactMatch(...)`
  - may return immediately
- `collectRelatedEvidence(...)`
  - never returns immediately
  - only contributes scored evidence
- `collectCandidateEvidence(...)`
  - optional future-only mined or weak signals that should be visible to operators but not heavily weighted yet

This keeps exact memory from being conflated with recommendation-strength evidence.

#### Example Pseudocode

```javascript
const exactMatch = await evidenceService.findExactMatch({ tmdbId, mediaType });
if (exactMatch?.isAuthoritative) {
  return buildExactMatchResult(exactMatch);
}

const relatedEvidence = await evidenceService.collectRelatedEvidence({ metadata });

const policyResult = await policyEngine.evaluateItem(metadata, {
  relatedEvidence
});
```

#### Phase 4A.1: Policy Scoring Composition

Before cutover, define how related evidence will coexist with the current scoring families in [policyEngine.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyEngine.js):

- `preset`
- `profile`
- `pattern`
- `rag`
- `history`

Recommended target:

- rename or internally replace `pattern` with `related_evidence`
- keep the current outward breakdown shape compatible during rollout
- preserve historical stats APIs by aliasing `pattern` to `related_evidence` until client/admin surfaces migrate

This avoids breaking dashboards while still correcting the underlying semantics.

#### Phase 4B: Legacy Signal Path Retirement

The legacy signal path in [signalCollector.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/signalCollector.js) currently injects `learned_pattern` separately from PolicyEngine. That creates duplicate trust models.

Target behavior:

- while compatibility is active:
  - keep the fallback path operational
  - gate duplicate related-evidence injection behind a feature flag or staged cutover toggle
- after runtime parity:
  - remove standalone `LEARNED_PATTERN` injection from the fallback path
  - source any remaining related evidence from `classificationEvidenceService`

This should be handled as an explicit sub-phase so rollout diagnostics can compare:

- old shortcut behavior
- old fallback-weight behavior
- new scored-related-evidence behavior

#### Phase 4C: AI / RAG / Clarification Integration

The unified evidence model should not be limited to policy scoring. It should also define what AI, RAG-adjacent diagnostics, and clarification flows are allowed to see.

Current reality:

- AI sees `signalContext` and optional `ragContext` in [classification.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classification.js) and [aiPromptBuilder.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/aiPromptBuilder.js)
- RAG contributes similarity matches, but does not currently consume learned evidence directly
- policy questions can already surface `policyResult`, `aiResult`, and `ragContext` in [policyQuestionBuilder.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyQuestionBuilder.js)

Recommended target:

- AI may see a **summary** of related evidence, not raw authoritative instructions
- RAG should remain a separate retrieval channel, but evidence may enrich diagnostics and final explanations
- clarification prompts/questions should expose why related evidence supported or conflicted with the leading library

Recommended summary contract for AI and clarification:

```json
{
  "relatedEvidenceSummary": {
    "topLibrary": "Documentaries",
    "confidence": 68,
    "topScopes": [
      { "scope": "genre", "label": "Documentary", "confidence": 84, "provenance": "policy_confirmed" },
      { "scope": "studio", "label": "BBC", "confidence": 63, "provenance": "mined" }
    ],
    "hasConflict": false
  }
}
```

Rules:

- AI can use this to explain or verify, but not to override an exact match
- mined evidence should be visibly marked as weaker than human-confirmed evidence
- raw evidence rows should not be dumped into prompts if a summarized form is sufficient

##### AI Verification and Prompt-Context Integration

Current AI verification in [classification.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classification.js) depends on:

- `signalContext`
- `policySignals`
- `ragContext`

Today, learned evidence does not enter AI as a normalized first-class evidence family. It either:

- bypasses AI entirely through exact or learned-pattern shortcuts, or
- reaches AI indirectly through already-computed signal summaries

Target behavior:

- authoritative `item_exact` evidence may still bypass AI
- related evidence should only appear as advisory scored context
- AI should verify the suggested library using metadata, related-evidence summary, and RAG context together

#### Proposed Prompt-Context Shape

```json
{
  "confidence": 78,
  "suggestedLibrary": { "id": 58, "name": "Documentaries" },
  "relatedEvidence": {
    "topLibrary": "Documentaries",
    "confidence": 68,
    "topScopes": [
      { "scope": "genre", "label": "Documentary", "confidence": 84, "provenance": "policy_confirmed" },
      { "scope": "studio", "label": "BBC", "confidence": 63, "provenance": "mined" }
    ],
    "hasConflict": false
  },
  "ragContext": {
    "similarItems": [
      { "title": "Planet Earth", "libraryId": 58, "similarity": 0.82 }
    ]
  }
}
```

#### Prompting Rules

Allowed:

- present related evidence as part of why the system leaned toward a library
- distinguish confirmed and mined evidence inside the AI context
- ask AI to verify whether that evidence-backed suggestion still makes sense for the concrete metadata

Not allowed:

- instruct AI to trust learned evidence as if it were exact memory
- pass raw evidence rows or opaque JSON blobs directly into prompts when a normalized summary is available
- let AI apply a second confidence lift for the same related evidence already scored by PolicyEngine

##### Policy-Question Integration

[policyQuestionBuilder.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyQuestionBuilder.js) is the right human-facing place to surface related evidence without turning it into hidden automation.

Target behavior:

- show a compact related-evidence summary when a question is raised
- preserve candidate diversity and visible conflicts
- make provenance obvious so mined evidence is visibly weaker than confirmed evidence

#### Example Question Payload Addition

```json
{
  "questionType": "library_selection",
  "suggestedLibrary": "Documentaries",
  "relatedEvidence": [
    {
      "scope": "genre",
      "display": "Documentary",
      "provenance": "policy_confirmed",
      "confidence": 84
    },
    {
      "scope": "studio",
      "display": "BBC",
      "provenance": "mined",
      "confidence": 63
    }
  ],
  "ragSummary": [
    { "title": "Planet Earth", "library": "Documentaries", "similarity": 0.82 }
  ]
}
```

Question-building rules:

- use related evidence to explain why a candidate rose
- do not suppress alternatives just because one evidence scope is strong
- keep RAG and related evidence visibly separate so operators can spot disagreement

##### RAG and Diagnostics Integration

RAG should remain a separate semantic retrieval system. In the initial rollout, `classification_evidence` should not be merged into retrieval or embedding generation logic.

Recommended interaction model:

- RAG keeps producing semantic neighbors from embeddings
- related evidence remains a scored evidence family
- diagnostics compare whether PolicyEngine, related evidence, and RAG agree or disagree

#### Example Diagnostic Shape

```json
{
  "policyWinner": "Documentaries",
  "relatedEvidenceWinner": "Documentaries",
  "ragWinner": "Kids Docs",
  "agreement": {
    "policy_vs_relatedEvidence": true,
    "policy_vs_rag": false,
    "rag_vs_relatedEvidence": false
  }
}
```

This gives operators better debugging without turning RAG into another persistence layer for learned evidence.

##### Guardrails Against Double Counting

Related evidence must affect classification once.

It must not be:

1. applied as an early-return shortcut,
2. also scored inside PolicyEngine,
3. also narrated to AI as if it were new authority,
4. also transformed into hidden RAG boost logic.

Hard guardrails:

- `item_exact` may bypass scoring; related evidence may not
- AI may consume a summary of the already-computed related-evidence result, but must not independently rescore it
- RAG may be compared against related evidence, but should not be directly boosted from it in the first rollout
- the legacy `SIGNAL_TYPES.LEARNED_PATTERN` path should be removed once PolicyEngine owns unified related evidence

#### Phase 4D: Compatibility Flags and Observability

> **STATUS: Phase 4D complete.** Two observability log statements added:
> - `policyEngine.js` `evaluatePolicy`: `logger.debug` distinguishes the `scoreRelatedEvidence` path from the legacy `scorePatterns` path, logging `library_id`, `evidenceCount`, and `patternScore` for each.
> - `classification.js` `runDecisionTree`: `logger.info` fires when `relatedEvidence.length > 0`, logging `title`, `evidenceCount`, `topLibraryId`, `topConfidence`, `topScope`, and `uniqueScopes`. Suite: 329/329.

The runtime cutover should include explicit observability gates so the new evidence model can be compared safely.

Recommended rollout flags:

- `EVIDENCE_DUAL_WRITE_ENABLED`
- `EVIDENCE_READ_SHADOW_MODE`
- `EVIDENCE_USE_RELATED_SCORING`
- `EVIDENCE_DISABLE_LEGACY_LEARNED_SHORTCUT`

Recommended shadow metrics:

- old learned-pattern shortcut hit count
- new exact-match hit count
- new related-evidence contribution count
- per-item diff between old and new top library
- confidence delta when related evidence is applied once vs duplicated

These metrics should be logged or surfaced in diagnostics before full cutover.

### Phase 5: Reinforcement Unification

> **STATUS: Phase 5 complete.** `classificationEvidenceReinforcementService.js` created as a unified reinforcement façade. It wraps `patternReinforcementService` (legacy `discovered_patterns` path) and also calls `classificationEvidenceService.reinforceGenrePatterns()` when `PATTERN_GENRE` signals are present and metadata is available (new unified evidence path). Both `classification.js` (accept path, `setImmediate`) and `routes/classification.js` (correction path, `setImmediate`) switched from `patternReinforcementService` to the new service; both now pass `{ metadata, mediaType }` for the additional evidence writes. Test mocks updated in `classification-routes.test.js` and `classification-history-filters.test.js`. Suite: 461/461 targeted.

Unify reinforcement/decay logic currently split across:

- [clarificationService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/clarificationService.js)
- [patternReinforcementService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/patternReinforcementService.js)

Target:
- one reinforcement policy
- one decay policy
- one purge/reset contract

#### Proposed Reinforcement Rules

- if final outcome agrees with related evidence:
  - increment `usage_count`
  - raise confidence modestly
  - update `last_seen_at`
- if final outcome conflicts:
  - decay conflicting evidence
  - lower `success_rate`
  - optionally transition weak mined evidence to `decayed`
- if evidence is `item_exact` and human-confirmed:
  - keep authoritative

#### Proposed File Changes

- add or extend:
  - `server/src/services/classificationEvidenceReinforcementService.js`
- refactor current logic out of:
  - [clarificationService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/clarificationService.js)
  - [patternReinforcementService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/patternReinforcementService.js)
  - [classificationRetryService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classificationRetryService.js)

### Phase 6: UI / Method / Operator Surface

> **STATUS: COMPLETE** ✅
>
> Implemented and tested. All items below were delivered:
>
> | Deliverable | File | Notes |
> |---|---|---|
> | Evidence admin route | [`server/src/routes/evidence.js`](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/routes/evidence.js) | GET summary/list/id/diagnose, POST decay/promote/purge |
> | Operator diagnostics service | [`server/src/services/evidenceDiagnosticsService.js`](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/evidenceDiagnosticsService.js) | Read-only debug read model, errors swallowed |
> | Route registration | [`server/src/routes/api.js`](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/routes/api.js) | Mounted at `/api/evidence` with `authenticateToken + requireAdmin` |
> | Client API module | [`client/src/api/evidence.js`](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/api/evidence.js) | `getSummary`, `list`, `getById`, `diagnose`, `decay`, `promote`, `purge` |
> | History label updates | [`client/src/views/History.vue`](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/History.vue) | Added `policy_confirm`, `policy_supported_by_related_evidence` |
> | Activity label updates | [`client/src/views/Activity.vue`](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/Activity.vue) | Added method icons + display names |
> | Stats label updates | [`client/src/views/statistics/ClassificationStats.vue`](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/statistics/ClassificationStats.vue) | `getMethodDisplayName()`, new color entries |
> | Stats route enrichment | [`server/src/routes/stats.js`](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/routes/stats.js) | `getStatsByMethod()` now returns `methodLabel` |
> | Route tests | [`server/src/__tests__/routes/evidence.test.js`](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/routes/evidence.test.js) | 35 assertions, all passing |
> | Diagnostics service tests | [`server/src/__tests__/services/evidenceDiagnosticsService.test.js`](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/services/evidenceDiagnosticsService.test.js) | 6 describe blocks, 11 tests, all passing |
> | `useEvidenceFilters` composable | [`client/src/composables/useEvidenceFilters.js`](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/composables/useEvidenceFilters.js) | Reactive filter state + active filter map |
> | `useEvidenceData` composable | [`client/src/composables/useEvidenceData.js`](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/composables/useEvidenceData.js) | SWR summary + manual paginated list + diagnosis cache |
> | `useEvidenceActions` composable | [`client/src/composables/useEvidenceActions.js`](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/composables/useEvidenceActions.js) | decay, promote, purge with loading/error/success state |
> | `Evidence.vue` admin screen | [`client/src/views/Evidence.vue`](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/Evidence.vue) | Summary cards, filter bar, table, purge panel, detail/diagnose drawer |
> | Router + sidebar nav | [`client/src/router/index.js`](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/router/index.js) | `/evidence` route registered; `Evidence` added to sidebar |

Update:
- history labels
- activity/dashboard labels
- operator inspection views

Potential surfaces:
- [History.vue](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/History.vue)
- [Activity.vue](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/Activity.vue)
- [Dashboard.vue](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/Dashboard.vue)
- [patterns.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/routes/patterns.js)

Additional surfaces to account for:

- [ClassificationStats.vue](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/statistics/ClassificationStats.vue)
- [discordBot.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/discordBot.js)
- [server/src/routes/stats.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/routes/stats.js)
- any stats or admin routes that currently treat `learned_pattern` and `discovered_patterns` as conceptually separate operator stories

#### Proposed UI Examples

History detail example:

```json
{
  "method": "policy_supported_by_related_evidence",
  "signal_breakdown": {
    "preset": 82,
    "profile": 66,
    "related_evidence": 71,
    "rag": 28,
    "history": 15
  },
  "related_evidence": [
    { "scope": "genre", "key": "genre:documentary", "provenance": "policy_confirmed", "confidence": 84 },
    { "scope": "studio", "key": "studio:neon", "provenance": "mined", "confidence": 61 }
  ]
}
```

Operator-facing visibility goals:
- list evidence by library and scope
- show provenance and confidence
- show reinforcement history or summary stats
- allow decay, dismiss, purge, or reclassify testing workflows

#### Proposed Operator Surfaces

Phase the UI/admin changes instead of replacing everything at once:

1. **Compatibility read model**
   - keep old method names in existing dashboards
   - add tooltips or details that map `learned_pattern` to exact vs related evidence semantics

2. **Unified evidence admin route**
   - expose `classification_evidence` by scope, provenance, status, and library
   - optionally keep discovered/mined candidate controls under a filtered view instead of a separate mental model

3. **History detail enrichment**
   - show whether confidence came from:
     - exact memory
     - related evidence
     - RAG similarity
     - profile/preset logic

4. **Stats transition layer**
   - preserve current charts while adding a newer category for `related_evidence_supported`

#### Proposed File Changes

- add history/activity label mappings for:
  - `policy_supported_by_related_evidence`
  - `exact_match`
- add a new server route or extend [patterns.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/routes/patterns.js) into a broader evidence admin surface
- if needed, add a dedicated client admin screen for evidence inspection

### Phase 6A: Backup, Reset, and Maintenance Semantics

> **STATUS: ✅ COMPLETE** — Full restore mapping tests delivered alongside Phase 7 completion.
>
> | Deliverable | File | Notes |
> |---|---|---|
> | Export includes CE rows | [`server/src/services/backupService.js`](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/backupService.js) | `collectBackupData` calls `classificationEvidenceRepository.listAll()`; sets `backup.data.classificationEvidence` + `backup.meta.classificationEvidenceCount` |
> | Replace-mode purge | [`server/src/services/backupService.js`](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/backupService.js) | `restoreBackup(mode: 'replace')` calls `classificationEvidenceRepository.purgeAll({ client })` |
> | Restore with library ID remapping | [`server/src/services/backupService.js`](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/backupService.js) | Each CE row upserted via `classificationEvidenceRepository.upsertEvidence()` with new library ID from `libraryIdMap`; `conflictMode: 'do_nothing'` preserves existing rows |
> | Null-library-id rows restored (not skipped) | [`server/src/services/backupService.js`](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/backupService.js) | Unlike legacy pattern restore, CE rows with `library_id: null` or unmapped library IDs restore with `libraryId: null` instead of being dropped |
> | Restore mapping tests | [`server/src/__tests__/backupService.evidence.test.js`](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/backupService.evidence.test.js) | 12 new Phase 6A tests across export + restore mapping describe blocks; 14/14 total pass |

The migration also has to account for learned-state backup and destructive maintenance operations.

Primary surfaces:
- [backupService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/backupService.js)
- [queueCarsaService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/queueCarsaService.js)
- settings/admin backup screens such as [Backup.vue](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/settings/Backup.vue)

Target behavior:
- backups distinguish:
  - exact evidence
  - related evidence
  - mined candidate evidence
- restore flows can map legacy `learning_patterns` and `discovered_patterns` data into `classification_evidence` conservatively
- destructive reset tools can target scopes intentionally instead of assuming one monolithic learned-state table

Recommended rollout:
- Phase 1-2:
  - preserve legacy backup shape
  - add backfill/restore mapping tests
- Phase 6-7:
  - expose the new evidence categories in backup preview/restore summaries
- Phase 7:
  - retire legacy-table-only reset assumptions

### Phase 7: Compatibility Window and Removal

> **STATUS: ✅ COMPLETE** — All Phase 7 deliverables implemented and tested. 5186/5186 tests pass.
>
> | Deliverable | File | Notes |
> |---|---|---|
> | `checkLearnedPatterns()` retired | [`server/src/services/classification.js`](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classification.js) | Dead method body removed; replacement comment added |
> | `LEARNED_PATTERN` constant removed | [`server/src/services/signalCollector.js`](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/signalCollector.js) | Constant retired alongside Phase 4B injection removal |
> | `patternSignalCollector.js` demoted | [`server/src/services/patternSignalCollector.js`](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/patternSignalCollector.js) | Phase 7 demotion comment added; reads from `discovered_patterns` kept for comparison/diagnostic |
> | Writes flipped to new table | [`server/src/services/classificationEvidenceService.js`](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classificationEvidenceService.js) | `rememberExactMatch`, `reinforceGenrePatterns`, `purgeEvidence` all write to `classification_evidence` as primary; legacy adapter removed from write paths |
> | `findExactMatch` cascade read | [`server/src/services/classificationEvidenceService.js`](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classificationEvidenceService.js) | Reads `classification_evidence` first; falls back to `learning_patterns` adapter during compatibility window |
> | `collectRelatedEvidence` default changed | [`server/src/services/classificationEvidenceService.js`](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classificationEvidenceService.js) | `includeDiscoveredPatterns` default changed from `true` → `false`; stops classification-time dependence on `discovered_patterns` |
> | Tests updated | [`server/src/__tests__/services/classificationEvidenceService.test.js`](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/services/classificationEvidenceService.test.js), [`server/src/__tests__/signalCollector.test.js`](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/signalCollector.test.js), [`server/src/__tests__/clarification.test.js`](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/clarification.test.js), [`server/src/__tests__/classification.test.js`](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/classification.test.js) | All Phase 7 write path and read path tests updated; dead `checkLearnedPatterns` test describe removed |
>
> **Legacy tables not dropped** — `learning_patterns`, `discovered_patterns`, `pattern_match_log` tables remain. Deletion requires parity checks, production observability review, and retry/purge behavior validation (see Proposed Compatibility Rules below).

After parity and observability are proven:

- stop writes to `learning_patterns`
- stop classification-time dependence on `discovered_patterns`
- retain legacy reads for a short compatibility window if needed
- then remove or archive legacy paths

#### Proposed Compatibility Rules

- compatibility window should preserve old method displays in stats/history exports where necessary
- backfilled legacy rows should remain queryable for audit/debug until cutover is complete
- deletion of old tables should happen only after:
  - parity checks
  - production observability review
  - retry/purge behavior validation

#### Proposed Cleanup Targets

- [classification.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classification.js)
  - remove `checkLearnedPatterns()` shortcut path
- [signalCollector.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/signalCollector.js)
  - remove duplicate `LEARNED_PATTERN` fallback handling
- [patternSignalCollector.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/patternSignalCollector.js)
  - either collapse into the new evidence service or demote to mined-candidate collection only
- legacy tables:
  - `learning_patterns`
  - `discovered_patterns`
  - `pattern_match_log`

---

## 9. Write and Reinforcement Rules

### 9.1 Human-Confirmed Sources That Should Strengthen Evidence

- policy question resolution
- explicit manual correction
- Discord confirmation/correction
- retry-confirmed final outcomes where a human confirmed the new result

### 9.2 Sources That Must Not Become Authoritative

- mined pattern discovery alone
- AI-only decisions
- machine-only policy auto decisions without later confirmation

### 9.3 Purge Semantics

Current purge only removes `exact_match`.

Target purge should support explicit scopes:

- purge exact evidence only
- purge related evidence for a specific item family
- purge all evidence generated from a specific classification if required

This is especially important for retry/relearn workflows.

#### Example Purge API Contract

```json
{
  "tmdbId": 550,
  "mediaType": "movie",
  "scopes": ["item_exact", "genre"],
  "reason": "retry_relearn"
}
```

Expected behavior:
- remove exact evidence for the item
- remove related evidence directly derived from the same confirmed outcome when requested
- leave unrelated mined evidence untouched unless explicitly targeted

---

## 10. Operator and UI Changes

### 10.1 Visibility Goals

Operators should be able to answer:

- Why did this item get confidence from related evidence?
- Was that evidence human-confirmed or mined?
- Which scope contributed: genre, studio, franchise, certification, or exact?
- How often has that evidence been correct?
- Can it be decayed, dismissed, or purged?

### 10.2 Method Terminology Cleanup

Current `learned_pattern` is misleading because it implies a broad learned-similarity capability while runtime behavior is mostly genre-only.

Recommended future terminology:

- `Exact Match`
- `Related Evidence`
- `Pattern-Supported Policy`

The old `learned_pattern` method name should be preserved only during compatibility.

---

## 11. Risks

### Risk 1: Hidden Behavior Drift

If related evidence is removed from the early shortcut path without compensating score adjustments, auto-routing rates may drop.

Mitigation:
- dual-write first
- compare old-vs-new decisions in tests and sampled diagnostics

### Risk 2: Over-Promotion of Weak Evidence

If mined evidence is treated like human-confirmed evidence, false confidence will rise.

Mitigation:
- enforce provenance-based trust tiers
- keep `exact_match` as the only authoritative learned memory

### Risk 3: Ambiguous Backfill Provenance

Old rows may not clearly identify whether they were human-confirmed or machine-derived.

Mitigation:
- use conservative default provenance during backfill
- do not backfill uncertain legacy rows as authoritative

### Risk 4: Method Analytics Drift

Changing method semantics can break dashboards, stats, or user expectations.

Mitigation:
- compatibility mapping in stats/history during rollout
- explicit method migration notes in release docs

### Risk 5: Backup and Reset Drift

If backup, restore, or reset tooling continues to assume legacy tables are the only source of learned state, operators may think they preserved or cleared evidence when they did not.

Mitigation:
- include [backupService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/backupService.js) and [queueCarsaService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/queueCarsaService.js) in the migration plan
- add restore/backfill tests that cover both legacy and unified evidence storage
- make reset tooling scope-aware before removing legacy tables

### Risk 6: AI Double Counting and Hidden Bias

If related evidence is scored by PolicyEngine and then also injected into AI as a strong narrative cue without guardrails, AI may over-trust the same signal twice.

Mitigation:
- pass only summarized, provenance-aware related evidence into verify-mode AI context
- keep AI in explanation/verification mode rather than evidence promotion mode
- do not use related evidence as both a hidden prompt instruction and a score lift

---

## 12. Testing Strategy

### 12.1 Unit Tests

Add direct tests for:

- exact-match authoritative lookup
- related evidence scoring aggregation
- provenance-based trust behavior
- reinforcement and decay rules
- purge scope behavior
- backfill mapping correctness
- compatibility-read behavior during dual-write

### 12.1A Server Unit Suite Expansion Map

The following existing unit suites should be treated as primary extension points.

#### Classification and write-path suites

- [classification.test.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/classification.test.js)
  - extend for:
    - unified evidence lookup precedence
    - compatibility mapping back to legacy `method`
    - exact vs related vs policy vs AI precedence
  - keep this as the main runtime contract suite
- [clarification.test.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/clarification.test.js)
  - extend for:
    - unified evidence write semantics
    - provenance assignment
    - merge/reinforcement behavior
- [classificationRetryService.test.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/services/classificationRetryService.test.js)
  - extend for:
    - multi-scope purge behavior
    - retry/relearn evidence lifecycle
- [queueAdminService.test.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/queueAdminService.test.js)
  - extend for:
    - manual/admin write compatibility
- [queueService.test.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/queueService.test.js)
  - extend for:
    - reset/clear-and-resync evidence cleanup compatibility

#### Policy and scoring suites

- [policyEngine.combinationModes.test.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/policyEngine.combinationModes.test.js)
  - extend for:
    - related-evidence-aware scoring inputs
    - `require_all` and mixed-signal compatibility
- [policyEngine.presetSemantics.test.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/policyEngine.presetSemantics.test.js)
  - extend for:
    - policy behavior when related evidence coexists with presets
- [signalCollector.test.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/signalCollector.test.js)
  - extend for:
    - evidence-to-signal compatibility mapping
    - legacy `LEARNED_PATTERN` retirement path
- [classification-methods-constraint.test.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/classification-methods-constraint.test.js)
  - keep as the enum/backward-compatibility guard

### 12.1B Net-New Server Unit Suites

The current suite layout has real gaps that should be filled explicitly.

#### New suites to add

- `server/src/__tests__/services/classificationEvidenceService.test.js`
  - owns:
    - exact lookup contract
    - related-evidence collection contract
    - compatibility-read behavior during dual-read
- `server/src/__tests__/services/classificationEvidenceWriteService.test.js`
  - owns:
    - exact writes
    - related writes
    - provenance enforcement
    - duplicate/merge semantics
- `server/src/__tests__/services/classificationEvidenceReinforcementService.test.js`
  - owns:
    - reinforcement
    - decay
    - support-count updates
    - conflict handling
- `server/src/__tests__/services/classificationEvidenceLifecycleService.test.js`
  - owns:
    - scope-aware purge
    - retry purge
    - restore merge behavior
    - reset behavior
- `server/src/__tests__/patternSignalCollector.test.js`
  - there is currently no direct unit owner for this runtime-critical adapter
- `server/src/__tests__/confidenceCalculator.test.js`
  - there is currently no direct unit owner for learned-pattern/evidence weight behavior
- `server/src/__tests__/patternReinforcementService.test.js`
  - route tests mock it, but no direct service suite owns it
- `server/src/__tests__/policyEngine.evidenceScoring.test.js`
  - focused unit coverage for the future `related_evidence` channel without overloading preset-specific tests
- `server/src/__tests__/policyDecisionBuilder.test.js`
  - contract suite for the normalized PolicyEngine DTO
- `server/src/__tests__/classificationEvidenceKeyBuilder.test.js`
  - canonical key-shape coverage, especially for genre normalization

### 12.1C Highest-Risk Unit Contract Gaps

These gaps should be considered blocking before runtime cutover:

- no direct unit suite for [patternSignalCollector.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/patternSignalCollector.js)
- no direct unit suite for [confidenceCalculator.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/confidenceCalculator.js)
- no dedicated unit owner for unified evidence precedence rules
- no dedicated DTO contract tests for the normalized PolicyEngine result shape
- no unit suite that pins backup/reset/retry semantics for unified evidence lifecycle

### 12.2 Integration Tests

Add integration tests for:

- policy-question confirmation writes exact and related evidence
- manual correction writes exact evidence and updates related evidence appropriately
- policy scoring includes related evidence once, not twice
- AI skip remains limited to exact-match cases
- retry purge clears intended evidence scopes
- old and new evidence stores stay consistent during dual-write

### 12.2A Integration Suite Expansion Map

The following existing integration suites should be extended instead of replaced.

- [integration/policyEngine.test.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/integration/policyEngine.test.js)
  - extend for:
    - related evidence contributing to policy scoring
    - action changes caused by related evidence
    - compatibility of `scores`, `weights`, and `breakdown`
- [integration/ai-skip-logic.test.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/integration/ai-skip-logic.test.js)
  - extend for:
    - policy auto-route caused by unified related evidence
    - medium-confidence related evidence resulting in `prompt_confirm` or `prompt_select`
- [classification.test.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/classification.test.js)
  - although unit-heavy, it remains a key persistence contract suite for `classification_details`
- [integration/classification-retry-service.test.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/integration/classification-retry-service.test.js)
  - extend for:
    - multi-scope evidence purge
    - retry lifecycle correctness
- [integration/stats-api.test.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/integration/stats-api.test.js)
  - extend for:
    - explicit learned/evidence method bucket compatibility
- [classification-history-filters.test.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/classification-history-filters.test.js)
  - extend for:
    - `learned_pattern`
    - mixed legacy/new method filters
- [prompts-routes.test.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/prompts-routes.test.js)
  - keep as a route-unit guard, but pair it with real integration coverage

### 12.2B Net-New Integration Suites

Recommended new integration files:

- `server/src/__tests__/integration/learned-pattern-unification.test.js`
  - end-to-end flow for:
    - legacy learned-pattern shortcut
    - unified related evidence flowing into policy scoring
    - AI skip behavior under the new model
- `server/src/__tests__/integration/policy-decision-contract.test.js`
  - locks down normalized PolicyEngine DTO across actions
- `server/src/__tests__/integration/classification-history-contract.test.js`
  - round-trip contract coverage for:
    - `method`
    - `classification_details`
    - evidence metadata
    - compatibility labels
- `server/src/__tests__/integration/prompts-api.test.js`
  - real prompt response flow against pattern/evidence state changes
- `server/src/__tests__/integration/evidence-stats-compatibility.test.js`
  - explicit stats/history compatibility checks during rollout states

### 12.2C Lifecycle, Migration, and Maintenance Tests

This rollout has unusually high lifecycle risk. Treat these as first-class tests, not follow-up work.

#### Existing suites to extend

- [backupService.test.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/backupService.test.js)
  - extend mocked collect/restore behavior
- [integration/classification-retry-service.test.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/integration/classification-retry-service.test.js)
  - real-DB purge and retry lifecycle
- [queueService.test.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/queueService.test.js)
  - clear-and-resync/delete-order compatibility
- [scheduler.test.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/scheduler.test.js)
  - ensure maintenance jobs do not mutate evidence unexpectedly
- [migrations.test.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/migrations.test.js)
  - evidence schema/index/idempotency checks
- [integration/migration-system.test.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/integration/migration-system.test.js)
  - migration execution harness
- [integration/legacy-migration.test.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/integration/legacy-migration.test.js)
  - best pattern to reuse for evidence backfill validation

#### New lifecycle/migration tests

- `server/src/__tests__/integration/evidence-backup-restore.test.js`
  - exact + related evidence backup/restore
  - merge vs replace mode
  - library remap behavior
  - duplicate handling
- `server/src/__tests__/integration/evidence-backfill.test.js`
  - seed legacy `learning_patterns` and `discovered_patterns`
  - run migration/backfill
  - assert provenance, keys, confidence, and dedupe behavior
- `server/src/__tests__/services/classificationEvidenceLifecycleService.test.js`
  - service-level purge/reset coverage
- optional script harness:
  - `scripts/__tests__/backfill_classification_evidence.test.js`

#### Highest-risk lifecycle regressions to pin down

- backup/restore duplicate drift
- retry purge leaving behind related evidence
- reset tooling clearing only legacy tables
- migration/backfill key mismatch, especially for genre evidence
- maintenance jobs unintentionally preserving or deleting evidence

### 12.2D Shadow-Mode and Compatibility Tests

Add integration coverage for rollout states, not just end-state behavior:

- dual-write on, legacy reads still active
- shadow reads active, decisions still made from legacy logic
- related-evidence scoring enabled, legacy shortcut disabled
- stats/history compatibility mapping still returns stable operator-facing labels

This is important because the highest-risk failures are likely to happen during partial rollout rather than after final cutover.

### 12.3 UI Tests

Update tests for:

- history method labels
- activity/dashboard method badges
- operator evidence visibility surfaces

### 12.3A Client and Operator Suite Expansion Map

The highest-value client suites to extend are the reporting and compatibility surfaces.

- [History.test.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/__tests__/views/History.test.js)
  - extend for:
    - legacy `learned_pattern`
    - `exact_match`
    - future evidence-backed method labels
    - mixed datasets during compatibility
- [HistoryEnhancements.test.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/__tests__/views/HistoryEnhancements.test.js)
  - extend for:
    - method-filter compatibility
    - future `related_evidence` detail rendering
- [Dashboard.test.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/__tests__/Dashboard.test.js)
  - extend beyond SWR/cache behavior into method icon/label/tooltip compatibility
- [Activity.spec.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/__tests__/Activity.spec.js)
  - extend for compact method label/icon compatibility
- [ClassificationStats.test.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/__tests__/ClassificationStats.test.js)
  - extend for:
    - `byMethod` compatibility buckets
    - color mapping
    - legacy/new method coexistence
- [AI.test.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/__tests__/settings/AI.test.js)
  - extend when terminology shifts from pattern-only to evidence-aware settings copy
- [api.domains.test.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/__tests__/api.domains.test.js)
  - extend when evidence admin endpoints are introduced while preserving `/patterns/*` compatibility

### 12.3B Net-New Client Tests

Recommended new client test units:

- `client/src/__tests__/classificationMethodPresentation.test.js`
  - shared label/icon/color compatibility mapping
- `client/src/__tests__/evidenceCompatibilityMapping.test.js`
  - if a dedicated mapper utility is introduced
- direct tests for:
  - `HistoryEvidencePanel.vue` if added
  - new evidence admin components under `client/src/components/evidence`
  - new `Evidence.vue` page and its composables

### 12.3C Client Compatibility Risks To Capture

These should be explicit test concerns in the plan:

- method filter options and labels in [History.vue](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/History.vue)
- compact badge semantics in [Activity.vue](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/Activity.vue)
- icon/tooltip wording in [Dashboard.vue](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/Dashboard.vue)
- method color buckets in [ClassificationStats.vue](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/statistics/ClassificationStats.vue)
- operator/admin wording in settings and pattern/evidence surfaces

### 12.4 Example Test Scenarios

1. **Exact match remains authoritative**
   - seed `item_exact`
   - assert immediate exact-match return
   - assert AI path is not invoked

2. **Related evidence is scored but not authoritative**
   - seed `genre` evidence with high confidence
   - assert no early return
   - assert policy scoring includes related evidence contribution

3. **Mined evidence cannot become authoritative**
   - seed `studio` evidence with `provenance = mined`
   - assert it never bypasses AI even at high confidence

4. **Retry purge is scope-aware**
   - seed both `item_exact` and `genre`
   - purge exact only
   - assert related evidence remains

5. **Dual-write parity**
   - trigger policy-question resolution
   - assert old `learning_patterns` write still occurs during compatibility
   - assert corresponding new `classification_evidence` row is written

6. **AI sees summarized related evidence only**
   - seed related evidence
   - assert `signalContext` or prompt-context summary includes scoped evidence support
   - assert raw evidence rows are not injected as opaque prompt clutter

7. **RAG remains separate from learned evidence**
   - seed related evidence and RAG matches
   - assert related evidence affects policy support only once
   - assert RAG similarity still arrives through its own context path

8. **History compatibility mapping**
   - seed results classified through new related-evidence flow
   - assert legacy stats/history responses can still present a stable compatibility label during rollout

---

## 12.5 Explorer Workstreams

The plan should be validated against four codebase exploration tracks before Phase 1 implementation starts:

1. **Classification runtime and learning writes**
   - map all `learning_patterns` reads, writes, retry purge behavior, and method semantics

2. **Policy/pattern scoring and reinforcement**
   - map how `discovered_patterns` enters policy scoring, stats, pattern admin, and reinforcement

3. **AI / RAG / policy-question context**
   - determine where summarized related evidence can safely improve explanation quality without creating hidden overrides

4. **Client/operator/reporting surfaces**
   - inventory all places where `learned_pattern`, `exact_match`, and pattern-derived analytics are user-visible

Each workstream should produce:

- file inventory
- compatibility constraints
- rollout risks
- recommended changes to the phase plan

### 12.5A Explorer Brief 1: Classification Runtime and Learning Writes

Focus:

- [classification.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classification.js)
- [signalCollector.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/signalCollector.js)
- [confidenceCalculator.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/confidenceCalculator.js)
- [clarificationService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/clarificationService.js)
- [classificationRetryService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classificationRetryService.js)
- [classification.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/routes/classification.js)
- [discordBot.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/discordBot.js)
- [queueAdminService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/queueAdminService.js)

Questions:

- where exactly are `learning_patterns` read, written, incremented, and purged?
- what is the minimum safe replacement seam for `checkExactMatch(...)` and `checkLearnedPatterns(...)`?
- which writes are truly human-confirmed versus merely operationally inferred?
- how should retry and purge semantics map into `classification_evidence` without over-deleting?

Expected output:

- a canonical inventory of all `learning_patterns` touchpoints
- a Phase 1 dual-write list
- a Phase 4 read-cutover list

### 12.5B Explorer Brief 2: Policy / Pattern Scoring and Reinforcement

Focus:

- [policyEngine.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyEngine.js)
- [patternSignalCollector.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/patternSignalCollector.js)
- [patternReinforcementService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/patternReinforcementService.js)
- [patternMiningService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/patternMiningService.js)
- [feedbackAnalysis.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/feedbackAnalysis.js)
- [formulaEngine.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/formulaEngine.js)
- [patterns.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/routes/patterns.js)
- [stats.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/routes/stats.js)

Questions:

- which parts of `discovered_patterns` are runtime-critical scoring inputs vs candidate-generation/admin behavior?
- should `patternSignalCollector` collapse into `classificationEvidenceService`, or remain a mined-candidate adapter?
- where do stats and cost-savings routes rely on `learned_pattern` or pattern-derived categories?
- what compatibility aliases are needed while `pattern` becomes `related_evidence`?

Expected output:

- a proposed runtime split between candidate generation and scored evidence
- a compatibility plan for stats/admin routes
- Phase 3-5 migration notes for policy scoring

### 12.5C Explorer Brief 3: AI / RAG / Policy-Question Context

Focus:

- [classification.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classification.js)
- [aiPromptBuilder.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/aiPromptBuilder.js)
- [aiResponseParser.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/aiResponseParser.js)
- [contextManager.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/contextManager.js)
- [policyQuestionBuilder.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyQuestionBuilder.js)
- RAG services/helpers that build `ragContext`

Questions:

- where are `signalContext` and `ragContext` built, summarized, and consumed?
- what evidence summary can be safely exposed to AI verification without creating hidden overrides?
- what evidence summary can improve clarification questions and operator diagnostics?
- what should remain outside RAG retrieval to avoid double-counting and mutable retrieval bias?

Expected output:

- a proposed `relatedEvidenceSummary` contract
- prompt and question-builder guardrails
- Phase 4 recommendations for AI/RAG-aware explanation only

### 12.5D Explorer Brief 4: Client / Operator / Reporting Surfaces

Focus:

- [History.vue](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/History.vue)
- [Activity.vue](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/Activity.vue)
- [Dashboard.vue](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/Dashboard.vue)
- [ClassificationStats.vue](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/statistics/ClassificationStats.vue)
- pattern/admin routes and any related client consumers
- Discord/operator-facing method presentation paths

Questions:

- where are `learned_pattern`, `exact_match`, and pattern-derived analytics currently user-visible?
- what compatibility mapping is required so rollout does not break charts, labels, or operator expectations?
- what should the first unified evidence admin surface show?
- which views should stay compatibility-mapped longest?

Expected output:

- a UI/reporting compatibility matrix
- phased label migration guidance
- candidate requirements for a unified evidence admin screen

---

## 13. Acceptance Criteria

Phase 1-2 acceptance:

- `classification_evidence` exists
- legacy data is backfilled conservatively
- dual-write exists for confirmed human flows
- no runtime classification behavior change yet

Phase 3-5 acceptance:

- exact-match remains authoritative
- related evidence is scored in one path only
- no `genre_pattern` early shortcut remains
- reinforcement and purge behavior are unified

Phase 6-7 acceptance:

- UI terminology is coherent
- operator visibility exists for the new evidence model
- legacy paths are read-only or removed

---

## 14. Recommended Initial PR Scope

The first implementation PR should only include:

1. `classificationEvidenceService` contract
2. schema migration for `classification_evidence`
3. backfill migration or deterministic backfill script
4. dual-write from confirmed human flows
5. tests for schema/service/dual-write

It should explicitly avoid:

- changing classification-time read behavior
- changing policy scoring behavior
- changing UI method semantics

This keeps the first rollout observable and low-risk.

### 14.1 Proposed First PR Files

Likely first-PR file set:

- new docs / tests:
  - [implementation_plan_learned_pattern_evidence_unification.md](c:/Users/Moreland/Repositories/Classifarr/Classifarr/docs/implementation_plan_learned_pattern_evidence_unification.md)
  - `server/src/__tests__/services/classificationEvidenceService.test.js`
- new service:
  - `server/src/services/classificationEvidenceService.js`
- migration / backfill:
  - `database/migrations/YYYYMMDD_HHMMSS_add_classification_evidence.sql`
  - `scripts/backfill_classification_evidence.js`
- dual-write touchpoints:
  - [clarificationService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/clarificationService.js)
  - [classification.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/routes/classification.js)
  - [discordBot.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/discordBot.js)
  - [queueAdminService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/queueAdminService.js)

---

## 15. Open Questions

1. Should `profile_affinity` live in the same evidence table, or remain a computed score outside persisted evidence?
2. Should mined pattern discovery continue at all after related evidence is unified, or should it be demoted to candidate generation only?
3. Do we want one operator UI for all evidence scopes, or keep pattern mining administration separate from confirmed evidence administration?
4. Should `retry_confirmed` provenance require explicit human confirmation, or can some retry flows promote evidence automatically under strict rules?
5. Should PolicyEngine keep the public score label `pattern` during compatibility, while internally sourcing from `related_evidence`?
6. Should AI verification receive provenance-aware related evidence in Phase 4, or should that wait until after the policy cutover stabilizes?
7. Should RAG diagnostics become the first operator-facing surface for unified evidence, or should a dedicated evidence admin screen land first?

---

## 16. Codebase Exploration Lanes

The implementation work should continue to be grounded in codebase exploration, not just schema design. The following lanes are the highest-value discovery passes.

### Lane A: Classification and correction-memory seams

Focus:
- [classification.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classification.js)
- [signalCollector.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/signalCollector.js)
- [confidenceCalculator.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/confidenceCalculator.js)
- [clarificationService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/clarificationService.js)
- [classificationRetryService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classificationRetryService.js)

Questions:
- where are the last direct `learning_patterns` reads and writes?
- what is the minimum-risk contract for a new evidence service?
- what purge semantics are actually required by retry and correction flows?

Initial findings:
- reads are still concentrated in [classification.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classification.js):
  - `checkExactMatch(...)`
  - `checkLearnedPatterns(metadata)`
- writes are spread across:
  - [clarificationService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/clarificationService.js)
  - [classification.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/routes/classification.js)
  - [discordBot.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/discordBot.js)
  - [queueAdminService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/queueAdminService.js)
- retry purge in [classificationRetryService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classificationRetryService.js) currently deletes only `exact_match`
- [backupService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/backupService.js) still backs up and restores all `learning_patterns` as one undifferentiated dataset
- `genre_pattern` currently has split semantics:
  - authoritative early return in [classification.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classification.js)
  - advisory `LEARNED_PATTERN` signal in [signalCollector.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/signalCollector.js) and [confidenceCalculator.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/confidenceCalculator.js)
- this lane is the strongest argument for introducing `classificationEvidenceService` as a wrapper first, before any read-path cutover

### Lane B: Policy scoring and mined-pattern lifecycle

Focus:
- [policyEngine.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyEngine.js)
- [patternSignalCollector.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/patternSignalCollector.js)
- [patternMiningService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/patternMiningService.js)
- [patternReinforcementService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/patternReinforcementService.js)
- [patterns.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/routes/patterns.js)

Questions:
- which discovered-pattern behaviors are true runtime dependencies?
- which should remain candidate generation only?
- how do we preserve stats and pattern admin compatibility?

Initial findings:
- PolicyEngine pattern scoring still depends directly on [patternSignalCollector.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/patternSignalCollector.js) and `discovered_patterns`
- mined/reinforced patterns have their own approval, reject, and delete lifecycle through [patterns.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/routes/patterns.js)
- policy settings still expose `trust_patterns`, so compatibility likely needs a read-model layer before renaming that concept publicly
- [patternReinforcementService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/patternReinforcementService.js) is runtime-critical today because it mutates future pattern confidence after accept/correct flows
- [feedbackAnalysis.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/feedbackAnalysis.js) can promote suggestions directly into `discovered_patterns`, so candidate generation and live scoring are currently coupled
- there is a concrete genre-key mismatch:
  - [patternMiningService.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/patternMiningService.js) mines genre rows one way
  - [patternSignalCollector.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/patternSignalCollector.js) looks them up using a different key shape
- this lane suggests keeping discovered-pattern generation/admin semantics alive during compatibility, even if runtime scoring begins to read from unified evidence

### Lane C: AI, RAG, and policy-question surfaces

Focus:
- [aiPromptBuilder.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/aiPromptBuilder.js)
- [aiResponseParser.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/aiResponseParser.js)
- [contextManager.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/contextManager.js)
- [policyQuestionBuilder.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyQuestionBuilder.js)
- RAG helper and diagnostics surfaces

Questions:
- where can unified evidence safely improve explainability?
- where would it cause double-counting or hidden bias?
- what prompt/question payload changes are safe after cutover?

Initial findings:
- AI prompt building currently consumes `signalContext`, `policySignals`, and `ragContext`, not first-class learned evidence rows
- high-confidence `learned_pattern` is more likely to bypass AI than inform it
- policy questions are the cleanest human-facing place to surface provenance-aware related evidence after cutover
- RAG should remain retrieval-only in the first rollout; evidence should annotate diagnostics before it influences retrieval behavior

### Lane D: Operator, history, and analytics compatibility

Focus:
- [History.vue](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/History.vue)
- [Activity.vue](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/Activity.vue)
- [Dashboard.vue](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/Dashboard.vue)
- [ClassificationStats.vue](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/statistics/ClassificationStats.vue)
- server stats/pattern routes

Questions:
- which method labels and stats assume `learned_pattern` exists?
- what compatibility mapping is required during rollout?
- should evidence inspection extend the existing patterns UI or land as a new admin surface?

Initial findings:
- `learned_pattern` is hard-coded in history/activity/dashboard/statistics surfaces, not just stored in server output
- [patterns.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/routes/patterns.js) cost-summary logic treats `learned_pattern`, `exact_match`, and rule methods as one "calls avoided" family
- [History.vue](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/History.vue) already separates method badges from signal-level pattern rows, which makes it the best first compatibility surface for unified evidence metadata
- [discordBot.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/discordBot.js) still has method-label mappings for `learned_pattern`, so Discord/operator messaging needs the same compatibility layer as the web UI
- this lane suggests adding compatibility mapping first, then introducing a dedicated evidence view instead of overloading the old patterns UI immediately

### 16.3 Pre-Implementation Lock Decisions

Before the first migration PR starts, explicitly lock down:

1. Whether `genre_pattern` is officially reclassified as advisory-only from the moment unified evidence exists, or remains compatibility-authoritative until Phase 4 cutover.
2. The canonical evidence-key format for:
   - `genre`
   - `studio`
   - `franchise`
   - `certification`
3. Scope-aware purge/reset semantics for:
   - retry
   - manual relearn
   - backup restore replace-mode
4. Whether PolicyEngine keeps the public `pattern` score label during compatibility while internally reading from unified related evidence.
5. Whether AI verification receives provenance-aware related-evidence summaries in the same release as runtime cutover, or only after parity metrics are stable.
6. Which route becomes the first operator-facing unified evidence view:
   - extend [patterns.js](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/routes/patterns.js)
   - or add a dedicated evidence admin route/read-model

---

## 17. Summary

The core decision is:

- keep exact human-confirmed memory authoritative
- make all broader learned similarity one scored evidence family
- stop maintaining separate runtime truth systems for `learning_patterns` and `discovered_patterns`

This plan starts with a low-risk contract/schema foundation, then moves classification-time behavior only after dual-write and compatibility observability are in place.
