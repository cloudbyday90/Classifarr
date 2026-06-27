# Policy Builder Phase 3 Implementation

Status: in progress
Scope: intent-first builder presentation, legacy-compatible save contract

## Goal

Phase 3 makes the policy builder read as an intent-first workflow after the
Phase 2 draft bridge exists. The builder should explain policy behavior before
it exposes starter-template mechanics.

This phase does not change database storage, API payloads, or classification
scoring. It uses the draft model as the source for product-facing presentation
and keeps the legacy preset-backed `customSignals` serializer in place.

## First Implemented Component

The first implemented component adds a read-only policy behavior summary:

1. Add `client/src/utils/policyIntentSummary.js` as a pure summary builder.
2. Derive Purpose, Hard Limits, Helpful Hints, and Review Triggers from the
   existing intent view.
3. Add deterministic review triggers for missing belongs-here signals, missing
   hard limits/avoid rules, empty starter-template selection, and helpful-only
   policies.
4. Render the summary through `PolicyIntentSummaryCard.vue` before starter
   template details.
5. Keep the summary prop-only and event-free so it cannot mutate policy state.

The second implemented component moves starter-template mechanics behind
intent-first disclosure:

1. Add `PolicyStarterTemplateMechanics.vue` as the wrapper for template
   selection, selected-template details, and combined-signal display.
2. Keep the disclosure forced open when no starter template is selected so new
   policies remain actionable.
3. Collapse the disclosure by default when starter templates already exist so
   operators see policy behavior and intent editing first.
4. Pass search/category state through component `v-model` events and pass all
   template edit commands through explicit events.
5. Keep legacy template attachments and signal details available for power
   users without reintroducing direct `customSignals` mutation paths.

The third implemented component makes intent editing the primary work surface:

1. Move `PolicyIntentEditor.vue` directly below the policy behavior summary.
2. Keep `PolicyStarterTemplateMechanics.vue` after the editor as supporting
   context and compatibility tooling.
3. Preserve the existing draft-command event contract for intent edits.
4. Preserve the legacy save payload because only component order changed.
5. Add modal-level ordering coverage so future refactors keep summary, intent
   editing, and starter-template mechanics in the intended order.

The fourth implemented component hardens the intent editor section contract:

1. Add `policyIntentEditorSections.js` as the shared source for intent section
   labels, help text, option sources, badge classes, and command semantics.
2. Move draft command construction for Belongs Here, Helpful Matches, Hard
   Limits, Boosts, and Avoid into allow-listed utility functions.
3. Keep `PolicyIntentEditor.vue` focused on rendering, active-template
   selection, and emitting validated draft commands.
4. Reject incomplete or unknown section commands before they can reach the
   component event boundary.
5. Add direct utility coverage for section order, option projection, draft
   command payloads, and clear-command support.

The fifth implemented component extracts each intent section card:

1. Add `PolicyIntentSectionCard.vue` as the focused renderer for one
   operator-facing intent section.
2. Keep the card prop-driven and emit only narrow UI events:
   `add-value` and `clear-section`.
3. Keep draft command generation in `policyIntentEditorSections.js` so the card
   cannot bypass the allow-listed contract.
4. Reduce `PolicyIntentEditor.vue` to active-template selection, intent-view
   projection, section orchestration, and draft-command emission.
5. Add direct card coverage for entry rendering, source labels, add payloads,
   clear payloads, and no-edit rendering.

The sixth implemented component improves intent-specific add-control language:

1. Add `actionLabel` and `actionHelp` to each section definition in
   `policyIntentEditorSections.js`.
2. Replace generic select placeholders with task-specific copy:
   belongs-here genre, helpful genre, maximum allowed rating, confidence boost,
   and avoid rating.
3. Render action copy inside `PolicyIntentSectionCard.vue` so operators see
   what each control means before choosing a value.
4. Preserve the existing draft command payloads and legacy save behavior.
5. Add contract and card coverage for the new operator-facing control copy.

The seventh implemented component improves intent entry display formatting:

1. Add `formatPolicyIntentEntryForSection` to
   `policyIntentEditorSections.js`.
2. Derive `displayText` for each projected editor entry during section
   projection.
3. Replace raw chip text such as `genres: Family` and
   `certifications: max PG-13` with operator-facing text such as
   `Belongs here: Family`, `Maximum rating: PG-13`, and `Avoid rating: R`.
4. Keep `PolicyIntentSectionCard.vue` display-only; it renders `displayText`
   and no longer interprets signal values.
5. Preserve the same draft data, command payloads, and legacy save behavior.

The eighth implemented component adds draft-managed remove affordances:

1. Add removable-entry metadata during section projection in
   `policyIntentEditorSections.js`.
2. Build remove commands through the same allow-listed section contract used by
   add and clear commands.
3. Target the chip's own `preset_id` so removal works correctly when multiple
   starter templates are selected and a different template is active in the
   editor dropdown.
4. Route card-level `remove-entry` events through `PolicyIntentEditor.vue` as
   validated `draft-remove-signal-value` commands, then into the existing draft
   state boundary from `PolicyBuilderModal.vue`.
5. Keep raw preset JSON hidden from the card and preserve the legacy
   `customSignals` serializer.

## Research Inputs

- [Vue Props](https://vuejs.org/guide/components/props.html) and
  [Component Events](https://vuejs.org/guide/components/events.html): parent
  state should flow through props and user actions should flow through explicit
  events. The summary card intentionally has no events, while the intent editor
  keeps its draft-command event contract after moving higher in the modal.
- [Vue Computed Properties](https://vuejs.org/guide/essentials/computed.html):
  derived UI state should be declarative and cached. The modal computes the
  summary from the existing draft view instead of hand-mutating display state.
- [Vue Composables](https://vuejs.org/guide/reusability/composables.html):
  related stateful concerns should be isolated as the UI grows. The summary
  depends on the existing draft/view utilities instead of adding modal-local
  policy interpretation.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html):
  structured input should use positive validation and expected fields. The
  summary builder only reads known intent buckets and known value keys. The
  intent editor now also builds draft commands from allow-listed section
  definitions instead of ad hoc component-local branching.

## Recommendation Stack

- Keep product-facing summaries derived from the intent draft, not directly
  from raw preset JSON.
- Keep summary generation pure and deterministic.
- Keep display components prop-only unless they own a real edit interaction.
- Treat review triggers as product-owned checks, not AI-generated copy.
- Keep legacy starter-template details available, but make policy behavior the
  first concept operators see.
- Place intent editing immediately after behavior summary so the first editable
  surface is the policy model, not the compatibility template model.
- Keep intent-editor section metadata in a shared contract so labels, option
  sources, and draft command semantics cannot drift.
- Keep each intent section card display-only plus narrow UI events; command
  authority stays in the shared section contract.
- Make each add control explain its policy effect before selection; generic
  dropdown placeholders are not enough for an intent-first builder.
- Format configured intent entries with the same product language as the
  section controls so operators are not asked to read raw signal keys.
- Keep chip removal scoped to draft-managed fields and route it through the
  same allow-listed command contract as additions. Do not let display
  components mutate preset JSON directly.

Pros:

- Low risk because save payloads do not change.
- Gives users a clearer explanation of policy behavior.
- Creates a clean place for later warning and provenance work.
- Helps expose weak policies before classification.

Cons:

- The summary is still derived from compatibility storage until native intent
  persistence exists.
- Review triggers are intentionally coarse in this first slice.
- Template details remain visible until later Phase 3 disclosure work moves
  them behind an advanced/debug path.
- Reordering improves the user flow but does not yet simplify the editor
  controls themselves.
- The shared contract still renders the current simple select controls; richer
  controls should build on the same contract rather than bypass it.
- Section-card extraction reduces editor size but does not yet replace the
  select controls with richer task-specific inputs.
- This slice improves action language while still using simple select controls.
  More specialized inputs can come later without changing the draft command
  contract.
- Entry display formatting remains derived from the compatibility draft view
  until native intent persistence exists.
- Remove affordances currently cover draft-managed belongs-here,
  helpful-match, boost, and max-rating chips. Multi-value exclusion editing
  still needs a dedicated replace/remove control so one avoid rating can be
  removed without clearing unrelated certification settings.

## Validation

Added tests in `client/src/__tests__/utils/policyIntentSummary.test.js`
covering:

- product-facing section generation,
- value formatting for identity, hard-limit, exclusion, compatibility, and
  booster signals,
- deterministic review triggers for weak intent.

Added tests in `client/src/__tests__/PolicyIntentSummaryCard.test.js`
covering:

- read-only section rendering,
- complete versus needs-review status,
- empty-section copy,
- review-trigger rendering.

Added tests in `client/src/__tests__/PolicyStarterTemplateMechanics.test.js`
covering:

- forced-open rendering when no starter template is selected,
- default-collapsed rendering when starter templates already exist,
- browser search/category/add-all/toggle event pass-through.

Updated `client/src/__tests__/PolicyBuilderModal.test.js` with ordering
coverage proving the modal renders:

1. Policy Behavior Summary
2. Policy Intent Builder
3. Starter Templates & Signal Details

Added tests in `client/src/__tests__/utils/policyIntentEditorSections.test.js`
covering:

- operator-facing section order and labels,
- intent-view entry and option projection,
- allow-listed add/config draft command payloads,
- clear-command behavior,
- rejection of unknown or incomplete commands.

Added tests in `client/src/__tests__/PolicyIntentSectionCard.test.js`
covering:

- section copy and entry rendering,
- starter-template source labels,
- add-value payloads and select reset behavior,
- clear-section payloads,
- hidden edit controls when no active preset exists.
- action labels and help copy for intent-specific controls.
- operator-facing entry display text.
- editable-only remove-entry payloads for removable chips.

Added tests in `client/src/__tests__/PolicyIntentEditor.test.js` and
`client/src/__tests__/composables/usePolicyBuilderState.test.js` covering:

- draft remove command emission from intent chips,
- chip-level removal flowing through the public draft state boundary.

Focused validation:

```bash
npm --prefix client run test -- PolicyIntentSummaryCard.test.js policyIntentSummary.test.js PolicyBuilderModal.test.js PolicyIntentEditor.test.js
```

Starter-template disclosure validation:

```bash
npm --prefix client run test -- PolicyStarterTemplateMechanics.test.js PolicyBuilderModal.test.js PolicyStarterTemplateBrowser.test.js PolicySelectedStarterTemplates.test.js PolicyIntentSummaryCard.test.js
```

Intent work-surface ordering validation:

```bash
npm --prefix client run test -- PolicyBuilderModal.test.js PolicyIntentEditor.test.js PolicyIntentSummaryCard.test.js PolicyStarterTemplateMechanics.test.js
```

Intent editor contract validation:

```bash
npm --prefix client run test -- PolicyIntentEditor.test.js policyIntentEditorSections.test.js PolicyBuilderModal.test.js
```

Intent section card extraction validation:

```bash
npm --prefix client run test -- PolicyIntentSectionCard.test.js PolicyIntentEditor.test.js policyIntentEditorSections.test.js PolicyBuilderModal.test.js
```

Intent-specific control language validation:

```bash
npm --prefix client run test -- PolicyIntentSectionCard.test.js PolicyIntentEditor.test.js policyIntentEditorSections.test.js PolicyBuilderModal.test.js
```

Intent entry display validation:

```bash
npm --prefix client run test -- PolicyIntentSectionCard.test.js PolicyIntentEditor.test.js policyIntentEditorSections.test.js PolicyBuilderModal.test.js
```

Intent chip removal validation:

```bash
npm --prefix client run test -- PolicyIntentSectionCard.test.js PolicyIntentEditor.test.js policyIntentEditorSections.test.js usePolicyBuilderState.test.js PolicyBuilderModal.test.js
```
