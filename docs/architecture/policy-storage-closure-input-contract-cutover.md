# Policy Storage Closure Input Contract Cutover

## Status

Implemented July 11, 2026.

## Intent

Storage-closure evidence is an internal verification contract. Its inputs must
use the durable component-oriented names already emitted by the current
collectors and CLI wrappers. Silent acceptance of retired phase-key aliases
could make incomplete or stale evidence appear complete and leaves delivery
terminology in production readers.

## Boundary Audit

The audit identified three internal fallback readers:

- roadmap sequence and implementation-status aliases in
  `policyStorageClosureEvidenceRun.mjs`;
- component-evidence and roadmap aliases in
  `policyStorageCompletionCheckpoint.mjs`;
- an artifact-map alias in `policyStorageClosureRequirementAudit.mjs`.

Every current collector and CLI caller emits `componentId`,
`componentSequenceIds`, `implementationStatusComponentIds`, or `componentIds`.
The only remaining phase-key writers were tests that exercised the fallback.
The subsequent catalog cutover removed historic value normalization as well:
current inputs must use durable component IDs.

## Official Guidance Reviewed

- [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  recommends names that are descriptive, unambiguous, and stable. Component
  field names describe the contract; delivery-era aliases do not.
- [NIST SP 800-228 Update 1](https://csrc.nist.gov/pubs/sp/800/228/upd1/final)
  recommends lifecycle controls selected through a risk-based approach. This
  cutover reduces an internal input surface while preserving explicit,
  testable validation failure for malformed evidence.
- [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports traceable secure development practices. Focused regression tests
  prove both the accepted durable contract and rejection of retired aliases.

## Options Considered

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Keep phase-key fallbacks indefinitely | Avoids short-term input changes | Retains ambiguous production behavior and naming debt | Rejected |
| Add a temporary normalizer with a deletion gate | Centralizes compatibility handling | No current caller needs it; adds an unnecessary lifecycle obligation | Rejected |
| Require durable component fields now | One clear contract, bounded validation, no compatibility debt | Retired ad hoc JSON must be regenerated | Selected |

## Final Recommendation Stack

1. Accept only durable component-oriented input keys in storage-closure
   services.
2. Block retired keys and historic delivery values through the existing
   checkpoint risk model instead of
   silently translating them.
4. Keep focused tests for both valid dotted historic values and rejected legacy
   input keys.

## Implementation

- Removed phase-key fallbacks from storage-closure evidence normalization,
  checkpoint roadmap evaluation, checkpoint component-evidence lookup, and
  closure artifact-map normalization.
- The later catalog cutover removed historic identifier normalization from
  durable component fields.
- Added focused regression coverage proving that retired keys cannot satisfy
  roadmap or changelog completion evidence.
- Updated the production naming inventory and regression baseline from `22/23`
  to `15/16` production references and rename candidates.

## Security Outcome

- Storage-closure completion is now based on one explicit input schema.
- Unknown retired keys cannot silently satisfy a completion checkpoint.
- The cutover performs no file writes, storage mutations, process execution,
  or network activity.
- Historic values cannot satisfy storage-closure evidence.

## Verification

- Focused closure evidence, completion checkpoint, and requirement-audit tests
  pass.
- The production naming inventory validates with no unclassified references.
- The regression audit is ratcheted to the reduced baseline.

## Next Step

Review the remaining storage-closure historic component-ID maps. If no current
generated artifact requires them, migrate the final evidence fixtures to
durable component IDs and remove value-level legacy normalization as a separate
contract component.
