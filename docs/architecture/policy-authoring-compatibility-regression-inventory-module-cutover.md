# Policy Authoring Compatibility Regression Inventory Module Cutover

Date: 2026-07-10

## Purpose

This cutover renames the draft parity regression inventory to a durable
policy-authoring compatibility boundary. Its purpose has not changed: keep
compatibility and authority contracts observable while avoiding tests that
freeze a temporary policy-builder experience.

## Official Research Inputs

- OWASP Mass Assignment Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html
- OWASP REST Security Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
- OWASP Input Validation Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- NIST Secure Software Development Framework SP 800-218:
  https://csrc.nist.gov/pubs/sp/800/218/final

## Recommendation

Use a stable regression inventory that names the product contracts it checks:

1. compatibility-preserving no-op saves;
2. typed command boundaries and immutable read projections;
3. allow-listed client and server serialization;
4. server-owned persistence authority; and
5. explicit transition candidates for temporary diagnostic surfaces.

This matches OWASP's recommendation to allow-list editable fields and validate
untrusted data at the server boundary. It also aligns with NIST SSDF's
expectation that security-relevant behavior is verified and documented as part
of normal development.

## Tradeoffs

Pros:

- The audit remains meaningful after roadmap work is complete.
- Consumers can distinguish policy-engine rewrites from native-storage removals
  without knowing historical phase labels.
- Existing behavioral coverage remains intact during refactoring.

Cons:

- Historical roadmap sections still need to explain where the inventory was
  introduced.
- The inventory intentionally tracks a remaining phase-coded legacy bridge
  test until that boundary receives its own cutover.

## Implemented Outcome

- Renamed the service to
  `server/src/services/policyAuthoringCompatibilityRegressionInventory.mjs`.
- Renamed the focused test to
  `server/src/__tests__/services/policyAuthoringCompatibilityRegressionInventory.test.mjs`.
- Renamed the design record to
  `docs/architecture/policy-authoring-compatibility-regression-inventory.md`.
- Replaced phase-prefixed public constants, function names, completion fields,
  action IDs, and diagnostics with policy-authoring compatibility terms.
- Replaced phase-specific rewrite/delete decisions with `rewrite_for_policy_engine`
  and `remove_after_native_storage_cutover`.
- Preserved immutable records, rule-coverage checks, missing-rule fail-closed
  behavior, test-file existence checks, and snapshot-freeze protection.

## Verification

Focused verification:

- `server/src/__tests__/services/policyAuthoringCompatibilityRegressionInventory.test.mjs`

Supporting verification:

- policy-builder production-name inventory;
- documentation lint; and
- Git whitespace check.

## Next Component

Cut over the legacy bridge isolation service and focused test. The
compatibility inventory still refers to that phase-coded test path, so it is
the next bounded product-contract rename.
