# Policy Builder Intent Model Roadmap

Status: active roadmap. Phase 0, the first Phase 1 state extraction slice, and Phase 5 read-only intent contract are implemented for the next release line.

## Goal

Move Classifarr from a preset-centric policy builder to an intent-centric policy builder without making the platform feel like an expert-system editor.

The user-facing model should be:

```text
Tell Classifarr what belongs here, what must not go here, and what evidence helps.
```

The technical model can remain more detailed internally:

```text
identity signals + compatibility signals + strict constraints + boosters + exclusions
```

## Current Problem

Presets are currently doing two jobs:

1. They act as reusable starter shortcuts.
2. They also carry hidden policy logic through bundled signals.

That muddles the policy builder because users are asked to reason about presets, custom signal overrides, runtime behavior, weights, and scoring all at once.

The better product model is:

```text
Libraries have policy intent.
Presets help draft that intent.
```

## Design Principle

Presets should become starter templates, not the primary policy object.

Current:

```text
Library Policy -> selected presets -> hidden/custom signals -> scoring behavior
```

Target:

```text
Library Policy -> purpose + hard limits + helpful hints + review behavior
              -> optionally seeded by starter templates
```

## Compatibility Contract

Existing preset-backed policies must continue to work.

In this document, **legacy presets** means existing `content_presets` and `policy_presets` records that already define policy behavior through bundled `signals` plus optional policy-specific `customSignals`.

The compatibility rules are:

- Opening an existing policy must not rewrite it.
- Saving unrelated fields such as name, thresholds, weights, or enabled state must preserve preset attachments and `customSignals`.
- Intent edits may serialize into `customSignals`, but they must not silently remove preset attachments.
- Removing a starter template in the UI is the only action that should remove the underlying preset attachment.
- Existing backup/restore behavior must remain valid until a later explicit storage migration exists.
- The server remains the validation authority for signal semantics, strict/advisory behavior, and unsupported aliases.

## Legacy Preset Bridge

The next architecture step should be a bridge, not a replacement.

```text
legacy presets + customSignals + configuration_view
        ↓
policy intent draft
        ↓
intent-first UI
        ↓
legacy-compatible save payload
```

This bridge lets the UI become intent-centric while storage and scoring remain compatible.

The draft should record provenance:

```js
{
  source: 'legacy_presets',
  migration_state: 'inferred',
  purpose: [],
  hard_limits: [],
  helpful_hints: [],
  avoid: [],
  review_behavior: {},
  template_links: []
}
```

Suggested source states:

- `legacy_presets`: intent inferred from existing preset attachments.
- `intent_draft`: intent edited directly in the builder but saved through compatibility payloads.
- `mixed`: policy has both inferred legacy preset behavior and direct intent edits.
- `native_intent`: future state after explicit storage migration.
- `unknown`: policy contains unsupported or ambiguous signal shapes.

Suggested inference states:

- `exact`: the signal maps cleanly to one intent role.
- `inferred`: the signal maps to intent but came from legacy preset semantics.
- `partial`: only some signals could be represented clearly.
- `ambiguous`: the signal could fit more than one product concept.

Important rule:

```text
Do not automatically convert legacy presets into native intent storage on read or ordinary save.
```

Explicit conversion can come later after preview/replay tooling proves behavior is stable.

## User-Facing Concepts

Use plain language first:

- **What belongs here?**
  - Internal role: identity signals.
  - Examples: Family, Anime, Stand-up, Documentary.

- **What should never go here?**
  - Internal role: strict constraints and hard exclusions.
  - Examples: max PG-13 for Family, exclude R and NC-17.

- **What helps but should not decide alone?**
  - Internal role: compatibility signals and boosters.
  - Examples: Comedy can help Family slightly, but does not define Family.

- **When should Classifarr ask?**
  - Internal role: thresholds, weak-evidence prompts, policy conflict prompts.
  - Examples: only RAG supports this destination, rating conflicts with Family.

## Refactor Plan

`PolicyBuilderModal.vue` currently owns too many responsibilities:

- library loading,
- preset/template loading,
- suggestion loading,
- migration notice loading,
- selected preset state,
- custom signal mutation,
- intent editing,
- advanced scoring fields,
- save payload construction,
- validation state,
- large sections of presentation markup.

Before expanding policy behavior, split the builder into smaller units.

Target structure:

```text
PolicyBuilderModal.vue
  Orchestrates modal layout, save/cancel, and high-level sections.

composables/usePolicyBuilderState.js
  Owns form state, loading, selected templates, notices, validation, and save payload.

composables/usePolicyIntentDraft.js
  Converts legacy presets/configuration_view/customSignals into intent draft.
  Converts intent draft back into legacy-compatible preset/customSignals payloads.

components/policies/PolicyIntentSummary.vue
  Shows purpose, hard limits, hints, avoid rules, review behavior, and warnings.

components/policies/PolicyIntentEditor.vue
  Edits the intent draft.

components/policies/PolicyTemplatePicker.vue
  Searches and applies starter templates.

components/policies/AppliedTemplateList.vue
  Shows starter-template provenance and advanced template details.
```

Refactor rule:

```text
Extract behavior without changing policy save semantics first.
```

This keeps later UX changes safer.

## Phase 0: Stabilize Current Additive UI

Intent: make the current intent editor less technical while preserving behavior.

Changes:

- Keep the current intent editor as an additive layer.
- Rename technical labels to plain-language labels.
- Avoid adding more signal controls until the state model is extracted.
- Add tests proving existing preset-backed policies save without shape loss.

Why this fits next:

- It protects current users while the design is still evolving.
- It prevents the large modal from becoming more complex before refactoring.

## Phase 1: Extract Policy Builder State

Intent: reduce modal complexity without changing user behavior.

Implementation status: first deterministic state slice implemented in `client/src/composables/usePolicyBuilderState.js`.

Changes:

- Create `client/src/composables/usePolicyBuilderState.js`.
- Move form defaults, selected template state, custom signal mutation, intent signal mutation, validation state, and save payload construction out of `PolicyBuilderModal.vue`.
- Keep library loading, preset loading, suggestions, and migration notices in `PolicyBuilderModal.vue` until a later side-effect extraction pass.
- Keep API payload shape unchanged.
- Preserve current tests, then add composable tests for save payload construction and legacy preset round-trips.

Why this fits next:

- Creates a safer foundation for intent-specific behavior.
- Makes future changes testable without mounting the full modal.
- Reduces risk of regressions in policy save behavior.

## Phase 2: Introduce Intent Draft Bridge

Intent: stop making the UI manipulate raw `customSignals` directly.

Changes:

- Create `client/src/composables/usePolicyIntentDraft.js`.
- Build draft state from:
  - policy `configuration_view` when present,
  - existing preset attachments,
  - preset base `signals`,
  - policy-specific `customSignals`.
- Record source and inference metadata:
  - `source`,
  - `migration_state`,
  - `template_links`,
  - warnings for ambiguous or partial inference.
- Convert draft edits back to legacy-compatible `customSignals` on save.

Why this fits next:

- Gives the UI a clean product model.
- Keeps legacy presets intact.
- Avoids premature database migration.
- Makes interpretation and round-trip behavior independently testable.

## Phase 3: Clarify Existing UI

Intent: reduce confusion without changing storage or scoring.

Changes:

- Rename `Selected Presets` to `Applied Starter Templates`.
- Rename `Customize` to `Advanced Template Details`.
- Make the intent editor visually primary.
- Move old per-preset signal customization behind an advanced disclosure.
- Rename visible sections:
  - `Identity Signals` -> `What belongs here`
  - `Strict Constraints` -> `Hard limits`
  - `Boosters` -> `Helpful hints`
  - `Compatibility Signals` -> `Soft matches`
  - `Exclusions` -> `Avoid or down-rank`

Why this fits next:

- Low risk.
- No API or database change.
- Makes the current implementation easier to understand immediately.

## Phase 4: Add Intent Summary And Warnings

Intent: users should see policy behavior, not preset mechanics.

Changes:

- Add an intent summary card near the top of the builder:
  - Purpose
  - Hard limits
  - Helpful hints
  - Review triggers
- Show starter template provenance:
  - `Seeded from Family template`
  - `Modified from Comedy template`
- Add warnings:
  - `This policy has no hard rating limit.`
  - `This policy relies only on soft matches.`
  - `Generic Comedy is a hint, not a destination rule.`

Why this fits next:

- Helps diagnose weak or ambiguous policies before classification.
- Supports the recent Family, Comedy, and RAG failure modes.
- Keeps the UI focused on decisions users understand.

## Phase 5: Add Server-Side Intent Schema

Intent: make the intent model authoritative on the server, not only a UI projection.

Candidate files:

- `server/src/services/policyIntentContract.mjs`
- `server/src/services/policyIntentSchema.mjs`
- `server/src/services/policyIntentMapper.mjs`

Initial implementation:

- `policyIntentContract.mjs` derives a read-only `policy_intent_contract` from legacy preset-backed policies.
- The contract is attached to policy read/create/update responses.
- No database migration is required.
- Unsupported legacy preset signals produce warnings and `partial` inference instead of breaking policy loading.

Validation rules:

- Purpose can only use identity-capable fields.
- Hard limits must map to strict constraints.
- Helpful hints cannot become strict.
- Avoid rules must clearly identify advisory versus strict behavior.
- Unknown operators should be rejected or normalized before persistence.

Why this fits next:

- Prevents client/server semantic drift.
- Keeps validation centralized.
- Prepares the platform for eventual storage modernization.

## Phase 6: Convert Presets Into Starter Templates

Intent: demote presets from hidden rule containers to reusable recipes.

Changes:

- Rename UI concepts:
  - `Presets` -> `Starter Templates`
  - `Content Presets` -> `Template Library`
- Add template preview:
  - `Applying this adds purpose X, hard limits Y, helpful hints Z.`
- Applying a template mutates the intent draft instead of making users edit preset internals.
- Preserve existing preset records for compatibility.

Why this fits next:

- Simplifies the mental model.
- Keeps templates useful without making them the policy source of truth.
- Reduces confusion around broad signals such as generic Comedy.

## Phase 7: Add Policy Impact Preview

Intent: make policy edits safer.

Changes:

- Add a bounded preview endpoint that evaluates a proposed policy draft against recent items.
- Show:
  - likely destination changes,
  - newly blocked items,
  - newly prompted items,
  - confidence or evidence changes.
- Keep it admin-only and avoid sending provider prompts or embeddings to the client.

Why this fits next:

- Reduces trial-and-error tuning.
- Prevents accidental routing churn.
- Makes policy behavior more predictable before save.

## Phase 8: Consider Storage Migration Later

Do not migrate storage until the product model is proven.

Possible future tables:

```text
library_policy_intent
policy_intent_rules
policy_template_applications
```

Why not now:

- Current `customSignals` compatibility path works.
- The UX still needs refinement.
- A premature schema migration would add risk before the model stabilizes.

## Migration Strategy

No automatic destructive migration.

Migration should be explicit and reversible until the intent model is proven:

1. Existing policies load as preset-backed policies.
2. The builder shows inferred intent and template provenance.
3. Direct intent edits save through compatibility payloads.
4. A future `Convert to intent policy` action may write native intent storage.
5. Conversion should require impact preview or replay before becoming default.

Legacy preset compatibility should remain until:

- native intent storage exists,
- policy replay verifies equivalent behavior,
- backup/restore includes intent records,
- users can inspect and reverse converted policy behavior.

## Testing Strategy

Required coverage before each phase:

- Legacy preset round-trip tests:
  - load preset-backed policy,
  - save unrelated fields,
  - verify preset attachments and `customSignals` remain unchanged.
- Intent edit serialization tests:
  - edit purpose,
  - edit hard limits,
  - edit helpful hints,
  - verify legacy-compatible save payload.
- Draft inference tests:
  - exact mappings,
  - inferred mappings,
  - partial mappings,
  - ambiguous mappings.
- UI tests:
  - plain-language labels,
  - warning visibility,
  - template provenance,
  - advanced template details still accessible.
- Server tests once schema exists:
  - allowed intent roles,
  - rejected unsupported operators,
  - strict/advisory normalization,
  - no destructive conversion on ordinary save.

## Risks

- Dual-model drift: client draft semantics diverge from server policy semantics.
- Silent migration: opening or saving a policy unexpectedly changes preset-backed behavior.
- Overexposed internals: users see too many policy mechanics and lose the simple mental model.
- Template ambiguity: a legacy preset may contain mixed signals that do not map cleanly to one product concept.
- UI bloat: continuing to add controls to `PolicyBuilderModal.vue` without extracting state/components.
- Trust loss: users cannot tell whether a policy is template-backed, modified, inferred, or natively intent-backed.

## Recommended Next Work

Start with Phase 0 and Phase 1:

1. Introduce the intent draft bridge.
2. Rename the most technical visible labels.
3. Extract policy builder data loading after the draft bridge stabilizes.
4. Add server-provided editor schema exploration.

The builder now has a tested state boundary, so the next highest-value step is making the UI edit an intent draft instead of directly manipulating legacy `customSignals`.

## Open Questions

- Should `Soft matches` be visible by default, or only in advanced mode?
- Should `Helpful hints` and `Soft matches` be combined in the first simplified UI?
- Should Family-like libraries get guided hard-limit defaults?
- Should starter templates be editable globally, or should applying a template copy its intent into the policy?
- How should we show that a policy was seeded from a template but later modified?
- Should conversion from legacy presets to native intent storage ever be automatic, or always explicit?
- What should the UI display when legacy preset inference is partial or ambiguous?
- How long should legacy preset-backed policies remain first-class after native intent storage exists?
