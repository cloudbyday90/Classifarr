# Classification AI Parse Diagnostics Contract Cutover

## Status

Implemented as a focused durable-version cutover.

## Problem

New AI parse diagnostics emitted `phase1_v1`, a delivery-era label that does
not describe the diagnostic contract and would remain in future classification
history. The field is persisted as metadata, so the cutover needed evidence
that changing new writes would not break a consumer of historic values.

## Usage Audit

- `classificationUtilsService.mjs` is the sole producer of the version value.
- `classificationAiService.mjs` attaches the diagnostics to classification
  results.
- `classificationPersistenceService.mjs` stores that object under
  `classification_details.parse_diagnostics`.
- Current statistics queries use attempt and repair fields only; they do not
  read `contract_version`.
- No client, route, server validator, database constraint, or migration
  branches on `phase1_v1`.

Therefore this is an output-version cutover for new diagnostic records, not a
schema migration. Existing rows retain their historical version value and need
no rewrite or compatibility reader.

## Official Guidance Reviewed

- [Semantic Versioning](https://semver.org/) requires a clear public API before
  compatibility semantics can be assigned. The usage audit establishes that the
  diagnostic field's value is not a consumed API discriminator.
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports tracking security-relevant design decisions and verifying changes.
- [NIST SP 800-228 API Protection Guidelines](https://csrc.nist.gov/pubs/sp/800/228/upd1/final)
  recommends incremental, risk-based treatment of API changes.

## Recommendation

Emit `classification.ai_parse_diagnostics.v1` for new records and remove the
old exported constant without an alias. Preserve historic metadata in place.
If a future reader starts branching on this field, it must first define an
explicit compatibility policy and migration owner rather than infer behavior
from an old delivery label.

## Pros And Cons

Pros:

- Current diagnostics describe their durable domain and schema version.
- Avoids a permanent compatibility alias for a value with no runtime consumer.
- Preserves historical data without an unnecessary bulk migration.

Cons:

- External users who parse raw diagnostic metadata must update their display or
  filter value for newly created records.
- A future version-aware consumer must explicitly support historic values if it
  needs to interpret old records differently.

## Final Recommendation Stack

- Producer constant: `AI_PARSE_DIAGNOSTICS_CONTRACT_VERSION`
- New-write value: `classification.ai_parse_diagnostics.v1`
- No data migration or runtime reader because the version is not currently
  consumed.
- Focused classification and utilities tests lock the current value.

## Outcome

New AI parse diagnostics use durable product vocabulary. Existing classification
history remains unchanged, and the application retains no delivery-phase parse
contract name or compatibility alias. The verified production naming inventory
is ratcheted to 142 production references and 143 rename candidates.
