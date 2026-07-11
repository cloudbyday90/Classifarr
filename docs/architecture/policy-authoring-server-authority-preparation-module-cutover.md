# Policy Authoring Server Authority Preparation Module Cutover

Date: 2026-07-10

## Purpose

The server authority preparation module was cut over from phase-coded naming to
durable policy-authoring naming. This keeps the active implementation aligned
with the re-imagined policy-authoring model: client drafts are UX projections,
and server contracts own validation, warning reason codes, storage readiness,
and downstream authority boundaries.

## Official Research Inputs

- OWASP Mass Assignment Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html
- OWASP REST Security Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
- Express security best practices:
  https://expressjs.com/en/advanced/best-practice-security/
- Express body-parser request-size limits:
  https://expressjs.com/en/resources/middleware/body-parser/
- NIST Secure Software Development Framework SP 800-218:
  https://csrc.nist.gov/pubs/sp/800/218/final

## Recommendations

1. Keep module names product-stable.
   Runtime services and tests should use `policyAuthoring*` names instead of
   temporary roadmap labels.

2. Keep response diagnostics allow-listed.
   Preflight output should expose only the schema/version/mode fields operators
   need and should not echo raw draft payloads.

3. Keep readiness fields explicit.
   Native storage must remain disabled until migration, rollback, and parity
   gates pass.

4. Keep future insertion points named by boundary.
   Planned engine and storage insertion points should use `targetBoundaryId`
   rather than implementation-phase metadata.

## Implemented Outcome

- Renamed the focused service and test to:
  - `server/src/services/policyAuthoringServerAuthorityPreparation.mjs`
  - `server/src/__tests__/services/policyAuthoringServerAuthorityPreparation.test.mjs`
- Replaced phase-coded owner ids with `policy_engine_projection` and
  `native_intent_storage`.
- Replaced roadmap-phase target metadata with `targetBoundaryId`.
- Replaced phase-specific preflight keys with:
  - `intent_contract_schema_version`
  - `profile_suggestion_field_ids`
- Replaced premature native-storage audit naming with migration-readiness
  terminology.
- Updated the architecture record and roadmap links to the durable module name.

## Verification

Focused verification:

- `server/src/__tests__/services/policyAuthoringServerAuthorityPreparation.test.mjs`

Supporting verification:

- production-name inventory
- documentation lint
- Git whitespace check

## Next Component

Cut over the draft parity and regression inventory family so its public service,
test, and design record protect policy-authoring compatibility without keeping
phase-coded runtime names.
