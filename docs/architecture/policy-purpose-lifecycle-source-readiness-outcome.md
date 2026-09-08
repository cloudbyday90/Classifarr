# Policy-Purpose Lifecycle Source-Readiness Outcome

Status: implemented on 2026-09-08.

## Implemented outcome

The policy-purpose coverage response is now version 7. Its held-out source
readiness now joins current declared-purpose provenance with lifecycle receipts
for the same active policy and current active native intent. A retained purpose
in one policy, a lifecycle receipt in another, or a receipt for a superseded
intent can no longer produce an available private-study source.

The response adds a library-neutral evidence inventory alongside the three
source partitions. The client independently bounds the inventory and source
partitions before rendering either status.

The database migration adds a partial policy-first index for applied native
intent change receipts. It is an implementation performance aid only; it does
not change authoring records, policy behavior, AI behavior, or routing.

## Validation

- Server unit tests cover empty, profile-only, qualified, missing, malformed,
  and review-required lifecycle partitions, contract versioning, and SQL data
  minimization.
- PostgreSQL integration seeds one established receipt for a retained active
  policy, then replaces another policy's current intent without a receipt. It
  confirms only the current-receipted policy qualifies while the stale receipt
  remains unqualified.
- Client tests reject contradictory availability and display the new aggregate
  categories without introducing any control.
- The focused server and client suites, integration test, lint, typecheck,
  migration validation, production build, static ESM check, and security diff
  scan are recorded with this change.
- The security diff scan reviewed 14 changed executable files and found no
  reportable finding. The hosted TAC advisory connector was unavailable, so
  protected scan-output access could not be verified.

## Platform result

The platform now avoids a false-positive source-eligibility signal without
requiring routine operator input. Its live state may remain in
`normal_lifecycle_provenance_required` until ordinary native authoring has
created matching retained-purpose receipts. That is the intended fail-closed
state, not a request to create synthetic evidence.

The next task remains measurement rather than routing: once the passive gate
reports a qualified source, run the private eligibility audit, capture one real
24–32-case cohort, collect independent labels, and run readiness plus
frozen-study preflight. Only a good measured error profile can justify a
review-only semantic counter-evidence experiment.

The current-intent invariant and the configuration-agnostic inventory are
documented in [Policy Evidence Inventory Outcome](policy-purpose-evidence-inventory-outcome.md).
