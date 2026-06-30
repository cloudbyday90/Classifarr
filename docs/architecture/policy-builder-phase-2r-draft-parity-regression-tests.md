# Policy Builder Phase 2R Draft Parity And Regression Tests

Status: implemented as the sixth Phase 2R draft/bridge contract.

## Scope

Phase 2R.6 closes the draft bridge phase by protecting compatibility without
locking Classifarr into the transitional policy-builder UI. The draft remains an
editing projection. Server validation remains authoritative. Native intent
storage remains disabled until Phase 8R migration gates pass.

This document covers the implemented Phase 2R.6 regression contract only. It
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

1. Keep Phase 2R tests centered on contract behavior:
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
4. Mark old diagnostic or advanced legacy UI tests as Phase 6R/8R rewrite or
   deletion candidates rather than treating them as permanent product contracts.
5. Keep server validation authoritative even when the client prevents obvious
   UI-only leakage.

## Pros And Cons

### Contract-Oriented Tests

Pros:

- Protects behavior that matters across refactors.
- Avoids freezing the old builder layout.
- Makes future Phase 3R and Phase 6R UI simplification safer.

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
- Gives Phase 6R and Phase 8R a concrete cleanup list.

Cons:

- Requires later phases to actively remove or rewrite those candidates.

## Final Recommendation

Use a layered regression stack:

- Client utility tests verify command and payload behavior.
- Vue component tests verify emitted commands and operator interactions.
- Server contract tests verify the architecture boundary and suite coverage.
- Server request validation remains the authority for persisted payload shape.

This keeps Phase 2R complete without adding another operator-facing surface or
promoting the client draft into durable authority.

## Implementation

The Phase 2R.6 implementation now provides:

- `server/src/services/policyBuilderPhase2DraftParityRegression.mjs`
  - lists required Phase 2R parity rules,
  - maps current tests to those rules,
  - identifies Phase 6R/8R rewrite/delete candidates,
  - validates that required regression coverage exists,
  - verifies the client draft is not considered durable authority.
- `server/src/__tests__/services/policyBuilderPhase2DraftParityRegression.test.mjs`
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

## Phase 2R.6 Checklist Result

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

## Next Step

Phase 2R is complete. Continue with **Phase 3R.1 Workflow Inventory And
Cutline** so the policy-builder UI can be rebuilt around the simpler operator
flow without carrying forward transitional diagnostic surfaces.
