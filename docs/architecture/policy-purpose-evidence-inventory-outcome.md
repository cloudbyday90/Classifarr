# Library-Agnostic Policy Evidence Inventory Outcome

Status: implemented on 2026-09-08.

## Outcome

The administrator-only policy-purpose review now returns
`policy_purpose_coverage_review.v7` with a new aggregate
`evidenceInventory`. It reports availability of authoritative current native
intent, intent version and schema version, retained declared purpose,
verifiable lifecycle records, current-intent lifecycle records, complete
records, and incomplete records.

The inventory is library- and configuration-agnostic. It contains no policy,
library, intent, receipt, author, provider, media, profile, rule, or AI data.
All semantic-cohort, selection, and routing flags remain false.

The held-out source gate now consumes the same record. A historical receipt
cannot qualify an active policy unless a verifiable normal lifecycle receipt
also identifies its current native intent. The response remains a passive
eligibility input, never a cohort selection, label, or routing decision.

## Implementation

- Added modular server inventory contract and persistence services.
- Reused the single inventory aggregate to drive the existing source-readiness
  contract, preventing divergent current-policy and lifecycle reads.
- Added strict client normalization and an accessible, read-only inventory
  panel.
- Added a PostgreSQL integration case that replaces a policy's active intent
  without a receipt and verifies that its older receipt does not qualify the
  source.
- Preserved ESM throughout. No dependency or database migration was required.

## Validation

Focused server unit tests, client tests, and the PostgreSQL integration test
cover bounded counts, mismatched current-intent receipts, response
normalization, raw-configuration rejection, and non-routing authority. Full
quality checks and a clean Docker rebuild are recorded with the implementation
commit.

The public repository had zero open pull requests during discovery, so no
random PR could be implemented locally or merged.

## Next task

Allow ordinary native policy authoring to accumulate complete passive evidence.
When the aggregate first reports availability, run the private eligibility
audit and one independently labelled 24–32-case cohort. Treat a good measured
error profile as a prerequisite for a review-only semantic counter-evidence
experiment.
