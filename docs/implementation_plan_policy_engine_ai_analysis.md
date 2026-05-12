# Implementation Plan: PolicyEngine + RAG -> AI Analysis -> Policy Prompt

## Goal
Align the classification pipeline with the intended design:
- PolicyEngine computes policy-driven signals (presets/custom + profile/history + RAG).
- AI analysis consumes those signals unless PolicyEngine confidence is high enough to skip AI.
- policy_prompt is generated only after AI analysis for low/ambiguous cases.

## Additional Workstreams (from current planning)
This plan also tracks two parallel efforts discussed in the same session:
1) Open dependency PRs (merge order + test gates).
2) OMDb 523 error handling and resilience.
3) *arr routing after Discord clarification (quality profile/search-on-add + Sonarr add failures).
4) ClarificationService policy question resolution JSON parse error.
5) Overseerr specials exclusion (ignore Season 0 in webhook/request payloads).

## Constraints from OPENAI.md (Repo Operating Rules)
This plan follows the repo’s operating rules and architecture guidelines:
- Follow existing patterns; avoid cross-cutting refactors unless requested.
- If API contracts change, update server routes/services and client `client/src/api` plus affected views/stores.
- If DB schema changes, add a migration in `database/migrations/` and update queries.
- Use `.env.example` as reference; never commit secrets.
- Prefer using existing scripts in `scripts/` or `server/src/scripts/` when automation is needed.
- Keep changes scoped and document behavior changes in `docs/`/`README.md` when appropriate.

## Dedicated Checklist (Comprehensive)

### Phase 0: Alignment
- [ ] Confirm target pipeline: PolicyEngine -> RAG -> AI Analysis -> Decision -> Notification.
- [ ] Confirm AI runs for all non-auto-classify cases.
- [ ] Confirm policy_prompt only after AI analysis (no early return).
- [ ] Confirm AI mode rules (classify vs verify) by confidence band.

### Phase 1: Server Core Flow
- [x] `classification.js`: remove early returns for policy_prompt paths.
- [x] `classification.js`: store `metadata.policyResult` for AI use.
- [x] `classification.js`: create `ragContext` once and reuse.
- [x] `classification.js`: ensure AI gets policy signals + ragContext.
- [x] `classification.js`: generate policy_prompt only after AI, based on AI uncertainty/confidence.

### Phase 2: Policy Signals + AI
- [x] `policyEngine.js`: accept optional `ragCache` (avoid duplicate RAG calls).
- [x] `policyEngine.js`: return structured breakdown (scores/weights) for AI prompt.
- [x] `policyEngine.js`: expose ranked candidates with scores for prompt building.
- [x] `aiPromptBuilder.js`: policy signal section uses PolicyEngine signals (not legacy).
- [x] `aiPromptBuilder.js`: include RAG summary in AI context.
- [x] `aiResponseParser.js`: allow explicit mode override (classify vs verify).
- [x] `aiResponseParser.js`: if classify mode, allow AI to set confidence (clamped).

### Phase 3: policy_prompt Enrichment
- [x] `policyQuestionBuilder.js`: accept `policyResult`, `ragContext`, `aiResult`.
- [x] `policyQuestionBuilder.js`: include policy scores/weights in payload.
- [x] `policyQuestionBuilder.js`: include RAG summary and AI rationale.
- [x] `policyQuestionBuilder.js`: include key tags/genres/keywords used in the question.

### Phase 4: UI / Phase Tracking
- [x] `classificationPhaseService.js`: add `ai_analysis` phase.
- [x] Update phase order metadata and validation.
- [x] `GlobalProgressBar.vue`: add `ai_analysis`, update ordering and labels.
- [x] `ActivityItemProgress.vue`: align labels/order with server phases.
- [x] `History.vue`: ensure method labels match any new method names.

### Phase 5: Bug Fix (Source Library Confidence)
- [x] `mediaSync.js`: set confidence = 100 when resolving via source_library.

### Phase 6: *arr Routing After Discord
- [x] `discordBot.js`: confirm routing path uses correct metadata after clarification.
- [x] `classification.js`: routeToArr uses TVDB ID (not TMDB) for Sonarr.
- [x] `tmdb.js`: add helper to fetch external IDs (TVDB) for TV series.
- [x] `sonarr.js`: add lookup helper to build full add payload from `/series/lookup`.
- [x] `classification.js`: ensure Radarr uses qualityProfileId + search_on_add.
- [x] `classification.js`: ensure Sonarr uses qualityProfileId + search_on_add.
- [x] Align `search_on_add` with Sonarr Add + Search behavior and monitored status.
- [x] Add preflight validation for Sonarr: TVDB ID exists + series has English title.
- [x] Align Radarr routing with best practices: root folder + quality profile + monitored, and explicitly trigger search when needed.
- [x] Validate `radarr_settings` / `sonarr_settings` persistence from UI.
- [x] Add/extend tests for routing payloads and error handling.

### Phase 7: Overseerr Specials Inclusion Toggle
- [x] Add config to include specials (season 0) for TV requests (webhook config or settings).
- [x] Add DB migration: `webhook_config.include_specials` (default false).
- [x] `server/src/services/webhook.mjs`: read/write `include_specials` in config.
- [x] `server/src/services/webhook.mjs`: filter `request.seasons` and `extra` (season 0) when `include_specials` is false.
- [x] `server/src/routes/settings.mjs`: expose `include_specials` in `/api/settings/webhook` and configs endpoints.
- [x] `client/src/views/settings/Webhooks.vue`: add toggle for “Include Specials (Season 0)”.
- [x] `client/src/api/index.js`: ensure `include_specials` is sent/received in webhook config.
- [x] Filter `requested_seasons` / `extra` arrays to remove season 0 before enqueueing tasks.
- [x] Log when specials were excluded for traceability.
- [x] Add tests for webhook parsing with season 0 present.

### Phase 8: ClarificationService JSON Parse Bug
- [x] `clarificationService.js`: treat `classification.metadata` as JSONB (object) or string.
- [x] Ensure `resolvePolicyQuestion` uses safe parse for `classification.metadata`.
- [x] Add unit test for metadata object vs string handling.
- [x] Confirm Discord resolution path succeeds for policy_question payloads stored as JSON.

### Phase 9: Open PRs (Dependency Updates)
- [x] PR #222: review diff scope.
- [x] PR #222: `npm --prefix server test`.
- [x] PR #220: review diff scope.
- [x] PR #220: `npm --prefix server test`.
- [x] PR #223: review diff scope.
- [x] PR #223: `npm --prefix client test` (optional build).
- [x] PR #221: review diff scope.
- [x] PR #221: `npm --prefix client test`.

### Phase 10: OMDb 523 Resilience
- [x] `omdb.js`: treat 520/521/523 as transient Cloudflare errors.
- [x] Add unit test for 523 retry + graceful skip.
- [x] `npm --prefix server test`.

### Phase 11: Tests & Validation
- [x] `classification.test.js`: AI runs for policy_prompt cases.
- [x] `classificationPhaseService.test.js`: updated phase ordering.
- [x] `policyQuestionBuilder` tests for enriched payload.
- [x] Add unit for AI mode override (classify vs verify).
- [x] Client UI tests for progress labels/order (if present).

### Phase 12: Local Testing
- [x] Run server tests: `npm --prefix server test`.
- [x] Run client tests: `npm --prefix client test`.
- [x] Run integration tests: `npm --prefix server run test:integration`.
- [x] Optional: client build `npm --prefix client run build`.
- [ ] Manual smoke: Discord clarification -> *arr routing (Sonarr + Radarr) with search-on-add enabled.
- [ ] Manual smoke: Overseerr webhook with season 0 (specials) excluded when toggle is on.
- [ ] After all test suites complete, update `docs/interesting_findings.md` with any NEW warnings/errors (non-breaking only).

### Phase 13: Release (v0.40.5-alpha)
- [x] Update `RELEASE_NOTES.md` with v0.40.5-alpha entry.
- [x] Update `CHANGELOG.md` if required by repo conventions.
- [ ] Review release checklist in `release.md`.
- [ ] Tag/release steps after local tests pass.
- [x] Pull resolved items from `docs/interesting_findings.md` into `CHANGELOG.md` and `RELEASE_NOTES.md`.

#### Release-Specific Checks (v0.40.5-alpha)
Highlights:
- PolicyEngine + RAG feeds AI analysis; policy_prompt generated only after AI.
- *arr routing fixes (Sonarr add via TVDB lookup; Radarr search-on-add).
- OMDb 523 resilience.
- ClarificationService JSON parse fix.
- Overseerr specials exclusion toggle (season 0).

Manual smoke tests:
- Discord clarification -> Sonarr add (valid TVDB ID; no 400).
- Discord clarification -> Radarr add with search-on-add enabled.
- Overseerr webhook with season 0 present: verify specials excluded when toggle on.
- PolicyEngine low confidence case runs AI before prompt.

Observability:
- Confirm routing errors log payload context (no secrets).
- Confirm webhook logs show filtered seasons when exclude_specials=true.
- [ ] Update `RELEASE_NOTES.md` for pipeline change and OMDb resilience.
- [ ] Update `CHANGELOG.md` if required by repo conventions.

## Problem Summary
- PolicyEngine currently short-circuits on `prompt_confirm` / `prompt_select`, so AI analysis never runs.
- This yields low confidence results for items that should be high confidence, because AI never sees the full signal set.
- policy_prompt is being produced before AI, contrary to the intended design.
- *arr routing after Discord clarification fails to add TV series to Sonarr (HTTP 400) and does not consistently respect Radarr quality profile or search-on-add.
- Clarification resolution fails when `classification.metadata` is already JSONB (object), causing `"[object Object]" is not valid JSON`.
- Overseerr webhook payloads can include season/episode data for TV requests; need an option to exclude specials (season 0) before classification.

### Open PRs (Dependency Updates)
Open PRs to merge (recommended order):
1) PR #222: server `cors` 2.8.5 -> 2.8.6
2) PR #220: server `axios` 1.13.2 -> 1.13.3
3) PR #223: client `axios` 1.13.2 -> 1.13.3
4) PR #221: client `vitest` 4.0.17 -> 4.0.18

Test gates:
- Server PRs: `npm --prefix server test`
- Client PRs: `npm --prefix client test` (optional `npm --prefix client run build`)

### OMDb 523 Bug
Observed error: `Request failed with status code 523` (OMDbService)
- 523 is a Cloudflare edge error; should be treated as transient.
- Current retry logic handles 522/524/502/503 only.
- Add 520/521/523 to transient Cloudflare errors and retry/skip gracefully.

### *arr Routing After Discord (New Issue)
Bug report:
- Error ID: 9107f1ed-3a63-4438-b38b-764a88398d49
- Error: `Failed to add series to Sonarr: Request failed with status code 400`
Likely causes:
- Sonarr expects **TVDB ID**; current routing uses TMDB ID as `tvdbId`.
- Sonarr add payload likely missing fields from `/series/lookup` response.
Routing expectations:
- Radarr: must respect quality profile and `search_on_add`.
- Sonarr: must add series and honor quality profile + search-on-add settings.

Best practices (Sonarr wiki - add/search behavior):
- When adding a show, Sonarr expects correct root path, quality profile, and monitoring status; searches for missing episodes should be explicitly triggered when required.
- Auto-searching is only triggered when explicitly requested (e.g., Add + Search / manual search), and does not run continuously for older releases.
- A series must exist on TVDB and have an English title to be addable; TVDB IDs are required for ID-based lookups.

Best practices (Radarr wiki - add/search behavior):
- When adding a movie, set the root folder, quality profile, and monitoring status; Radarr uses those settings to manage RSS monitoring and upgrades. citeturn6view2
- Radarr does not regularly search for missing movies; to search immediately you must use “Start search for missing movie.” citeturn7view0turn7view1
- For movies you want now (older releases), explicit search on add (searchForMovie) is required to find past releases. citeturn7view0turn7view1

File map:
- `server/src/services/discordBot.mjs` -> `routeAfterClarification`
- `server/src/services/classification.mjs` -> `routeToArr` (payload creation)
- `server/src/services/sonarr.mjs` -> `addSeries`, `searchSeries`
- `server/src/services/radarr.mjs` -> `addMovie`
- `server/src/services/tmdb.mjs` -> add external ID lookup helper

Payload expectations (target):
Radarr add (minimum):
```
{
  title,
  tmdbId,
  year,
  qualityProfileId,
  rootFolderPath,
  monitored,
  addOptions: { searchForMovie }
}
```
Sonarr add (minimum from /series/lookup):
```
{
  title,
  tvdbId,
  qualityProfileId,
  rootFolderPath,
  monitored,
  seriesType,
  seasonFolder,
  addOptions: { searchForMissingEpisodes, monitor }
}
```

#### *arr API Payload Schemas (Expanded)
Sonarr (recommended flow):
1) Call `/series/lookup` with `term=tvdb:{id}` to get a fully-populated series record.
2) POST to `/series` using the lookup response fields, plus:
   - `qualityProfileId`
   - `rootFolderPath`
   - `monitored`
   - `seasonFolder`
   - `addOptions.searchForMissingEpisodes`
3) Preflight: ensure TVDB ID exists and the series has an English title (Sonarr cannot add series without an English title).
4) If Sonarr responds with 400, log the payload and compare against `/series/lookup` output to detect missing required fields.

Radarr (recommended flow):
1) Use TMDB ID when adding a movie.
2) POST to `/movie` with:
   - `tmdbId`
   - `qualityProfileId`
   - `rootFolderPath`
   - `monitored`
   - `addOptions.searchForMovie` for “Add + Search” behavior
3) If adding older titles, enable `searchForMovie` to trigger immediate search.

#### Sources / References (for implementation)
- Sonarr FAQ: TVDB presence + English title requirement.
- Sonarr API behavior: series add expects full data, use `/series/lookup` response.
- Radarr FAQ / Users Guide: add + search behavior for older releases; RSS-only for new content.

### ClarificationService JSON Parse Bug (New Issue)
Bug report:
- Error ID: ada1fd7a-cbdb-4451-a7e3-b73c66afaa24
- Error: `"\"[object Object]\" is not valid JSON"`
Likely cause:
- `resolvePolicyQuestion` does `JSON.parse(classification.metadata)` even when `metadata` is already JSONB (object) from Postgres.
Expected fix:
- Handle object vs string and only parse when value is a string.

### Overseerr Specials Exclusion (New Issue)
Notes:
- Overseerr webhook templates expose a `{{request}}` object and an `{{extra}}` array for series-related notifications (season/episode numbers).
Implementation guidance:
- Use the `request.seasons` list (if present) and the `extra` array to filter out season 0 (specials) on ingest.
Sources:
- Overseerr webhook template variables (request + extra arrays) in docs.
Proposed implementation:
- Add a toggle in webhook settings: `include_specials` (default false).
- If disabled, drop season 0 from `request.seasons` and remove season/episode entries in `extra` for season 0 before storing or enqueueing.

## Desired Behavior
1) PolicyEngine runs first to compute policy signals and confidence.
2) If PolicyEngine confidence >= auto-classify threshold, skip AI and finalize.
3) Otherwise, AI analysis runs using PolicyEngine signals + RAG context.
4) policy_prompt is generated only after AI analysis if uncertainty remains.

## Proposed Flow (Logical)
1. Metadata Fetch
2. PolicyEngine Evaluation (build signals + compute confidence)
3. RAG Analysis (reuse same RAG results from PolicyEngine)
4. AI Analysis (classify/verify using policy signals)
5. Decision
6. Notification

## File-by-File Change Map

### Server
**`server/src/services/classification.mjs`**
- Refactor `runDecisionTree(...)`:
  - Always compute `policyResult` first.
  - Return early only on `policyResult.action === 'auto_classify'`.
  - For `prompt_confirm` / `prompt_select`, do NOT return early; instead set `metadata.policyResult = policyResult` and continue to AI analysis.
  - Ensure `ragContext` is built once and passed to both PolicyEngine (for scoring) and AI (for prompt context).
  - Generate `policy_prompt` only after AI if `needs_clarification` or confidence below threshold.

**`server/src/services/policyEngine.mjs`**
- Accept optional `ragCache` input to avoid duplicate RAG fetches.
- Return a structured breakdown:
  - top library, scores, weights, and per-signal breakdown for AI prompt use.

**`server/src/services/aiPromptBuilder.mjs`**
- Ensure the "policy_engine" section consumes PolicyEngine signals (not legacy signalContext).
- Add clarity around breakdown fields: `type`, `score`, `weight`.

**`server/src/services/aiResponseParser.mjs`**
- Allow explicit mode control (classify vs verify).
- If running classify mode, do not treat presence of signalContext as verification-only.

**`server/src/services/policyQuestionBuilder.mjs`**
- Extend inputs: `policyResult`, `ragContext`, `aiResult`, `metadata`.
- Enrich `policy_question.meta` with:
  - policy scores/weights
  - RAG summary
  - key tags/genres/keywords
  - AI rationale (if available)

**`server/src/services/classificationPhaseService.mjs`**
- Add `ai_analysis` phase between RAG and Decision.
- Adjust phase order for progress tracking.

**`server/src/services/mediaSync.mjs`**
- Fix reconciliation path to set `confidence = 100` when `method = 'source_library'`.

### Client
**`client/src/components/activity/GlobalProgressBar.vue`**
- Update phase list to include `ai_analysis`.
- Move Decision after AI.
- Rename/remove Combine if it no longer reflects behavior.

**`client/src/components/activity/ActivityItemProgress.vue`**
- Update labels and ordering to match server phases.

**`client/src/views/History.vue`**
- Ensure friendly method names cover any new/renamed methods (if introduced).

## Data Shape (Proposed)

### Policy Signal Context (for AI)
```
{
  confidence: 0-100,
  suggestedLibrary: { id, name },
  breakdown: [
    { type: "preset", score: 72, weight: 0.35 },
    { type: "profile", score: 60, weight: 0.25 },
    { type: "pattern", score: 40, weight: 0.15 },
    { type: "rag", score: 50, weight: 0.15 },
    { type: "history", score: 30, weight: 0.10 }
  ],
  ranked: [ { library_id, library_name, score } ]
}
```

### Policy Question Payload (enriched)
```
{
  "type": "policy",
  "problem_summary": "Low confidence",
  "why_uncertain": "Policy signals are weak or conflicting.",
  "question": "Which library fits best?",
  "options": [ { "label": "Movies", "library_id": 5 } ],
  "meta": {
    "candidates": [ { "library_id": 5, "score": 62 } ],
    "policy_scores": { "preset": 70, "profile": 60, "pattern": 40, "rag": 50, "history": 30 },
    "policy_weights": { "preset": 0.35, "profile": 0.25, "pattern": 0.15, "rag": 0.15, "history": 0.10 },
    "rag_summary": [ { "title": "Similar Item", "library": "Movies", "similarity": 0.82 } ],
    "ai_rationale": "AI saw mixed signals between Movies and TV."
  }
}
```

## Implementation Steps
1) Refactor `classification.js` to stop short-circuiting on policy_prompt and to pass policy signals into AI analysis.
2) Add AI mode control (classify vs verify) in `aiResponseParser`.
3) Update `aiPromptBuilder` to display policy signals + RAG context from PolicyEngine.
4) Enhance `policyQuestionBuilder` payload with policy + RAG + AI rationale.
5) Update phase order (server + client).
6) Fix `source_library` reconciliation confidence.
7) Update tests.
8) Update release notes.

## Test Plan
- Unit: `classification.test.js` (AI runs when policy_prompt would have occurred).
- Unit: `policyQuestionBuilder` (enriched meta fields).
- Unit: `classificationPhaseService.test.js` (new phase order).
- UI: activity stepper order and labels.
- Integration: `npm --prefix server run test:integration`.
- Post-test: record NEW non-breaking warnings/errors in `docs/interesting_findings.md`.

## Acceptance Criteria
- policy_prompt is only created after AI analysis.
- AI analysis receives policy signals + RAG context.
- Items that should be high confidence no longer remain <50% without AI.
- Source library reconciled items show 100% confidence.

## Workstream Implementation Steps

### A) PolicyEngine + AI Pipeline (Primary)
1) Refactor `classification.js` to stop short-circuiting on policy_prompt and to pass policy signals into AI analysis.
2) Add AI mode control (classify vs verify) in `aiResponseParser`.
3) Update `aiPromptBuilder` to display policy signals + RAG context from PolicyEngine.
4) Enhance `policyQuestionBuilder` payload with policy + RAG + AI rationale.
5) Update phase order (server + client).
6) Fix `source_library` reconciliation confidence.
7) Update tests.
8) Update release notes.

### B) Open PRs (Dependency Updates)
1) Review PR #222 (server cors): verify diff scope (package.json/package-lock.json only).
2) Test server after PR #222: `npm --prefix server test`.
3) Review PR #220 (server axios): verify diff scope.
4) Test server after PR #220: `npm --prefix server test`.
5) Review PR #223 (client axios): verify diff scope.
6) Test client after PR #223: `npm --prefix client test` (optional build).
7) Review PR #221 (client vitest): verify diff scope.
8) Test client after PR #221: `npm --prefix client test`.

### C) OMDb 523 Resilience
1) Update `server/src/services/omdb.mjs` to treat 520/521/523 as transient Cloudflare errors.
2) Add unit test verifying 523 retries and returns null without incrementing usage.
3) Run `npm --prefix server test`.
4) Document in release notes.
