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

The ninth implemented component makes certification chips value-specific:

1. Split multi-value array entries into one operator-facing chip per value
   during section projection.
2. Enable avoid-rating chips such as `R` and `NC-17` to emit value-specific
   remove commands instead of showing one ambiguous combined chip.
3. Clean dependent `mode: exclude` draft values when the last excluded rating
   is removed.
4. Normalize imported hard-limit entries with `max` ratings to `mode: max` so
   a max-rating rule remains a hard limit even when compatibility storage also
   contains exclusion data.
5. Preserve unrelated certification settings, unsupported legacy fields, and
   the existing legacy-compatible save payload.

The tenth implemented component adds section-specific certification controls:

1. Add `PolicyIntentCertificationControl.vue` for rating-limit and avoid-rating
   edits.
2. Add `controlKind` to the section contract so certification sections can use
   purpose-built controls while genre sections keep the simple signal selector.
3. Replace generic immediate-select behavior for certification sections with an
   explicit selected value plus action button: `Set max rating` or
   `Add avoid rating`.
4. Keep the control local-state only; it emits the same narrow `add-value` and
   `clear-section` events as the generic card.
5. Preserve draft command construction in `policyIntentEditorSections.js` and
   `PolicyIntentEditor.vue`.

The eleventh implemented component adds section-specific genre intent controls:

1. Add `PolicyIntentGenreControl.vue` for Belongs Here, Helpful Matches, and
   Boosts.
2. Move identity, compatibility, and booster sections to `controlKind:
   genre_intent`.
3. Replace immediate select-submit behavior with explicit action buttons:
   `Add belongs-here genre`, `Add helpful genre`, and `Add confidence boost`.
4. Keep the same `add-value` event contract so draft command generation remains
   centralized and allow-listed.
5. Preserve the generic selector fallback for future section types.

The twelfth implemented component adds inline chip provenance:

1. Add `PolicyIntentChip.vue` as the focused renderer for one configured intent
   chip.
2. Show the operator-facing signal text, starter-template name, and an
   allow-listed source label on every chip.
3. Map known draft sources to safe labels: `Intent edit`, `Policy override`,
   and `Starter template`; use `Template signal` as the fallback.
4. Keep remove behavior as the chip's only event and route it through the
   section card so the section key stays outside the chip.
5. Keep raw source keys out of the UI while giving operators enough provenance
   to understand why a chip exists.

The thirteenth implemented component adds per-section behavior summaries:

1. Add `summarizePolicyIntentSection` to
   `policyIntentEditorSections.js`.
2. Derive section summaries from the already-projected, operator-facing chip
   text rather than raw signal keys.
3. Surface concise section behavior above the chips when the section has
   configured entries.
4. Keep empty sections quiet so the existing empty-state text remains the only
   prompt.
5. Preserve draft command behavior, save payloads, and existing section
   controls.

The fourteenth implemented component adds deterministic weak-section warnings:

1. Add `buildPolicyIntentSectionWarnings` to
   `policyIntentEditorSections.js`.
2. Derive section warnings from the already-projected section model and sibling
   section context rather than raw preset JSON.
3. Warn when a policy has no Belongs Here identity, when Helpful Matches or
   Boosts exist without identity evidence, and when optional rating boundaries
   are absent.
4. Render warning and info messages inside `PolicyIntentSectionCard.vue`
   without giving the card command authority.
5. Preserve draft command behavior, save payloads, classification scoring, and
   legacy starter-template compatibility.

The fifteenth implemented component adds warning consequence helpers:

1. Add a deterministic `consequence` field to each section warning returned by
   `buildPolicyIntentSectionWarnings`.
2. Explain the classification consequence separately from the corrective action
   so operators can tell whether a weak section affects review frequency,
   routing confidence, or hard-boundary behavior.
3. Render consequence text as visible secondary copy in
   `PolicyIntentSectionCard.vue` instead of hover-only or hidden help.
4. Keep warning rendering passive; the card still owns no draft command,
   scoring, routing, or save behavior.
5. Preserve legacy starter-template compatibility and the current save payload.

The sixteenth implemented component adds a non-blocking policy readiness
summary:

1. Add `buildPolicyIntentReadinessSummary` to
   `policyIntentEditorSections.js`.
2. Fold section warnings into one top-level readiness state:
   `Ready`, `Ready with notes`, or `Needs review`.
3. Add `PolicyIntentReadinessSummary.vue` as a prop-only status component that
   shows warning/note counts and concise section issue rows.
4. Render the readiness summary above the starter-template selector in
   `PolicyIntentEditor.vue` so operators see policy state before editing.
5. Keep readiness advisory only; it does not block save, mutate draft state,
   change scoring, route items, or change the legacy-compatible payload.

The seventeenth implemented component adds readiness issue navigation:

1. Render readiness issues as explicit buttons inside
   `PolicyIntentReadinessSummary.vue`.
2. Emit a narrow `focus-section` event with the affected section key instead of
   letting the summary own DOM behavior.
3. Wrap each `PolicyIntentSectionCard` in a focusable section anchor owned by
   `PolicyIntentEditor.vue`.
4. Use function refs plus `scrollIntoView` and focus to move operators from a
   readiness issue to the affected section.
5. Keep navigation non-mutating and advisory; it does not affect draft data,
   save behavior, scoring, routing, or legacy template compatibility.

The eighteenth implemented component adds section completion badges:

1. Add `buildPolicyIntentSectionCompletion` to
   `policyIntentEditorSections.js`.
2. Derive compact section states from configured entries and section warnings:
   `Configured`, `Needs identity`, `Advisory`, and `Optional`.
3. Attach the completion model to each projected intent section alongside
   entries, summaries, and warnings.
4. Render the badge beside each section title in `PolicyIntentSectionCard.vue`
   so sections are self-describing even when the top readiness summary is out
   of view.
5. Keep badges presentation-only; they do not block save, mutate draft state,
   change scoring, route items, or change the legacy-compatible payload.

The nineteenth implemented component adds section next-action guidance:

1. Add `buildPolicyIntentSectionNextAction` to
   `policyIntentEditorSections.js`.
2. Derive the smallest useful next edit from the section key and completion
   state.
3. Attach `nextAction` to each projected intent section alongside completion,
   warnings, summaries, and entries.
4. Render the next-action line under the section help text in
   `PolicyIntentSectionCard.vue`.
5. Keep the guidance passive and deterministic; controls remain the only edit
   surface and save/scoring behavior is unchanged.

The twentieth implemented component extracts section visual state:

1. Add `policyIntentSectionVisualState.js` as the focused utility for
   section warnings, completion badges, next-action guidance, and readiness
   summaries.
2. Keep `policyIntentEditorSections.js` responsible for section definitions,
   entry projection, and draft command construction.
3. Re-export the visual-state helpers from `policyIntentEditorSections.js` so
   existing callers keep a stable import path during the Phase 3 transition.
4. Move visual-state helper coverage into
   `policyIntentSectionVisualState.test.js`.
5. Preserve rendered behavior, draft command behavior, save payloads, scoring,
   routing, and legacy template compatibility.

The twenty-first implemented component extracts section projection and draft
commands:

1. Add `policyIntentSectionProjection.js` as the focused utility for intent chip
   display labels, multi-value chip projection, behavior summaries, remove
   commands, add commands, and clear commands.
2. Keep `policyIntentEditorSections.js` responsible for section definitions and
   composition of projection, visual state, and available options.
3. Pass section definitions into projection/command helpers instead of importing
   definitions from the utility, avoiding circular ownership between contract
   data and behavior.
4. Keep the existing public exports from `policyIntentEditorSections.js` so
   `PolicyIntentEditor` and existing tests keep their import path during the
   Phase 3 transition.
5. Move direct projection and draft-command coverage into
   `policyIntentSectionProjection.test.js`, leaving
   `policyIntentEditorSections.test.js` focused on the composed section
   contract and public wrapper compatibility.
6. Preserve rendered behavior, draft command behavior, save payloads, scoring,
   routing, and legacy template compatibility.

The twenty-second implemented component adds option availability guardrails:

1. Add deterministic option-state derivation to
   `policyIntentSectionProjection.js` so each section can mark already
   configured values as unavailable with an operator-facing reason.
2. Attach `optionStates` to each composed section while keeping the existing
   `options` array for compatibility.
3. Update genre and certification controls to disable duplicate/no-op options,
   show the reason in the option text/title, and explain when all available
   options are already configured.
4. Pass current section entries into draft-command construction from
   `PolicyIntentEditor.vue` so stale UI events cannot emit duplicate commands.
5. Keep the guardrail scoped to same-section duplicates and max-rating no-ops;
   cross-section conflicts remain policy semantics work, not a hidden UI block.
6. Preserve rendered behavior for valid edits, save payloads, scoring, routing,
   and legacy template compatibility.

The twenty-third implemented component adds option diagnostics:

1. Add `buildPolicyIntentOptionDiagnostics` to
   `policyIntentSectionProjection.js` so option availability messages are
   derived from the same option state used by controls and command validation.
2. Attach `optionDiagnostics` to each composed section while keeping raw
   `options` and structured `optionStates` available for compatibility.
3. Distinguish missing reference options, partially available choices, fully
   configured sections, and fully available sections with deterministic status,
   counts, tone, and message fields.
4. Update genre and certification controls to render the shared diagnostic
   message instead of owning separate local availability copy.
5. Keep diagnostics informational only; they explain why choices are unavailable
   but do not change valid draft commands, save payloads, scoring, or routing.

The twenty-fourth implemented component adds control readiness:

1. Add `buildPolicyIntentControlReadiness` to
   `policyIntentSectionProjection.js` so add-button readiness is derived from
   selected value, option state, and option diagnostics in one place.
2. Return deterministic `canSubmit`, `status`, and `reason` fields for missing
   reference options, fully configured sections, missing selections, disabled
   selections, and ready selections.
3. Update genre and certification controls to use the shared readiness object
   for disabled state, button title, and accessible button label text.
4. Keep local controls responsible only for rendering labels and emitting valid
   add events; command rejection remains in the draft-command boundary.
5. Preserve valid edit behavior, save payloads, scoring, routing, and legacy
   template compatibility.

The twenty-fifth implemented component extracts shared option-select rendering:

1. Add `PolicyIntentOptionSelect.vue` as the focused renderer for section
   option labels, placeholders, disabled option reasons, and diagnostics.
2. Add `resolvePolicyIntentOptionStates` to
   `policyIntentSectionProjection.js` so fallback raw option mapping is owned
   by the same utility boundary as option guardrails and readiness.
3. Update genre and certification controls to use the shared select while
   keeping their intent-specific labels, buttons, clear actions, readiness, and
   event contracts local.
4. Keep the shared component on the standard Vue `v-model` contract so parent
   controls still own selected-value state and valid add emissions.
5. Preserve valid edit behavior, save payloads, scoring, routing, and legacy
   template compatibility.

The twenty-sixth implemented component extracts shared action-button readiness:

1. Add `PolicyIntentActionButton.vue` as the focused renderer for the primary
   intent edit action button.
2. Keep disabled state, title text, and accessible label construction derived
   from the shared readiness object.
3. Emit a narrow `activate` event only when the readiness object allows submit,
   so disabled controls cannot fire a parent edit action.
4. Update genre and certification controls to pass their intent-specific button
   labels and readiness state into the shared button while keeping selected
   value reset, clear actions, and draft event payloads local.
5. Preserve valid edit behavior, save payloads, scoring, routing, and legacy
   template compatibility.

The twenty-seventh implemented component extracts option-action orchestration:

1. Add `usePolicyIntentOptionAction` as the focused composable for selected
   option state, option-state projection, readiness derivation, guarded submit,
   and selected-value reset.
2. Keep the composable generic by accepting a reactive section source and a
   narrow add-value callback rather than importing editor state or policy
   components.
3. Update genre and certification controls to use the composable while keeping
   their intent-specific labels, clear actions, layout, and policy copy local.
4. Keep the submit path double-guarded: the shared action button blocks disabled
   activation and the composable re-checks readiness before emitting the
   add-value payload.
5. Preserve valid edit behavior, save payloads, scoring, routing, and legacy
   template compatibility.

The twenty-eighth implemented component extracts secondary action rendering:

1. Add `PolicyIntentSecondaryActionButton.vue` as the focused renderer for
   non-primary intent actions such as clearing the max-rating rule.
2. Keep the secondary action on an explicit `type="button"` with visible and
   accessible label text.
3. Emit a narrow `activate` event and leave the certification control
   responsible for deciding when the clear action exists and which section key
   to emit.
4. Preserve the certification control's clear-section event contract while
   removing its raw secondary-button markup.
5. Preserve valid edit behavior, save payloads, scoring, routing, and legacy
   template compatibility.

The twenty-ninth implemented component extracts certification control
projection:

1. Add `policyIntentCertificationControl.js` as the focused utility for
   certification-control labels and clear capability.
2. Derive hard-limit versus avoid-rating copy from the section key in a pure
   helper rather than inline Vue branching.
3. Return `inputLabel`, `buttonLabel`, `clearLabel`, and `canClear` as the
   certification control's display contract.
4. Keep `PolicyIntentCertificationControl.vue` responsible for layout and
   event emission while delegating certification-specific wording to the helper.
5. Preserve valid edit behavior, save payloads, scoring, routing, and legacy
   template compatibility.

## Research Inputs

- [Vue Props](https://vuejs.org/guide/components/props.html) and
  [Component Events](https://vuejs.org/guide/components/events.html): parent
  state should flow through props and user actions should flow through explicit
  events. The summary card intentionally has no events, while the intent editor
  keeps its draft-command event contract after moving higher in the modal.
- [Vue Computed Properties](https://vuejs.org/guide/essentials/computed.html):
  derived UI state should be declarative and cached. The modal computes the
  summary from the existing draft view instead of hand-mutating display state.
  Certification-control labels now use the same approach by projecting a view
  model from section state instead of branching through template-local copy.
- [Vue Composables](https://vuejs.org/guide/reusability/composables.html):
  related stateful concerns should be isolated as the UI grows. The summary
  depends on the existing draft/view utilities instead of adding modal-local
  policy interpretation. The option-action orchestration now follows the same
  pattern by moving repeated selected-value/readiness logic out of individual
  controls.
- [MDN JavaScript Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules):
  explicit module imports and exports make ownership boundaries inspectable.
  Phase 3 keeps compatibility re-exports while moving visual-state,
  projection, and command behavior into focused ES modules.
- [Vue Component `v-model`](https://vuejs.org/guide/components/v-model.html):
  reusable form components should expose the standard model update event so
  parent components keep ownership of state and submit behavior. The shared
  option select emits only `update:modelValue`.
- [Vue Component Events](https://vuejs.org/guide/components/events.html):
  reusable action components should emit explicit events rather than reaching
  into parent state. The shared action button emits only `activate`, and parent
  controls still own policy-specific payload construction. The secondary action
  button follows the same event boundary for clear actions.
- [Vue Form Input Bindings](https://vuejs.org/guide/essentials/forms.html):
  select controls are a native fit for bounded choices. Phase 3 keeps native
  select behavior while centralizing the option projection and diagnostics that
  both intent controls share.
- [MDN `<option>` HTML element](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/option):
  disabled options are not checkable and do not receive normal interaction.
  The duplicate/no-op guardrail uses disabled options plus visible reason text
  instead of allowing a no-op command and failing silently.
- [MDN `<button>` HTML element](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button):
  disabled buttons cannot be pressed. The add controls therefore pair disabled
  state with deterministic reason text in the title and accessible label so the
  disabled state is explainable. Secondary policy actions also use explicit
  `type="button"` so they cannot accidentally submit surrounding forms.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html):
  structured input should use positive validation and expected fields. The
  summary builder only reads known intent buckets and known value keys. The
  intent editor now also builds draft commands from allow-listed section
  definitions instead of ad hoc component-local branching.
- [WCAG 2.2 Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html):
  user-facing instructions should provide enough information to complete the
  task without unnecessary clutter. Warning consequences stay short, visible,
  and next to the affected section instead of becoming a hidden tooltip or a
  global warning list. Option diagnostics use the same principle when a section
  has no usable choices.
- [WCAG 2.2 Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html):
  invalid input should be identified and described. Duplicate/no-op choices are
  disabled with a reason before the user attempts to apply them.
- [WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html):
  status information should be programmatically determinable without taking
  focus away from the current task. The readiness summary uses a polite status
  region because it reports derived policy state while leaving editing controls
  in place.
- [Vue Template Refs](https://vuejs.org/guide/essentials/template-refs.html):
  direct DOM access should be limited to cases that need it, such as focus
  management. Section jump navigation keeps DOM refs in the editor boundary and
  uses summary events rather than reaching into child component internals.
- [WCAG 2.2 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html):
  focus movement should preserve meaning and operability. Readiness issue
  buttons move focus to the affected section wrapper, not to a hidden or
  unrelated control.

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
- Split multi-value chips at the presentation boundary when each value can be
  removed independently. The command should describe the exact value being
  removed, not a combined label.
- Use section-specific controls when one generic selector makes different
  policy intents look equivalent. The component can improve clarity without
  changing the persisted draft or save contract.
- Keep genre intent controls separate from certification controls because the
  operator decision is different: destination identity, supporting evidence, and
  confidence boosting should not feel like the same action.
- Surface provenance close to each configured signal. Operators should not need
  to open advanced template mechanics just to learn whether a chip came from an
  intent edit, policy override, or starter template.
- Show effective behavior before controls and chips. Summaries should be
  deterministic projections of configured intent, not AI-generated copy.
- Surface weak-section warnings at the section boundary. The warning should
  explain missing policy structure without changing draft data, scoring, or
  save behavior.
- Pair each weak-section warning with a compact consequence. Operators should
  see both what to fix and why it matters before saving.
- Add one readiness summary above detailed section cards. Operators should see
  whether the policy is ready, ready with notes, or needs review before they
  scan individual sections.
- Make readiness issues directly navigable. Issue rows should point to the
  affected section without mutating policy data or introducing save blocking.
- Make each section self-describing with a compact completion badge. The badge
  should summarize section state without requiring the operator to re-read the
  global readiness summary.
- Pair each section state with a concise next-action line. The badge explains
  the state; the line explains the smallest useful edit.
- Keep visual-state derivation in a focused module. The section contract should
  compose display state, not become the long-term owner of every UI state rule.
- Keep projection and draft-command derivation in a focused module. The section
  contract should define the operator-facing sections, then delegate display and
  command mechanics to deterministic helpers.
- Derive option availability from configured section entries before rendering
  controls. Duplicate/no-op choices should be visible but unavailable, with a
  reason that matches the command-layer guardrail.
- Derive option diagnostics from option state, not component-local heuristics.
  Missing reference options, partially available choices, and exhausted choices
  should use the same counts and statuses everywhere.
- Derive add-button readiness from option state and diagnostics. Controls should
  not duplicate disabled-state reasons or silently reject clicks.
- Use a shared option-select component for identical bounded-choice rendering,
  but keep intent-specific labels and action buttons in the genre and
  certification controls where the policy meaning differs.
- Use a shared primary action button for identical readiness rendering, but pass
  policy-specific labels from each control so the component does not own
  classification semantics.
- Move repeated reactive option-action orchestration into a composable once the
  rendering boundaries are stable. Components should keep policy language and
  layout; composables should own shared selected-value/readiness mechanics.
- Use a shared secondary action button for low-risk non-primary actions, but
  keep action availability and payload construction in the policy-specific
  parent control.
- Project certification-control copy and capabilities through a pure helper
  once the component layout is stable. The component should render the
  projected contract, not own policy wording rules inline.

Pros:

- Low risk because save payloads do not change.
- Gives users a clearer explanation of policy behavior.
- Creates a clean place for later warning and provenance work.
- Helps expose weak policies before classification.
- Projection and command helpers can be tested without mounting Vue components
  or duplicating section-composition setup.
- Passing definitions into helpers keeps the utility reusable while avoiding a
  circular import from helper behavior back into the section contract.
- Disabled duplicate options reduce accidental no-op edits and make command
  rejection visible before the operator clicks an action button.
- Centralized option diagnostics keep genre and certification controls aligned
  and make missing reference data distinguishable from "everything is already
  configured."
- Shared control readiness keeps disabled reasons consistent between UI labels
  and command-layer guardrails.

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
- Value-specific removal now covers multi-value avoid-rating chips. Richer
  certification editing can still improve replacement flows, but removal no
  longer requires clearing unrelated certification settings.
- Certification controls now have explicit action buttons, but the editor still
  uses simple selectors for any future generic signal sections. Genre-driven
  intent sections now have explicit controls, but richer grouping or search can
  still improve large genre lists later.
- Chip provenance is intentionally concise. It explains source category, not
  full raw signal history; deeper debugging still belongs in advanced template
  mechanics.
- Section summaries are intentionally compact and derived from chip text. They
  do not replace the top-level behavior summary or warning model.
- Weak-section warnings are intentionally advisory in this slice. They improve
  builder clarity but do not yet enforce save blocking or runtime scoring
  changes.
- Consequence copy can become stale if runtime semantics change. Keep it
  generated from the same section warning contract so tests catch drift when
  warning codes change.
- Readiness is intentionally advisory. It improves reviewability but does not
  replace server-side validation, runtime scoring, or future authoritative
  intent persistence.
- Readiness navigation uses DOM focus and scrolling, so it must remain scoped
  to editor-owned wrappers. Child cards should not expose internal methods just
  to support navigation.
- Completion badges are intentionally coarse. They improve scanability but do
  not replace section warnings, consequences, or future server-side validation.
- Next-action guidance is intentionally advisory. It should never imply that
  Classifarr is enforcing or auto-applying the suggested edit.
- Re-exporting visual-state helpers preserves compatibility but can hide the
  new boundary. New direct helper tests should import the focused module so the
  ownership remains clear.
- Re-exporting projection and command helpers preserves compatibility but can
  make the old section contract look like it still owns the behavior. New direct
  tests should import `policyIntentSectionProjection.js`.
- Same-section duplicate prevention is intentionally conservative. Blocking
  cross-section overlap would encode policy semantics in the UI before the
  runtime model owns those rules.
- Option diagnostics explain current availability but do not fix missing
  reference data by themselves. Reference-data enrichment still belongs in the
  library/preset source-of-truth flow.
- Button titles are supplemental, not a full accessibility solution by
  themselves. The reason is also included in the accessible label while visible
  section diagnostics explain exhausted or missing option sets.
- Sharing the select reduces duplicate markup, but the surrounding controls
  still duplicate the action-button pattern by design for now. A later slice can
  extract button readiness without collapsing policy-specific language.
- Sharing the action button centralizes disabled-readiness behavior, but parent
  controls still need a final submit guard because they own selected value reset
  and draft event emission.
- The option-action composable reduces duplicated logic but should remain below
  the editor command boundary. It emits only section/value payloads and does not
  construct draft commands or mutate policy data directly.
- The secondary action button is intentionally simpler than the primary action
  button. If a future secondary action becomes readiness-gated, add explicit
  readiness props rather than overloading the clear-rating component now.
- Certification control projection is intentionally small. It owns labels and
  clear capability only; it does not validate option selections, emit commands,
  or decide runtime policy semantics.

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
- value-specific avoid-rating removal commands,
- draft cleanup for dependent certification mode fields,
- hard-limit normalization when compatibility storage contains both max-rating
  and exclusion data.

Added tests in
`client/src/__tests__/PolicyIntentCertificationControl.test.js` covering:

- explicit max-rating set actions,
- max-rating clear actions,
- avoid-rating additions without max-clear controls.

Added tests in `client/src/__tests__/PolicyIntentGenreControl.test.js`
covering:

- explicit belongs-here genre actions,
- distinct helpful-match copy and payloads,
- distinct confidence-boost copy and payloads.

Added tests in `client/src/__tests__/PolicyIntentChip.test.js` covering:

- inline source labels for intent edits,
- distinct labels for policy overrides and starter-template signals,
- fallback labels for unknown source keys,
- editable-only remove actions.

Updated tests in `client/src/__tests__/utils/policyIntentEditorSections.test.js`
and `client/src/__tests__/PolicyIntentSectionCard.test.js` covering:

- per-section behavior summary projection,
- summary rendering before configured chips,
- empty sections without summary text.
- deterministic weak-section warning projection,
- warning suppression when required sibling context exists,
- warning rendering inside section cards.
- warning consequence projection,
- visible consequence rendering inside section cards.
- top-level readiness summary projection,
- readiness status rendering with warning/note counts,
- readiness placement before detailed section editing.
- readiness issue navigation events,
- editor-owned section focus and scroll behavior,
- readiness issue buttons with accessible labels.
- deterministic section completion badge projection,
- completion badge rendering for configured and weak sections.
- deterministic section next-action projection,
- next-action rendering for configured and weak sections.
- visual-state helper extraction into a focused module,
- stable re-export compatibility from the section contract,
- direct visual-state helper coverage.
- projection and draft-command helper extraction into a focused module,
- stable public wrapper compatibility from the section contract,
- direct projection and command helper coverage.
- deterministic option-state derivation for already configured values,
- disabled duplicate option rendering in genre and certification controls,
- command-layer duplicate rejection using current section entries.
- option diagnostics for missing reference options,
- option diagnostics for partially available choices,
- option diagnostics for fully configured sections.
- deterministic add-control readiness for missing selections,
- deterministic add-control readiness for disabled selections,
- accessible disabled-button reason labels in genre and certification controls.

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

Certification chip editing validation:

```bash
npm --prefix client run test -- PolicyIntentSectionCard.test.js PolicyIntentEditor.test.js policyIntentEditorSections.test.js usePolicyIntentDraft.test.js policyIntentDraftBridge.test.js usePolicyBuilderState.test.js PolicyBuilderModal.test.js
```

Certification control validation:

```bash
npm --prefix client run test -- PolicyIntentCertificationControl.test.js PolicyIntentSectionCard.test.js PolicyIntentEditor.test.js policyIntentEditorSections.test.js PolicyBuilderModal.test.js
```

Genre intent control validation:

```bash
npm --prefix client run test -- PolicyIntentGenreControl.test.js PolicyIntentCertificationControl.test.js PolicyIntentSectionCard.test.js PolicyIntentEditor.test.js policyIntentEditorSections.test.js PolicyBuilderModal.test.js
```

Intent chip provenance validation:

```bash
npm --prefix client run test -- PolicyIntentChip.test.js PolicyIntentSectionCard.test.js PolicyIntentGenreControl.test.js PolicyIntentCertificationControl.test.js PolicyIntentEditor.test.js PolicyBuilderModal.test.js
```

Section behavior summary validation:

```bash
npm --prefix client run test -- policyIntentEditorSections.test.js PolicyIntentSectionCard.test.js PolicyIntentEditor.test.js PolicyBuilderModal.test.js
```

Weak-section warning validation:

```bash
npm --prefix client run test -- policyIntentEditorSections.test.js PolicyIntentSectionCard.test.js PolicyIntentEditor.test.js PolicyBuilderModal.test.js
```

Warning consequence validation:

```bash
npm --prefix client run test -- policyIntentEditorSections.test.js PolicyIntentSectionCard.test.js PolicyIntentEditor.test.js PolicyBuilderModal.test.js
```

Policy readiness summary validation:

```bash
npm --prefix client run test -- policyIntentEditorSections.test.js PolicyIntentReadinessSummary.test.js PolicyIntentEditor.test.js PolicyBuilderModal.test.js
```

Readiness issue navigation validation:

```bash
npm --prefix client run test -- PolicyIntentReadinessSummary.test.js PolicyIntentEditor.test.js PolicyBuilderModal.test.js
```

Section completion badge validation:

```bash
npm --prefix client run test -- policyIntentEditorSections.test.js PolicyIntentSectionCard.test.js PolicyIntentEditor.test.js PolicyBuilderModal.test.js
```

Section next-action validation:

```bash
npm --prefix client run test -- policyIntentEditorSections.test.js PolicyIntentSectionCard.test.js PolicyIntentEditor.test.js PolicyBuilderModal.test.js
```

Section visual-state extraction validation:

```bash
npm --prefix client run test -- policyIntentSectionVisualState.test.js policyIntentEditorSections.test.js PolicyIntentSectionCard.test.js PolicyIntentEditor.test.js PolicyBuilderModal.test.js
```

Section projection and draft-command extraction validation:

```bash
npm --prefix client run test -- policyIntentSectionProjection.test.js policyIntentEditorSections.test.js PolicyIntentEditor.test.js PolicyBuilderModal.test.js
```

Option availability guardrail validation:

```bash
npm --prefix client run test -- policyIntentSectionProjection.test.js policyIntentEditorSections.test.js PolicyIntentGenreControl.test.js PolicyIntentCertificationControl.test.js PolicyIntentSectionCard.test.js PolicyIntentEditor.test.js PolicyBuilderModal.test.js
```

Option diagnostics validation:

```bash
npm --prefix client run test -- policyIntentSectionProjection.test.js policyIntentEditorSections.test.js PolicyIntentGenreControl.test.js PolicyIntentCertificationControl.test.js PolicyIntentSectionCard.test.js PolicyIntentEditor.test.js PolicyBuilderModal.test.js
```

Control readiness validation:

```bash
npm --prefix client run test -- policyIntentSectionProjection.test.js policyIntentEditorSections.test.js PolicyIntentGenreControl.test.js PolicyIntentCertificationControl.test.js PolicyIntentSectionCard.test.js PolicyIntentEditor.test.js PolicyBuilderModal.test.js
```

Shared option-select validation:

```bash
npm --prefix client run test -- PolicyIntentOptionSelect.test.js policyIntentSectionProjection.test.js PolicyIntentGenreControl.test.js PolicyIntentCertificationControl.test.js PolicyIntentSectionCard.test.js PolicyIntentEditor.test.js PolicyBuilderModal.test.js
```

Shared action-button validation:

```bash
npm --prefix client run test -- PolicyIntentActionButton.test.js PolicyIntentOptionSelect.test.js policyIntentSectionProjection.test.js PolicyIntentGenreControl.test.js PolicyIntentCertificationControl.test.js PolicyIntentSectionCard.test.js PolicyIntentEditor.test.js PolicyBuilderModal.test.js
```

Option-action composable validation:

```bash
npm --prefix client run test -- usePolicyIntentOptionAction.test.js PolicyIntentActionButton.test.js PolicyIntentOptionSelect.test.js policyIntentSectionProjection.test.js PolicyIntentGenreControl.test.js PolicyIntentCertificationControl.test.js PolicyIntentSectionCard.test.js PolicyIntentEditor.test.js PolicyBuilderModal.test.js
```

Secondary action validation:

```bash
npm --prefix client run test -- PolicyIntentSecondaryActionButton.test.js PolicyIntentCertificationControl.test.js PolicyIntentActionButton.test.js PolicyIntentOptionSelect.test.js usePolicyIntentOptionAction.test.js PolicyIntentSectionCard.test.js PolicyIntentEditor.test.js PolicyBuilderModal.test.js
```

Certification control projection validation:

```bash
npm --prefix client run test -- policyIntentCertificationControl.test.js PolicyIntentCertificationControl.test.js PolicyIntentSecondaryActionButton.test.js PolicyIntentActionButton.test.js PolicyIntentOptionSelect.test.js usePolicyIntentOptionAction.test.js PolicyIntentSectionCard.test.js PolicyIntentEditor.test.js PolicyBuilderModal.test.js
```
