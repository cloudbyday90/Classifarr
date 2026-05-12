# Issue 275 Implementation Plan

Title: RAG Enhancement: Uncertainty-Triggered Retrieval Loops to Reduce Hallucinations

Owner: Classifarr team
Status: Implemented and release-ready for V1 (Issue 275 closure scope)
Date: 2026-02-11

## Summary
Add a feedback-driven retrieval loop for low-confidence or conflicting-context cases in the classification flow. When the first retrieval pass produces weak/ambiguous evidence, Classifarr will run a second retrieval pass using an expanded/rewritten query, then re-run (or re-contextualize) the AI verification/classification. The loop is strictly bounded to avoid infinite retries.

Primary outcomes:
- Improved recall when initial retrieval is weak.
- Reduced hallucination risk by grounding the model with better context.
- Better handling of ambiguous titles/franchises/overlapping genres.

## Rollout Policy Update (2026-02-11)
- Activation policy is direct `apply` mode by default.
- No pre-activation waiting period is required.
- `shadow` remains available for rollback/diagnostics.
- Automatic regression fallback (`apply` -> `shadow`) is enabled by default and can be disabled by operators.
- If any section below conflicts, this policy and `docs/issue-275-release-runbook.md` are authoritative.

## Non-Goals (V1)
- Do not introduce a second LLM just to expand queries.
- Do not remove operator control over rollout behavior (`apply` or `shadow`) via config.
- Do not introduce new domain tables for the first iteration; limit DB changes to bounded config/optional index migrations only.
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
- Keep feature gated behind settings (default on, operator-adjustable).
- Produce tests and minimal docs updates that explain behavior and config.

### Layer 2: Orchestration (Decision Making)
Decisions that must be explicitly chosen (and tested):
- Rollout mode: resolved to direct-apply activation with optional shadow fallback.
- Auto fallback policy: resolved to sustained-regression auto-switch from `apply` to `shadow` (default on).
- Scope of control: resolved to phased model (V1 global-only, V1.1 selective per-policy overrides).
- Trigger: resolved to policy-first with AI/signal fallback.
- Conflict definition: resolved to hybrid (vote split + similarity margin + minimum quality).
- Pass 2 retrieval method: resolved to adaptive `auto` selector (hybrid vs semantic-focused based on pass-1 diagnostics).
- Re-run AI on pass 2: resolved to conditional rerun with strict gating and max call budget.
- Metadata completeness and enrichment budget: resolved to bounded authoritative enrichment gate.

### Layer 3: Execution (Deterministic Work)
- Prefer extending existing services (`server/src/services/ragRetriever.mjs`, `server/src/services/classification.mjs`) instead of new abstractions.
- Use `execution/` only if we need a deterministic harness to replay ambiguous cases; otherwise, cover via unit/integration tests.
- Store any intermediate evaluation artifacts under `.tmp/issue-275/` (never committed).

## Check For Tools First (Repo Principle)
- `directives/` currently contains only `directives/README.md` (no RAG-specific SOP yet).
- `execution/` should be checked for any existing classification/RAG evaluation harness before writing a new one.

Note: creating or overwriting a new directive SOP for this feature should be done only if explicitly requested.

## Current State (Code Map)
1. Classification flow uses RAG once (semantic search) to add a semantic-similarity signal and RAG context.
   - File: `server/src/services/classification.mjs`
   - Call site: `ragRetriever.semanticSearch(metadata, 5)`
2. RAG retriever supports:
   - `semanticSearch(metadata, limit)` with a `rag_similarity_threshold` filter (returns `[]` if top results are below threshold).
   - `hybridSearch(metadata, limit)` combining semantic + full-text (RRF or legacy fusion).
   - File: `server/src/services/ragRetriever.mjs`
3. AI step happens after signals are combined. Low AI confidence currently triggers a policy question (not retrieval retry).
   - File: `server/src/services/classification.mjs`
   - Behavior: when `aiResult.confidence < 70` (and not `needs_clarification`) build a policy question.
4. Policy thresholds are enforced inside PolicyEngine per library policy:
   - File: `server/src/services/policyEngine.mjs`
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
   - apply AI rerun gate (rerun only when evidence materially improves)

PolicyEngine re-check path (new, conditional, bounded):
6. If the item falls below the Policy Builder Threshold (PolicyEngine `prompt_threshold`) after pass 1:
   - run a targeted identifier/evidence pass that is deterministic and verifiable
   - re-run PolicyEngine to see whether score crosses `prompt_threshold` (or `auto_classify_threshold`)
   - only if it still remains below threshold do we proceed to Policy Builder UX / manual selection

### Rollout Mode (Resolved)
Use direct `apply` activation by default, with `shadow` retained as an operational fallback/diagnostic mode.

Decision:
1. Default rollout mode for V1: `apply`
   - second-pass logic executes and may influence final classification/routing when comparator gates pass
2. Optional diagnostic mode: `shadow`
   - available for troubleshooting, rollback drills, and non-invasive evaluation

Why this is best practice for this deployment profile:
- Low-volume environments may take too long to satisfy sample-based shadow gates.
- Comparator/resilience/fail-open controls already bound risk at runtime.
- Fast activation delivers immediate benefit while preserving a configuration-only rollback path.

Activation checks (recommended):
- Confirm trace and stage-level diagnostics are queryable.
- Confirm no material increase in timeout/error rate or latency during normal operations Operational Visibility.
- Keep rollback one switch away (`apply` -> `shadow`).

### Automatic Regression Fallback (Resolved)
Run with immediate `apply`, but make rollback hands-off by default when sustained regressions are detected.

Decision:
1. Automatic fallback is enabled by default.
2. When in `apply`, sustained threshold breaches automatically switch mode to `shadow`.
3. Automatic re-promotion back to `apply` is disabled by default (operator/manual decision).
4. Operators can disable automatic fallback from Classification Settings if they do not want this behavior.

Fallback trigger model:
- Evaluate only while `rag_loop_rollout_mode=apply`.
- Require a minimum number of apply samples before evaluating breaches.
- Use existing regression thresholds (`rag_loop_shadow_max_error_rate_delta`, `rag_loop_shadow_max_p95_latency_delta_ms`) as comparator gates.
- Require consecutive breach windows to avoid one-spike mode flips.
- Apply cooldown after a switch so mode changes do not flap.

Locked V1 defaults (no ambiguity):
- `rag_loop_auto_fallback_enabled=true`
- `rag_loop_auto_fallback_min_apply_samples=25`
- `rag_loop_auto_fallback_consecutive_breaches=3`
- `rag_loop_auto_fallback_cooldown_ms=900000` (15 minutes)
- `rag_loop_shadow_max_error_rate_delta=0.01`
- `rag_loop_shadow_max_p95_latency_delta_ms=250`

Operational behavior:
- On trigger: update `ai_provider_config.rag_loop_rollout_mode` to `shadow`, emit structured fallback incident event, and annotate reason code(s).
- While in `shadow`: continue traces/diagnostics; no behavior-changing decisions are applied.
- Recovery to `apply`: manual by default through settings/API, after operator review.

### Auto-Fallback Incident Reporting (Resolved)
When automatic fallback triggers, create an operator-copyable incident payload so users can open a high-quality bug report.

Requirements:
1. Emit a structured event with severity `ERROR` and reason code `rollout_auto_fallback_triggered`.
2. Persist a sanitized incident bundle in config-backed state (no secrets, no raw prompts/responses).
3. Expose latest incident via API for UI copy action.
4. Show a user-visible error banner in Classification Settings with:
   - what happened (`apply` -> `shadow`)
   - incident ID
   - timestamp
   - Copy Report button
   - Open Issue helper link

Incident payload contract (copy/report bundle):
- `incident_id`
- `triggered_at`
- `from_mode`, `to_mode`
- `app_version`, `image_tag` (if available), `node_version`
- `thresholds` (error/latency/sample/breach/cooldown values)
- `observed_metrics` (apply sample count, error delta, p95 latency delta, consecutive breaches)
- `top_reason_codes` (recent stage/reason counts)
- `recent_correlation_ids` (bounded list)
- `fallback_state` (auto-fallback enabled, auto-recover enabled, cooldown status)
- `redaction_version`

### Automatic Re-Enable After Upgrade (Resolved)
Support opt-in automatic re-enable of `apply` after a newer release is deployed.

Decision:
1. `rag_loop_auto_recover_enabled` toggle controls this behavior (default `false`).
2. Auto-recover is version-aware: only attempt when current app version is newer than the version that triggered fallback.
3. Only one auto-recover attempt per version.
4. Auto-recover attempts set mode back to `apply` and clear breach counters, then normal fallback guards continue protecting the system.
5. If regression persists, automatic fallback can switch back to `shadow` again and generate a new incident.

### Scope of Control (Resolved)
Use phased control scope to balance safety, simplicity, and future flexibility.

Decision:
1. V1 scope: global-only controls for second-pass behavior.
2. V1.1 scope: optional selective per-policy overrides (effective per-library in current schema) for a small set of high-impact knobs.

Why this is best practice:
- Shadow mode evaluation is cleaner when behavior is globally consistent; it avoids fragmented metrics and tuning noise.
- Global-first keeps rollout operationally simple and limits configuration drift.
- Policy-level behavior already exists in Classifarr (`library_policies` thresholds/trust/weights), so introducing overrides later is low-risk.

Override policy (V1.1 target):
- Allow overrides only for:
  - enable/disable second pass
  - retry strategy (`auto` | `hybrid` | `semantic`)
  - stricter timeout cap
- Keep conflict thresholds and gating defaults global initially to avoid policy drift.

Effective configuration precedence:
1. hard safety caps (code constants / max boundaries)
2. per-policy override (if present and enabled)
3. global `ai_provider_config` defaults

### Scope Resolution Sketch (Example Snippets)
Example effective config resolver (pseudo-code):
```js
function resolveRagLoopConfig(globalCfg, policyOverride) {
  const safeCaps = {
    maxPasses: Math.min(globalCfg.rag_loop_max_passes ?? 2, 2),
    maxAiCalls: Math.min(globalCfg.policy_recheck_max_ai_calls_per_item ?? 2, 2),
    timeoutMs: Math.min(globalCfg.policy_recheck_metadata_timeout_ms ?? 2000, 3000)
  };

  if (!policyOverride?.enabled) {
    return { ...globalCfg, ...safeCaps };
  }

  return {
    ...globalCfg,
    rag_retry_strategy: policyOverride.retry_strategy ?? globalCfg.rag_retry_strategy,
    policy_recheck_below_prompt_threshold_enabled:
      policyOverride.second_pass_enabled ?? globalCfg.policy_recheck_below_prompt_threshold_enabled,
    policy_recheck_metadata_timeout_ms: Math.min(
      policyOverride.timeout_ms ?? globalCfg.policy_recheck_metadata_timeout_ms,
      safeCaps.timeoutMs
    ),
    ...safeCaps
  };
}
```

Example policy override read path (pseudo-code):
```js
const policy = await getPolicyForLibrary(libraryId);
const policyOverride = policy?.rag_loop_override || null; // JSONB column (V1.1)
const effective = resolveRagLoopConfig(globalConfig, policyOverride);
```

### Shadow Mode Implementation Sketch (Example Snippets)
Example control flow in `classification.js` (pseudo-code):
```js
const rolloutMode = config.rag_loop_rollout_mode || 'shadow'; // 'shadow' | 'apply'

const baselineResult = initialResult; // current decision path
const secondPass = await evaluateSecondPassIfEligible(input, config); // deterministic diagnostics + candidate result

if (!secondPass.ran) {
  return baselineResult;
}

if (rolloutMode === 'shadow') {
  // Keep user-visible behavior identical to baseline
  baselineResult.loop_shadow = {
    ran: true,
    would_upgrade: secondPass.wouldUpgrade,
    strategy: secondPass.strategy,
    reason: secondPass.reason,
    metrics: secondPass.metrics
  };
  return baselineResult;
}

// rolloutMode === 'apply'
return secondPass.applyResult ?? baselineResult;
```

Example trace payload stored in `classification_details` metadata (JSONB):
```js
classification_details.rag_loop = {
  mode: 'shadow',
  ran: true,
  trigger: 'policy_prompt_select',
  strategy: 'auto:hybrid',
  would_upgrade: false,
  pass1_top_similarity: 0.52,
  pass2_top_similarity: 0.61,
  confidence_before: 58,
  confidence_after: 58,
  reason: 'shadow-eval-only'
};
```

Example promotion gate evaluator (service/test harness pseudo-code):
```js
function canPromoteShadowToApply(metrics) {
  return (
    metrics.shadow_samples >= 200 &&
    metrics.correction_rate_delta <= 0 &&
    metrics.error_rate_delta <= 0.01 &&
    metrics.p95_latency_delta_ms <= 250
  );
}
```

### Uncertainty Triggers (Version 1)
Trigger should be conservative (avoid extra work unless needed).

Resolved trigger model (V1):
- Primary trigger (policy-first): `policyResult.action === 'prompt_select'` (below per-policy `prompt_threshold`).
- Fallback trigger (when policy context is unavailable): `aiResult.confidence < 70`.
- Secondary fallback (legacy path only): low signal confidence (for example < 60) when AI and policy are unavailable.

Optional additional triggers (V1.1+):
- RAG conflict detected: retrieved matches vote strongly for multiple different libraries.
- Retrieval weakness: top combined similarity is below threshold but still "close enough" that a second pass may help.

### Enforcement Order (Authoritative Decision Gate)
To enforce scope and avoid ambiguous behavior, use this order:
1. If PolicyEngine returns `auto_classify`: stop (no second pass).
2. If PolicyEngine returns `prompt_confirm`: stop (existing confirm flow).
3. If PolicyEngine returns `prompt_select` (below `prompt_threshold`):
   - run one targeted identification re-check (deterministic + verifiable only).
   - re-run PolicyEngine once.
   - if outcome becomes `prompt_confirm` or `auto_classify`, stop with upgraded outcome.
   - if still `prompt_select`, continue with existing Policy Builder flow.
4. AI low-confidence trigger (`aiResult.confidence < 70`) remains a secondary trigger for retrieval retry in non-policy-upgraded paths.

This makes "below Policy Builder Threshold" the primary entry point for the new targeting behavior.

### AI Re-Run Policy (Resolved)
AI rerun is allowed, but only when it is likely to add value and only once.

Rules:
1. Policy-first path (`policyResult.action === 'prompt_select'`):
   - do targeted identification pass + PolicyEngine re-check first.
   - do not automatically rerun AI after this step.
2. AI rerun is eligible only when all are true:
   - policy context is unavailable, or policy re-check still ambiguous and retrieval materially improved.
   - new evidence is verifiable and added in pass 2 (not just restated AI reasoning).
   - AI rerun budget not exhausted.
3. Material improvement gate (suggested defaults):
   - top similarity improvement >= 0.08, or
   - top-vs-second library margin improvement >= 10 points, or
   - clear new library consensus in RAG votes (for example 3/5 top matches agree).
4. AI call budget:
   - max 2 AI calls per item (initial + one rerun).
5. Result adoption gate:
   - accept rerun result only if confidence improves meaningfully (suggested >= 5 points), or
   - confidence is similar but evidence quality is stronger and deterministic checks agree.
   - otherwise keep first AI result and continue existing clarification flow.

### Primary Threshold For This Feature (Policy Builder Threshold)
This plan explicitly targets items below the Policy Builder Threshold:
- If PolicyEngine `top.score < top.prompt_threshold` (typically 60%), treat the item as "low-confidence" for the purpose of the second pass.
- Goal of pass 2: raise the PolicyEngine score by finding additional verifiable identifiers (keywords/genres/franchise/studio/cast) and/or improving RAG context.

### Contradiction/Conflict Detection (RAG)
Resolved approach: use a hybrid rule (vote split + similarity margin + minimum quality).

Inputs:
- Use top N candidates (default N=5, tunable up to 10).
- Candidates should be available even if below the normal `rag_similarity_threshold` filter.

Per-library aggregates:
- `voteCount`
- `totalSimilarity`
- `avgSimilarity`

Conflict is true when all are satisfied:
1. Minimum evidence:
   - total candidate matches >= 3
2. Split support:
   - top 2 libraries each have >= 2 votes, and
   - vote gap is small (`top1.voteCount - top2.voteCount <= 1`)
3. Similarity closeness:
   - `abs(top1.totalSimilarity - top2.totalSimilarity) <= 0.10 * top1.totalSimilarity`
4. Quality floor:
   - `top1.avgSimilarity >= 0.55` and `top2.avgSimilarity >= 0.55`

Explicit non-conflict shortcuts:
- If top library has strong dominance (for example `top1.voteCount >= 3` and similarity margin >= 0.15), mark non-conflict.
- If candidate pool is too small/noisy (fewer than 3 matches or low average similarities), mark non-conflict and route through retrieval-weakness logic instead.

### Conflict Resolution Rules (Comprehensive)
To avoid inconsistent behavior, define deterministic precedence when signals conflict:

Precedence order:
1. Authoritative source signals (if present).
2. PolicyEngine threshold outcome (auto/prompt-confirm/prompt-select).
3. Verifiable targeted identifiers from pass 2.
4. RAG conflict heuristics and similarity margins.
5. AI confidence and reasoning output.

Conflict cases and resolution:
1. PolicyEngine vs AI disagree:
   - if policy is `auto_classify` or `prompt_confirm`, prefer policy outcome unless hard contradiction from authoritative data.
   - if policy is `prompt_select`, allow targeted pass and optional gated AI rerun.
2. RAG votes split across libraries:
   - treat as conflict; do not auto-upgrade confidence.
   - require either stronger margin after pass 2 or deterministic policy evidence.
3. Identifier appears in multiple libraries:
   - do not count ambiguous identifier as decisive on its own.
   - require supporting evidence from at least one additional signal family (genre + keyword, or keyword + RAG consensus).
4. AI rerun gives higher confidence but uses weaker evidence:
   - reject rerun output; keep prior decision.
5. Global settings vs per-policy thresholds:
   - per-policy `auto_classify_threshold` and `prompt_threshold` are authoritative for routing behavior.

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

Hard boundary:
- If an identifier cannot be traced to an allowed source, it MUST be dropped before re-check.

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

Failure condition:
- If no new verifiable identifiers are found, skip re-check and immediately continue the existing Policy Builder flow.

### Metadata Completeness Gate (Resolved)
Purpose: enrich missing high-impact metadata only when it is likely to improve PolicyEngine scoring and within strict time/risk bounds.

Run enrichment only when all are true:
1. Policy gate:
   - current path is below Policy Builder Threshold (`policyResult.action === 'prompt_select'`)
2. Identity gate:
   - `tmdb_id` is present (authoritative lookup key available)
3. Completeness gate:
   - at least 2 high-impact fields are missing:
     - `genres`
     - `keywords`
     - `belongs_to_collection`
     - `production_companies`
     - `cast`

Source policy:
- Use authoritative existing enrichment path only (TMDb-backed metadata path already used by pipeline).
- Do not use generic web search as default metadata source for this step.

Budget and retries:
- max enrichment attempts per item: 1
- enrichment timeout budget: 2000 ms
- enrichment must fit inside the existing overall second-pass budget (no additional budget expansion)

Post-enrichment behavior:
- Re-run targeted identification + PolicyEngine re-check once.
- If score still below `prompt_threshold`, continue standard Policy Builder flow.
- On timeout/error, fail open and continue without enrichment retry.

### Retrieval Pass 2 Strategy
Resolved approach: adaptive strategy selector with `auto` as default.

Strategy modes:
- `auto` (default): choose retry method using pass-1 diagnostics.
- `hybrid`: always use `hybridSearch()`.
- `semantic`: use semantic-focused retry only (expanded metadata + semantic candidate path).

`auto` selector decision rules:
1. Low-signal/recall failure:
   - if pass 1 has 0 matches OR top similarity below low-signal floor, use `hybrid`.
2. High-quality conflict:
   - if conflict detector is true and semantic quality floor is met, use `semantic` retry first.
3. Sparse metadata:
   - if important fields are missing (keywords/genres/franchise), do metadata enrichment and then use `hybrid`.
4. Uncertain selector outcome:
   - default to `hybrid` for recall safety.

Pass 2 retrieval plan:
- Use expanded metadata/terms
- Run selected method from strategy selector (`hybrid` or `semantic`)
- Optionally rerank:
  - For `hybrid`, keep existing RRF behavior (or legacy combine where configured).
  - For `semantic`, rerank by semantic score then recency tie-break.

### Loop Limits / Safety
Hard limits:
- `max_passes = 2` (one retry only) for V1.
- timeout: do not exceed a fixed budget (e.g., 5-10 seconds) for the entire retrieval loop, to avoid blocking the queue.
- if provider/DB errors occur: log and continue without pass 2.

For the PolicyEngine re-check:
- max re-evaluations: 1 (single re-check only).
- strict input hygiene: only use verifiable identifiers (see above).
- strict budget: do not exceed the same global budget used for pass 2 retrieval.
- no silent fallback to AI-generated identifiers when evidence is insufficient.

### Resilience and Auto-Cooldown (Resolved)
Decision: use fail-open, dependency-scoped cooldowns for optional second-pass components. Do not auto-disable baseline classification.

Why this is best practice with current implementation:
- Existing classification already has robust fallback paths (`signal_calculation`, `fallback`) and queued retries for severe AI outages (`pending_retry`).
- Embedding paths already include retry/backoff and circuit-breaker behavior; adding a second-pass guard should not duplicate or fight those controls.
- TMDb currently has rate limiting but no circuit breaker, so optional enrichment should degrade gracefully when TMDb is unstable.

Dependency scopes (independent breakers):
1. `tmdb_enrichment`:
   - gates only metadata-completeness enrichment step.
2. `rag_pass2`:
   - gates second-pass retrieval/rerank only.
3. `ai_rerun`:
   - gates optional second AI call only.

Open/cooldown policy (rolling window + streak):
- Evaluate a rolling window (default 5 minutes) with minimum samples (default 20).
- Open breaker when either condition is met:
  - consecutive timeout streak >= 3, or
  - timeout rate >= 35%, or
  - non-timeout error rate >= 50%.
- Cooldown defaults:
  - TMDb enrichment: 15 minutes
  - RAG pass 2: 10 minutes
  - AI rerun: 15 minutes
- Half-open recovery:
  - allow 2 probe attempts; close only if both succeed, otherwise reopen cooldown.

Behavior when open:
- `tmdb_enrichment` open:
  - skip enrichment and continue pass 2 using existing metadata.
- `rag_pass2` open:
  - skip pass 2 entirely and keep baseline/pass-1 decision flow.
- `ai_rerun` open:
  - skip rerun and use first AI result + policy path.
- if 2+ breakers are open simultaneously:
  - bypass second-pass loop globally for a short window (default 10 minutes) to protect queue latency.

Conflict-prevention boundaries:
- Never mutate persistent provider settings (`rag_enabled`, provider selections) as an automatic reaction to transient spikes.
- Do not enqueue `pending_retry` solely because pass 2 failed; keep existing retry queue semantics for primary AI unavailability only.
- Keep cooldown state ephemeral/in-memory for V1; log state transitions for visibility.

Resilience gate sketch (pseudo-code):
```js
function shouldRunSecondPass(ctx) {
  if (!ctx.flags.rag_retrieval_loop_enabled) return { run: false, reason: 'feature_disabled' };
  if (ctx.cooldowns.globalBypassActive) return { run: false, reason: 'global_cooldown' };
  if (ctx.breakers.rag_pass2.isOpen()) return { run: false, reason: 'rag_pass2_cooldown' };
  return { run: true };
}

async function runTargetedPassWithResilience(ctx) {
  const gate = shouldRunSecondPass(ctx);
  if (!gate.run) return { skipped: true, reason: gate.reason };

  const enrichmentAllowed =
    ctx.needsEnrichment && !ctx.breakers.tmdb_enrichment.isOpen();
  const rerunAllowed =
    ctx.aiRerunEligible && !ctx.breakers.ai_rerun.isOpen();

  // Execute bounded flow with existing fail-open behavior
  return await executeBoundedSecondPass({ enrichmentAllowed, rerunAllowed });
}
```

### Logging and Observability
Add explicit logs/metrics for:
- whether pass 2 ran
- why it ran (low confidence vs conflict vs weak retrieval)
- pass 1 vs pass 2 match counts and top similarity
- latency of each pass
- rollout mode (`shadow` vs `apply`) and whether a shadow run would have changed the decision
- effective control scope (`global` vs `policy_override`) and resolved strategy source
- resilience state transitions (`closed -> open -> half_open`) and cooldown skip reasons

Where:
- `server/src/utils/ragLogger.mjs` for metrics-style events
- standard logger in `classification.js` and/or `ragRetriever.js` for debugging

Expanded error logging/handling requirements (complements existing system):
- Extend `RAG_ERROR_TYPES` in `server/src/utils/ragErrorHandler.mjs` for second-pass stages:
  - `RAG_LOOP_GATE`, `RAG_LOOP_TIMEOUT`, `POLICY_RECHECK`, `TRACE_PERSIST`, `CONFIG_VALIDATION`, `MAPPING_MISSING`
- Preserve existing `error_log` + `rag_metrics` pipelines; do not create parallel logging channels.
- Add structured metadata contract for all second-pass errors/warnings:
  - `classification_id`, `tmdb_id`, `media_type`, `stage`, `reason_code`, `rollout_mode`, `strategy`, `recoverable`, `fallback_action`, `sql_state`
- Keep skip-by-design events (`gate_not_met`, `shadow_mode_no_apply`) at `INFO` level to avoid false alarms.
- Treat recoverable stage failures as `WARN` (with fail-open fallback), and baseline-path failures as `ERROR`.
- Capture SQLSTATE for DB failures and map to deterministic reason codes:
  - integrity (`23xxx`) -> `db_integrity_violation`
  - undefined column/table (`42xxx`) -> `db_schema_mismatch`
  - serialization/deadlock (`40xxx`) -> `db_retryable_conflict`
- Add log storm protection:
  - fingerprint repeated errors by (`module`, `stage`, `reason_code`, `sql_state`) and rate-limit duplicate writes to `error_log`.
- Ensure persistence failure safety:
  - if `error_log` insert fails, fallback to console/file logger and continue classification flow.

Stage-level fallback policy (required):
1. Enrichment stage error/timeout:
   - log `WARN` with `fallback_action=enrichment_skipped`; continue pass-2 without enrichment.
2. Pass-2 retrieval error/timeout:
   - log `WARN` with `fallback_action=pass2_skipped`; keep baseline/pass-1 outcome.
3. Policy re-check error:
   - log `WARN` with `fallback_action=policy_recheck_skipped`; continue existing prompt flow.
4. AI rerun error:
   - log `WARN` with `fallback_action=ai_rerun_skipped`; keep first AI result.
5. Trace write/sanitize error:
   - log `WARN` with `fallback_action=trace_omitted`; never fail classification because of trace persistence.

### Decision Trace and Auditability (Resolved)
Decision: persist a compact, structured, versioned second-pass decision trace in classification metadata for every item where the second-pass evaluator is entered (including skipped-by-gate cases).

Why this is best practice with current implementation:
- Current `classification_details` captures summary metrics but not the decision path (`why_reran`, `why_accepted`, `why_rejected`).
- Direct-apply activation still requires per-item explainability for audit and rapid rollback decisions.
- The existing metadata write path in `logClassification()` already supports adding structured details without schema changes.

Trace boundaries:
- Include:
  - trigger and gating decisions
  - stage outcomes (enrichment, pass2 retrieval, policy re-check, AI rerun gate)
  - final adoption reason (baseline kept vs pass2 applied)
- Exclude:
  - full prompts, full model responses, API keys, raw external payloads
  - any free-form AI chain-of-thought text

Recommended trace location:
- `metadata.classification_details.rag_loop_trace`
- versioned payload with stable enum reason codes

Trace schema sketch (pseudo-code):
```js
classification_details.rag_loop_trace = {
  trace_version: 1,
  mode: 'shadow', // 'shadow' | 'apply'
  ran: true,
  trigger: 'policy_prompt_select', // enum
  decision: {
    outcome: 'baseline_kept', // 'baseline_kept' | 'pass2_applied'
    reason_code: 'insufficient_delta', // enum
    confidence_before: 58,
    confidence_after: 58
  },
  stages: [
    { step: 'gate', status: 'ok', reason_code: 'eligible' },
    { step: 'enrichment', status: 'skipped', reason_code: 'tmdb_cooldown_open' },
    { step: 'retrieval_pass2', status: 'ok', reason_code: 'hybrid_auto_selected' },
    { step: 'policy_recheck', status: 'ok', reason_code: 'still_prompt_select' },
    { step: 'ai_rerun_gate', status: 'skipped', reason_code: 'material_improvement_not_met' }
  ],
  metrics: {
    pass1_top_similarity: 0.52,
    pass2_top_similarity: 0.61,
    latency_ms: 182
  },
  config_scope: 'global', // 'global' | 'policy_override'
  created_at: '2026-02-11T00:00:00.000Z'
};
```

Trace hygiene rules:
- Cap event count (default 20 stages/events).
- Cap serialized size (default 16 KB); if exceeded, drop lowest-priority stage details and keep summary.
- Use reason enums, not long prose, for stable querying.
- Include `trace_version` for forward compatibility.

### Auto-Learning Interaction (Resolved)
Decision: second-pass-upgraded auto outcomes are excluded from policy auto-learning until a user explicitly confirms or corrects them.

Why this is best practice with current implementation:
- Auto-learning should be driven by high-trust labels (user decisions), not newly introduced automation paths.
- Current learning flow consumes `policy_feedback_log` and user interaction paths; this aligns naturally with a confirmation-first learning gate.
- It prevents feedback-loop amplification where second-pass heuristics could reinforce themselves before human validation.

Learning eligibility matrix:
1. `shadow` mode evaluations:
   - never learning-eligible (diagnostic only).
2. `apply` mode, pass2 evaluated but baseline kept:
   - unchanged from current behavior; user feedback events remain eligible.
3. `apply` mode, pass2 applied automatically with no user interaction:
   - not learning-eligible.
4. any path with explicit user confirmation/correction (prompt confirm/select or manual correction):
   - learning-eligible.

Recommended guard rule (pseudo-code):
```js
function isLearningEligible(feedbackRow) {
  const trace = feedbackRow.item_metadata?.classification_details?.rag_loop_trace;
  const manualFeedback = feedbackRow.was_correction === true ||
    ['prompt_confirm', 'prompt_select', 'manual_classification'].includes(feedbackRow.prompt_type);

  if (!trace) return manualFeedback;
  if (trace.mode === 'shadow') return false;
  if (trace.decision?.outcome === 'pass2_applied' && !manualFeedback) return false;
  return manualFeedback;
}
```

Operational boundary:
- Do not update `policy_presets` or `auto_learned_preferences` from machine-only second-pass upgrades.
- Only update learning artifacts after a user-validated event is recorded.
- Keep this policy enabled by default and require explicit opt-in to relax later.

### Multilingual and Alias Handling (Resolved)
Decision: use a deterministic title precedence with canonical-first scoring and authoritative alias expansion only.

Why this is best practice with current implementation:
- Current metadata already carries `title`, `original_title`, and `original_language`; this supports deterministic precedence without introducing untrusted sources.
- Policy and keyword scoring currently rely on `title`/`overview` text; adding uncontrolled alias expansion could create false positives.
- RAG semantic retrieval can benefit from carefully bounded alias tokens while full-text remains conservative.

Title precedence (for targeted pass and retrieval text building):
1. canonical display title (`metadata.title`)
2. original title (`metadata.original_title`) when different
3. authoritative aliases (if available) from trusted metadata sources only

Authoritative alias sources (allowed):
- TMDb alternative titles/translations (when fetched by enrichment path)
- media server original title fields already ingested

Disallowed alias sources:
- aliases inferred from LLM output
- unverified web snippets

Normalization rules (deterministic):
- apply Unicode NFKC normalization
- lowercase for matching comparisons
- trim punctuation/whitespace noise
- dedupe by normalized value
- keep original form for prompt/display context

Bounded alias policy:
- max aliases used for retry: 5
- min normalized token length: 3 (except CJK scripts where length gate is script-aware)
- drop aliases that are exact duplicates of canonical/original after normalization
- apply lower weight to aliases than canonical/original during retrieval text construction

Script/language safeguards:
- if `original_language` differs from UI/display language, include both canonical and original title in pass-2 retrieval text.
- avoid transliteration by default in V1 (high ambiguity risk); rely on authoritative alias strings as provided.
- do not treat alias-only matches as decisive for policy upgrade without supporting evidence from another signal family.

Alias-aware query build sketch (pseudo-code):
```js
function buildTitleCandidates(metadata) {
  const canonical = metadata.title || '';
  const original = metadata.original_title || '';
  const aliases = getAuthoritativeAliases(metadata).slice(0, 5);

  return dedupeNormalized([
    { value: canonical, weight: 1.0, source: 'canonical' },
    { value: original, weight: 0.8, source: 'original' },
    ...aliases.map(v => ({ value: v, weight: 0.6, source: 'alias' }))
  ]);
}
```

Conflict boundary:
- If alias-based evidence conflicts with canonical/original title evidence, prefer canonical+original unless policy/rag consensus improves with additional non-title signals.
- Alias-only confidence uplift cannot by itself move `prompt_select` to auto-classify.

### Data Model Changes
No new domain tables are required for V1 classification flow, but V1 does require new configuration columns in `ai_provider_config` (see Configuration Additions and Timestamp Migration Package).

Decision-trace storage plan (resolved):
- Persist `classification_details.rag_loop_trace` inside existing metadata payload.
- Keep trace format versioned (`trace_version`) and bounded by size/event caps.
- Keep existing records backward-compatible (trace may be absent on old rows).

Optional later enhancement:
- project selected trace fields into dedicated analytics tables/materialized views for faster reporting.
- add explicit `learning_eligible` boolean to `policy_feedback_log` for efficient filtering/auditing (V1.1+).
- add optional metadata field for authoritative alias list cache (`metadata.tmdb_aliases`) to reduce repeated fetch cost (V1.1+).

## Configuration Additions (V1)
Add settings (in `ai_provider_config` or existing settings table, consistent with current RAG config pattern):
- `rag_retrieval_loop_enabled` (boolean, default true)
- `rag_loop_low_confidence_threshold` (integer percent, default 70)
- `rag_loop_max_passes` (integer, default 2)
- `rag_loop_use_hybrid_on_retry` (boolean, default true)
- `rag_loop_conflict_detection_enabled` (boolean, default false for V1, can turn on later)
- `rag_loop_candidate_limit` (integer, default 25) for conflict detection (if we implement "below threshold candidates")

Add settings for the policy-focused second pass (names TBD, but keep them explicit):
- `policy_recheck_below_prompt_threshold_enabled` (boolean, default true)
- `policy_recheck_max_attempts` (integer, default 1)
- `policy_recheck_identifier_caps` (json or separate settings; defaults: keywords=8, genres=5, studios=3, cast=3)
- `policy_recheck_min_similarity_delta` (numeric, default 0.08)
- `policy_recheck_min_margin_delta` (numeric, default 10)
- `policy_recheck_min_confidence_gain` (numeric, default 5)
- `policy_recheck_max_ai_calls_per_item` (integer, default 2)

Add settings for conflict detection tuning:
- `rag_conflict_top_n` (integer, default 5)
- `rag_conflict_min_matches` (integer, default 3)
- `rag_conflict_min_votes_per_library` (integer, default 2)
- `rag_conflict_max_vote_gap` (integer, default 1)
- `rag_conflict_max_similarity_margin_ratio` (numeric, default 0.10)
- `rag_conflict_min_avg_similarity` (numeric, default 0.55)

Add settings for retry strategy selection:
- `rag_retry_strategy` (enum: `auto` | `hybrid` | `semantic`, default `auto`)
- `rag_retry_low_signal_similarity_floor` (numeric, default 0.55)
- `rag_retry_conflict_semantic_preferred` (boolean, default true)
- `rag_retry_sparse_metadata_prefers_hybrid` (boolean, default true)

Add settings for rollout/shadow mode:
- `rag_loop_rollout_mode` (enum: `shadow` | `apply`, default `apply`)
- `rag_loop_shadow_min_samples` (integer, default 200)
- `rag_loop_shadow_max_error_rate_delta` (numeric, default 0.01)
- `rag_loop_shadow_max_p95_latency_delta_ms` (integer, default 250)
- `rag_loop_auto_fallback_enabled` (boolean, default true)
- `rag_loop_auto_fallback_min_apply_samples` (integer, default 25)
- `rag_loop_auto_fallback_consecutive_breaches` (integer, default 3)
- `rag_loop_auto_fallback_cooldown_ms` (integer, default 900000)
- `rag_loop_auto_recover_enabled` (boolean, default false)

Note: the `rag_loop_shadow_*` thresholds are the canonical regression gates used by both shadow diagnostics and auto-fallback evaluation.
Note: `rag_loop_auto_recover_enabled` uses fixed V1 semantics: version-bump-only retry, one attempt per version.

Add settings for decision trace controls:
- `rag_loop_trace_enabled` (boolean, default true when loop is enabled)
- `rag_loop_trace_max_events` (integer, default 20)
- `rag_loop_trace_max_bytes` (integer, default 16384)
- `rag_loop_trace_include_stage_metrics` (boolean, default true)

Add settings for learning-eligibility controls:
- `policy_learning_second_pass_requires_manual_confirmation` (boolean, default true)
- `policy_learning_include_shadow_feedback` (boolean, default false)
- `policy_learning_allow_machine_only_second_pass_feedback` (boolean, default false)

Add settings for multilingual/alias controls:
- `rag_alias_expansion_enabled` (boolean, default true)
- `rag_alias_max_terms` (integer, default 5)
- `rag_alias_min_token_length` (integer, default 3)
- `rag_alias_source_policy` (enum: `authoritative_only`, default `authoritative_only`)
- `rag_title_precedence_mode` (enum: `canonical_first`, default `canonical_first`)
- `rag_alias_weight` (numeric, default 0.6)

Add settings for resilience/cooldown behavior:
- `rag_loop_resilience_enabled` (boolean, default true when loop is enabled)
- `rag_loop_resilience_window_ms` (integer, default 300000)
- `rag_loop_resilience_min_samples` (integer, default 20)
- `rag_loop_resilience_timeout_streak_threshold` (integer, default 3)
- `rag_loop_resilience_timeout_rate_threshold` (numeric, default 0.35)
- `rag_loop_resilience_error_rate_threshold` (numeric, default 0.50)
- `rag_loop_cooldown_tmdb_ms` (integer, default 900000)
- `rag_loop_cooldown_rag_ms` (integer, default 600000)
- `rag_loop_cooldown_ai_ms` (integer, default 900000)
- `rag_loop_half_open_probe_count` (integer, default 2)
- `rag_loop_global_bypass_multi_open_enabled` (boolean, default true)
- `rag_loop_global_bypass_ms` (integer, default 600000)

V1.1 optional per-policy override container:
- `library_policies.rag_loop_override` (JSONB, nullable) containing subset:
  - `second_pass_enabled` (boolean)
  - `retry_strategy` (enum string)
  - `timeout_ms` (integer, capped by global safety bounds)

Add settings for metadata completeness gate:
- `policy_recheck_metadata_enrichment_enabled` (boolean, default true)
- `policy_recheck_metadata_missing_fields_min` (integer, default 2)
- `policy_recheck_metadata_timeout_ms` (integer, default 2000)
- `policy_recheck_metadata_max_attempts` (integer, default 1)
- `policy_recheck_metadata_source` (enum: `authoritative_only`, default `authoritative_only`)

Note: keep defaults conservative to avoid surprising CPU/DB load.

## Timestamp Migration Package (Issue 275)
This feature requires timestamp-style migrations only (`YYYYMMDD_HHMMSS_description.sql`). Do not add numeric migrations.

Creation commands (run at implementation time):
- `npm run migration:create "add rag loop core config"`
- `npm run migration:create "add rag loop governance config"`
- `npm run migration:create "add rag loop error observability"`
- `npm run migration:create "add rag loop auto fallback config"`
- `npm run migration:create "add rag loop policy override"` (V1.1 only)

### V1 Required Migrations
Use one logical concern per migration. The exact timestamps will be generated at creation time.

1. `*_add_rag_loop_core_config.sql`
   - Purpose: add core second-pass and policy re-check controls to `ai_provider_config`.
   - Required columns (idempotent `ADD COLUMN IF NOT EXISTS`):
     - `rag_retrieval_loop_enabled` BOOLEAN DEFAULT true
     - `rag_loop_rollout_mode` VARCHAR(10) DEFAULT 'apply'
     - `rag_loop_low_confidence_threshold` INTEGER DEFAULT 70
     - `rag_loop_max_passes` INTEGER DEFAULT 2
     - `rag_loop_use_hybrid_on_retry` BOOLEAN DEFAULT true
     - `rag_loop_conflict_detection_enabled` BOOLEAN DEFAULT false
     - `rag_retry_strategy` VARCHAR(20) DEFAULT 'auto'
     - `rag_retry_low_signal_similarity_floor` NUMERIC(4,2) DEFAULT 0.55
     - `rag_retry_conflict_semantic_preferred` BOOLEAN DEFAULT true
     - `rag_retry_sparse_metadata_prefers_hybrid` BOOLEAN DEFAULT true
     - `rag_loop_candidate_limit` INTEGER DEFAULT 25
     - `rag_conflict_top_n` INTEGER DEFAULT 5
     - `rag_conflict_min_matches` INTEGER DEFAULT 3
     - `rag_conflict_min_votes_per_library` INTEGER DEFAULT 2
     - `rag_conflict_max_vote_gap` INTEGER DEFAULT 1
     - `rag_conflict_max_similarity_margin_ratio` NUMERIC(4,2) DEFAULT 0.10
     - `rag_conflict_min_avg_similarity` NUMERIC(4,2) DEFAULT 0.55
     - `policy_recheck_below_prompt_threshold_enabled` BOOLEAN DEFAULT true
     - `policy_recheck_max_attempts` INTEGER DEFAULT 1
     - `policy_recheck_identifier_caps` JSONB DEFAULT '{"keywords":8,"genres":5,"studios":3,"cast":3}'
     - `policy_recheck_min_similarity_delta` NUMERIC(4,2) DEFAULT 0.08
     - `policy_recheck_min_margin_delta` NUMERIC(6,2) DEFAULT 10
     - `policy_recheck_min_confidence_gain` NUMERIC(6,2) DEFAULT 5
     - `policy_recheck_max_ai_calls_per_item` INTEGER DEFAULT 2
     - `policy_recheck_metadata_enrichment_enabled` BOOLEAN DEFAULT true
     - `policy_recheck_metadata_missing_fields_min` INTEGER DEFAULT 2
     - `policy_recheck_metadata_timeout_ms` INTEGER DEFAULT 2000
     - `policy_recheck_metadata_max_attempts` INTEGER DEFAULT 1
     - `policy_recheck_metadata_source` VARCHAR(30) DEFAULT 'authoritative_only'
   - Required constraints (idempotent `DO $$ ... IF NOT EXISTS ...`):
     - rollout mode in (`shadow`, `apply`)
     - retry strategy in (`auto`, `hybrid`, `semantic`)
     - positive/range checks for thresholds, attempts, and limits
   - Required hardening:
     - backfill existing row `id=1` with `COALESCE` safeguards
     - add column comments for operator clarity

2. `*_add_rag_loop_governance_config.sql`
   - Purpose: add rollout gates, trace controls, learning controls, alias controls, and resilience controls to `ai_provider_config`.
   - Required columns:
      - rollout gates:
        - `rag_loop_shadow_min_samples` INTEGER DEFAULT 200
        - `rag_loop_shadow_max_error_rate_delta` NUMERIC(5,4) DEFAULT 0.01
        - `rag_loop_shadow_max_p95_latency_delta_ms` INTEGER DEFAULT 250
     - trace:
       - `rag_loop_trace_enabled` BOOLEAN DEFAULT true
       - `rag_loop_trace_max_events` INTEGER DEFAULT 20
       - `rag_loop_trace_max_bytes` INTEGER DEFAULT 16384
       - `rag_loop_trace_include_stage_metrics` BOOLEAN DEFAULT true
     - learning:
       - `policy_learning_second_pass_requires_manual_confirmation` BOOLEAN DEFAULT true
       - `policy_learning_include_shadow_feedback` BOOLEAN DEFAULT false
       - `policy_learning_allow_machine_only_second_pass_feedback` BOOLEAN DEFAULT false
     - alias/title:
       - `rag_alias_expansion_enabled` BOOLEAN DEFAULT true
       - `rag_alias_max_terms` INTEGER DEFAULT 5
       - `rag_alias_min_token_length` INTEGER DEFAULT 3
       - `rag_alias_source_policy` VARCHAR(30) DEFAULT 'authoritative_only'
       - `rag_title_precedence_mode` VARCHAR(30) DEFAULT 'canonical_first'
       - `rag_alias_weight` NUMERIC(4,2) DEFAULT 0.60
     - resilience:
       - `rag_loop_resilience_enabled` BOOLEAN DEFAULT true
       - `rag_loop_resilience_window_ms` INTEGER DEFAULT 300000
       - `rag_loop_resilience_min_samples` INTEGER DEFAULT 20
       - `rag_loop_resilience_timeout_streak_threshold` INTEGER DEFAULT 3
       - `rag_loop_resilience_timeout_rate_threshold` NUMERIC(4,2) DEFAULT 0.35
       - `rag_loop_resilience_error_rate_threshold` NUMERIC(4,2) DEFAULT 0.50
       - `rag_loop_cooldown_tmdb_ms` INTEGER DEFAULT 900000
       - `rag_loop_cooldown_rag_ms` INTEGER DEFAULT 600000
       - `rag_loop_cooldown_ai_ms` INTEGER DEFAULT 900000
       - `rag_loop_half_open_probe_count` INTEGER DEFAULT 2
       - `rag_loop_global_bypass_multi_open_enabled` BOOLEAN DEFAULT true
       - `rag_loop_global_bypass_ms` INTEGER DEFAULT 600000
   - Required constraints:
     - bounded numeric checks for rates/weights/timeouts/sizes
     - enum checks for alias source and title precedence
   - Required hardening:
     - `COALESCE` backfill for existing config row
     - column comments for every operator-facing knob

3. `*_add_rag_loop_error_observability.sql`
   - Purpose: expand `error_log` observability for second-pass diagnostics while preserving existing log APIs.
   - Required columns (`ADD COLUMN IF NOT EXISTS`):
     - `classification_id` INTEGER
     - `error_stage` VARCHAR(50)
     - `reason_code` VARCHAR(80)
     - `correlation_id` UUID
     - `sql_state` VARCHAR(10)
   - Required indexes:
     - `idx_error_log_classification_id` on `classification_id`
     - `idx_error_log_stage_reason` on `(error_stage, reason_code)`
     - `idx_error_log_correlation_id` on `correlation_id`
     - partial index for unresolved stage errors:
       - `(error_stage, created_at DESC) WHERE resolved = false AND error_stage IS NOT NULL`
   - Required constraints/guards:
     - `error_stage` allowlist check for known stage enums (`gate`, `enrichment`, `retrieval_pass2`, `policy_recheck`, `ai_rerun`, `trace`)
     - `sql_state` length/format guard (nullable; uppercase alnum max 10)
   - Important compatibility rule:
     - do NOT add FK on `classification_id` in `error_log` (logging must remain fail-open even if related rows are pruned)

### V1 Implemented Optional Migration (Requested)
4. `*_add_rag_loop_trace_query_indexes.sql`
   - Purpose: improve trace query performance for shadow metrics and audit.
   - Recommended indexes (only if query profiling justifies):
     - expression index for trace mode:
       - `(metadata->'classification_details'->'rag_loop_trace'->>'mode')`
     - expression index for trace outcome:
       - `(metadata->'classification_details'->'rag_loop_trace'->'decision'->>'outcome')`
     - optional time-filter support index on `classification_history(created_at)` if missing in target environments
   - Note: avoid `CONCURRENTLY` in migration files because the migration runner wraps each migration in a transaction.

### V1 Activation Policy Migration
5. `*_enable_rag_loop_apply_defaults.sql`
   - Purpose: switch Issue 275 defaults to immediate activation.
   - Required changes:
     - `ai_provider_config.rag_retrieval_loop_enabled` default -> `true`
     - `ai_provider_config.rag_loop_rollout_mode` default -> `'apply'`
     - `ai_provider_config.policy_recheck_below_prompt_threshold_enabled` default -> `true`
    - Required backfill:
      - update existing `ai_provider_config` rows so active installs receive the same behavior without manual toggles.

### V1 Auto-Fallback Migration
6. `*_add_rag_loop_auto_fallback_config.sql`
   - Purpose: make regression rollback hands-off by default.
   - Required changes:
     - ensure `rag_loop_auto_fallback_enabled` default -> `true`
     - ensure `rag_loop_auto_recover_enabled` default -> `false`
     - ensure apply-sample / breach / cooldown defaults are present and bounded
     - add persisted fallback/recovery state columns:
       - `rag_loop_auto_fallback_breach_count` INTEGER DEFAULT 0
       - `rag_loop_last_auto_fallback_at` TIMESTAMPTZ NULL
       - `rag_loop_last_auto_fallback_incident_id` VARCHAR(64) NULL
       - `rag_loop_last_auto_fallback_incident` JSONB NULL
       - `rag_loop_last_auto_fallback_version` VARCHAR(64) NULL
       - `rag_loop_auto_recover_last_attempt_at` TIMESTAMPTZ NULL
       - `rag_loop_auto_recover_last_attempt_version` VARCHAR(64) NULL
   - Required backfill:
     - update existing `ai_provider_config` rows using `COALESCE` so current installs get automatic safety behavior.
   - Required constraints:
      - positive/range checks on sample count, consecutive breach count, and cooldown.
      - non-negative check for `rag_loop_auto_fallback_breach_count`.
      - JSON object check for `rag_loop_last_auto_fallback_incident` when present.

### V1.1 Deferred Migration
7. `*_add_library_policy_rag_loop_override.sql`
   - Purpose: enable selective per-policy overrides.
   - Required column:
     - `library_policies.rag_loop_override` JSONB NULL
   - Required constraints:
     - JSON shape validation (limited keys only: `second_pass_enabled`, `retry_strategy`, `timeout_ms`)
     - safe bounds for `timeout_ms`
   - Required index:
     - GIN index on `library_policies.rag_loop_override` for admin/filter queries.

### Migration Quality Gates (Required Components in Every File)
Each migration file must include:
1. Idempotent SQL (`IF NOT EXISTS` / guarded constraint creation).
2. Data-preservation logic (`COALESCE`/backfill) for existing rows.
3. Constraints for enums and numeric bounds (prevent invalid config states).
4. Comments for new operator-facing columns.
5. Upgrade + re-run safety (run twice without failure).

Post-migration required actions:
1. Start server and verify migration runner applied all new files.
2. Run migration naming check: `npm run migration:check`.
3. Update schema snapshot: `npm run db:dump-schema`.
4. Commit migration files + `database/schema/current.sql` together.

## Database Violations, Conflicts, and Missing Mapping Controls
This section defines how to prevent and handle DB-level issues introduced by the expanded second-pass flow.

### Potential violation/conflict classes
1. Config constraint violations (`ai_provider_config`)
   - Example: invalid `rag_loop_rollout_mode`, negative timeouts, out-of-range rate thresholds.
   - Prevention: strict CHECK constraints + runtime config clamping.
2. Constraint-name collisions during re-runs
   - Example: attempting to add same constraint twice under different names.
   - Prevention: `DO $$ ... IF NOT EXISTS (pg_constraint...)` wrappers with deterministic names.
3. JSON shape conflicts
   - Example: malformed `policy_recheck_identifier_caps` or future `library_policies.rag_loop_override`.
   - Prevention: JSON type/shape guards and bounded key validation.
4. Missing policy mapping/context
   - Example: item has no resolvable policy (missing library context or policy row drift).
   - Handling: route to fallback trigger path (`aiResult.confidence < 70`) and log `reason_code=policy_context_missing`.
5. Missing metadata mappings for targeted pass
   - Example: absent `tmdb_id`, missing `media_type`, sparse fields below minimum evidence thresholds.
   - Handling: skip enrichment/re-check deterministically; continue baseline flow with structured `skip_reason`.
6. Legacy metadata parse issues
   - Example: rows without `classification_details` or malformed JSON payloads.
   - Handling: safe parsing + backward-compatible readers; never throw on missing trace details.
7. Retry/write conflicts
   - Example: serialization or deadlock errors during concurrent updates.
   - Handling: classify SQLSTATE `40xxx` as retryable and apply bounded retry/backoff where safe.

### Pre-flight data integrity audit queries (required)
Run in staging before `apply` promotion:
```sql
-- Ensure one ai_provider_config row exists
SELECT COUNT(*) AS cfg_rows FROM ai_provider_config WHERE id = 1;

-- Detect libraries missing policy rows (should be zero in healthy state)
SELECT l.id, l.name
FROM libraries l
LEFT JOIN library_policies lp ON lp.library_id = l.id
WHERE lp.id IS NULL;

-- Detect invalid policy threshold ordering
SELECT id, library_id, auto_classify_threshold, prompt_threshold
FROM library_policies
WHERE auto_classify_threshold < prompt_threshold;

-- Detect malformed/legacy metadata rows that are not JSON objects
SELECT id
FROM classification_history
WHERE metadata IS NOT NULL
  AND jsonb_typeof(metadata) <> 'object'
LIMIT 100;
```

### Runtime mapping safeguards (required)
- `classification.js` must treat missing policy context as non-fatal and continue with fallback trigger ordering.
- Targeted second pass must require verifiable identifiers; if mappings are missing, skip re-check and keep baseline flow.
- `History.vue` and API readers must handle missing `classification_details.rag_loop_trace` without exceptions.
- All skip paths must emit structured diagnostics (`stage`, `reason_code`, `fallback_action`) for auditability.

## Dependencies and Prerequisites
This expansion is primarily integration work across existing services. The goal is to avoid adding new third-party libraries unless a concrete gap appears during implementation.

### Runtime and Platform Dependencies (Required)
- Node.js and npm versions aligned with repo engines:
  - `server/package.json`: Node `>=24.11.0`, npm `>=10.0.0`
  - `client/package.json`: Node `>=24.11.0`, npm `>=10.0.0`
- PostgreSQL with `pgvector` extension available:
  - required for semantic/hybrid retrieval (`vector` type and similarity operators)
  - migration lineage already expects this (`database/migrations/031_add_rag_embeddings.sql`)

### Data/Schema Dependencies (Required)
- `ai_provider_config` must remain the authoritative config source for RAG/AI runtime flags.
- New config keys in this plan require migration support (add columns/defaults) before feature enablement.
- Existing data surfaces relied on by this expansion:
  - `classification_history` and `classification_embeddings` for retrieval
  - `library_policies` for threshold and routing decisions
  - `rag_metrics` / `error_log` for observability and promotion gating
- Expanded error observability for V1 requires additional `error_log` stage columns/indexes (see timestamp migration package).
- Metadata payload support is required for:
  - `metadata.classification_details.rag_loop_trace` (versioned decision trace)

V1.1/optional schema dependencies:
- `library_policies.rag_loop_override` JSONB container (per-policy overrides).
- Optional analytics projection tables/materialized views for fast reporting.
- Optional explicit `learning_eligible` persistence field for feedback filtering.

### Service Integration Dependencies (Required)
- Backend services that must be updated in lockstep:
  - `server/src/services/classification.mjs`
  - `server/src/services/ragRetriever.mjs`
  - `server/src/services/policyEngine.mjs`
  - `server/src/services/embeddingRouter.mjs` / `server/src/services/embeddingService.mjs`
  - `server/src/utils/ragLogger.mjs`
- Settings and API surfaces that must expose/accept new controls:
  - `server/src/routes/settings.mjs` (`/api/settings/ai`)
  - `server/src/routes/rag.mjs` (status/diagnostics endpoints as needed)

### External Dependency Contracts (Required/Conditional)
- AI provider availability is required for normal AI classification paths; second-pass logic must remain fail-open when unavailable.
- Embedding provider availability is required for RAG-dependent second pass; skip pass-2 retrieval when unavailable/open cooldown.
- TMDb availability is conditionally required only when metadata enrichment gate is entered:
  - enrichment must be authoritative-source only
  - timeout and single-attempt caps remain mandatory
  - TMDb failures must not block baseline classification

### Frontend Dependencies (Recommended V1 Scope)
- Existing UI surfaces used for rollout controls and diagnostics:
  - `client/src/views/rag/AdvancedTab.vue`
  - `client/src/views/History.vue`
  - low-confidence review / Policy Builder UI surface (existing flow)
- No new frontend framework/library dependency is required for planned UI additions.

### Testing and Validation Dependencies (Required)
- Server unit/integration test stack remains sufficient (`jest`, `supertest`, `pg-mem`, `testcontainers`).
- Integration scenarios requiring vector behavior should use pgvector-capable test environments (existing testcontainer pattern).
- Client test stack remains sufficient (`vitest`, `@testing-library/vue`, `jsdom`).

### Operational Dependencies and Rollout Blockers
Blockers before direct `apply` activation:
1. DB migrations for new config fields are applied successfully in target environment.
2. History trace payload (`rag_loop_trace`) is present and readable for audit sampling.
3. Metrics pipeline can compute correction/error/latency deltas for post-activation checks.
4. Optional acceleration paths (embedding backfill/reclassification) are operational if needed for low-volume traffic.
5. Rollback path verified (`apply` -> `shadow` config switch with no code rollback).
6. Automatic fallback controls are present and defaulted correctly (`rag_loop_auto_fallback_enabled=true`).

Dependency stance:
- V1 target is zero new npm package dependencies.
- If a new dependency becomes necessary, it must be justified in this plan and added with explicit risk/rollback notes before implementation.

### Pre-Flight Execution Checklist (Ordered)
Use this exact order for rollout readiness and direct activation decisioning.

1. Migration pre-check
   - Confirm target environment DB version and `pgvector` availability.
   - Confirm pending migrations list includes issue-275 config additions.
   - Go/No-Go: stop if extension or migration prerequisites are missing.
2. Apply migrations
   - Run migrations in staging first, then production.
   - Verify new `ai_provider_config` fields/defaults and `error_log` observability columns/indexes are present.
   - Go/No-Go: stop if schema drift or default-value mismatch is detected.
3. API/settings contract verification
   - Verify `/api/settings/ai` read/write behavior for new keys.
   - Verify masking behavior for secrets remains unchanged.
   - Go/No-Go: stop if partial updates overwrite unrelated config.
4. Feature gate initialization
    - Set `rag_retrieval_loop_enabled=true`, `policy_recheck_below_prompt_threshold_enabled=true`, and `rag_loop_rollout_mode=apply`.
    - Set `rag_loop_auto_fallback_enabled=true` (default-on safety switch).
    - Keep conservative defaults for budgets/timeouts/attempt limits.
    - Go/No-Go: stop if configuration does not persist or comparator gates are bypassed.
5. Apply Operational Visibility validation
   - Confirm `classification_details.rag_loop_trace` is being written.
   - Confirm `rag_metrics`/logging includes stage outcomes and skip reasons.
   - Confirm fallback incident API returns sanitized payload after simulated trigger.
   - Go/No-Go: stop if trace payloads are missing, malformed, or unqueryable.
6. Quality and stability review (post-activation)
    - Track correction-rate delta, error-rate delta, and p95 latency delta under normal production monitoring.
    - Go/No-Go: verify auto-fallback trigger transitions mode to `shadow` on sustained breach windows.
7. Rollback drill
   - Dry-run operational rollback (`apply` -> `shadow`) in staging.
   - Confirm no code rollback or schema rollback is required.
   - Go/No-Go: stop if rollback cannot be completed quickly and safely.
8. Ongoing operations
    - Keep normal Operational Visibility monitoring active.
    - Keep automatic fallback enabled unless explicitly disabled for controlled testing.
    - Manage optional V1.1 scope via roadmap prioritization, not rollout gating.
    - Go/No-Go: defer further expansion if regressions are not yet resolved.

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
   - In `server/src/services/classification.mjs`, after pass 1 AI result, decide if pass 2 is allowed/needed.
   - If triggered, run retrieval pass 2, rebuild `ragContext`, and evaluate AI rerun eligibility using the resolved gate.
4. Ensure no infinite loops:
   - enforce `max_passes` and timeout budget.
   - add resilience gate with dependency-scoped cooldown checks before enrichment/retrieval/rerun stages.
5. Add logging/metrics.
6. Add decision trace builder and sanitizer:
   - implement `buildRagLoopTrace(context)` returning `trace_version` + stable enum codes.
   - enforce redaction/allowlist rules (no raw prompt/response blobs).
   - enforce event-count and byte-size caps with deterministic truncation.
7. Add learning eligibility guard:
   - implement `isLearningEligible(feedbackRow)` in learning/feedback pipeline.
   - exclude machine-only pass2-applied outcomes from learning updates by default.
   - ensure user confirmation/correction paths remain eligible.
8. Add multilingual/alias resolver:
   - implement `buildTitleCandidates(metadata)` with canonical/original/alias precedence and normalization.
   - ensure alias inputs come only from authoritative sources.
   - enforce alias caps/weights and script-aware minimum token safeguards.
9. Add PolicyEngine re-check (required for the "raise above Policy Builder Threshold" goal):
   - When `policyResult.action === 'prompt_select'`, run the targeted identification pass and then re-run PolicyEngine once.
   - Only accept changes that come from verifiable evidence and produce a clearer PolicyEngine outcome.
   - If no verifiable evidence is found, short-circuit to existing Policy Builder flow (no synthetic boosting).
10. Add deterministic result comparator:
   - compare pass 1 vs pass 2 outcomes using confidence delta + evidence quality rules.
   - centralize this comparison in one helper to avoid route-level drift.
11. Add conflict resolver helper:
   - codify precedence order and tie-break rules so policy/rag/ai conflicts are handled consistently.
12. Add conflict detector helper:
   - implement `detectRagConflict(matches, config)` using the resolved hybrid rule.
   - return structured diagnostics (`reason`, `top1`, `top2`, `metrics`) for logging and tests.
13. Add retry strategy selector helper:
   - implement `selectRetryStrategy(pass1Diagnostics, metadataCompleteness, config)`.
   - support explicit override modes (`hybrid` / `semantic`) and default `auto` mode.
   - log strategy selection reason for observability.
14. Add metadata completeness evaluator:
   - implement `getMissingHighImpactFields(metadata)` and gate enrichment by resolved thresholds.
   - call existing authoritative enrichment path with bounded timeout and single-attempt policy.
   - log enrichment attempt result (`applied`, `skipped`, `timeout`, `error`) for diagnostics.
15. Add rollout mode gate:
   - implement `applyOrShadowDecision(baselineResult, secondPassResult, rolloutConfig)`.
   - in `shadow` mode, persist decision trace but return baseline behavior unchanged.
   - in `apply` mode, apply second-pass output according to resolved comparator rules.
16. Add rollout metrics collector:
    - aggregate correction deltas, error deltas, and latency deltas in active mode.
    - expose readiness/health signal and rollback hints for operators.
    - expose a reusable regression snapshot helper for automatic fallback evaluation.
17. Add automatic fallback controller:
    - implement sustained-breach evaluator using apply-mode metrics + configured gates.
    - when evaluator triggers, atomically switch `rag_loop_rollout_mode` from `apply` to `shadow`.
    - enforce cooldown and consecutive-breach requirements to avoid mode flapping.
    - generate/persist structured fallback incident payload and incident ID.
    - keep auto-recovery disabled by default; require manual return to `apply` unless explicitly enabled.
    - when auto-recover is enabled, only attempt re-enable on version bump and at most once per version.
18. Add control-scope resolver (V1 ready, V1.1 compatible):
    - centralize effective-config merge logic (global defaults + optional policy override + safety caps).
    - log resolved source of each key (`global`, `policy_override`, `safety_cap`) for traceability.
19. Add resilience manager and wiring:
    - implement `ragLoopResilienceManager` with three breakers (`tmdb_enrichment`, `rag_pass2`, `ai_rerun`) and optional global bypass.
    - use existing circuit-breaker semantics (`CLOSED`, `OPEN`, `HALF_OPEN`) for deterministic behavior.
    - record breaker transitions and skip reasons into diagnostics for shadow/apply analysis.
20. Add config validator and normalizer:
    - implement `validateAndNormalizeRagLoopConfig(rawConfig)` for strict bounds, enum checks, and safe defaults.
    - map invalid values to deterministic fallback defaults and emit structured warning logs.
21. Add mapping/metadata guard helpers:
    - implement `resolvePolicyContextOrFallback(item)` and `getRecheckEligibility(item, metadata)` helpers.
    - ensure missing policy/metadata mappings are treated as deterministic skip paths, not runtime failures.
22. Expand error taxonomy + structured persistence:
    - extend `ragErrorHandler` reason/error codes for second-pass stages.
    - update `ragLogger` and module log calls to include `classification_id`, `stage`, `reason_code`, `sql_state`, `fallback_action`.
23. Add log dedupe and retry-safe DB error handling:
    - add short-window dedupe/fingerprint logic for repeated stage errors to prevent `error_log` flood.
    - add bounded retry for retryable SQLSTATE conflicts (`40xxx`) where safe; fail open otherwise.
24. Add fallback incident read API:
    - expose latest fallback incident payload (sanitized) for UI copy/report actions.
    - include enough context to reproduce/diagnose without exposing secrets.

## Implementation Steps (Client/UI Recommended)
1. Add rollout controls to RAG advanced settings:
    - second-pass enabled toggle
    - rollout mode selector (`shadow` | `apply`)
    - guardrail copy that explains `apply` changes behavior while `shadow` does not
2. Add automatic fallback control to Classification Settings:
   - add `Automatic Safety Fallback` toggle to `client/src/views/settings/Confidence.vue`.
   - default ON and persist via `/api/settings/ai` (`rag_loop_auto_fallback_enabled`).
   - include concise help copy: "Automatically switches to diagnostic mode if sustained regression is detected."
   - add `Auto Re-enable After Upgrade` toggle to `client/src/views/settings/Confidence.vue` (default OFF, uses `rag_loop_auto_recover_enabled`).
3. Add fallback incident report panel in Classification Settings:
   - display incident summary when auto-fallback has triggered.
   - provide copyable incident payload text and one-click "Open Issue" helper action.
4. Add `rag_loop_trace` summary rendering in History detail modal:
   - show status, trigger, strategy, confidence delta, and result adoption reason
   - handle missing traces safely for legacy records
5. Add low-confidence diagnostic line in Policy Builder/review flow:
   - indicate whether targeted re-check ran
   - display score delta and whether threshold crossing occurred

## Client/UI Scope
V1 baseline can run without UI changes, but recommended V1 scope includes minimal observability and control so operators can run apply-first with automatic safety fallback and clear diagnostics.

Recommended V1 UI additions:
- RAG Advanced settings (`client/src/views/rag/AdvancedTab.vue`):
  - toggle for second-pass enablement
  - rollout mode selector (`shadow` | `apply`)
  - read-only shadow promotion metrics summary (sample count, correction delta, error delta, latency delta)
- Classification Settings (`client/src/views/settings/Confidence.vue`):
  - `Automatic Safety Fallback` toggle (default ON) for hands-off apply->shadow protection
  - `Auto Re-enable After Upgrade` toggle (default OFF) for version-aware apply retry
  - contextual explanation that `shadow` is diagnostic mode and auto fallback is triggered only on sustained breaches
  - incident panel with copyable report payload for GitHub issue filing
- History details (`client/src/views/History.vue`):
  - compact `rag_loop_trace` summary (ran/skipped, trigger, strategy, confidence before/after, accept/reject reason)
- Policy Builder / low-confidence review surface:
  - one diagnostic line for "targeted re-check ran" and score delta (`before -> after`)

V1.1 optional enhancements:
- per-policy override controls for selected knobs (enable/strategy/timeout)
- deeper diagnostics dashboards (breaker state timeline, strategy distribution, promotion readiness trends)
- richer filter/search over trace reason codes in history views

## Tests and Validation
Unit tests:
- `expandRetrievalMetadata()` adds expected fields/terms and is stable (no nondeterministic output).
- conflict detection logic: feed synthetic match sets and validate conflict true/false.
- identifier hygiene tests: AI-provided terms (unverified) must be rejected; only trusted sources are accepted.
- AI rerun gate tests: rerun only when improvement thresholds are met and call budget allows.
- result comparator tests: reject higher-confidence rerun when evidence quality is weaker.
- automatic fallback evaluator tests:
  - does not trigger before minimum apply samples
  - triggers only after configured consecutive breach windows
  - respects cooldown guard and avoids mode flapping
  - emits deterministic incident payload shape with required fields
  - redacts secrets/prompts from incident payload
  - auto-recover only attempts on version bump and only once per version
- precedence tests: policy-first outcomes override conflicting AI output unless authoritative contradiction exists.
- conflict-threshold boundary tests:
  - vote gap boundary (`<=1` vs `>1`)
  - similarity-margin boundary (`<=0.10` vs `>0.10`)
  - minimum-quality boundary (`>=0.55` vs `<0.55`)
- retry strategy selector tests:
  - low-signal -> selects `hybrid`
  - high-quality conflict -> selects `semantic`
  - sparse metadata -> enrichment path then `hybrid`
  - explicit override modes bypass `auto`
- metadata completeness gate tests:
  - enrichment runs only when `prompt_select` + `tmdb_id` + missing-field threshold are met.
  - enrichment is skipped when any gate condition fails.
  - timeout and max-attempt behavior are enforced deterministically.
- rollout mode tests:
  - `shadow` mode runs evaluation but never changes final decision/routing side effects.
  - `apply` mode applies second-pass decision only when comparator gate passes.
  - trace payload is attached consistently in shadow mode.
- control scope tests:
  - V1 global-only mode uses global config deterministically for all policies.
  - V1.1 override mode applies only allowed keys and preserves global defaults for everything else.
  - safety caps override both global and policy values when limits are exceeded.
- decision trace tests:
  - trace includes stable enum codes for all stage outcomes.
  - trace excludes disallowed fields (raw prompts/responses, secrets).
  - trace truncation is deterministic when max events/bytes are exceeded.
  - missing trace on legacy records is handled safely by readers.
- learning-eligibility tests:
  - pass2-applied machine-only outcomes are excluded from learning updates.
  - user-confirmed/user-corrected outcomes remain learning-eligible.
  - shadow-mode events never contribute to learning metrics/preferences.
- multilingual/alias tests:
  - canonical/original/alias precedence is deterministic.
  - normalization and dedupe are deterministic across case/punctuation variants.
  - alias caps and minimum-token safeguards are enforced.
  - alias-only evidence cannot by itself trigger policy outcome promotion.
- resilience/cooldown tests:
  - timeout/error spike opens dependency breaker only after min-sample gate.
  - half-open probe behavior closes on sustained success and reopens on failure.
  - open breaker correctly skips only scoped stage (enrichment vs retrieval vs AI rerun), not whole classification.
  - multi-breaker open condition activates global bypass and recovers after cooldown.
- config-validation tests:
  - invalid enum/range values are normalized to safe defaults with warning logs.
  - normalized config preserves valid values without mutation.
- missing-mapping guard tests:
  - missing policy context routes to deterministic fallback path.
  - missing metadata mappings produce skip reasons, not thrown errors.
- DB error classification tests:
  - SQLSTATE `23xxx` maps to integrity violation reason codes.
  - SQLSTATE `42xxx` maps to schema mismatch reason codes.
  - SQLSTATE `40xxx` maps to retryable conflict reason codes.
- error-log dedupe tests:
  - repeated same-stage errors within dedupe window are coalesced.
  - distinct stage/reason combinations are preserved.

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
- simulate conflict-heavy scenarios:
  - split RAG vote with small margins should not auto-upgrade.
  - ambiguous identifier present in multiple libraries should not be decisive alone.
  - policy and AI disagreeing should resolve according to precedence rules.
- simulate strategy-specific pass-2 behavior:
  - `auto` chooses expected method from diagnostics.
  - forced `hybrid` and forced `semantic` modes behave deterministically.
- simulate metadata enrichment outcomes:
  - enrichment fills missing fields and improves policy decision path.
  - enrichment timeout/error keeps flow moving without extra retries.
- simulate rollout behavior across modes:
  - same input in `shadow` and `apply` demonstrates identical diagnostics but different final application behavior.
  - apply-mode sustained-regression simulation auto-switches mode to `shadow` when enabled.
  - apply-mode sustained-regression simulation does not switch when `rag_loop_auto_fallback_enabled=false`.
  - auto-fallback incident payload is retrievable via API and matches copy/report contract.
  - auto-recover enabled + version bump simulation re-enables `apply` once; no version bump does not re-enable.
- simulate mixed-policy environment (V1.1 scenario):
  - policies with and without override produce expected strategy/timeout behavior while preserving global gates.
- simulate DB-violation scenarios:
  - invalid config update rejected by DB constraints returns safe API error.
  - serialization/deadlock conflict path applies bounded retry or fail-open behavior as designed.
- simulate mapping-gap scenarios:
  - library without policy context does not crash second-pass pipeline and records deterministic fallback reason.
  - missing `tmdb_id`/high-impact metadata skips enrichment/re-check and preserves baseline flow.
- simulate error-observability payloads:
  - second-pass failures persist stage/reason/sql_state/classification identifiers in error logs.
  - logging failure does not fail classification path (fallback to standard logger only).

Load/perf sanity:
- ensure worst-case classification time impact is bounded (max 2 retrieval calls, 2 AI calls only if configured to re-run AI).

## Rollout Steps
1. Implement both rollout modes in the same feature path behind `rag_loop_rollout_mode`, with default `apply`.
2. Implement automatic fallback controller (`apply` -> `shadow`) behind `rag_loop_auto_fallback_enabled`, default ON.
3. Implement fallback incident reporting surface (API + copyable UI payload).
4. Add optional version-aware auto-recover toggle (`rag_loop_auto_recover_enabled`), default OFF.
5. Activate in `apply` and validate Operational Visibility/readiness in staging, then production.
6. Monitor correction/error/latency regressions through normal operations Operational Visibility.
7. Keep rollback simple: sustained regressions auto-switch to `shadow`; manual override remains available (no code rollback required).
8. Document mode semantics, activation checks, incident reporting flow, and fallback playbook in `docs/` (and optionally `README.md` if user-facing).

### Rollout Clarification (Shadow vs Non-Shadow)
- `shadow` and `apply` are two modes of the same implementation, not separate feature branches.
- Non-shadow behavior is the `apply` mode, which is enabled directly by default.
- Automatic fallback can switch from `apply` to `shadow` when sustained regression thresholds are breached.
- This does not require a separate issue to exist technically; it is an operational configuration choice.
- A follow-up issue is only needed if we choose to add extra capabilities (for example, per-policy UI overrides or advanced dashboards) beyond the current scoped plan.

## Risks and Mitigations
1. Extra latency and load:
   - Mitigation: strict `max_passes`; bounded AI rerun gate; prefer hybrid on retry only.
2. Incorrect conflict detection causing unnecessary retries:
   - Mitigation: conservative defaults; keep conflict detection off by default in V1.
3. "Contradiction" depends on seeing below-threshold candidates:
   - Mitigation: add an explicit candidate-returning method rather than changing the meaning of `semanticSearch()`.
4. Prompt instability due to changed RAG context:
   - Mitigation: re-run AI only when benefit is expected; keep prompt deltas minimal and deterministic.
5. Conflicting signals causing inconsistent outcomes across code paths:
   - Mitigation: implement a single precedence resolver + comparator used by all second-pass paths.
6. Cost/latency creep from repeated AI retries:
   - Mitigation: hard cap AI calls per item and require measurable improvement before rerun.
7. External metadata dependency delays or rate-limits:
   - Mitigation: one attempt, strict 2s timeout, authoritative-only source, fail-open behavior.
8. Incorrect second-pass behavior causing routing regressions:
   - Mitigation: immediate-apply with comparator gates + fail-open resilience + rapid rollback to `shadow`.
9. Low traffic delaying confidence in quality Operational Visibility:
   - Mitigation: use short post-activation monitoring plus targeted backfill/reclassification to increase signal.
10. Configuration drift across policies causing inconsistent behavior:
   - Mitigation: global-first V1, selective override-only V1.1, and strict effective-config precedence with safety caps.
11. Cooldown thrash from noisy short windows:
   - Mitigation: minimum sample gate + timeout-streak trigger + half-open hysteresis.
12. Metadata bloat from verbose traces:
   - Mitigation: compact schema, enum reason codes, and strict event/byte caps with deterministic truncation.
13. Learning pollution from unconfirmed second-pass auto upgrades:
   - Mitigation: confirmation-gated learning eligibility and default exclusion of machine-only outcomes.
14. False positives from broad alias expansion:
   - Mitigation: authoritative-only aliases, strict caps/weights, and alias-only non-decisive rule.
15. Constraint or schema mismatch during rollout (partial migration state):
   - Mitigation: migration pre-flight checks, strict DB constraint naming guards, and no-apply promotion until schema parity is verified.
16. Missing policy/metadata mappings causing inconsistent second-pass behavior:
   - Mitigation: explicit mapping eligibility guards, deterministic skip reasons, and fallback-to-baseline behavior with structured logging.
17. Overly sensitive auto fallback causing unnecessary mode switches:
   - Mitigation: minimum apply-sample gate + consecutive-breach requirement + cooldown + operator toggle in Classification Settings.
18. Auto-recover causes repeated oscillation between modes:
   - Mitigation: version-bump-only recovery rule + one auto-recover attempt per version + normal fallback protections after re-enable.
19. Incident payload leaks sensitive data:
   - Mitigation: strict redaction contract, allowlisted fields only, and no raw prompt/response/API key material.

## Acceptance Criteria
1. When enabled, low-confidence classifications can trigger exactly one bounded retrieval retry.
2. Pass 2 uses deterministic expansion and produces measurable improvements on a small set of ambiguous test cases.
3. No infinite loops; hard max pass count and timeouts are enforced.
4. Clear logs/metrics indicate when and why the loop ran.
5. Existing behavior is unchanged when the feature is disabled.
6. For items below the Policy Builder Threshold (PolicyEngine `prompt_threshold`), a single targeted second pass can raise the PolicyEngine result when verifiable evidence exists; otherwise the system falls back to the existing Policy Builder flow without introducing hallucinated signals.
7. Decision ordering is deterministic: PolicyEngine threshold gate first, targeted re-check second, AI low-confidence retry only as a secondary path.
8. Trigger precedence is deterministic: policy-first (`prompt_select`), then AI confidence fallback (<70), then legacy signal fallback only when policy/AI paths are unavailable.
9. AI rerun behavior is deterministic and bounded: maximum one rerun, gated by measurable evidence improvement, with explicit result-comparison rules.
10. Conflict resolution is deterministic: policy/rag/ai disagreements follow a documented precedence order and test coverage verifies tie-break behavior.
11. Contradiction detection is deterministic: hybrid vote+margin rule is implemented with configurable thresholds and boundary tests.
12. Pass-2 retrieval method selection is deterministic: `auto` strategy chooses method from diagnostics with configurable overrides, and falls back safely to `hybrid` when uncertain.
13. Metadata enrichment is deterministic and bounded: runs only behind completeness gates, uses authoritative source only, and enforces timeout/attempt caps.
14. Shadow mode is fully non-invasive: second-pass diagnostics are recorded but baseline decision/routing behavior remains unchanged.
15. Apply-mode activation is supported directly, with explicit Operational Visibility validation and rapid rollback to `shadow` when regressions are detected.
16. Control scope is deterministic: V1 uses global-only settings; V1.1 applies only allowed per-policy override keys with documented precedence and safety caps.
17. Resilience behavior is deterministic and fail-open: cooldowns only disable optional second-pass stages, never baseline classification flow.
18. Decision trace is persisted and auditable: every second-pass evaluation stores a versioned, redacted, bounded trace with deterministic reason codes.
19. Learning safety is deterministic: second-pass-applied machine-only outcomes do not update learning artifacts unless user-validated later.
20. Multilingual/alias handling is deterministic: canonical/original/authoritative-alias precedence and bounded alias rules are enforced.
21. Minimal operator UI exists for V1 rollout safety: settings expose second-pass mode controls, history surfaces trace summaries, and low-confidence review surfaces re-check outcome hints.
22. Database safety is deterministic: invalid rollout config values are constrained/normalized and do not crash baseline classification.
23. Mapping-gap handling is deterministic: missing policy or metadata mappings produce explicit skip/fallback reasons without runtime exceptions.
24. Error observability is comprehensive and non-invasive: second-pass stage failures emit structured, queryable logs/metrics while classification remains fail-open.
25. Log volume is controlled: repeated identical second-pass failures are deduplicated/throttled to prevent `error_log` storm conditions.
26. Automatic safety fallback is hands-off by default: sustained apply-mode regressions auto-switch `rag_loop_rollout_mode` to `shadow` with structured reason logging.
27. Classification Settings exposes `Automatic Safety Fallback` (default ON), and disabling it cleanly prevents auto mode switching.
28. Automatic fallback creates a copyable, sanitized incident report with enough diagnostics for maintainers to triage/fix.
29. Classification Settings exposes `Auto Re-enable After Upgrade` (default OFF); when ON, the system retries `apply` only after version bump and only once per version.

## Optional Feature Coverage Audit (Plan Completeness)
Purpose: ensure every optional capability is explicitly tracked and "implemented in plan" (fully specified with scope + steps + validation), even when deferred from V1 code delivery.

Definition of "implemented in plan":
1. Decision/scoping is explicit (`Planned V1`, `Deferred V1.1`, or `Out of Scope`).
2. Concrete implementation steps exist.
3. Validation exists (tests and/or rollout gates).
4. Acceptance impact is explicit (criterion or non-goal note).

Coverage matrix:
- Optional feature: Pass-2 rerank behavior
  - Plan status: Planned V1
  - Scope: keep deterministic rerank path per strategy
  - Evidence in plan: Retrieval Pass 2 Strategy; Backend Step 3/13; Unit/integration strategy tests
  - Acceptance linkage: criteria 11-12
- Optional feature: Metadata completeness enrichment before re-check
  - Plan status: Planned V1 (bounded)
  - Scope: authoritative-only, single attempt, strict timeout
  - Evidence in plan: Metadata Completeness Gate; config keys; Backend Step 14; metadata enrichment tests
  - Acceptance linkage: criterion 13
- Optional feature: AI rerun after pass 2
  - Plan status: Planned V1 (strictly gated)
  - Scope: max one rerun, measurable improvement required
  - Evidence in plan: AI Re-Run Policy; Backend Step 3/10; AI rerun gate tests
  - Acceptance linkage: criterion 9
- Optional feature: Resilience cooldown + global bypass
  - Plan status: Planned V1
  - Scope: dependency-scoped fail-open breakers; optional short global bypass
  - Evidence in plan: Resilience and Auto-Cooldown; Backend Step 18; resilience tests
  - Acceptance linkage: criterion 17
- Optional feature: Shadow-mode diagnostics UI (operator-facing)
  - Plan status: Planned V1 (recommended)
  - Scope: advanced settings controls + history trace summary + policy-builder diagnostic line
  - Evidence in plan: Client/UI Scope; Client/UI Steps
  - Acceptance linkage: criterion 21
- Optional feature: Automatic regression fallback (`apply` -> `shadow`)
  - Plan status: Planned V1
  - Scope: default-on sustained-breach evaluator + cooldown + incident reporting + operator toggles
  - Evidence in plan: Rollout Policy Update; Automatic Regression Fallback; Auto-Fallback Incident Reporting; Backend Steps 17/24; Classification Settings UI steps
  - Acceptance linkage: criteria 26-29
- Optional feature: Per-policy overrides for second-pass controls
  - Plan status: Deferred V1.1
  - Scope: limited override keys (enable/strategy/timeout) with precedence and safety caps
  - Evidence in plan: Scope of Control; V1.1 config container; control-scope tests
  - Acceptance linkage: criterion 16 (V1.1 clause)
- Optional feature: Advanced diagnostics dashboards and trace filtering
  - Plan status: Deferred V1.1
  - Scope: breaker timeline, strategy distribution, promotion trends, trace-code filtering
  - Evidence in plan: Client/UI Scope V1.1 optional enhancements
  - Acceptance linkage: explicitly non-blocking for V1
- Optional feature: Data-model projection enhancements for analytics
  - Plan status: Deferred V1.1+
  - Scope: project trace fields to dedicated analytics tables/materialized views
  - Evidence in plan: Data Model Changes -> Optional later enhancement
  - Acceptance linkage: explicitly non-blocking for V1
- Optional feature: Explicit `learning_eligible` column and alias cache field
  - Plan status: Deferred V1.1+
  - Scope: optional schema optimizations only
  - Evidence in plan: Data Model Changes -> Optional later enhancement
  - Acceptance linkage: explicitly non-blocking for V1

Gap check result:
- No optional feature is currently "untracked."
- V1-optional behaviors that affect correctness/safety are now explicitly mapped to steps + tests + acceptance.
- Deferred items are clearly marked as non-blocking to prevent accidental scope creep.

## Optional Feature Release Checklist
Use this checklist during grooming/release planning to ensure optional items have explicit ownership and a milestone decision.

Milestone legend:
- `V1`: must ship with initial issue-275 delivery.
- `V1.1`: follow-up milestone after V1 stabilization.
- `Backlog`: intentionally deferred beyond V1.1.

Checklist:
- [x] Pass-2 rerank behavior
  - Owner: Codex
  - Target milestone: V1
  - Done when: deterministic rerank path is implemented per strategy and covered by strategy selector tests.
- [x] Metadata completeness enrichment before re-check
  - Owner: Codex
  - Target milestone: V1
  - Done when: enrichment gate, timeout/attempt caps, and authoritative-source enforcement are implemented and tested.
- [x] AI rerun after pass 2 (gated)
  - Owner: Codex
  - Target milestone: V1
  - Done when: rerun budget + material-improvement gates + result comparator are implemented and tested.
- [x] Resilience cooldown + optional global bypass
  - Owner: Codex
  - Target milestone: V1
  - Done when: dependency-scoped breakers with half-open probes are implemented and resilience tests pass.
- [x] Shadow-mode diagnostics UI (operator-facing)
  - Owner: Codex
  - Target milestone: V1
  - Done when: advanced settings controls, history trace summary, and low-confidence diagnostic line are implemented.
- [x] Automatic regression fallback (`apply` -> `shadow`)
  - Owner: Codex
  - Target milestone: V1
  - Done when: sustained-breach evaluator auto-switches mode to `shadow` by default, incident payload is copyable for issue filing, and Classification Settings toggles cover both disable + version-aware re-enable.
- [ ] Per-policy override controls (UI + backend wiring)
  - Owner: Codex
  - Target milestone: V1.1
  - Done when: allowed override keys (`enable`, `strategy`, `timeout`) are configurable with precedence/safety-cap validation.
- [ ] Advanced diagnostics dashboards and trace filtering
  - Owner: Codex
  - Target milestone: V1.1
  - Done when: breaker/strategy/promotion dashboards and trace reason-code filters are available.
- [ ] Trace projection to analytics tables/materialized views
  - Owner: Codex
  - Target milestone: Backlog
  - Done when: decision-trace fields are queryable without scanning raw metadata payloads.
- [ ] Explicit `learning_eligible` column and alias cache field
  - Owner: Codex
  - Target milestone: Backlog
  - Done when: schema additions are shipped with migration, compatibility checks, and reader/writer updates.

Release governance notes:
- If an item remains unchecked when its target milestone starts, explicitly reclassify it (`V1` -> `V1.1` or `Backlog`) in this section before implementation begins.
- Any reclassification must also update Acceptance Criteria and Release Notes scope statements.

## Open Questions (Resolve Before Implementation)
None remaining for V1 design.

## Resolved Decisions
1. Trigger model for second-pass targeting:
   - Use policy-first gating: run targeted re-check when PolicyEngine returns `prompt_select` (below `prompt_threshold`).
   - Use AI confidence (`aiResult.confidence < 70`) only as fallback when PolicyEngine context is unavailable.
   - Use signal confidence only as tertiary fallback in legacy/no-policy/no-AI paths.
2. AI rerun policy:
   - Do not rerun AI by default on policy-first path.
   - Allow one AI rerun only when verifiable evidence materially improves and gates are met.
   - Use deterministic result adoption rules; reject reruns that increase confidence without stronger evidence.
3. Contradiction/conflict detection:
   - Use hybrid rule (vote split + similarity margin + quality floor), not vote-only or margin-only.
   - Require minimum evidence (`min_matches`) and explicit thresholds with defaults.
   - Treat low-signal candidate pools as retrieval weakness, not true conflict.
4. Pass-2 retrieval strategy:
   - Use adaptive `auto` selection by default (not always-hybrid).
   - Prefer `hybrid` for low-signal/sparse-metadata cases and `semantic` for high-quality conflict cases.
   - Provide explicit override modes for deterministic behavior and troubleshooting.
5. Metadata completeness and enrichment budget:
   - Trigger enrichment only when `prompt_select` + `tmdb_id` + at least 2 high-impact metadata fields missing.
   - Use authoritative enrichment source only, with max 1 attempt and 2000 ms timeout.
   - Keep enrichment within the existing second-pass budget; fail open on timeout/error.
6. Rollout mode for V1:
   - Launch in `apply` mode by default so second-pass benefits are immediate.
   - Keep `shadow` available as a rapid rollback/diagnostic mode.
7. Scope of control for second-pass behavior:
   - V1 uses global-only controls for stable rollout and low-variance operations.
   - V1.1 introduces selective per-policy overrides for a limited key set with explicit precedence and safety caps.
8. Resilience behavior for dependency spikes:
   - Use dependency-scoped cooldown breakers for `tmdb_enrichment`, `rag_pass2`, and `ai_rerun`.
   - Keep behavior fail-open: skip only optional second-pass stages while preserving baseline decision path and existing retry queue semantics.
   - Use rolling-window + timeout-streak triggers, half-open probes, and optional short global bypass when multiple breakers open.
9. Decision trace and auditability for second-pass outcomes:
   - Persist `classification_details.rag_loop_trace` with `trace_version`, stage-level enum reasons, and bounded/redacted payload.
   - Record trace in both `shadow` and `apply` modes (including skipped-by-gate cases) for comparable audit coverage.
   - Enforce deterministic truncation and backward-compatible readers for rows without trace data.
10. Auto-learning interaction for second-pass outcomes:
   - Exclude machine-only pass2-applied outcomes from auto-learning by default.
   - Require explicit user confirmation/correction before updating learning artifacts (`policy_presets`, `auto_learned_preferences`, learning stats inputs).
   - Keep shadow evaluations permanently excluded from learning.
11. Multilingual and alias handling for targeted retry:
   - Use deterministic precedence: canonical title first, original title second, authoritative aliases third.
   - Normalize/dedupe alias candidates with strict caps and script-aware safeguards.
   - Prevent alias-only evidence from single-handedly upgrading policy outcomes.
12. Automatic regression fallback behavior:
   - Enable automatic fallback by default (`rag_loop_auto_fallback_enabled=true`).
   - Use locked defaults: `min_apply_samples=25`, `consecutive_breaches=3`, `cooldown_ms=900000`, with existing error/latency gates.
   - On sustained apply-mode regressions, auto-switch rollout mode to `shadow` with structured reason logging.
   - Emit a copyable, sanitized incident payload for user bug reports when fallback triggers.
   - Keep auto-recovery to `apply` disabled by default; when enabled, allow version-bump-only retry once per version.
   - Expose Classification Settings toggles for automatic fallback and version-aware auto-recover behavior.
