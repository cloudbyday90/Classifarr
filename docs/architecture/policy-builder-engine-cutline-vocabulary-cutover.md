# Policy Builder Engine-Cutline Vocabulary Cutover

## Status

Implemented July 11, 2026.

## Decision

The advanced-scoring extraction target now says that the engine cutline must
reclassify or remove conflicting controls. The stable decision ID, target
boundary, and risk bindings are unchanged.

## Official Guidance Reviewed

- [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  recommends stable, descriptive, unambiguous terminology.
- [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports traceable change verification through focused regression tests.

## Options And Recommendation

Keeping delivery-era wording leaves the diagnostic stale. Removing the reason
would reduce operator context. The selected approach describes the existing
engine-cutline decision directly and preserves all behavior.

## Security Outcome

No authorization, persistence, route, process, or network behavior changed.
The focused contract test protects the decision reason without weakening its
related risk bindings.

## Verification

- Focused orchestration-contract test passes.
- The naming inventory is valid at `7/8` production references and candidates.

## Next Step

Replace the remaining evidence-admin comments that refer to their delivery
phase with durable operator terminology.
