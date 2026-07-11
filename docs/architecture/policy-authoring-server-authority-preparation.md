# Policy Authoring Server Authority Preparation

Date: 2026-06-30
Updated: 2026-07-10

## Purpose

Policy authoring must treat the server as the authority for accepted draft
shape, semantic validation, persistence readiness, warning reason codes, and
future engine projections. Browser controls can make authoring fast and clear,
but they remain UX guardrails. They do not decide durable policy validity.

This boundary does not enable native intent persistence, alter classification
routing, execute Arr writes, change classification scoring, or promote client
draft state to storage authority.

## Official Research Inputs

- OWASP Input Validation guidance recommends semantic server-side validation at
  trust boundaries:
  https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- OWASP Mass Assignment guidance recommends allow-listing accepted fields
  instead of binding arbitrary client properties:
  https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html
- OWASP REST Security guidance recommends validating request payloads, request
  sizes, and content types for APIs:
  https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
- Express security best practices recommend explicit production hardening and
  safe dependency posture:
  https://expressjs.com/en/advanced/best-practice-security/
- Express body-parser documentation exposes request-size limits as a first-class
  API boundary control:
  https://expressjs.com/en/resources/middleware/body-parser/
- NIST SSDF SP 800-218 recommends secure design review, implementation
  criteria, and verification:
  https://csrc.nist.gov/pubs/sp/800/218/final

## Recommendations

1. Keep client validation UX-only.
   Client command and view checks should prevent obvious bad edits early, but
   durable validity comes from server-owned contracts.

2. Keep server request validation authoritative.
   `policyIntentDraft` may be included in save payloads, but the server request
   schema owns accepted shape, enum values, source metadata, and semantic bucket
   rules.

3. Keep preflight diagnostics sanitized.
   Responses may report schema version, source, migration state, persistence
   mode, and allowed future fields, but must not echo raw draft payloads.

4. Use stable product boundary names.
   The implementation should describe responsibility owners, insertion points,
   warning reasons, and readiness gates with product concepts instead of
   temporary roadmap phase numbers.

5. Prepare native storage without enabling it.
   The authority record should define the migration, rollback, and parity gates
   that must pass before native intent storage can replace the legacy bridge.

6. Make authority drift executable.
   The audit should fail if client guardrails become authoritative, server
   responsibilities lose authority, insertion points echo raw drafts, warning
   reason codes disappear, native-storage steps are missing, or native storage
   is enabled before migration readiness.

## Pros And Cons

Pros:

- Prevents the browser draft from becoming accidental policy authority.
- Gives the write route and request validator explicit server insertion points.
- Lets save payloads include explicit draft intent without trusting client
  inference or echoing raw drafts.
- Preserves legacy bridge behavior while preparing native storage.
- Gives future profile-to-intent suggestions a controlled, server-owned
  boundary.

Cons:

- Adds authority metadata before native storage exists.
- Current writes still persist through legacy preset/custom-signal storage.
- Profile-to-intent suggestions remain planned until the engine projection
  provider exists.
- The audit validates ownership and insertion-point safety; it does not replace
  full request-schema validation or storage migrations.

## Final Recommendation Stack

- Server authority contract:
  `server/src/services/policyAuthoringServerAuthorityPreparation.mjs`
- Existing request authority:
  `server/src/services/policyIntentRequestValidator.mjs`
- Existing route preflight:
  `server/src/routes/policiesRoutePolicyWrite.mjs`
- Existing intent contract validation:
  `server/src/services/policyIntentSchema.mjs`
- Current native storage mode:
  `legacy_bridge_only`
- Planned server boundaries:
  - policy intent contract validator,
  - profile-to-intent suggestion provider,
  - native intent storage mapper.

## Implemented Outcome

The policy authoring server authority preparation implementation now provides:

- an authority responsibility inventory that separates client UX guardrails,
  route preflight, server request validation, intent contract validation,
  legacy bridge serialization, profile-to-intent suggestions, and native intent
  storage,
- server insertion point records for route preflight, request validation,
  contract validation, profile suggestions, and native storage mapping,
- durable owner names such as `policy_engine_projection` and
  `native_intent_storage`,
- product-boundary insertion point metadata through `targetBoundaryId`,
- a sanitized server-authority preflight wrapper for explicit draft intent,
- server warning reason-code inventory aligned with current intent validation,
- a native-storage replacement plan that preserves product draft/view/command
  contracts while storage changes underneath,
- an executable server-authority audit that fails unknown responsibilities or
  owners, missing module boundaries, client guardrails marked authoritative,
  server responsibilities marked non-authoritative, authoritative records
  without insertion points, insertion points that echo raw drafts, premature
  native storage activation, missing warning reason codes, and missing
  native-storage replacement steps.

## Verification

Focused tests:

- `server/src/__tests__/services/policyAuthoringServerAuthorityPreparation.test.mjs`

Adjacent tests:

- `server/src/__tests__/services/policyIntentRequestValidator.test.mjs`
- `server/src/__tests__/services/policyIntentSchema.test.mjs`
- `server/src/__tests__/services/policyIntentContract.test.mjs`
- `server/src/__tests__/services/policyAuthoringDraftViewProjection.test.mjs`
- `server/src/__tests__/services/policyAuthoringDraftCommandBoundary.test.mjs`

The tests assert:

- client draft checks are non-authoritative,
- server request validation and contract validation are authoritative,
- insertion points are declared and block raw draft echo,
- explicit draft payloads produce sanitized preflight diagnostics,
- native intent persistence remains disabled,
- contract, profile-suggestion, and native-storage insertion points are visible,
- native storage replacement can happen without rewriting product components,
- authority inventory drift fails before later server contracts depend on it.

## Next Component

Continue with the policy authoring draft parity and regression inventory cutover.
That work should protect compatibility and authority boundaries without freezing
transitional UI or legacy-first internals.
