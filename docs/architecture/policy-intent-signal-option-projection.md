# Policy Intent-Signal Option Projection

Status: implemented as the server-owned option projection for native policy
creation.

## Scope

This document defines the bounded read model behind the native `What belongs
here?` picker. It replaces the previous observed-profile-only option list with
one explicit projection that can represent:

- read-only library evidence;
- suggestions derived from the observed profile;
- optional, matching starter-template suggestions;
- common options when a server-owned provider supplies them;
- validated operator-provided custom values when a server-owned provider
  supplies them;
- already-declared values; and
- values unavailable because they conflict with current intent or fail the
  broad-identity guard.

The projection is display-only. It does not attach a template, declare intent,
write policy storage, route media, call a provider, consume quota, or learn from
an operator action. The browser renders the supplied state and emits typed local
draft commands only after explicit selection.

## Official Guidance Reviewed

The following official sources were reviewed for this design, current through
June 2026:

- [OWASP API Security Top 10, API3: Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)
  recommends returning only the response properties a consumer needs and
  avoiding generic serialization of internal records.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side allowlists, normalization, and size limits at a trust
  boundary.
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports explicit interfaces and verification of data flowing between
  components.
- [W3C WCAG 2.2, Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  supports announcing selection state without moving focus.
- [WAI-ARIA Checkbox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/)
  supports native, independently selectable option groups when each choice has
  a visible label and explanation.

## Recommendations

1. Return a versioned, minimal option projection rather than raw profile or
   template records.
2. Keep source ID, source label, selection state, disabled reason, evidence,
   explicit-acceptance flag, and no-auto-declare flag server-owned.
3. Validate every option with the same option-selection contract before it is
   emitted; drop malformed input rather than passing it to the browser.
4. Convert unsupported broad genre identity suggestions from template, common,
   or custom sources into a disabled explanation unless there is supporting
   library evidence.
5. Prefer observed-profile candidates over duplicate template/common/custom
   candidates. Already-declared or conflicting values suppress selectable
   duplicates.
6. Treat starter templates as secondary optional provenance. Matching a
   template may suggest a scalar value, but it never attaches or persists that
   template.
7. Do not fabricate common or custom values in the read path. Those sources are
   emitted only when a later server-owned provider validates bounded input.

## Pros And Cons

### One Server-Owned Projection

Pros:

- Stops the Vue client from inferring source semantics or disabled states.
- Bounds the API surface and prevents raw template/profile records from leaking
  through a display endpoint.
- Gives all picker consumers one contract to audit and test.

Cons:

- Requires a coordinated version change to the workflow reader and its client
  guard.
- Adds a small composition layer instead of allowing each UI control to source
  options independently.

### Conservative Common And Custom Sources

Pros:

- Avoids presenting a generic list as if it were library-derived identity.
- Keeps custom values behind a future server-side validation and persistence
  boundary.
- Preserves the media-server library as the primary source of destination
  context.

Cons:

- Common/custom options do not appear until a server-owned registry or custom
  input command supplies bounded candidates.
- Some sparse libraries still need an explicit operator decision instead of a
  guessed destination rule.

## Final Recommendation Stack

- `server/src/services/policyIntentSignalOptionProjection.mjs` composes
  source-labelled, bounded evidence and options, deduplicates by signal meaning,
  applies disabled states, and exposes an audit helper.
- `server/src/services/policyStarterTemplateSuggestions.mjs` owns reusable
  library/template matching and safely projects only supported `require_any`
  scalar values for optional provenance.
- `server/src/services/policyAuthoringOptionSelection.mjs` remains the
  validator for source/state behavior and now guards broad starter-template
  genres in addition to common/custom values.
- `server/src/services/policyOperatorWorkflowReadService.mjs` publishes
  workflow read contract v2 with `intentSignalProjection` under the observed
  profile.
- `client/src/composables/usePolicyOperatorWorkflow.js` and
  `client/src/components/policies/PolicyBuilderWorkflowShell.vue` accept only
  the v2 server display contract and pass the projection through to the
  presentation picker.
- `client/src/utils/policyIntentSignalDraft.js` remains a typed local command
  boundary; it does not determine source eligibility.

## Verification

- `server/src/__tests__/services/policyIntentSignalOptionProjection.test.mjs`
- `server/src/__tests__/services/policyStarterTemplateSuggestions.test.mjs`
- `server/src/__tests__/services/policyOperatorWorkflowReadService.test.mjs`
- `server/src/__tests__/policies-operator-workflow-read-routes.test.mjs`
- `client/src/__tests__/utils/policyIntentSignalDraft.test.js`
- `client/src/__tests__/utils/policyNativeEvidenceRecovery.test.js`
- `client/src/__tests__/composables/usePolicyOperatorWorkflow.test.js`
- `client/src/__tests__/IntentSignalPicker.test.js`
- `client/src/__tests__/PolicyBuilderWorkflowShell.test.js`
- `client/src/__tests__/PolicyBuilderModal.test.js`

## Outcome

Native policy creation now receives one audited, display-only intent-signal
projection. The normal path remains library-first: observed values are the
highest-priority candidate source, template suggestions are optional and
non-persistent, and generic/custom sources cannot become destination identity
until a server-owned validation path supplies them.

## Next Step

Implement a server-validated custom intent-signal entry command. It must accept
only bounded supported types, normalize and explain the operator value,
reevaluate the broad-identity guard against current library evidence, and return
the resulting candidate through this projection before it can reach the local
draft.
