# Issue 275 Implementation Plan

Title: RAG Enhancement: Uncertainty-Triggered Retrieval Loops to Reduce Hallucinations

Owner: Classifarr team
Status: Draft (Not Implementing Yet)
Date: 2026-02-07

## Summary
Add a feedback-driven retrieval loop for low-confidence or conflicting-context cases in the classification flow. When the first retrieval pass produces weak/ambiguous evidence, Classifarr will run a second retrieval pass using an expanded/rewritten query, then re-run (or re-contextualize) the AI verification/classification. The loop is strictly bounded to avoid infinite retries.

Primary outcomes:
- Improved recall when initial retrieval is weak.
- Reduced hallucination risk by grounding the model with better context.
- Better handling of ambiguous titles/franchises/overlapping genres.

## Non-Goals (V1)
- Do not introduce a second LLM just to expand queries.
- Do not change the default behavior unless explicitly enabled via config.
- Do not require database schema changes for the first iteration.
- Do not do cross-cutting refactors across unrelated services/routes.
- Do not feed AI-suggested identifiers directly into PolicyEngine unless they are verifiable from trusted sources (metadata, RAG matches, or authoritative lookups).

## Requirements From Issue 275
1. Detect low-confidence or conflicting-context situations after the initial RAG pass and/or AI analysis.
2. Perform an additional retrieval pass with an expanded/rewritten query.
3. Optional: rerank results from the second pass.
4. Strict limits (max passes/timeout) to avoid infinite loops.
5. Validation with ambiguous inputs.
6. For items below the Policy Builder Threshold (per-policy `prompt_threshold`, typically 60%), attempt a targeted second pass that tries to raise the PolicyEngine score using verifiable identifiers before escalating to user prompts.

## OPENAI.md Structure (3-Layer Architecture)
This plan is organized to follow `OPENAI.md`'s 3-layer architecture (Directive -> Orchestration -> Execution) and operating principles (check tools first; keep changes scoped; self-anneal; update directives with learnings).

### Layer 1: Directive (What To Do)
- Implement a bounded retrieval retry for uncertainty cases (low confidence and/or conflicting retrieval context).
- Make query expansion deterministic and testable.
- Keep feature gated behind settings (default off).
- Produce tests and minimal docs updates that explain behavior and config.

### Layer 2: Orchestration (Decision Making)
Decisions that must be explicitly chosen (and tested):
- Trigger: AI confidence only vs signal confidence vs both.
- Conflict definition: vote split, similarity margin, both.
- Pass 2 retrieval method: hybrid search vs semantic search with relaxed threshold.
- Re-run AI on pass 2: yes/no (and in which mode: classify vs verify).

### Layer 3: Execution (Deterministic Work)
- Prefer extending existing services (`server/src/services/ragRetriever.js`, `server/src/services/classification.js`) instead of new abstractions.
- Use `execution/` only if we need a deterministic harness to replay ambiguous cases; otherwise, cover via unit/integration tests.
- Store any intermediate evaluation artifacts under `.tmp/issue-275/` (never committed).

## Check For Tools First (Repo Principle)
- `directives/` currently contains only `directives/README.md` (no RAG-specific SOP yet).
- `execution/` should be checked for any existing classification/RAG evaluation harness before writing a new one.

Note: creating or overwriting a new directive SOP for this feature should be done only if explicitly requested.

## Current State (Code Map)
1. Classification flow uses RAG once (semantic search) to add a semantic-similarity signal and RAG context.
   - File: `server/src/services/classification.js`
   - Call site: `ragRetriever.semanticSearch(metadata, 5)`
2. RAG retriever supports:
   - `semanticSearch(metadata, limit)` with a `rag_similarity_threshold` filter (returns `[]` if top results are below threshold).
   - `hybridSearch(metadata, limit)` combining semantic + full-text (RRF or legacy fusion).
   - File: `server/src/services/ragRetriever.js`
3. AI step happens after signals are combined. Low AI confidence currently triggers a policy question (not retrieval retry).
   - File: `server/src/services/classification.js`
   - Behavior: when `aiResult.confidence < 70` (and not `needs_clarification`) build a policy question.
4. Policy thresholds are enforced inside PolicyEngine per library policy:
   - File: `server/src/services/policyEngine.js`
   - Behavior: if `top.score < top.prompt_threshold` then `action: 'prompt_select'` (Policy Builder bucket).
   - UI: the Confidence settings page describes the “Policy Builder Threshold” concept (commonly 60%), but PolicyEngine ultimately uses each policy’s stored `prompt_threshold` value.

Key implication:
- Today, "contradiction" is hard to detect from RAG if `semanticSearch()` returns `[]` due to threshold filtering. We will need access to near-miss candidates (or an alternate retrieval mode) to decide whether to retry.

## Proposed Design

### High-Level Flow
Pass 1 (existing):
1. Collect signals
2. RAG retrieval (pass 1)
3. Combine signals -> confidence
4. AI classify/verify using prompt context (includes RAG context)

Pass 2 (new, conditional, bounded):
5. If uncertainty trigger is met:
   - build expanded retrieval query/metadata
   - run RAG retrieval again (prefer hybrid search)
   - merge/rerank contexts
   - re-run AI classify/verify (or re-run verification only, depending on mode)

Optional PolicyEngine re-check path (new, conditional, bounded):
6. If the item falls below the Policy Builder Threshold (PolicyEngine `prompt_threshold`) after pass 1:
   - run a targeted identifier/evidence pass that is deterministic and verifiable
   - re-run PolicyEngine to see whether score crosses `prompt_threshold` (or `auto_classify_threshold`)
   - only if it still remains below threshold do we proceed to Policy Builder UX / manual selection

### Uncertainty Triggers (Version 1)
Trigger should be conservative (avoid extra work unless needed).

Recommended trigger (V1):
- AI result confidence is below a threshold (default 70) AND the AI is not already asking for clarification.

Optional additional triggers (V1.1+):
- RAG conflict detected: retrieved matches vote strongly for multiple different libraries.
- Retrieval weakness: top combined similarity is below threshold but still "close enough" that a second pass may help.
- PolicyEngine low-confidence routing: `policyResult.action === 'prompt_select'` (i.e., `top.score < prompt_threshold`).

### Primary Threshold For This Feature (Policy Builder Threshold)
This plan explicitly targets items below the Policy Builder Threshold:
- If PolicyEngine `top.score < top.prompt_threshold` (typically 60%), treat the item as "low-confidence" for the purpose of the second pass.
- Goal of pass 2: raise the PolicyEngine score by finding additional verifiable identifiers (keywords/genres/franchise/studio/cast) and/or improving RAG context.

### Contradiction/Conflict Detection (RAG)
Define a simple, testable rule based on library vote distribution from matches:
- Consider top N matches (e.g., 5-10).
- Compute votes per `libraryId` and their total similarity.
- "Conflict" if:
  - at least 2 libraries have meaningful support, and
  - the margin between the top 2 libraries is small.

Example rule (tunable):
- conflict if `top1.voteCount >= 2` AND `top2.voteCount >= 2` AND `abs(top1.totalSimilarity - top2.totalSimilarity) <= 0.10 * top1.totalSimilarity`

Note: This requires access to matches even when below `rag_similarity_threshold`.

### Expanded Retrieval Query / Query Rewriting
We should avoid introducing a second LLM just to expand queries (cost/complexity). Use deterministic expansion based on existing metadata fields.

Function: `expandRetrievalMetadata(metadata, options)`
- Inputs:
  - title/year/media_type
  - genres, keywords, franchise/collection, studios, language, cast
- Output:
  - a new metadata object (or a special "searchText" override) biased for retrieval

Expansion strategy (deterministic):
- Always include `title` and `year` if present.
- Add `belongs_to_collection` / franchise when available.
- Add up to:
  - 5 genres
  - 8 keywords
  - 3 cast members
  - 1-3 production companies/studios
- If original title differs (if present in metadata), include it too.
- If the item is likely anime (keyword/genre hints), include "anime" as a term (only when supported by existing metadata).

Implementation detail: `semanticSearch()` uses `embeddingService.formatForEmbedding(metadata)` as the text to embed. Expansion can be achieved by:
- adding a `metadata.rag_query_overrides` object (preferred: explicit and testable), or
- cloning metadata and injecting additional "Keywords"/"Franchise" style fields for embedding text, or
- extending `embeddingService.formatForEmbedding()` to accept an optional `options` object (avoid if it impacts global behavior).

Preferred approach (scoped change):
- Add a new helper in `ragRetriever` such as `buildRetrievalText(metadata, { pass })` that wraps `embeddingService.formatForEmbedding()` and appends pass-specific extra terms.

### Targeted Identification Pass (Policy-Focused, Verifiable)
Goal: for items that land in the Policy Builder bucket (below `prompt_threshold`), run a bounded second pass that tries to find additional evidence that directly maps to existing policy presets/signals.

Key idea:
- Instead of "broadly retrieving more", the second pass is "checking specific identifiers" that can directly trigger a preset/keyword/genre/studio match for a particular library.

Evidence sources (allowed):
- Existing metadata fields already gathered by the pipeline (title/year/type/genres/keywords/franchise/studio/cast/overview/language).
- RAG matches (similar past classifications) and their associated library votes and similarity.
- Authoritative lookups already supported by the system (for example, TMDb enrichment, if already part of the normal metadata acquisition).
- Web search results only if they are structured and can be traced back to a source that the system explicitly fetched (no "AI says it is X" inputs).

Evidence sources (disallowed):
- Unverified identifiers invented by the model during AI analysis (hallucinated keywords/genres/franchises).

What we do with the evidence:
- Build a candidate identifier set:
  - normalize tokens (lowercase, trim, dedupe)
  - restrict sizes (e.g., max 8 keywords, max 5 genres, max 3 studios/cast) to prevent noise
- Run targeted checks that are deterministic:
  - improve retrieval context (pass 2 RAG retrieval) to strengthen the RAG signal for the correct library
  - (optionally) ensure metadata completeness if key fields are missing (keywords/cast/franchise)
- Re-run PolicyEngine with the enriched metadata and updated RAG cache.

Success condition:
- If re-evaluation changes PolicyEngine action from `prompt_select` to `prompt_confirm` or `auto_classify`, we stop and use that result (no extra loops).
- If still `prompt_select`, proceed with the existing "Policy Builder" workflow (manual selection + rule creation guidance).

### Retrieval Pass 2 Strategy
Prefer `hybridSearch()` on pass 2 because it can recover from poor vector matches by using full-text search signals.

Pass 2 retrieval plan:
- Use expanded metadata/terms
- Call `ragRetriever.hybridSearch(expandedMetadata, limit)`
- Optionally rerank:
  - If hybridSearch already uses RRF, keep that.
  - Otherwise (legacy weighted combine), optionally apply a simple rerank by: `combinedScore` then recency.

### Loop Limits / Safety
Hard limits:
- `max_passes = 2` (one retry only) for V1.
- timeout: do not exceed a fixed budget (e.g., 5-10 seconds) for the entire retrieval loop, to avoid blocking the queue.
- if provider/DB errors occur: log and continue without pass 2.

For the PolicyEngine re-check:
- max re-evaluations: 1 (single re-check only).
- strict input hygiene: only use verifiable identifiers (see above).
- strict budget: do not exceed the same global budget used for pass 2 retrieval.

### Logging and Observability
Add explicit logs/metrics for:
- whether pass 2 ran
- why it ran (low confidence vs conflict vs weak retrieval)
- pass 1 vs pass 2 match counts and top similarity
- latency of each pass

Where:
- `server/src/utils/ragLogger.js` for metrics-style events
- standard logger in `classification.js` and/or `ragRetriever.js` for debugging

### Data Model Changes
None required for V1.

Optional later enhancement:
- store a small `rag_loop` object in `classification_details` metadata, e.g.:
  - `rag_loop: { ran: true, reason: 'low_confidence', pass2_top_similarity: 0.78 }`

## Configuration Additions (V1)
Add settings (in `ai_provider_config` or existing settings table, consistent with current RAG config pattern):
- `rag_retrieval_loop_enabled` (boolean, default false for first release)
- `rag_loop_low_confidence_threshold` (numeric, default 0.70)
- `rag_loop_max_passes` (integer, default 2)
- `rag_loop_use_hybrid_on_retry` (boolean, default true)
- `rag_loop_conflict_detection_enabled` (boolean, default false for V1, can turn on later)
- `rag_loop_candidate_limit` (integer, default 25) for conflict detection (if we implement "below threshold candidates")

Add settings for the policy-focused second pass (names TBD, but keep them explicit):
- `policy_recheck_below_prompt_threshold_enabled` (boolean, default false)
- `policy_recheck_max_attempts` (integer, default 1)
- `policy_recheck_allow_web_enrichment` (boolean, default false)
- `policy_recheck_identifier_caps` (json or separate settings; defaults: keywords=8, genres=5, studios=3, cast=3)

Note: keep defaults conservative to avoid surprising CPU/DB load.

## Implementation Steps (Backend)
1. Retrieval candidates for analysis:
   - Add a retrieval method that can return "top K candidates without threshold filtering", for conflict/weakness detection.
   - Options:
     - Add `semanticSearch(metadata, limit, { applyThreshold: true|false })`
     - Add `semanticSearchCandidates(metadata, candidateLimit)` which returns unfiltered results.
2. Add deterministic query expansion:
   - Implement `expandRetrievalMetadata()` (in `ragRetriever.js` or a small helper module).
   - Add unit tests covering expansion output.
3. Add the bounded loop in the classification flow:
   - In `server/src/services/classification.js`, after pass 1 AI result, decide if pass 2 is allowed/needed.
   - If triggered, run retrieval pass 2, rebuild `ragContext`, and re-run `aiClassify()` with an updated prompt context (via `options.ragContext`).
4. Ensure no infinite loops:
   - enforce `max_passes` and timeout budget.
5. Add logging/metrics.
6. Add PolicyEngine re-check (optional but aligned with the "raise above Policy Builder Threshold" goal):
   - When `policyResult.action === 'prompt_select'`, run the targeted identification pass and then re-run PolicyEngine once.
   - Only accept changes that come from verifiable evidence and produce a clearer PolicyEngine outcome.

## Client/UI Scope
V1: no UI changes required (feature can be disabled by default and used in tests).

Optional V1.1:
- show a small badge/diagnostic line in RAG details indicating "retry pass ran" and what changed.
- show a diagnostic line in Policy Builder view indicating "policy re-check ran" and whether it improved the score.

## Tests and Validation
Unit tests:
- `expandRetrievalMetadata()` adds expected fields/terms and is stable (no nondeterministic output).
- conflict detection logic: feed synthetic match sets and validate conflict true/false.
- identifier hygiene tests: AI-provided terms (unverified) must be rejected; only trusted sources are accepted.

Integration tests (server):
- simulate an ambiguous item where pass 1 retrieval is weak and pass 2 is stronger.
  - Mock `ragRetriever` to return:
    - pass 1: empty or low-signal matches
    - pass 2: matches that strongly suggest a library
  - Assert pass 2 path is executed only when triggers are met.
- ensure pass 2 is NOT executed when confidence is already >= threshold or `needs_clarification` is true.
- simulate PolicyEngine `prompt_select` and validate the single re-check attempt:
  - without new evidence, the re-check is a no-op (no behavioral change).
  - with added verifiable identifiers, PolicyEngine score crosses `prompt_threshold` and action changes to `prompt_confirm` (or higher).

Load/perf sanity:
- ensure worst-case classification time impact is bounded (max 2 retrieval calls, 2 AI calls only if configured to re-run AI).

## Rollout Steps
1. Add config keys (default disabled).
2. Implement backend loop and tests.
3. Document the behavior and configuration in `docs/` (and optionally `README.md` if user-facing).
4. Release with feature disabled by default; enable after validation.

## Risks and Mitigations
1. Extra latency and load:
   - Mitigation: feature disabled by default; strict `max_passes`; prefer hybrid on retry only.
2. Incorrect conflict detection causing unnecessary retries:
   - Mitigation: conservative defaults; keep conflict detection off by default in V1.
3. "Contradiction" depends on seeing below-threshold candidates:
   - Mitigation: add an explicit candidate-returning method rather than changing the meaning of `semanticSearch()`.
4. Prompt instability due to changed RAG context:
   - Mitigation: re-run AI only when benefit is expected; keep prompt deltas minimal and deterministic.

## Acceptance Criteria
1. When enabled, low-confidence classifications can trigger exactly one bounded retrieval retry.
2. Pass 2 uses deterministic expansion and produces measurable improvements on a small set of ambiguous test cases.
3. No infinite loops; hard max pass count and timeouts are enforced.
4. Clear logs/metrics indicate when and why the loop ran.
5. Existing behavior is unchanged when the feature is disabled.
6. For items below the Policy Builder Threshold (PolicyEngine `prompt_threshold`), a single targeted second pass can raise the PolicyEngine result when verifiable evidence exists; otherwise the system falls back to the existing Policy Builder flow without introducing hallucinated signals.

## Open Questions (Resolve Before Implementation)
1. Primary trigger:
   - Use AI confidence (`aiResult.confidence`) only, or also include signal-calculator confidence?
2. Re-run AI behavior:
   - On pass 2, do we re-run AI generation, or only adjust verification/prompt context and keep earlier result?
3. Conflict detection:
   - How should "contradiction" be defined for Classifarr libraries (vote split, similarity margin, both)?
4. Retrieval method on pass 2:
   - Always hybridSearch on retry, or choose based on pass 1 outcome?
5. Ordering for low-confidence items below Policy Builder Threshold:
   - Prefer PolicyEngine re-check first (cheaper) or retrieval retry first (may improve RAG score feeding PolicyEngine)?
6. Metadata completeness:
   - Which "missing metadata" conditions justify an additional authoritative fetch (keywords/cast/franchise) and what is the time budget?
