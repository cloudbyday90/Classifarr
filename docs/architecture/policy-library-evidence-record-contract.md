# Policy Library Evidence Record Contract

## Status

Implemented July 2026.

## Scope

This record hardens the read-only library evidence collectors used by the Phase
6R.1 evidence envelope. It does not change collector queries, database schema,
provider calls, routing, learning, policy storage, or user interfaces.

## Problem

The evidence projection normalizer validates entries after the envelope is
assembled. Individual collector audits previously checked collection counts,
source-specific facts, and side effects, but did not consistently reject a
tampered returned record with an unexpected field, malformed numeric value, or
reason code owned by a different source.

That left the collector boundary less precise than the downstream projection
boundary. The normalizer remained protective, but malformed records were not
identified at their source.

## Official Guidance Reviewed

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends early syntactic and semantic validation, with allowlists for
  fixed structured inputs. Each collector now validates a bounded allowlist of
  record fields and source-owned reason codes.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-side derivation of security-relevant values and explicit
  invariants. Collectors continue to derive records from persisted data and
  verify their own output before it is aggregated.
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports defined secure interfaces and verification. The reusable contract
  gives every collector the same primitive-field and audit behavior.

## Decision

Use one modular ESM contract for every returned collector record. A valid record
contains exactly these primitive fields:

```text
key
label
value
count
confidence
observedAt
reasonCode
```

The contract requires canonical evidence-entry fields, a non-negative integer
count, `null` or a zero-to-one confidence value, no extra fields, and a reason
code from the allowlist supplied by the owning collector.

The contract audits output only. It does not normalize or silently drop fields,
so a regression remains visible to the collector audit and its caller fails
closed.

## Implementation

- `server/src/services/policyLibraryEvidenceRecordContract.mjs`
  provides record and collection audit helpers.
- Outcome, pending-answer, routing-outcome, and metadata collectors each pass
  their fixed source-owned reason-code allowlist into the shared helper.
- Manual correction records now explicitly include `value: null`, matching the
  canonical bounded entry shape rather than relying on downstream defaults.
- Focused tests cover unexpected payload fields, unsupported reason codes,
  malformed confidence, and collection index reporting.

## Pros And Cons

### Pros

- Rejects malformed facts at the closest server-owned boundary.
- Makes all collector output shapes consistent and auditable.
- Prevents arbitrary nested data from being accepted as a collector record.
- Reuses the existing evidence entry normalizer instead of duplicating text,
  key, timestamp, and control-character rules.

### Cons

- New collector fields require an intentional contract update.
- Future collectors must define their fixed reason-code allowlist before their
  audits can pass.

## Final Recommendation Stack

1. Keep query and row-to-fact logic in source-specific collector modules.
2. Audit the returned primitive record shape with
   `policyLibraryEvidenceRecordContract.mjs`.
3. Keep reason-code ownership in the source-specific collector.
4. Let the evidence envelope assign source and authority provenance.
5. Keep projection normalization as a downstream defense-in-depth boundary.

## Verification

```text
server/src/__tests__/services/policyLibraryEvidenceRecordContract.test.mjs
server/src/__tests__/services/policyLibraryOutcomeEvidenceCollector.test.mjs
server/src/__tests__/services/policyLibraryPendingAnswerEvidenceCollector.test.mjs
server/src/__tests__/services/policyLibraryRoutingOutcomeEvidenceCollector.test.mjs
server/src/__tests__/services/policyLibraryMetadataEvidenceCollector.test.mjs
```

The tests verify both direct record-contract failures and source-specific
collector audit failures.
