# Native Intent Conversion Vocabulary Cutover

## Status

Implemented July 11, 2026.

## Decision

Replace the native-intent storage vocabulary phrase
`Describe converted policies after Phase 8R conversion.` with
`Describe policies after explicit policy conversion.`

The term record remains product-facing and continues to require conversion,
validation, backup, and rollback proof before native intent storage becomes the
runtime model.

## Boundary Audit

The phrase exists only in the immutable, server-owned
`policyLegacyCompatibilityVocabulary` term record. Its repository consumer is
the policy-authoring readiness checklist; it is not a persisted value, route
payload, database constraint, or versioned client API.

The direct wording replacement therefore has no compatibility alias or schema
migration requirement.

## Official Guidance Reviewed

- [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  recommends precise, unambiguous domain names. “Explicit policy conversion”
  conveys the enduring operation, unlike a delivery sequence.
- [NIST SP 800-228 Update 1](https://csrc.nist.gov/pubs/sp/800/228/upd1/final)
  supports traceable, risk-managed interface changes. The vocabulary test
  confirms the required conversion condition and rejects the retired phrase.
- [Node.js ECMAScript Modules](https://nodejs.org/api/esm.html) supports the
  repository's static server-module composition without a compatibility bridge.

## Options Considered

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Keep the delivery-era phrase | No copy change | Makes current product vocabulary depend on retired roadmap history | Rejected |
| Use both phrases | Temporary search familiarity | Preserves obsolete terminology in a durable contract | Rejected |
| Use explicit policy conversion | States the actual guarded operation | Requires a focused vocabulary assertion | Selected |

## Verification

- Native intent storage remains the only permanent compatibility model.
- Product-allowed use explicitly requires policy conversion.
- The vocabulary test rejects `Phase 8R` in the allowed product-use text.
- The production naming inventory and regression audit are regenerated before
  lowering the baseline.

## Security Outcome

No storage, conversion, validation, backup, rollback, authorization, or route
behavior changed. The product term preserves all safety prerequisites while
removing a non-domain delivery reference.

## Next Step

Audit the remaining policy operator workflow message that maps a section to
delivery-era user terms, then replace it with the durable policy-authoring
vocabulary only if its validation contract is unchanged.
