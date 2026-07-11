# Policy Authoring Legacy Bridge Boundary Module Cutover

Date: 2026-07-10

## Purpose

The legacy bridge boundary has been cut over from phase-coded naming to durable
policy-authoring naming. It remains a compatibility boundary, not product
policy authority: it owns the controlled conversion between draft data and the
legacy payload shape until native policy intent storage is safely live.

## Official Research Inputs

- OWASP Mass Assignment Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html
- OWASP Input Validation Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- OWASP REST Security Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
- NIST Secure Software Development Framework SP 800-218:
  https://csrc.nist.gov/pubs/sp/800/218/final

## Recommendations

1. Keep raw legacy payload mutation inside one bridge-owned serializer.
2. Keep serialized keys and unsupported-preservation keys separately
   allow-listed, rejecting unsafe or overlapping keys.
3. Keep compatibility removal gated on native storage, lossless conversion,
   rollback, read/write parity, write shutdown, backup/restore, and regression
   coverage.
4. Use product-stable boundary names for the service, tests, and diagnostics.

OWASP recommends allow-listed request and transfer fields, and server-side
validation at the earliest trusted boundary. The existing bridge audit embodies
that approach by rejecting unsafe keys and unowned serializer responsibilities.

## Tradeoffs

Pros:

- The contract remains understandable after the implementation roadmap ends.
- The active serializer imports its durable boundary directly, without a
  temporary compatibility shim.
- The audit continues to fail closed on unsafe serialization and missing
  removal gates.

Cons:

- The bridge still exists until native storage satisfies every removal gate.
- Some adjacent draft-contract code retains its own phase-coded names and must
  be refactored independently to avoid mixing unrelated contract changes.

## Implemented Outcome

- Renamed the service to
  `server/src/services/policyAuthoringLegacyBridgeBoundary.mjs`.
- Renamed the focused test to
  `server/src/__tests__/services/policyAuthoringLegacyBridgeBoundary.test.mjs`.
- Renamed the design record to
  `docs/architecture/policy-authoring-legacy-bridge-boundary.md`.
- Replaced phase-prefixed exports, functions, audit diagnostics, and lifecycle
  text with policy-authoring and native-storage terminology.
- Updated `policyAuthoringBridgeSerializer.mjs` to import the durable boundary
  directly.
- Updated the compatibility regression inventory to follow the renamed focused
  test path.

## Verification

Focused verification:

- `server/src/__tests__/services/policyAuthoringLegacyBridgeBoundary.test.mjs`
- `server/src/__tests__/services/policyAuthoringDraftCommandBoundary.test.mjs`

Supporting verification:

- policy-builder production-name inventory;
- documentation lint; and
- Git whitespace check.

## Next Component

Cut over the policy authoring draft contract family. Its active service and
focused tests still use phase-coded draft field, authority, and validation
identifiers that feed this legacy bridge boundary.
