# Policy Observed Suggestion Native Creation

## Status

Implemented for new policy creation.

## Problem

The connected media-server library is the source of truth for how a destination
is currently used, but current contents are not automatically durable policy
intent. A library can contain exceptions, historical mistakes, or incomplete
examples. The operator needs a small, understandable way to adopt useful
observations without being asked to build a policy from raw presets, JSON,
diagnostics, provider state, or scoring internals.

## Official Guidance Reviewed

- [W3C WAI: Grouping Controls](https://www.w3.org/WAI/tutorials/forms/grouping/)
  recommends a `fieldset` and `legend` for a related set of form controls. The
  selector uses that native structure for the candidate checkbox group.
- [W3C Technique H71](https://www.w3.org/WAI/WCAG21/Techniques/html/H71.html)
  describes semantic grouping for related controls and supports avoiding
  unnecessary nested groups. The selector has one compact purpose-selection
  group rather than separate mechanics panels.
- [GOV.UK Design System: Checkboxes](https://design-system.service.gov.uk/components/checkboxes/)
  recommends checkboxes for independent multiple selections, a visible
  "Select all that apply" label, and no preselection. Candidate values begin
  unchecked and require an explicit action.
- [W3C Technique ARIA19](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA19)
  documents live-region feedback for status changes. The selector announces
  selection and accepted-value state without moving focus.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends allowlist validation at the server boundary. The browser's typed
  command plan is treated as convenience only; the server independently
  validates native declared intent and transactionally establishes authority.

## Design

### Evidence Is Not Intent

`policyObservedSuggestionCandidates.mjs` derives two separate bounded outputs
from cached library-profile evidence:

1. Observations retain `observed_in_library` provenance and are display-only.
2. Selectable candidates have `suggested_from_observed_profile` provenance,
   require explicit acceptance, and set `canAutoDeclare` to `false`.

Only observed genres, studios, and keywords can become purpose candidates.
Ratings remain visible observations but cannot become a purpose rule through
this control. This prevents an incidental content rating from defining the
destination.

### Accessible Intent-Signal Boundary

`IntentSignalPicker.vue` renders normalized library evidence and source-labelled
intent-signal options as separate structures. Read-only evidence stays in its
own labelled region. Eligible suggestions use unchecked native checkboxes inside
one labelled fieldset, show their source, evidence count, and explanation, and
emit explicit typed `add_signal_value` or `remove_signal_value` plans.

`policyIntentSignalDraft.js` validates every command candidate again,
deduplicates it, and produces native `purpose` rules grouped by signal type.
No observation is preselected, persisted, learned, routed, or sent to a
provider as part of this interaction.

### Atomic Server Creation

`POST /api/policies` accepts an optional `native_intent_establishment` only
for a verified administrator and only when no legacy preset attachments are
present. `policyNativeIntentCreateContract.mjs` accepts only
`declared_intent`, generates an idempotency key server-side, and reuses the
native declared-intent schema validation. Its native-create request allowlist
also accepts only `library_id`, `name`, and `native_intent_establishment`, so
legacy thresholds, weights, trust flags, presets, and draft payloads cannot be
smuggled into a native policy. See [Policy Native Create Payload
Cutline](policy-native-create-payload-cutline.md).

The policy row and native initial establishment execute in one PostgreSQL
transaction through `applyPolicyInitialIntentEstablishmentInTransaction`.
If any authority, audit, rollback-snapshot, routing-target, or validation
write fails, policy creation rolls back as well. The response exposes only a
bounded establishment summary, never the raw declared-intent payload.

## Pros And Cons

Pros:

- Starts with current library evidence while preserving explicit operator
  authority over future destination meaning.
- Uses familiar, accessible multi-select controls without preselection.
- Keeps the browser on a typed local-draft boundary instead of mutating legacy
  preset structures.
- Prevents partial policy/native-intent creation with one transaction.
- Applies consistently across library names, media-server products, and
  operator naming conventions.

Cons:

- A single explicit acceptance action remains necessary because observation is
  evidence, not proof of desired future policy behavior.
- This first slice covers only identity-capable genres, studios, and keywords;
  hard limits, avoid rules, and learning remain separate, narrower tasks.
- Legacy starter templates cannot be combined with native initial establishment
  in one create operation.

## Final Recommendation Stack

1. Keep library observations as non-authoritative evidence.
2. Offer only bounded, identity-capable observed candidates through native
   checkbox groups with no preselection.
3. Translate explicit selection into typed client-side draft commands.
4. Validate and materialize the native declared intent only on the server.
5. Require one atomic transaction for policy creation and native authority
   establishment.

## Security Outcome

- Candidate sources, signal types, operators, and values are allowlisted on
  both client and server boundaries.
- The browser cannot supply an idempotency key, native audit metadata, routing
  target, or raw profile evidence for persistence.
- Native creation requires a verified administrator and rejects mixed legacy
  preset configuration.
- A failure cannot leave a policy row without the requested native authority.
- No selector operation calls a provider, consumes quota, learns from media,
  or routes media.

## Verification

- `server/src/__tests__/services/policyObservedSuggestionCandidates.test.mjs`
- `server/src/__tests__/services/policyNativeIntentCreateContract.test.mjs`
- `server/src/__tests__/services/policyInitialIntentEstablishmentService.test.mjs`
- `server/src/__tests__/policies-routes.coverage.test.mjs`
- `client/src/__tests__/utils/policyIntentSignalDraft.test.js`
- `client/src/__tests__/IntentSignalPicker.test.js`
- `client/src/__tests__/PolicyBuilderWorkflowShell.test.js`
- `client/src/__tests__/PolicyBuilderModal.test.js`
