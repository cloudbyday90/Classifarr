# Policy Authoring Review Triggers

Status: implemented as the durable policy-authoring review-trigger control.

## Scope

This document defines the bounded review-trigger control in the policy intent
editor. It lets operators declare when Classifarr should ask instead of
automating, without exposing replay, provider, scoring, TMDB, or migration
diagnostics as normal policy controls.

This slice does not change server routes, database schema, classification
scoring, learning behavior, routing behavior, or native policy storage. It uses
the draft bridge as the compatibility boundary and serializes review triggers
into legacy `customSignals.review_triggers.when_any` until native intent storage
replaces the bridge.

## Research Inputs

Official sources reviewed as of June 2026:

- W3C WCAG 2.2, Labels or Instructions:
  <https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html>
  - The control needs a visible label and helper text before operators decide
    which uncertainty conditions should trigger review.
- W3C WAI Forms Tutorial, Grouping Controls:
  <https://www.w3.org/WAI/tutorials/forms/grouping/>
  - Related checkbox controls should be grouped so the shared question is
    clear.
- WAI-ARIA Authoring Practices, Checkbox Pattern:
  <https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/>
  - Checkbox state and keyboard behavior must remain predictable.
- W3C WCAG 2.2, Headings and Labels:
  <https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html>
  - The review surface should use descriptive headings that explain the task,
    not implementation details.
- GOV.UK Design System, Checkboxes:
  <https://design-system.service.gov.uk/components/checkboxes/>
  - Checkboxes are appropriate when operators may select more than one review
    condition.
- GOV.UK Design System, Content Design:
  <https://design-system.service.gov.uk/styles/content/>
  - The copy should be plain, direct, and centered on the operator task.
- U.S. Web Design System, Checkbox:
  <https://designsystem.digital.gov/components/checkbox/>
  - Checkbox groups need clear labels, disabled-state explanations, and
    predictable state.
- U.S. Web Design System, Form Controls:
  <https://designsystem.digital.gov/components/form-controls/>
  - Controls should expose labels, helper text, validation state, and clear
    actions without relying on visual state alone.

## Recommendations

1. Use checkboxes for review triggers because multiple uncertainty conditions
   can apply to the same destination.
2. Keep review triggers operator-declared and explicit:
   - evidence is missing,
   - evidence conflicts,
   - the library profile is stale,
   - routing is not ready.
3. Store review triggers through the draft bridge as a small intent bucket:
   `review_triggers.when_any`.
4. Keep readiness warnings separate from declared review triggers. Readiness can
   still force review when unsafe, but the operator-declared trigger list should
   stay readable.
5. Render duplicate choices as disabled with an explanation instead of silently
   hiding them.
6. Do not include provider, replay, TMDB, scoring, or impact-preview language in
   the normal review-trigger control.

## Pros And Cons

### Pros

- Gives the existing `When should Classifarr ask?` setup card a concrete
  editable target.
- Uses a familiar multi-select control for a naturally multi-select decision.
- Keeps the edit path inside typed draft commands and the legacy bridge.
- Makes review behavior visible in intent summaries and section summaries.
- Preserves current save compatibility without adding schema or route churn.

### Cons

- The durable server-side intent contract is still future native-storage work.
- The legacy bridge key `review_triggers.when_any` is transitional.
- The review-trigger vocabulary is intentionally small until the engine-side
  review reasons are finalized.
- Routing readiness still needs its own Vue-facing surface; this slice only
  lets operators declare that routing-not-ready should ask.

## Final Stack

- Review trigger option vocabulary:
  `client/src/utils/policyReviewTriggers.js`
- Intent bucket and projection support:
  `client/src/utils/policyIntentModel.js`
  `client/src/utils/policyIntentDraftBridge.js`
  `client/src/utils/policyIntentDraftView.js`
  `client/src/utils/policyIntentSectionProjection.js`
- Draft command integration:
  `client/src/composables/usePolicyIntentDraft.js`
  `client/src/utils/policyIntentEditorSections.js`
- Vue control:
  `client/src/components/policies/PolicyIntentReviewTriggerControl.vue`
  `client/src/components/policies/PolicyIntentSectionCard.vue`
  `client/src/components/policies/PolicyIntentEditor.vue`
- Unit coverage:
  `client/src/__tests__/utils/policyReviewTriggers.test.js`
  `client/src/__tests__/utils/policyIntentModel.test.js`
  `client/src/__tests__/utils/policyIntentDraftBridge.test.js`
  `client/src/__tests__/composables/usePolicyIntentDraft.test.js`
  `client/src/__tests__/PolicyIntentReviewTriggerControl.test.js`
  `client/src/__tests__/PolicyIntentEditor.test.js`

## Implemented Outcome

The review behavior group now renders an editable **Ask When Unsure** section.
Operators can select one or more review triggers and apply them through typed
draft commands. The draft bridge projects and serializes those triggers through
the transitional legacy-compatible shape:

```json
{
  "review_triggers": {
    "when_any": ["evidence_missing"],
    "semantics": "review"
  }
}
```

The section projection now renders readable review-trigger chips, duplicate
disabled reasons, and behavior summaries such as:

```text
Classifarr should ask when Evidence is missing.
```

The policy behavior summary now includes declared review triggers separately
from deterministic readiness warnings. This keeps operator-declared review
behavior visible without making warnings look like durable policy rules.

## Follow-Up

The next high-value item is **Policy Authoring Routing Readiness**.
Routing is still represented mostly as a setup-card target and readiness state.
The next slice should give `Can this destination route?` a bounded, read-only
readiness surface that explains whether a connected Arr target exists and what
action is needed, without turning routing diagnostics into policy rules.
