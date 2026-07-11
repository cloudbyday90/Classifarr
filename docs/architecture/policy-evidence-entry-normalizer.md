# Policy Evidence Entry Normalizer

## Status

Implemented as the bounded field boundary for the policy evidence projection.

## Problem

The evidence engine receives snapshots from persisted media-server profiles,
operator intent, and bounded collectors. Its output can later reach audits,
workflow projections, and decision tracing. Type-only string normalization left
keys, labels, values, reason codes, and timestamps too permissive for that
cross-boundary contract. In particular, an incoming record could override a
source-owned reason code or carry unbounded/control-character text into the
projection.

## Guidance Reviewed

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends early server-side syntactic and semantic validation, canonical
  text normalization, allow-lists for structured fields, and maximum lengths.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends sanitizing event data, including carriage returns and line feeds,
  before it reaches logs or other observability systems.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-side enforcement of legal state combinations and resource
  limits. For this contract, a source adapter owns its reason code; an incoming
  record cannot redefine that meaning.

## Recommendation

Use one modular normalizer for every evidence entry before projection:

1. Canonicalize Unicode text and replace control characters with spaces.
2. Bound keys, labels, values, and reason codes.
3. Canonicalize keys and require allow-listed reason-code syntax.
4. Normalize timestamps to ISO-8601 UTC and reject object-valued display data.
5. Preserve source-owned reason codes instead of trusting a caller-provided
   override.
6. Audit generated and tampered entries before downstream consumers use a
   projection.

## Pros And Cons

Pros:

- Keeps evidence labels usable for legitimate Unicode media terminology.
- Prevents control-character log/trace injection and unbounded projection text.
- Preserves deterministic source semantics by preventing caller reason-code
  overrides.
- Adds no provider call, database access, learning, routing, or storage side
  effect.

Cons:

- Input-specific reason-code detail now belongs in trusted source adapters,
  rather than travelling through arbitrary records.
- The normalizer intentionally truncates oversized text; a later collection
  cardinality component should decide how to surface oversized input lists.

## Final Recommendation Stack

- Entry normalization:
  `server/src/services/policyEvidenceEntryNormalizer.mjs`
- Projection integration and instance audit:
  `server/src/services/policyEvidenceEngine.mjs`
- Focused tests:
  `server/src/__tests__/services/policyEvidenceEntryNormalizer.test.mjs`
  and `server/src/__tests__/services/policyEvidenceEngine.test.mjs`
- Design record:
  `docs/architecture/policy-evidence-entry-normalizer.md`

## Implemented Contract

`normalizePolicyEvidenceEntry` returns only bounded primitive fields:

```text
key
label
value
count
confidence
reasonCode
observedAt
stale
```

The normalizer uses the source adapter's `defaultReasonCode` and can retain an
incoming code only when that source's explicit allow-list includes it. The
engine supplies both values, so a persisted observation can preserve its
approved detail without allowing an arbitrary record to create a different
policy or learning meaning.

`buildPolicyEvidenceEntryAudit` checks the projected field contract. The
evidence projection audit reports `projection_entry_field_contract` when a
projection is later tampered with. The audit result contains stable risk IDs,
not raw entry text.

This component does not cap the number of input entries. Collection
cardinality is a separate boundary so the engine can expose a truthful
review-needed result instead of silently discarding evidence.
