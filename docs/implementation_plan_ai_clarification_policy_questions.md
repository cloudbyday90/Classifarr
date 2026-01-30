# Implementation Plan: Policy-Driven AI Clarification Questions

## Goal
Make Discord clarification questions policy-aware and relevant, using AI analysis + policy signals instead of generic seeded questions (e.g., the current language prompt). The system should ask questions that improve confidence and help refine future classifications.

## Problem Summary
- Clarification questions currently come from the `clarification_questions` table and are not tied to policy signals.
- The language question is unconditional and appears even when `original_language` is already known and no language policies are used.
- When policy presets are not attached, confidence is low and the system falls back to generic questions, which are often irrelevant.

## Desired Behavior
1) When a classification lands in `clarify` tier, the system should generate **policy-relevant** questions:
   - Identify top candidate libraries (by policy scores).
   - Determine **why** confidence is low (conflicting signals or missing signals).
   - Ask a question that disambiguates between top candidates.
2) The language question should only appear when **language is actually relevant**:
   - `original_language` is missing or non-English, **and**
   - a policy using language presets/signals exists.
3) When policy signals are absent (no presets attached), fallback to **manual library selection**, not generic language prompts.

## Scope
- Clarification question generation logic (server).
- Discord clarification UI generation (server).
- Policy-driven clarification is always on (no UI toggle).
- Tests for new decision logic.

## Non-Goals
- Redesigning the policy engine or preset system.
- Changing TMDb/OMDb enrichment behavior (already provides `original_language`).

## Current Flow (Summary)
1) Classification runs policy engine and produces confidence.
2) If confidence in clarify tier, Discord asks questions.
3) Questions come from `clarification_questions` table (seeded list).
4) Language question is always eligible and frequently selected.

## Proposed Design

### A) Build a policy-aware clarification context
**Inputs:**
- `policyResult` (scores, weights, top library candidates).
- `signalContext` (signals, pattern/history/RAG contributions).
- `metadata` (genres, keywords, original_language, etc.).
- `library_policies` + `policy_presets` (policy builder configuration).

**Outputs:**
- A structured “clarification intent” object:
  - `reason`: why the model is unsure
  - `candidates`: top libraries with scores
  - `question`: generated policy question
  - `options`: actionable responses mapped to libraries or actions

### B) Clarification Question Strategy
Priority order:
1) **Policy-driven question** (if top candidates are close or signals conflict)
   - Example: “Is this primarily Action/Fantasy or Comedy/Drama?” (mapped to libraries)
2) **Library-choice question** (if signals are weak or missing)
   - Example: “Which library should this go to?”
3) **Language question** only when:
   - `original_language` is missing or non-English, and
   - policies using language presets exist.
4) **Seeded questions** are deprecated and should not be used except as a hard safety net.

### C) Policy Builder Alignment (Existing Implementation)
The policy builder UI already exists and controls the real signals used for scoring:
- Policies live in `library_policies`.
- Presets are attached via `policy_presets`.
- The full preset catalog is in `content_presets` (including language presets).

Clarification should reflect **attached** presets, not the full catalog. That means:
- If a library policy has **no presets**, clarification should be **library selection** (no signal-based questions).
- If a library policy has presets, questions should be derived from the **active preset signals** (genres/keywords/language/etc.).
- The language question should only appear when a policy actually uses language presets **and** language is unknown or non-English.

#### Policy Builder → Clarification Data Flow (Detailed)
1) **PolicyBuilder UI (Client)**
   - The Policy Builder allows users to select presets and customize signals.
   - Selected presets are persisted by creating/updating `policy_presets` rows.
   - Custom signal overrides are stored in `policy_presets.custom_signals`.

2) **Policy Engine (Server)**
   - `library_policies` are loaded with attached presets.
   - For each policy, `content_presets.signals` + `policy_presets.custom_signals`
     are merged into the evaluation signal set.
   - The policy engine produces:
     - per-library scores and weights
     - candidate ranking
     - signal context for each candidate

3) **Clarification Question Builder (New)**
   - Input: top N candidate libraries + their active preset signals.
   - Identify **conflicts** (e.g., one candidate matches “Family Friendly” while another matches “Action/Crime”).
   - Identify **missing evidence** (e.g., no strong genre/keyword match).
   - Generate a question based on the **signals actually attached to those candidates**.
   - Output: `policy_question` payload for Discord/Web UI.

#### Concrete Example (Intended)
**Library Policies**
- Movies policy has presets: Action, Fantasy, Family Friendly
- TV Shows policy has presets: Reality, Documentary, Kids TV

**Incoming item**
- Genres: Action, Fantasy
- Keywords: superhero, alien planet
- original_language: en

**Clarification outcome**
- Candidates: Movies vs TV Shows
- Signals: strong Action/Fantasy for Movies, weak match for TV
- Question: “Does this belong in Movies or TV Shows?”
- Options: [Movies] [TV Shows]
- No language question (language preset not used for either policy)

#### Example: Language Question Allowed
**Library Policies**
- Anime Movies policy includes preset with `signals.language.require_any = ['ja']`
- Movies policy has no language signal

**Incoming item**
- original_language: ja (or missing)

**Clarification outcome**
- Candidates: Anime Movies vs Movies
- Question: “Is this primarily Japanese language content?”
- Options: [Yes → Anime Movies] [No → Movies]

#### Example: No Presets Attached
**Library Policies**
- Movies policy: 0 presets
- TV Shows policy: 0 presets

**Incoming item**
- Any metadata

**Clarification outcome**
- No signal basis for a targeted question
- Fallback to library selection (manual dropdown or Movies vs TV buttons)

#### Decision Matrix (Inputs → Question Type)
| Condition | Question Type | Example |
|---|---|---|
| Policy has **no presets attached** for top candidates | Library selection | “Which library should this go to?” |
| Top candidates have **conflicting signals** (genre/keywords/profile) | Policy-driven disambiguation | “Is this primarily Action/Fantasy or Comedy/Drama?” |
| Signals are weak/flat but presets exist | Library confirmation | “Does this belong in Movies or TV Shows?” |
| `original_language` missing or non-English **and** a policy uses language presets | Language clarification | “Is this primarily Japanese language content?” |
| `original_language = en` **or** no language presets in policies | **Skip language question** | n/a |
| AI clarification already provided (policy_question exists) | Use AI options | Use provided buttons/options |
| No policy_question + no matched legacy questions | Manual selection fallback | Dropdown only |

#### Media Type Guardrails (Radarr vs Sonarr)
We already enforce media-type alignment in multiple places and should preserve it:
- **Library selection** is filtered by `libraries.media_type` for the item’s `media_type`.
- **Policy selection** is tied to library media type (movie vs tv).
- **Routing** expects `movie → radarr` and `tv → sonarr`.

Implication for clarification:
- Questions and options must only present libraries that match the item’s `media_type`.
- If the item is `movie`, only Radarr-backed libraries are valid.
- If the item is `tv`, only Sonarr-backed libraries are valid.

This is essential to prevent invalid routing and to align with existing filters.

##### Media Type Validation Checklist
- Verify `metadata.media_type` is set before building clarification options.
- Ensure `candidate_libraries` are filtered by `libraries.media_type`.
- Ensure `policy_question.options` only include libraries with matching media_type.
- Assert `arr_type` matches (`movie → radarr`, `tv → sonarr`) before routing.

##### Existing References (for implementation)
- `server/src/services/classification.js` (library lookup uses `media_type`)
- `server/src/services/policyEngine.js` (policies joined to library media_type)
- `server/src/services/reclassificationService.js` (explicit movie/TV routing enforcement)
- `server/src/routes/policies.js` (policy/preset wiring)
- `client/src/components/policies/PolicyBuilderModal.vue` (policy builder UI)

### D) Data Model / Storage
No schema change required if using existing `policy_question` JSON storage.
Standardize the `policy_question` payload format:
```json
{
  "type": "policy",
  "reason": "Conflicting signals between Movies and TV Shows",
  "question": "Which library should this go to?",
  "options": [
    { "label": "Movies", "library_id": 5 },
    { "label": "TV Shows", "library_id": 10 }
  ],
  "meta": {
    "candidates": [{ "library_id": 5, "score": 62 }, { "library_id": 10, "score": 59 }],
    "signals": ["genres", "keywords"]
  }
}
```

### E) Discord Flow Integration
- If `result.needs_clarification` and `policy_question` exists → use policy-driven buttons.
- If no policy question is generated → fallback to library dropdown.
- Disable language buttons when language is known and not relevant.

## Implementation Steps

### 1) Clarification Logic (Server)
- Add a “policy-driven question builder” in `classification.js` or a new service.
- Use `policyResult` and `signalContext` to:
  - detect candidate libraries,
  - detect conflicts or missing signals,
  - form a question and options.
- Gate language questions by:
  - metadata (`original_language`) and
  - policy usage of language presets.
 - Pull attached presets for candidate libraries via `policy_presets` to know which signals are valid for questioning.
 - When presets are missing for all candidates, emit a library-choice question directly (skip seeded questions).

### 2) Discord Message Generation
- Prefer `policy_question` (AI/policy-generated) over seeded questions.
- Do not use `clarification_questions` unless an emergency fallback is required.

### 3) Settings / Controls (Required)
- Policy-driven clarification is **always enabled** (no toggle).
- Legacy rules-based clarification is deprecated; keep only minimal fallback behavior for emergency cases.

### 4) Tests (Comprehensive)
**Unit tests (server):**
- `server/src/__tests__/clarification.test.js`
  - Language question suppressed when `original_language = en`.
  - Language question allowed when `original_language` missing/non-English **and** policy uses language presets.
  - No presets attached → library-choice question (no seeded question).
- New or extended tests for policy-driven question builder:
  - Conflicting signals produce a targeted question.
  - Weak/flat signals produce a library confirmation question.
  - Deterministic ordering of options.

**Discord tests (server):**
- `server/src/__tests__/discordBot.test.js` (new or extend if exists)
  - `policy_question` buttons rendered when present.
  - Dropdown-only fallback when no `policy_question`.
  - Media-type filtering enforced in options.

**Integration tests (server):**
- Extend existing integration suites to cover:
  - Items with attached presets generate policy questions.
  - Items with no presets fall back to manual selection.
  - Language prompt only appears when language presets are attached.

## Reference Queries (Policy/Preset Lookup)
Use these queries during implementation/testing to verify policy wiring:

```sql
-- Libraries by media type (existing filter)
SELECT id, name, media_type, arr_type
FROM libraries
WHERE media_type = $1 AND is_active = true
ORDER BY priority DESC;

-- Policies for a library
SELECT id, name, library_id, enabled, priority
FROM library_policies
WHERE library_id = $1 AND enabled = true
ORDER BY priority DESC, id ASC;

-- Presets attached to a policy
SELECT cp.id, cp.name, cp.signals, pp.weight, pp.custom_signals
FROM policy_presets pp
JOIN content_presets cp ON cp.id = pp.preset_id
WHERE pp.policy_id = $1
ORDER BY pp.id ASC;

-- Detect policies that use language signals
SELECT DISTINCT pp.policy_id
FROM policy_presets pp
JOIN content_presets cp ON cp.id = pp.preset_id
WHERE cp.signals ? 'language';
```

## API Payload Schema (Clarifications)
Standardize `policy_question` payloads stored in `classification_history.policy_question`
and reused by Discord + Web UI:

```json
{
  "type": "policy",
  "reason": "Conflicting signals between Movies and TV Shows",
  "question": "Which library should this go to?",
  "options": [
    { "label": "Movies", "library_id": 5 },
    { "label": "TV Shows", "library_id": 10 }
  ],
  "meta": {
    "candidates": [
      { "library_id": 5, "score": 62 },
      { "library_id": 10, "score": 59 }
    ],
    "signals": ["genres", "keywords"]
  }
}
```

Key rules:
- `options[].library_id` must match the item `media_type`.
- If no candidates exist, emit a library dropdown-only fallback.

## Acceptance Criteria
- Items with known English language no longer get language clarification prompts.
- Items with no attached presets fall back to manual library selection, not language questions.
- When policy signals conflict, Discord asks a relevant, policy-based question.
- Tests cover the decision matrix and pass in CI.

## Coverage Checklist
**API**
- `GET /api/clarifications/:classificationId` returns policy-driven questions when available.
- `POST /api/clarifications/:id/respond` correctly records responses and resolves pending items.
- `GET /api/policies` and `/api/policies/:id` show attached presets (used by clarification logic).

**Database**
- `classification_history.policy_question` populated with policy-driven payloads.
- `classification_history.clarification_status` transitions: `clarify_questions → responded/resolved`.
- `policy_presets` reflect presets actually selected in Policy Builder.

**Discord/UI**
- Discord buttons show policy-driven options (no language buttons unless policy uses language signals).
- Library dropdown is filtered by `media_type`.
- Fallback to library selection when no presets exist.

**Decision Matrix Validation**
- All decision matrix branches exercised by tests.
- Media-type guardrails enforced in every branch.

## Risks / Edge Cases
- Policies with zero presets: should not generate AI clarification questions.
- Libraries with very close scores: ensure deterministic ordering for options.
- Policy question payload format must remain stable for Discord and web UI.

## Release Notes Checklist (v0.40.5-alpha follow-up)
- Clarification questions now policy-driven.
- Language prompts suppressed unless language policies exist or language is unknown.
