# Policy Authoring Compatibility Regression Inventory

Status: implemented compatibility regression contract.

## Scope

The compatibility regression inventory protects the draft bridge without locking
Classifarr into a transitional policy-builder UI. The draft remains an editing
projection, server validation remains authoritative, and native intent storage
remains disabled until its migration, rollback, and parity gates pass.

This document covers the implemented compatibility regression contract only. It
does not define runtime learning, replay execution, evidence generation, policy
storage migration, or provider readiness.

## Current Best-Practice Inputs

Official sources reviewed for this checkpoint:

- Vitest Guide: https://vitest.dev/guide/
- Vue Test Utils Guide: https://test-utils.vuejs.org/
- OWASP Mass Assignment Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html
- OWASP Input Validation Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- NIST Secure Software Development Framework SP 800-218:
  https://csrc.nist.gov/pubs/sp/800/218/final

The relevant guidance is consistent:

- Regression tests should verify externally meaningful behavior, not incidental
  implementation or layout details.
- Component tests should exercise user-facing interactions and emitted events,
  while shared utilities should own deterministic transformation coverage.
- Sensitive or untrusted payload fields should be allow-listed rather than
  accepted by object spreading.
- Secure development should define abuse-resistant contracts and test them as
  part of normal change validation.

## Recommendation Stack

1. Keep compatibility tests centered on contract behavior:
   - no-op legacy save parity,
   - typed command emission,
   - read-only projection protection,
   - bridge serialization allow-lists,
   - raw legacy storage hiding,
   - provenance preservation,
   - UI-only field exclusion.
2. Add a server-owned regression audit contract that records which tests prove
   each Phase 2R rule.
3. Harden the client save payload builder so it serializes only known policy form
   fields before adding presets and the explicit `policyIntentDraft`.
4. Mark old diagnostic or advanced legacy UI tests as policy-engine rewrite or
   native-storage removal candidates rather than treating them as permanent
   product contracts.
5. Keep server validation authoritative even when the client prevents obvious
   UI-only leakage.

## Pros And Cons

### Contract-Oriented Tests

Pros:

- Protects behavior that matters across refactors.
- Avoids freezing the old builder layout.
- Makes future UI simplification safer.

Cons:

- Does not prove every visual detail.
- Requires maintaining a small audit inventory as files move.

### Client Save Payload Allow-List

Pros:

- Prevents accidental UI-only or read-only projection fields from leaving the
  browser.
- Aligns with the existing server-side payload boundary.
- Reduces mass-assignment risk before request validation.

Cons:

- New form fields must be added through `createDefaultPolicyForm` before they
  serialize.
- The allow-list is not a replacement for server validation.

### Rewrite/Delete Candidate Tracking

Pros:

- Makes temporary diagnostic tests visible instead of silently permanent.
- Gives policy-engine and native-storage cutovers a concrete cleanup list.

Cons:

- Requires later phases to actively remove or rewrite those candidates.

## Final Recommendation

Use a layered regression stack:

- Client utility tests verify command and payload behavior.
- Vue component tests verify emitted commands and operator interactions.
- Server contract tests verify the architecture boundary and suite coverage.
- Server request validation remains the authority for persisted payload shape.

This keeps the compatibility boundary complete without adding another
operator-facing surface or promoting the client draft into durable authority.

## Implementation

The compatibility regression inventory provides:

- `server/src/services/policyAuthoringCompatibilityRegressionInventory.mjs`
  - lists required policy-authoring compatibility rules,
  - maps current tests to those rules,
  - identifies policy-engine rewrite and native-storage removal candidates,
  - validates that required regression coverage exists,
  - verifies the client draft is not considered durable authority.
- `server/src/__tests__/services/policyAuthoringCompatibilityRegressionInventory.test.mjs`
  - pins the audit inventory,
  - verifies every listed test file exists,
  - blocks snapshot-style legacy layout freezes,
  - proves every required Phase 2R rule has coverage.
- `client/src/composables/usePolicyBuilderState.js`
  - now serializes save payload form fields through an explicit allow-list
    derived from `createDefaultPolicyForm`.
- `client/src/__tests__/composables/usePolicyBuilderState.test.js`
  - now proves UI-only transient fields, read-only projections, and raw legacy
    payload placeholders do not serialize from the client save helper.

## Compatibility Checklist Result

| Check | Result |
| --- | --- |
| No-op legacy saves remain covered | Yes; bridge and state tests remain listed as required parity coverage. |
| Product components emit typed commands | Yes; editor and draft command tests are listed. |
| Commands cannot mutate read-only projections | Yes; command boundary and view projection tests are listed. |
| Bridge serialization is allow-listed | Yes; bridge isolation and request validation tests are listed. |
| Draft view hides raw legacy storage | Yes; client and server view projection tests are listed. |
| Provenance survives projection and serialization | Yes; bridge, view, editor parity, and chip tests are listed. |
| UI-only transient fields do not serialize | Yes; client payload and server payload-boundary tests are listed. |
| Old diagnostic UI is not frozen | Yes; diagnostic tests are marked as rewrite/delete candidates and snapshot freezes are rejected. |

## Next Component

Cut over the legacy bridge isolation service and focused test. The inventory
still tracks that bridge test by its phase-coded filename, so renaming the
bridge boundary is the next direct reduction in durable-code naming debt.
