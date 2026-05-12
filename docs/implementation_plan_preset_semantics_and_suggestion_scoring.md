# Implementation Plan: Preset Semantics, Suggestion Scoring, and Conflict Clarification

## Goal
Align preset behavior with operator expectations:

- preset suggestions in the UI must not imply runtime safety they do not currently represent
- presets should default to **scoring influences**, not silent hard disqualifiers
- clarification questions must be centered on the **top-ranked candidate**, not a lower-ranked conflicting library

## Product Vision Constraints
The implementation should be explicitly shaped around these product rules:

1. Media-server context is **descriptive**, not normative.
   - It tells Classifarr what is currently inside a library.
   - It must not silently redefine what a library is supposed to mean.
2. Presets are **advisory by default**.
   - A preset may increase or decrease score.
   - A preset must not become a hard block unless strict behavior is explicitly enabled and visible.
3. Candidate ordering must be **truthful end-to-end**.
   - `policyResult.ranked[0]` should remain the lead candidate in `policy_question.meta.candidates`, prompt wording, and option ordering unless there is an explicit, labeled override.
4. Ambiguous or malformed AI output must **fail safe**.
   - When the model breaks contract, the system should fall back to deterministic clarification/manual review.
   - It should not invent a confident target library from prose if the response contract was violated.
5. UI suggestion scores must be **operator hints**, not policy guarantees.
   - A high suggestion score should never imply "safe to attach" if runtime semantics may materially change classification behavior.

## Problem Summary
Recent classification traces exposed five connected issues:

1. The preset suggestion UI shows values like `90% match`, but that value is currently a token/name heuristic, not a runtime-safe suitability score.
2. Runtime preset evaluation currently treats `language.require_any` as a hard gate in the policy engine, which conflicts with the expectation that presets are soft scoring hints by default.
3. The clarification builder can foreground a conflicting library in the question/options even when that library ranked below the actual top candidate or scored `0`.
4. AI response parsing still permits malformed narrative outputs to enter the classification flow, which can amplify preset/clarification issues when the model ignores the response contract.
5. Polluted library profiles can still dominate fallback behavior when a library's synced contents do not match the operator's intended meaning for that library.

## Evidence From Current Behavior

### A) Suggestion score is heuristic, not semantic
Current suggestion logic in `server/src/routes/policies.mjs` is based on library-name token matching:

```js
const tokens = libraryName
  .replace(/[^a-z0-9\s]/g, ' ')
  .split(/\s+/)
  .filter(t => t.length > 2);

if (tokens.some(t => presetKey.includes(t) || t.includes(presetKey))) {
  score += 50;
}

const nameMatchCount = tokens.filter(t => presetName.includes(t)).length;
if (nameMatchCount > 0) {
  score += nameMatchCount * 30;
}

const descMatchCount = tokens.filter(t => presetDesc.includes(t)).length;
if (descMatchCount > 0) {
  score += descMatchCount * 10;
}
```

This can produce misleading scores for stopwords and substrings. For example, `Comedy and Standup` can produce a high suggestion score for `Scandinavian` because the token `and` is retained and is a substring of `scandinavian`.

The UI then presents that heuristic as:

```vue
<div class="text-xs text-gray-400">
  {{ preset.match_score }}% match
</div>
```

Files:
- `server/src/routes/policies.mjs`
- `client/src/components/policies/PolicyBuilderModal.vue`
- `client/src/components/policies/PresetSelectionModal.vue`

### B) Runtime language presets are currently hard gates
Current runtime behavior in `server/src/services/policyEngine.mjs`:

```js
if (signals.language) {
  const score = this.scoreLanguage(signals.language, item);
  if (score === 0 && signals.language.require_any && signals.language.require_any.length > 0) {
    return 0;
  }
  const weight = signals.language.weight ?? 1.0;
  scores.push(score * weight);
  totalWeight += weight;
}
```

And later:

```js
if (evaluation.score > 0 && !languageConflictPolicyIds.has(policy.id)) {
  evaluations.push(evaluation);
}
```

This means `language.require_any` is not merely lowering a score. It can:

- zero out the entire preset
- mark a policy as a language conflict
- remove that policy from ranked evaluation output

That behavior is stricter than the current user expectation for presets.

File:
- `server/src/services/policyEngine.mjs`

### C) Clarification question anchors on the conflicting library
Current conflict question builder in `server/src/services/policyQuestionBuilder.mjs`:

```js
const conflictLibraries = languageConflicts.map(c => ({ id: c.library_id, name: c.library_name }));
const regularLibraries = candidates.map(c => c.library).filter(Boolean);
const allLibraries = [...conflictLibraries, ...additionalLibraries];
const options = allLibraries.slice(0, 3).map(lib => this.toOption(lib.name, lib));
```

And question text:

```js
const conflictLangLabel = this.formatLanguage(conflict.required_languages[0]);
question = `This is ${itemLangLabel} content. "${conflict.library_name}" normally requires ${conflictLangLabel} titles — should it still go there, or to a different library?`;
```

This causes two separate UX problems:

- the first option can be the conflicting library even when the top-ranked candidate is different
- a multi-language conflict such as `['sv', 'no', 'da', 'fi']` is rendered as only the first language (`Swedish`)

File:
- `server/src/services/policyQuestionBuilder.mjs`

### D) AI response contract is still brittle in classify/verify mode
Current parser handling in `server/src/services/classification.mjs`:

```js
logger.warn('AI response malformed after parse/repair attempts', {
  title: metadata?.title,
  mode,
  parseFailureReason: finalParseResult.parse_diagnostics.failure_reason,
  response: String(response || '').substring(0, 200)
});
```

The parser expects one of the explicit response formats described in `server/src/services/aiPromptBuilder.mjs`:

```js
lines.push('FORMAT 1 - If you are confident:');
lines.push('CONFIDENT|<library_number>|<confidence_0_to_100>|<brief_reason>');
lines.push('');
lines.push('FORMAT 2 - If you need clarification:');
lines.push('CLARIFY|<problem_summary>|<why_uncertain>|<question>|<library_number_1>|<library_number_2>|<library_number_3_optional>');
```

But the live error report showed a narrative response:

```text
The media is a documentary about nature in Costa Rica. The `preset` signal strongly suggests "Movies"...
```

which failed with:

```json
{
  "parseFailureReason": "no_format_matched"
}
```

This matters because:

- a malformed narrative response can bypass the intended structured candidate flow
- fallback/narrative salvage may still center the wrong library or produce overly generic clarification
- operators see parser warnings in `error_log`, but the root issue is an AI contract adherence gap, not only policy scoring

Files:
- `server/src/services/classification.mjs`
- `server/src/services/aiResponseParser.mjs`
- `server/src/services/aiPromptBuilder.mjs`

### E) Narrative salvage still promotes free-text library guesses into user-facing questions
Current classify-mode salvage in `server/src/services/aiResponseParser.mjs`:

```js
const suggestedName = this.extractSuggestedLibraryName(response);
if (!suggestedName) {
    return null;
}

const matchedLibrary = this.findLibraryByName(suggestedName, libraries);
if (!matchedLibrary) {
    return null;
}

return {
    library: matchedLibrary,
    needs_clarification: true,
    policy_question: {
        question: `Should "${title}" go to "${matchedLibrary.name}"?`,
        options,
    },
    format: 'narrative_clarify'
};
```

And the current tests explicitly preserve this salvage behavior:

```js
it('should salvage narrative response with suggested library into clarification', () => {
    const response = 'The item is a TV show. The confidence score is low, and the suggested library is "TV Shows".';
    const result = aiResponseParser.parse(response, context, { mode: 'classify' });

    expect(result.format).toBe('narrative_clarify');
    expect(result.policy_question.question).toContain('TV Shows');
});
```

This is safer than auto-routing, but it still violates the desired truth model:

- the AI has already broken the response contract
- the system is still extracting a free-text library name from narrative prose
- the user then sees that inferred library as the center of the question

That behavior makes parser failures look like meaningful classification decisions.

Files:
- `server/src/services/aiResponseParser.mjs`
- `server/src/__tests__/services/aiResponseParser.test.mjs`

### F) Production evidence showed profile contamination can distort fallback behavior
During investigation, live library profile data showed:

- `Comedy and Standup`: `399` items, `144` documentary-like items
- `library_profiles.genre_distribution` included `Documentary: 35`
- `Movies` profile included `Documentary: 2`

That means fallback scoring can honestly conclude:

- "this documentary statistically resembles the `Comedy and Standup` library"

even when the operator intent is obviously the opposite.

This is not just a preset problem. It is a profile-hygiene problem:

- the current system has no explicit contamination guardrails
- there is no operator-facing warning when a library profile drifts away from its intended purpose
- a polluted profile can bias low-confidence or no-preset classifications in surprising ways

This evidence came from live production data captured during this investigation.

#### Production incidents captured during investigation

Incident 1:
- Error ID: `01efece3-339c-49ce-8583-2e578ef94ddf`
- Title: `World Natural Heritage Costa Rica: Guanacaste National Park`
- Mode: `classify`
- Failure: `no_format_matched`
- Response snippet:

```text
The media is a documentary about nature in Costa Rica. The `preset` signal strongly suggests "Movies" due to the "movie" type...
```

Incident 2:
- Error ID: `12b30258-14ba-41f9-910f-3b0cfa55042b`
- Title: `Taming the Garden`
- Mode: `classify`
- Failure: `no_format_matched`
- Response snippet:

```text
The item is a documentary movie. The library profile doesn't strongly align with documentaries, but the calculated confidence is low...
```

These two incidents indicate the same failure mode:
- the model is reasoning in prose about presets/profile/confidence
- but it is not obeying the strict `CONFIDENT|...` / `CLARIFY|...` contract
- the parser then falls back into warning/repair behavior instead of receiving a deterministic structured result

## Live Example Captured During Investigation
For `Taming the Garden`:

- top candidate: `Movies` with score `11.06`
- second candidate: `Family` with score `8`
- conflicting library: `Comedy and Standup` with score `0`
- shown question: `This is KA content. "Comedy and Standup" normally requires Swedish titles...`

That means the ranking was already preferring `Movies`, but the clarification prompt still centered the wrong library.

## Desired Behavior

### Operator-facing expectations
1. Preset suggestion scores should be clearly presented as **suggestion confidence**, not runtime classification confidence.
2. Attaching a preset should not unexpectedly introduce a hard runtime exclusion unless the preset or override explicitly opts into strict mode.
3. Clarification questions should primarily discuss the **top-ranked candidate(s)** and only mention conflicting libraries as secondary context.
4. Multi-language presets should be rendered honestly, not collapsed to a single language label.

### Runtime expectations
1. By default, preset signals act as weighted scoring inputs.
2. Hard constraints must be explicit and visible.
3. A language mismatch should reduce confidence unless the policy explicitly declares language as strict.
4. Conflict prompts should preserve candidate order from ranking.
5. Narrative parser salvage must not create a primary candidate from untrusted prose in classify mode.
6. Weakly configured policies and polluted profiles should reduce automation confidence, not silently distort destination ranking.

## Scope
- Preset suggestion API and UI wording
- Policy engine preset evaluation semantics
- Policy question builder conflict prompt composition
- AI prompt/parse contract hardening for classify/verify flows
- Profile contamination detection and weak-policy guardrails
- Tests covering new soft-vs-strict behavior
- Documentation and migration guidance for existing presets

## Non-Goals
- Replacing library profile scoring entirely
- Rewriting RAG or AI fallback logic in this pass
- Redesigning the full policy builder UX beyond preset suggestion messaging and strictness controls
- Replacing the current LLM provider stack

## Proposed Design

### Track 0: Enforce Truthful Ranking Invariants

#### Problem
The current flow allows ranked candidates, displayed options, and shown question text to diverge. The live `Taming the Garden` example proved:

- `meta.candidates[0] = Movies`
- `options[0] = Comedy and Standup`
- shown question centered `Comedy and Standup`

That is a truthfulness bug, not merely a wording bug.

#### Changes
1. Define a canonical lead candidate invariant:
   - `policyResult.ranked[0]` remains the primary candidate unless an explicit override reason is recorded.
2. Add a builder-level guard:
   - if question anchor library differs from candidate 1, downgrade to a generic clarification question instead of presenting misleading text.
3. Add metadata fields to make overrides explicit:
   - `primary_candidate_library_id`
   - `question_anchor_library_id`
   - `question_anchor_reason`
4. Add warning telemetry whenever:
   - `options[0] !== candidates[0]`
   - `shown_question` names a different library than candidate 1

#### Candidate files
- `server/src/services/policyQuestionBuilder.mjs`
- `server/src/services/classification.mjs`

#### Acceptance criteria
- the first displayed option matches the top ranked candidate unless the payload explicitly records an override reason
- prompt text cannot silently anchor on a lower-ranked or zero-score library
- ranking/order mismatches are visible in logs and tests

#### Canonical ranking invariants
These invariants should be treated as implementation rules, not best-effort guidelines:

1. `policyResult.ranked[0]` is the canonical primary candidate.
2. `policy_question.meta.candidates[0]` must represent the same library as `policyResult.ranked[0]`.
3. `policy_question.options[0]` must represent the same library as `policy_question.meta.candidates[0]`.
4. If the displayed question names a library explicitly, that library must equal `question_anchor_library_id`.
5. `question_anchor_library_id` must equal the primary candidate unless an override is explicitly recorded.

Required payload fields:

```json
{
  "meta": {
    "primary_candidate_library_id": 58,
    "question_anchor_library_id": 58,
    "question_anchor_reason": "primary_candidate"
  }
}
```

Allowed override reasons:
- `primary_candidate`
- `strict_conflict_top_candidate`
- `manual_review_required`
- `binary_verify_flow`

Disallowed silent behavior:
- anchoring on a lower-ranked candidate with no override metadata
- ordering options differently from candidates with no override metadata
- naming a zero-score conflict library as the lead question subject when candidate 1 is non-conflict

### Track 1: Make Suggestion Scores Honest

#### Problem
The current `/api/policies/presets/suggest/:libraryId` endpoint returns `match_score` values derived from naive substring/token matching. The UI presents them as `NN% match`, which looks like a runtime quality or classification guarantee.

#### Changes
1. Rename suggestion payload field from `match_score` to `suggestion_score`.
2. Rename `match_reasons` to `suggestion_reasons`.
3. Update UI copy from `NN% match` to `Suggestion score: NN`.
4. Replace substring scoring with safer token logic:
   - remove stopwords such as `and`, `the`, `for`, `with`
   - use normalized whole-token intersections instead of substring inclusion
   - cap repeated-token contributions so short names do not inflate scores
5. Add semantic warnings to suggestion responses for presets that carry strict runtime semantics.

#### Candidate files
- `server/src/routes/policies.mjs`
- `client/src/components/policies/PolicyBuilderModal.vue`
- `client/src/components/policies/PresetSelectionModal.vue`

#### Acceptance criteria
- `Scandinavian` is no longer suggested at a high score for `Comedy and Standup` due to token overlap on `and`
- UI no longer presents suggestion scores as runtime percentages
- tests cover stopword and substring false positives

### Track 2: Split Preset Signals Into Soft vs Strict Semantics

#### Problem
The current engine uses `require_any` for several signal types as hard gating behavior. For language, that directly conflicts with current expectations.

#### Proposed model
Introduce an explicit strictness contract for preset signals:

```json
{
  "language": {
    "weight": 2.0,
    "require_any": ["sv", "no", "da", "fi"],
    "strict": false
  }
}
```

Rules:
- `strict: false` or omitted: signal affects score only
- `strict: true`: signal may disqualify the preset/policy and surface a conflict

#### Runtime behavior
For `language`:
- if `require_any` fails and `strict !== true`, return a low or neutral score penalty instead of `0`-blocking the preset
- only create `languageConflicts` for policies where language is explicitly strict

#### Backward compatibility
Because existing presets already use `require_any`, we should not silently preserve current hard-gate semantics for all of them. That would keep the surprising behavior in place.

Recommended migration rule:
- default system presets to `strict: false`
- only mark clearly hard-routing libraries/policies as strict via `policy_presets.custom_signals`
- if needed, add an explicit one-time migration to annotate selected presets

#### Candidate files
- `server/src/services/policyEngine.mjs`
- `server/src/utils/policySignals.mjs`
- `server/src/routes/policies.mjs`
- `client/src/components/policies/PolicyBuilderModal.vue`

#### Acceptance criteria
- attaching `Scandinavian` to `Comedy and Standup` does not by itself create a hard language conflict unless strict mode is enabled
- policies can still opt into hard language conflicts when desired
- integration tests verify both soft and strict paths

### Track 3: Fix Conflict Clarification Composition

#### Problem
`buildLanguageConflictQuestion()` currently:
- puts conflicting libraries first in the options
- centers the question on the conflict library
- displays only `required_languages[0]`

#### Changes
1. Preserve ranked candidate order in options.
2. Treat conflict libraries as contextual metadata, not primary ordering drivers.
3. Rewrite question text to anchor on the top-ranked candidate:

Example:
```text
Top match is "Movies", but "Comedy and Standup" has a Scandinavian-language preference. Which library should this go to?
```

4. Render all required languages, e.g.:
```text
configured for Scandinavian content (sv/no/da/fi)
```

5. Only surface a dedicated language-conflict prompt when the conflicting library is the top-ranked candidate or within a small score margin of the top candidate. Otherwise, use a normal candidate question plus conflict note.

#### Candidate files
- `server/src/services/policyQuestionBuilder.mjs`

#### Acceptance criteria
- if `Movies` is candidate 1 and `Comedy and Standup` is a zero-score conflict library, option 1 remains `Movies`
- question text mentions the top candidate first
- multi-language conflicts are rendered as multi-language conflicts

### Track 4: Clarify Preset Semantics in UI

#### Problem
The policy builder currently gives no warning that some signals may behave as hard constraints.

#### Changes
1. Add per-signal annotations in the builder:
   - `Soft scoring`
   - `Strict gate`
2. When selecting or editing a preset that has strict signals, show a short warning:
   - `This preset can block non-matching items instead of only lowering score.`
3. If strictness is moved to overrides, show it in `custom_signals` UI rather than implying all preset behavior is equal.

#### Candidate files
- `client/src/components/policies/PolicyBuilderModal.vue`
- any preset editor/preset detail view used by the project

#### Acceptance criteria
- operators can tell whether a preset is advisory or strict before attaching it
- strict language behavior is visible in the UI

### Track 5: Harden AI Prompt/Parse Contract

#### Problem
The model still returns prose instead of the required `CONFIDENT|...` or `CLARIFY|...` format in some classify/verify flows. That creates noisy warnings and allows fallback behavior to reintroduce ambiguity even when ranking and preset semantics improve.

#### Changes
1. Tighten prompt instructions in `aiPromptBuilder`:
   - move the response contract to the top
   - explicitly forbid narrative prose before/after the contract line
   - include 1-2 bad examples and corrected examples
2. Strengthen parser diagnostics in `classification.js`:
   - persist `mode`, `title`, short response snippet, and library candidate context
   - distinguish `no_format_matched` from `bad_option_mapping` and `out_of_range_index`
3. Reduce silent narrative salvage in classify mode:
   - prefer deterministic repair or explicit fallback clarification over guessing from prose
4. Add contract tests for the exact malformed behavior seen in production:
   - prose mentioning a suggested library
   - prose mentioning preset/profile signals
   - prose that contains no valid format token

#### Candidate files
- `server/src/services/aiPromptBuilder.mjs`
- `server/src/services/aiResponseParser.mjs`
- `server/src/services/classification.mjs`

#### Acceptance criteria
- malformed narrative outputs no longer drive misleading clarification prompts
- parse warnings become more actionable and less frequent
- tests cover the production `no_format_matched` failure shape

#### Contract-violation fallback contract
When the model breaks the response format, the system must choose from a small deterministic set of outcomes:

| Condition | Outcome | User-facing behavior |
| --- | --- | --- |
| valid `CONFIDENT` | `confident` | normal confident classification |
| valid `CLARIFY` | `clarify` | normal clarification with resolved options |
| malformed response + deterministic policy candidates exist | `contract_violation` | generic clarification anchored to deterministic candidates |
| malformed response + no usable deterministic candidates | `fallback` | manual library selection |
| verify mode + malformed disagreement + suggested candidate already known | `narrative_clarify_verify` | contested suggested library with explicit disagreement framing |

For `contract_violation`, the payload should look like:

```json
{
  "format": "contract_violation",
  "needs_clarification": true,
  "pending_reason": "AI response contract violation",
  "policy_question": {
    "problem_summary": "AI response contract violation",
    "why_uncertain": "The AI returned narrative text instead of the required structured format.",
    "question": "Top match is \"Movies\", but the AI response was malformed. Which library should this go to?",
    "options": []
  }
}
```

Classify-mode narrative extraction rules:
- do not extract a new primary library from prose
- do not let `"suggested library is X"` override deterministic ranking
- raw malformed snippet may be logged, but not promoted into user-facing truth

### Track 6: Replace Narrative Guessing With Deterministic Contract-Violation Handling

#### Problem
Current classify-mode salvage extracts a suggested library from prose and builds a clarification around it. That is still a guess built on malformed AI output.

#### Changes
1. Introduce an explicit parser outcome such as:
   - `format: 'contract_violation'`
2. In classify mode, remove or heavily constrain free-text library extraction:
   - do not promote `"suggested library is X"` into the lead library unless `X` matches the top deterministic candidate already known from policy context
3. When the model violates contract:
   - prefer a generic deterministic clarification
   - preserve policy candidates from `signalContext` / `policyResult`
   - record the raw malformed snippet for debugging
4. Keep verify-mode disagreement handling, but ensure it is explicitly labeled as contested rather than suggested truth.

#### Candidate files
- `server/src/services/aiResponseParser.mjs`
- `server/src/services/classification.mjs`
- `server/src/services/aiPromptBuilder.mjs`

#### Acceptance criteria
- malformed classify responses do not create a new primary library from narrative prose
- user-facing clarification remains anchored to deterministic candidates
- parser outcomes clearly separate `contract_violation` from valid `clarify`

### Track 7: Add Profile Hygiene and Weak-Policy Guardrails

#### Problem
Low-confidence classification can still be distorted by polluted library profiles or weakly configured policies. The current system has no first-class notion of "this library profile appears contaminated" or "this policy has too little intent configured to trust automation."

#### Changes
1. Add weak-policy diagnostics:
   - zero-preset policies remain allowed
   - but they should be marked as weakly configured and lower automation confidence
2. Add profile hygiene checks:
   - suspicious genre ratios for the library name/policy category
   - high percentage of missing titles / empty keywords / empty metadata
   - profile drift indicators for obviously mismatched content families
3. Surface profile warnings in diagnostics and admin UI:
   - `Profile drift detected: Documentary-heavy content in Comedy and Standup`
4. Consider excluding heavily suspicious profile signals from fallback scoring until the profile is rebuilt or confirmed.
5. Add a rebuild/review workflow recommendation to docs:
   - audit synced items
   - rebuild profile
   - re-run classification after profile hygiene is restored

#### Candidate files
- `server/src/services/libraryProfileService.mjs`
- `server/src/services/classification.mjs`
- `server/src/services/policyEngine.mjs`
- any admin diagnostics view that surfaces policy/profile health

#### Acceptance criteria
- zero-preset policies do not pretend to be fully configured
- polluted profiles lower trust and become visible to operators
- profile drift can no longer silently dominate fallback behavior

#### Weak-policy behavior
`Zero presets` should not mean `invalid`, but it should mean `weakly configured`.

Recommended behavior:
- mark policy health as `weak`
- cap policy-driven confidence contribution for that policy
- avoid auto-classify when the winning policy is weak and no stronger corroborating signals exist
- surface `weak_policy_reason` in diagnostics

Suggested thresholds:
- `preset_count = 0` -> health = `weak`
- `preset_count = 1` and only low-information signals (`prefer` only, no `require`/structural signals) -> health = `weak_review`
- `preset_count >= 1` with at least one structural or high-signal preset -> health = `configured`

Suggested automation guard:
- if winning policy health is `weak` and final confidence < `75`, force `awaiting_decision`

#### Profile drift heuristics
The first pass should use simple, explainable thresholds.

Suggested drift signals:
- `missing_title_ratio >= 0.10`
- `empty_keyword_ratio >= 0.80`
- `documentary_ratio >= 0.20` for a comedy/stand-up library
- `animation_ratio >= 0.40` for a non-family/non-animation library
- `adult_rating_ratio >= 0.40` for a family/kids library

Suggested severity levels:
- `info`
  - one heuristic exceeded mildly
- `warning`
  - one heuristic exceeded strongly or two heuristics exceeded mildly
- `critical`
  - profile materially contradicts library/policy intent and should be excluded from fallback scoring until rebuilt

First release recommendation:
- warnings affect trust/diagnostics only
- critical drift may suppress profile contribution for that library in fallback scoring

### Track 8: Migrate Existing Attached Presets Safely

#### Problem
Users already have presets attached under the current semantics:

- shared preset defaults live in `content_presets.signals`
- policy-specific adjustments live in `policy_presets.custom_signals`
- runtime merges them in `mergePresetSignals(baseSignals, customSignals)`

If we simply change shared preset semantics in place, we risk silently changing behavior for existing user policies. That is especially dangerous for regional/language presets currently using `language.require_any`.

#### Current data model leverage
The existing merge path already gives us a safe migration hook:

```js
function mergePresetSignals(baseSignals, customSignals) {
  const base = normalizeSignalConfig(baseSignals) || {};
  const custom = normalizeSignalConfig(customSignals) || null;
  // custom_signals overrides merged on top of base signals
}
```

That means we can:

- keep system preset definitions readable and future-facing
- preserve legacy behavior per attached policy where needed
- migrate incrementally without mutating every shared preset row blindly

#### Migration strategy

##### 0. Define explicit migration modes
We should support three migration modes so rollout can be chosen deliberately instead of accidentally:

- `safe_default`
  - keep existing `policy_presets` attachments
  - preserve legacy behavior where needed via `policy_presets.custom_signals`
  - migrate shared system preset defaults toward the new advisory model
  - recommended default release strategy

- `soft_reset`
  - keep existing `policy_presets` rows attached
  - clear or override legacy strict semantics so migrated presets behave advisory-by-default
  - mark affected policies as `needs review`
  - simpler than full compatibility, but behavior changes more aggressively

- `hard_reset`
  - remove existing preset attachments from policies
  - users rebuild preset selections manually after upgrade
  - easiest technically
  - worst UX and highest regression risk for existing installs

Recommended choice:
- use `safe_default` for the shipped upgrade path
- keep `soft_reset` as an admin repair option
- keep `hard_reset` as an explicit emergency/reset tool, not the default migration

##### 1. Add explicit strictness metadata first
Introduce the new soft/strict schema support in runtime and UI before migrating user data.

Target shape:

```json
{
  "language": {
    "weight": 2.0,
    "require_any": ["sv", "no", "da", "fi"],
    "strict": false
  }
}
```

This must be supported in:
- preset normalization
- policy evaluation
- policy builder editing
- preset suggestion warnings

##### 2. Audit all existing attached presets before changing behavior
Build a one-time audit that classifies existing attachments into buckets:

- `safe_soft`
  - presets with no hard-gating semantics today
- `legacy_language_gate`
  - presets where `signals.language.require_any` exists
- `structural_gate`
  - presets where strict behavior should remain structural, such as `media_type.include`
- `customized_override`
  - policy presets with existing `custom_signals` that already diverge from base preset defaults

Outputs should include:
- policy id / name
- library id / name
- preset id / key / name
- base signals
- custom signals
- inferred migration class

##### 3. Preserve user intent at the attachment layer, not the global preset layer
Do not immediately rewrite all `content_presets.signals` rows to enforce new semantics globally.

Instead:
- change system preset defaults toward the new model
- write compatibility overlays into `policy_presets.custom_signals` for existing attached presets that need preserved behavior

Examples:

- if an existing policy really depended on hard language gating, backfill:

```json
{
  "language": {
    "strict": true
  }
}
```

- if an existing policy attached a regional preset but the product vision now treats it as advisory, backfill:

```json
{
  "language": {
    "strict": false
  }
}
```

This keeps migration explicit and reversible.

##### 4. Use policy-aware heuristics, not blanket conversion
The migration should not assume all current `language.require_any` attachments meant "hard gate."

Recommended heuristic:

- preserve strict behavior only when the policy/library clearly implies hard routing
  - examples: `Anime Movies`, `Korean`, `Bollywood`, strongly regional or language-specific libraries
- default to soft for broad libraries
  - examples: `Movies`, `Family`, `Comedy and Standup`
- flag ambiguous cases for operator review instead of guessing

We should prefer a conservative migration matrix over magical inference.

##### 4a. Migration matrix by preset family
This matrix should drive both audit classification and backfill behavior.

| Preset family | Examples | Default V2 semantics | Existing attachment migration mode | Notes |
| --- | --- | --- | --- | --- |
| Structural media-type | `tv_*`, `classic_films` when coupled with `media_type.include` | strict-capable | `strict_preserved` | structural, not preference-only |
| Genre broad-match | `comedy`, `drama`, `romance`, `documentary` | advisory | `soft_defaulted` | score-shaping only unless operator opts into strict |
| Audience/rating | `family_friendly`, `adult_only`, `kids_only` | advisory with strong weight | `soft_defaulted` | may still force prompt/review at high mismatch |
| Regional/language preference | `scandinavian`, `bollywood`, `korean`, `foreign`, `hollywood`, `british` | advisory by default | `manual_review` or `strict_preserved` depending on library intent | highest migration risk |
| Franchise/studio | `marvel_mcu`, `pixar`, `ghibli`, `star_wars` | advisory | `soft_defaulted` | strong hints, not routing gates by default |
| Temporal/quality | `80s`, `90s`, `highly_rated`, `hidden_gems` | advisory | `soft_defaulted` | should not disqualify on their own |
| Explicit language-specialized library presets | `anime`, `tv_anime` attached to libraries whose name/intent is language-specific | mixed | `strict_preserved` or `manual_review` | depends on library meaning, not preset key alone |

Initial rule of thumb:
- broad destination libraries -> advisory migration
- narrowly regional/language-branded libraries -> preserve or review
- ambiguous language/region attachments -> `manual_review`

##### 4b. Manual-review trigger conditions
An attachment should be routed to manual review if any of these are true:

- preset has `language.require_any`
- library name implies broad/general destination but preset implies narrow regional routing
- existing `custom_signals` already change language behavior
- policy has multiple language/regional presets attached
- policy history/profile data materially contradicts the preset intent

##### 5. Add a compatibility mode and staged rollout
Rollout should happen in stages:

1. ship runtime support for `strict`
2. add audit tooling and admin diagnostics
3. backfill `policy_presets.custom_signals` for existing attachments
4. flip system preset defaults to advisory-by-default
5. remove compatibility mode only after regression coverage and operator validation

Recommended feature flags:
- `PRESET_STRICTNESS_V2_ENABLED`
- `PRESET_MIGRATION_COMPAT_MODE`

Compatibility mode behavior:
- new/edited presets use V2 semantics immediately
- existing attachments honor migrated `custom_signals`
- operators can see which attachments are still in legacy compatibility state

##### 5a. How each migration mode behaves operationally

`safe_default`
- existing attachments remain visible and attached
- migrated compatibility overlays are written only where needed
- operators see status labels such as:
  - `Legacy strict behavior preserved`
  - `Migrated to advisory behavior`
  - `Needs review`

`soft_reset`
- existing attachments remain attached
- legacy strict semantics are neutralized unless re-enabled explicitly
- confidence may drop until operators review affected policies
- useful when the existing install is badly polluted but preserving preset lists still has value

`hard_reset`
- `policy_presets` rows are removed or ignored for all existing policies during migration
- system starts with clean policy shells and no inherited preset behavior
- appropriate only if:
  - migration confidence is too low
  - existing preset semantics are clearly doing more harm than good
  - release notes and UI make the reset explicit

##### 5b. Release recommendation
Release should be designed around `safe_default`.

Reason:
- it is the least destructive
- it preserves operator intent best
- it lets us refactor semantics without forcing every existing user to rebuild policies manually

We should still implement `hard_reset` as an opt-in support/admin tool because it is the simplest recovery path when an installation is deeply misconfigured.

##### 5c. Targeted operator workflow: drop incompatible attachments, then reapply corrected presets
For operators who prefer a clean rebuild over compatibility backfills, support a targeted drop flow instead of silently mutating semantics:

1. list legacy-incompatible attached presets
2. drop only those attachments
3. let the operator reapply corrected presets manually

This is the safest practical interpretation of `hard_reset` for live installs because it is:
- explicit
- reviewable before deletion
- narrower than deleting every attached preset

Current API shape:

- `GET /api/policies/presets/migration/incompatible`
  - returns only attached presets whose runtime semantics are:
    - `migration_state = advisory_defaulted`
    - `review_recommended = true`
- `GET /api/policies/presets/migration/incompatible?policy_id=<id>`
  - scopes the audit to a single policy
- `POST /api/policies/presets/migration/drop-incompatible`
  - drops all currently listed incompatible attachments
- `POST /api/policies/presets/migration/drop-incompatible { "policy_id": <id> }`
  - drops incompatible attachments for one policy only

This flow should be preferred over blanket preset deletion because it removes only the attachments that became suspect under the new advisory-by-default model.

Current implementation decision:
- this targeted incompatible drop is now the default one-time upgrade migration
- the migration runs automatically via `database/migrations/20260313_233000_auto_drop_legacy_incompatible_policy_presets.sql`
- a summary of dropped attachments is written to `settings.key = 'preset_semantics_v2_auto_drop_report'` only when at least one attachment was actually removed
- the admin endpoints remain useful for diagnostics and recovery on already-upgraded installs

##### 6. Surface migration impact in the UI
Operators need to know what changed.

Add indicators such as:
- `Legacy strict behavior preserved`
- `Migrated to advisory behavior`
- `Needs review`

Policy builder should show:
- base preset semantics
- per-policy override semantics
- whether the current attachment came from migration backfill

##### 7. Add a rollback-safe migration record
Store enough metadata to reverse or re-run migration safely.

Options:
- add migration annotations inside `policy_presets.custom_signals`
- or add a dedicated migration tracking table for preset attachment migrations

Minimum metadata to persist:
- migrated_at
- migration_version
- previous_effective_signals snapshot
- chosen migration mode (`strict_preserved`, `soft_defaulted`, `manual_review`)

#### Candidate files
- `server/src/utils/policySignals.mjs`
- `server/src/services/policyEngine.mjs`
- `server/src/routes/policies.mjs`
- `database/migrations/*`
- any admin diagnostics/policy builder views that display preset attachments

#### Acceptance criteria
- existing user-attached presets do not silently change runtime meaning on upgrade
- migration distinguishes shared preset defaults from per-policy attachment behavior
- ambiguous legacy attachments are reviewable instead of guessed blindly
- rollback/re-run is possible without hand-editing policy rows

## Migration Execution Plan

### Step 1: Build the audit report
Create a deterministic report over existing `policy_presets` attachments to identify:

- all attachments with `language.require_any`
- all attachments with existing `custom_signals`
- all policies with zero presets
- all libraries with profile drift warnings

### Step 2: Introduce runtime support without changing behavior
Ship code that understands `strict`, but initially preserves current behavior unless explicit migrated overrides exist.

This avoids a breaking deploy while we inventory live usage.

### Step 3: Backfill per-policy overrides
Run a migration/backfill that writes `policy_presets.custom_signals.language.strict` for existing attachments according to the migration matrix.

Important:
- prefer attachment-level backfill over global preset mutation
- never overwrite existing operator `custom_signals` blindly
- merge migration annotations into existing custom overrides

### Step 4: Change system defaults
Once attachment overrides are in place, update system presets so language/region semantics are advisory by default.

This ensures:
- new attachments follow the new model
- old attachments retain explicitly migrated intent

### Step 5: Surface review queue
Expose a review list for:

- ambiguous migrated attachments
- high-impact libraries
- policies where old and new effective semantics differ materially

### Step 6: Retire compatibility mode
After validation:
- remove fallback assumptions
- keep explicit `strict` semantics only
- retain migration metadata for auditability

## UI and Rollout Semantics

### UI state model
Preset attachments should expose both base semantics and effective semantics.

Suggested labels:
- `Advisory`
- `Strict`
- `Migrated: advisory`
- `Migrated: strict preserved`
- `Needs review`
- `Weak policy`
- `Profile drift warning`

Suggested placement:
- preset cards: small semantic chip
- selected preset rows: effective semantic chip + migration badge when applicable
- policy summary: policy health chip (`configured`, `weak`, `review`)

### Minimal UI copy rules
Avoid ambiguous phrasing like `% match` or `requires Swedish titles` unless the runtime payload truly represents a strict rule.

Preferred language conflict wording:
- `Top match is "Movies". Another policy has a Scandinavian-language preference (sv/no/da/fi).`

Preferred migrated-preset wording:
- `This preset was migrated to advisory behavior.`
- `Legacy strict behavior preserved for this attachment.`

### Rollout sequence
Recommended release order:

1. ship suggestion/UI wording cleanup
2. ship ranking invariants and parser contract handling
3. ship strictness support behind flags
4. run audit and generate migration report
5. backfill attachment overrides
6. expose migrated states in UI
7. flip advisory-by-default preset semantics
8. retire compatibility mode after validation

### Rollback plan
If post-release behavior regresses:

1. keep migrated metadata intact
2. re-enable compatibility mode
3. revert shared system preset defaults if necessary
4. leave attachment-level overrides as audit evidence
5. if needed, expose `soft_reset` or `hard_reset` as an admin recovery action

### Release-note requirements
Release notes should explicitly state:
- suggestion scores are now advisory UI hints
- some preset semantics may now be advisory unless marked strict
- migrated attachments may show `Needs review`
- no default destructive reset occurs under `safe_default`
- admins may optionally use reset tools for broken installs

## Implementation Phases

### Phase 0: Truthfulness and Vision Guardrails
- document canonical ordering/anchor invariants
- add metadata/logging for candidate/order mismatches
- decide exact fail-safe behavior for malformed classify responses

### Phase 1: Suggestion Score Cleanup
- update suggestion scorer tokenization and stopword handling
- rename response fields and UI labels
- add tests around false positives like `and` -> `scandinavian`

### Phase 2: Runtime Soft/Strict Language Semantics
- add strictness support to signal normalization
- change `policyEngine.evaluatePresetSignals()` soft default for language
- gate `languageConflicts` behind strict mode
- add integration tests for soft language presets

### Phase 3: Conflict Prompt Refactor
- preserve ranked order in question options
- rewrite prompt text generation
- render all required languages
- add regression tests for:
  - top candidate != conflict library
  - zero-score conflict library must not become option 1

### Phase 4: UI Semantics and Migration
- surface strictness in the policy builder
- add docs describing advisory vs strict presets
- consider migration/repair guidance for existing policies that attached regional presets assuming soft behavior

### Phase 5: AI Contract Hardening
- tighten prompt contract language
- improve parse diagnostics
- add regression tests for narrative `no_format_matched` responses

### Phase 6: Contract-Violation Fallback and Profile Guardrails
- replace classify-mode narrative library extraction with deterministic contract-violation fallback
- add weak-policy diagnostics for zero-preset policies
- add profile drift detection and warnings
- document operator recovery flow for polluted libraries

### Phase 7: Attachment Migration and Compatibility Retirement
- ship audit tooling for existing preset attachments
- implement explicit migration modes (`safe_default`, `soft_reset`, `hard_reset`)
- backfill per-policy strictness overrides into `policy_presets.custom_signals`
- update system preset defaults to advisory-by-default
- expose migrated/needs-review states in the UI
- retire compatibility mode after validation

## Testing Plan

### Server unit tests
- `server/src/__tests__/integration/policyEngine.test.mjs`
  - current behavior already includes hard-block language expectations; update/add tests for strict vs soft paths
- new or expanded tests for `policyQuestionBuilder`
  - preserve candidate order
  - conflict libraries stay secondary when not top-ranked
  - multi-language conflict wording

### API tests
- suggestion endpoint tests for:
  - stopword filtering
  - renamed suggestion fields
  - no misleading high scores for substring matches

### Builder and invariant tests
- `policyQuestionBuilder`
  - `options[0]` must equal `meta.candidates[0]` by default
  - conflict anchors must never silently replace candidate 1
  - question anchor metadata must be emitted when overrides exist

### Client tests
- `PolicyBuilderModal` / `PresetSelectionModal`
  - display `Suggestion score` rather than `% match`
  - show strictness warning labels when present

### AI parser tests
- `server/src/__tests__/aiResponseParser.test.mjs`
- `server/src/__tests__/prompt-builder.test.mjs`
- classification tests covering malformed narrative classify responses
- regression fixtures for the two captured `no_format_matched` production responses above
- regression tests ensuring malformed classify prose cannot create a new lead library from free text

### Profile and policy health tests
- unit tests for weak-policy detection
- unit/integration tests for profile drift warnings
- regression coverage for documentary-heavy comedy profile scenarios

### Migration tests
- migration/backfill tests for existing `policy_presets.custom_signals`
- regression tests ensuring existing customized attachments are preserved
- tests for `strict_preserved`, `soft_defaulted`, and `manual_review` migration outcomes

### UI and rollout tests
- semantic chip rendering for `Advisory`, `Strict`, and migrated states
- review badge rendering for `Needs review` and `Weak policy`
- language-conflict wording tests for multi-language preferences
- rollout/flag tests ensuring `safe_default` does not delete existing attachments

## Open Design Decisions
1. Should `require_any` always mean strict for `media_type` but soft-by-default for `language`?
   - recommended: yes
   - rationale: media type is structural; language is usually a preference/routing hint

2. Should strictness live in system preset definitions or only in per-policy overrides?
   - recommended: both supported, but prefer per-policy overrides for operator control

3. Should zero-preset policies remain eligible for ranking?
   - recommended: yes, but mark them as weakly configured and cap automation confidence
   - rationale: presets are not strictly required, but the system must be honest about lower determinism

4. Should classify-mode narrative salvage be removed entirely, or only constrained to deterministic candidates?
   - recommended: constrain first, then consider full removal if the contract hardening succeeds
   - rationale: preserve resilience without promoting prose guesses into user-facing truth

5. Should suggestion ranking consider current library profile statistics?
   - recommended: not in this pass
   - rationale: first fix misleading lexical suggestions and runtime semantic mismatch

6. Where should migration bookkeeping live?
   - recommended: start with metadata embedded in `policy_presets.custom_signals`, move to a dedicated migration table only if audit/reporting requirements grow
   - rationale: attachment-level metadata is the smallest change that keeps rollback and inspection possible

7. Which migration mode should be the default for production upgrades?
   - recommended: `safe_default`
   - rationale: least destructive, preserves operator intent, and avoids forcing users to rebuild presets after upgrade

8. Should `critical` profile drift suppress profile scoring automatically or only warn?
   - recommended: suppress profile scoring for that library in low-confidence fallback paths, but still surface a warning
   - rationale: warning alone does not stop polluted profiles from skewing results

9. Should broad audience presets ever become strict automatically?
   - recommended: no
   - rationale: audience/rating presets should influence confidence and prompting, not silently hard-route items

## Deliverables
- updated suggestion API and UI wording
- canonical ranking/order invariants for clarification payloads
- soft-vs-strict preset runtime behavior
- corrected conflict clarification ordering and wording
- hardened AI prompt/parse contract
- deterministic contract-violation fallback behavior
- profile drift and weak-policy diagnostics
- attachment migration/backfill strategy for existing user presets
- regression tests for all traced failure paths
- updated docs for preset semantics

## Summary
The system currently mixes three incompatible meanings of “preset”:

- UI suggestion heuristic
- runtime weighted scoring input
- runtime hard conflict rule

It also still tolerates malformed AI narrative responses and polluted library profiles in ways that obscure the true ranking/clarification state. The implementation should separate these concerns explicitly and enforce the product truth model:

- suggestions are hints
- presets are advisory unless explicitly strict
- ranked candidates stay canonical through the UI
- malformed AI output fails safe
- weak policies and dirty profiles reduce trust instead of silently steering the answer
