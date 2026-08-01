# Policy Constraint Value Eligibility

Status: implemented as the server-owned allowlist for native constraint draft
values.

## Scope

`policy.constraint_value_eligibility.v1` is a display-only projection emitted
with the operator workflow read. It supplies the exact values that the native
policy builder may stage locally for each existing constraint control:

- movie libraries receive the runtime movie certification order for `hard_limit`
  and `avoid`;
- television libraries receive the runtime television certification order for
  those controls; and
- all supported libraries receive the four bounded `review_warning` reasons.

The server derives the media-type family from the connected library and audits
the complete projection against that family. An unsupported or unknown media
type returns `unsupported_library_media_type` with no controls. This fails
closed rather than presenting a generic or free-form rating field.

The projection is deliberately separate from
`policy.constraint_decision_model.v1`: the decision model defines what each
constraint means, while eligibility defines the values that can be selected.
Neither projection authorizes persistence, routing, runtime evaluation,
learning, provider calls, quota reads, or client-added values. Constraint
commands remain local-only at this stage.

## Official Guidance Reviewed

The following official sources were reviewed for this design, current through
June 2026:

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends canonicalization, allowlists for fixed option sets, bounds, and
  independent server-side validation.
- [OWASP Mass Assignment Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html)
  recommends explicit bindable fields and DTO-style boundaries instead of
  accepting arbitrary client object properties.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  recommends validating type, range, format, unexpected content, and workflow
  preconditions at the server boundary.
- [W3C WAI: Labeling Controls](https://www.w3.org/WAI/tutorials/forms/labels/)
  recommends explicitly associated labels for form controls.
- [W3C WAI Forms Developer Curriculum](https://www.w3.org/WAI/curricula/developer-modules/forms/)
  recommends native controls and field grouping to preserve keyboard and
  assistive-technology behavior.

## Recommendations

1. Publish a versioned per-library allowlist from the server; do not hard-code
   rating or review-warning choices in the browser.
2. Use the same canonical certification order that runtime policy code already
   owns. Do not introduce a second rating vocabulary or silently include
   unsupported values such as `NR`.
3. Validate projection shape, authority fields, control IDs, selection mode,
   and option uniqueness on both the server output audit and the client display
   boundary. A later write endpoint must rederive and validate again.
4. Use native labelled `<select>` controls with a disabled empty choice. Do not
   offer a free-text fallback when a library media type is unsupported.
5. Keep the selected command local and exclude it from the create payload until
   a separate server-authorized write contract exists.

## Pros And Cons

### Server-Owned Canonical Allowlist

Pros:

- The UI stays aligned with the deterministic runtime certification order.
- A browser cannot stage a rating or review reason outside the active library's
  approved vocabulary.
- Unknown media types fail safely without assumptions about an operator's
  library naming or configuration.

Cons:

- Supporting a new media type requires a deliberate server contract update.
- The workflow read version changes when the projection contract changes.

### Native Select Controls

Pros:

- Operators see the valid choices immediately and cannot type an unsupported
  value.
- Native select behavior supplies established keyboard and accessibility
  semantics.
- Confirmation remains tied to the current selected blocker or avoid value.

Cons:

- The controls cannot accept bespoke text values, by design.
- An unsupported library type has no temporary UI workaround.

## Final Recommendation Stack

- `server/src/services/policyEngineUtils.mjs` remains the canonical runtime
  certification ordering source.
- `server/src/services/policyConstraintValueEligibility.mjs` derives and audits
  the immutable, media-type-aware eligibility projection.
- `server/src/services/policyOperatorWorkflowReadService.mjs` publishes that
  projection in `policy.operator_workflow_read.v4` without write authority.
- `client/src/utils/policyIntentConstraintValueEligibility.js` validates the
  display contract and resolves approved controls and values.
- `client/src/utils/policyIntentConstraintDraft.js` requires a value to be in
  the approved projection before creating or retaining a typed local command.
- `client/src/components/policies/PolicyIntentConstraintControlSurface.vue`
  renders labelled native selects only from the server projection.
- The next server write contract must independently rederive the decision and
  eligibility projections before accepting a constraint command.

## Verification

- `server/src/__tests__/services/policyConstraintValueEligibility.test.mjs`
- `server/src/__tests__/services/policyOperatorWorkflowReadService.test.mjs`
- `client/src/__tests__/utils/policyIntentConstraintValueEligibility.test.js`
- `client/src/__tests__/utils/policyIntentConstraintDraft.test.js`
- `client/src/__tests__/utils/policyIntentConstraintControlSurface.test.js`
- `client/src/__tests__/PolicyIntentConstraintControlSurface.test.js`

## Outcome

Native constraint controls now use a bounded, media-type-aware server allowlist
and fail closed when Classifarr cannot establish a safe canonical value family.
The selected values remain transient and cannot yet change policy or runtime
state.

## Next Step

Evaluate the existing readiness contract against the new non-persistent
constraint-admission boundary. The normal workflow should surface one
product-language next action without exposing storage, runtime, provider, or
diagnostic implementation detail.
