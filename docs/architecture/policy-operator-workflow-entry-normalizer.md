# Policy Operator Workflow Entry Normalizer

## Status

Implemented as the display-only entry projection for the destination-first
operator workflow. It prevents raw evidence, provider, metadata, and diagnostic
payloads from entering the normal policy setup surface.

## Problem

The operator workflow marked each entry `includesRawPayload: false`, but its
local mapper forwarded `entry.value` unchanged. An object-valued entry could
therefore carry raw data into the normal UI despite the claimed safety flag.

## Design

```text
bounded intent entry
  -> workflow entry normalizer
  -> display-only entry and entry audit
  -> destination-first workflow section
```

The normalizer retains only a bounded key, label, primitive display value,
known authority source, declared/observed markers, reason code, and evidence
count. Object-valued values become `null`; entries with no display value are
dropped. Provider payloads, metadata, request/response objects, and diagnostic
fields are not projected. The workflow audit now validates each actual entry
shape instead of relying only on a raw-payload flag.

## Official Guidance Reviewed

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side allowlists and bounded validation before data reaches
  application functions. The normalizer allows display primitives only and
  keeps provenance within the known authority vocabulary.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends excluding or sanitizing sensitive event data. The projection omits
  raw payloads and removes control whitespace from display text.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends enforcing legal data combinations server-side. The workflow audit
  rejects object-valued or payload-bearing entries even if a caller sets a
  safe-looking flag.

## Recommendations

1. Project intent entries through this normalizer before any normal workflow,
   Discord, or settings surface uses them.
2. Use labels and bounded primitive values only; detailed evidence belongs in a
   separate maintainer-scoped contract.
3. Validate each returned entry during workflow audit; never trust a claimed
   `includesRawPayload` flag.
4. Keep authority source IDs allowlisted so a display entry cannot invent
   provenance.

## Pros And Cons

Pros:

- Removes a raw-object leakage path from the normal workflow.
- Keeps destination setup simple and display-oriented.
- Makes entry safety independently testable and reusable.
- Preserves the five-section workflow and one action per section.

Cons:

- Detailed object-valued evidence is intentionally unavailable to normal
  workflow consumers.
- Consumers needing diagnostic detail must use an explicitly scoped maintainer
  contract.

## Final Recommendation Stack

1. `policyIntentEngine.mjs` produces bounded intent entries.
2. `policyOperatorWorkflowEntryNormalizer.mjs` projects display-safe entries.
3. `policyOperatorWorkflow.mjs` builds the five destination-first sections.
4. Client components render those sections without interpreting raw evidence.

## Security Outcome

- Object values and raw provider/diagnostic fields cannot enter normal workflow
  entries.
- Display text is bounded and control whitespace is removed.
- Authority provenance is restricted to the shared known vocabulary.
- The workflow audit detects tampered raw entry fields, direct execution,
  persistence, and diagnostic-surface regressions.
- The normalizer has no provider, routing, storage, learning, or policy-write
  side effect.

## Verification

Focused tests cover raw object removal, authority/source projection, missing
display entries, tampered payload detection, and full workflow integration.

## Next Step

Continue with the migration and deletion path: classify which legacy
preview/replay surfaces can be removed once bounded evidence, readiness, and
operator workflow contracts have replacement coverage.
