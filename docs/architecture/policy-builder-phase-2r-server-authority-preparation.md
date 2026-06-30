# Policy Builder Phase 2R Server Authority Preparation

Date: 2026-06-30

## Purpose

Phase 2R.5 defines how the policy-builder draft bridge defers authority to
server-owned contracts. The browser may provide command validation and helpful
read-model feedback, but final policy validity, native-intent acceptance,
warning reason codes, and future engine projections must be server-owned.

This task does not enable native intent persistence, alter policy routing,
execute Arr writes, change classification scoring, or promote client draft state
to durable policy authority.

## Official Research Inputs

- Vue component events documentation supports explicit event contracts and
  payload validation for UI boundaries:
  https://vuejs.org/guide/components/events.html
- Vue composables documentation recommends extracting reusable stateful logic
  behind clear boundaries:
  https://vuejs.org/guide/reusability/composables.html
- OWASP Input Validation guidance recommends server-side semantic validation at
  trust boundaries:
  https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- OWASP Mass Assignment guidance recommends allow-listing accepted fields rather
  than binding arbitrary client-provided properties:
  https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html
- NIST SSDF SP 800-218 recommends secure design review, implementation
  criteria, and verification:
  https://csrc.nist.gov/pubs/sp/800/218/final

## Recommendations

1. Keep client validation UX-only.
   Client command and view checks should prevent obvious bad edits early, but
   they cannot decide durable policy validity.

2. Keep server request validation authoritative.
   `policyIntentDraft` can be included in save payloads, but the server request
   schema remains the authority for accepted shape, size, enums, and semantic
   bucket rules.

3. Keep preflight diagnostics sanitized.
   Responses may report schema version, source, migration state, and preset
   count, but should not echo raw draft payloads.

4. Align warning reason codes with server contracts.
   Draft warnings should use server-side names such as
   `hard_limit_requires_strict_constraint`, `helpful_hint_cannot_be_strict`,
   `avoid_should_be_exclusion`, and `legacy_preset_partial_inference` where
   possible.

5. Prepare server insertion points before native storage.
   Phase 5R should own contract validation, Phase 6R should own read-only
   profile-to-intent suggestions, and Phase 8R should own native storage
   replacement after parity and rollback gates.

## Pros And Cons

Pros:

- Prevents the browser draft from becoming accidental policy authority.
- Gives the write route and request validator explicit insertion points for
  Phase 5R and Phase 8R.
- Lets save payloads include explicit draft intent without trusting client
  inference or echoing raw drafts.
- Preserves current legacy bridge behavior while preparing native storage.
- Gives Phase 6R a controlled place to add server-generated suggestions.

Cons:

- Adds authority metadata before native storage exists.
- Current writes still persist through legacy preset/custom-signal storage.
- Profile-to-intent suggestions remain planned, not implemented, until Phase
  6R.

## Final Recommendation Stack

- Server authority contract:
  `server/src/services/policyBuilderPhase2ServerAuthorityPreparation.mjs`
- Existing request authority:
  `server/src/services/policyIntentRequestValidator.mjs`
- Existing route preflight:
  `server/src/routes/policiesRoutePolicyWrite.mjs`
- Existing intent contract validation:
  `server/src/services/policyIntentSchema.mjs`
- Current native storage mode:
  `legacy_bridge_only`
- Future insertion points:
  - Phase 5R: policy intent contract validator,
  - Phase 6R: profile-to-intent suggestion provider,
  - Phase 8R: native intent storage mapper.

## Implemented Outcome

The Phase 2R.5 implementation now provides:

- an authority responsibility inventory that separates client UX guardrails,
  route preflight, server request validation, intent contract validation,
  legacy bridge serialization, Phase 6R suggestions, and Phase 8R storage,
- server insertion point records for route preflight, request validation,
  contract validation, profile suggestions, and native storage mapping,
- a sanitized server-authority preflight wrapper for explicit draft intent,
- server warning reason-code inventory aligned with current intent validation,
- a native-storage replacement plan that preserves product draft/view/command
  contracts while storage changes underneath.

## Verification

Focused tests:

- `server/src/__tests__/services/policyBuilderPhase2ServerAuthorityPreparation.test.mjs`

Adjacent tests:

- `server/src/__tests__/services/policyIntentRequestValidator.test.mjs`
- `server/src/__tests__/services/policyIntentSchema.test.mjs`
- `server/src/__tests__/services/policyIntentContract.test.mjs`
- `server/src/__tests__/services/policyBuilderPhase2DraftViewProjection.test.mjs`
- `server/src/__tests__/services/policyBuilderPhase2DraftCommandBoundary.test.mjs`

The tests assert:

- client draft checks are non-authoritative,
- server request validation and contract validation are authoritative,
- insertion points are declared and block raw draft echo,
- explicit draft payloads produce sanitized preflight diagnostics,
- native intent persistence remains disabled,
- Phase 5R, Phase 6R, and Phase 8R insertion points are visible,
- native storage replacement can happen without rewriting product components.

## Next Phase

Continue with Phase 2R.6 Draft Parity And Regression Tests. That task should
audit the current draft/bridge/view tests so they protect compatibility and
authority boundaries without freezing transitional UI or legacy-first internals.
