# Authorized outcome evaluation outcome

Date: 2026-10-28. Status: implemented following both explicit grill-me agreements:
prospective snapshots with historical gaps, and successful explicit choices with
confirmations separate from changes. The [design](authorized-outcome-evaluation-design.md)
records alternatives, official research, safeguards and the recommended stack.

## Findings

Two independent read-only source investigations and parent inspection agree:

- `policy_authorized_outcome_source_event_receipts` is an immutable idempotency
  boundary, not a frozen evaluation record. It lacks readable typed identity,
  original decision context and confirmation/change action provenance.
- The `operator_confirmation` source is used by both confirmation and destination
  change actions. Source name, learning tier and `ready` status cannot establish
  correction kind or classifier correctness.
- Manual corrections already create both durable correction snapshots and an
  authorized receipt for `classification_correction:<id>`. Deduplicate the event
  before row caps and coverage counts; later map grouping alone is insufficient.
- The shared inventory label intake reaches grouped calibration, source-pair and
  fresh/frozen policy evaluators. The saved-decision intake separately reaches
  original-decision agreement reporting. Those are the first two integration seams.
- Feedback dashboard statistics, independent reference cohorts, prospective
  inventory evaluation and mutable semantic calibration have different evidence
  populations. They require separate follow-up work.
- Existing readers differ on unavailable-target handling. Retain contradictions
  long enough to reject conflicts; a filtered invalid target must not improve a
  surviving label's apparent agreement.

The previous private installation snapshot contained eleven authorized receipts
and zero correction/feedback labels. This investigation made no new production
query and does not claim those counts are current. No private title, snapshot,
actor, metadata or credential is included in these documents.

## Implemented result

New eligible receipt commits atomically retain minimal, immutable evaluation
snapshots. Shared inventory-label and saved-decision readers use the same strict
projection, canonical event deduplication and explicit missing-evidence counts.
Legacy manual aliases are suppressed before row caps. Unavailable destinations
remain visible long enough to reject contradictory labels and preserve holdouts.
Older receipts are not reconstructed through mutable history.

Saved-decision reports provide separate confirmation/change decision rates and
media breakdowns after all-source conflict rejection. Mixed-kind decisions have
their own count and enter neither action-specific denominator. Aggregate input
counts remain coverage, and confirmations carry an explicit suggestion-bias
limitation. Overall agreement remains available for the existing mixed population.

The dedicated runtime observation time uses the database transaction clock and
survives later tier aliases without becoming fresh again. A missing, future or
expired timestamp cannot produce a new evaluation label. Missing optional
original-decision context does not invent an original classification; inventory
choice evidence and original-decision agreement remain distinct populations.

Routing, learning authorization and generalized learning behavior retain their
existing boundaries. Manual outcome-only decisions can supply evaluation
evidence. Runtime decisions that never produce an admitted receipt remain a
separate coverage gap. No classifier accuracy improvement or corrected library
choice is claimed by this measurement refactor.

## Verification and findings

All database checks use disposable synthetic PostgreSQL fixtures. No new UnRaid
query, live mutation, provider request, release or deployment was performed.

- Focused backend regression: 51 suites and 603 tests passed, covering identity,
  authority, clarification replay, reader cohorts, holdouts, report fingerprints,
  queue maintenance and learning writers.
- Final separate-cohort regression: ten suites and 90 tests passed, including
  distinct rates, mixed-kind exclusion, cross-source conflict retention, missing
  context, unavailable targets, duplicate aliases and the strict stored shape.
- Complete backend coverage: 1,883 suites passed; 60,564 tests passed and one
  test was skipped. Duration was 1,024.62 seconds on this host, not an application
  performance benchmark. Coverage is 89.19% statements/lines, 86.49% branches and
  90.75% functions.
- The coverage ratchet passed without changing its baseline. It uses the fresh
  backend report and the existing 2026-10-27 client report (477 files, 7,374 tests).
  Client tree `d6a377530fab2f2847f4b01a936dbbb1ca825f1b` is unchanged; frontend
  coverage was not rerun. Its coverage remains 87.79% statements, 81.84% branches,
  87.50% functions and 89.47% lines.
- Database integration regression: seven suites and 90 tests passed; a later
  five-suite clock/lifecycle check passed 59 tests. The final snapshot-integrity
  suite passed all 21 cases. After the cohort correction, the snapshot and
  automatic-destination integration suites passed all 36 tests. These overlapping
  runs are not unique-test totals.
- Fault injection verifies receipt, correction, snapshot and learning effects
  roll back together. Replay, pruning, history deletion, destination cascades,
  replace-restore rollback, source-only identity and corrupt bindings are covered.
- Server lint, type checking, both Knip modes, ESM imports/mock shapes, migration
  naming and generated schema checks passed. The PostgreSQL schema fixture loads
  `pg_stat_statements` so regeneration preserves its optional startup guard.
- Inventory writer ownership checks preserve the existing 100-category bound and
  unresolved debt; new evidence handling is classified under the existing
  evaluation-workload review. An initial stale-metadata failure stopped the first
  coverage run; the metadata was corrected before the final run.

A later complete coverage attempt was stopped when final review identified that
separate input counts alone did not meet the agreed separate-cohort reporting
contract. The decision summaries and regressions above address it; the completed
coverage run includes that correction. No gate, timeout or assertion was
relaxed to obtain a pass.

Review found and fixed two material edge cases: filtering an unavailable legacy
destination could conceal a contradiction, and a late first tier receipt could
refresh an old resolution after its earlier snapshot expired. Both now have
database-backed regressions. Strict validation also caught a missing typed ID in
the new saved-decision projection before delivery.

The [random PR outcome](actions-pr569-outcome.md) records the independent
PR #569 implementation and tests; it was closed without merging. No second random
PR selection or new release is part of this refactor.

Reproduction uses the repository-pinned Node 24.22.1 and npm 12.2.1, with the
existing Git OpenSSL executable supplied through `OPENSSL_BIN` for TLS fixtures.
Run the database commands against the integration harness's disposable Docker
database, not an installation database. The focused final commands from `server`
are:

```powershell
node scripts/run-jest.mjs --runInBand --no-coverage --testPathPatterns='authorizedOutcome|DestinationEvaluation|destinationOutcome|destinationIntake'
node scripts/run-jest.mjs -c jest.integration.config.mjs --runInBand --testPathPatterns='authorized-outcome-evaluation|automatic-destination-evaluation'
node scripts/run-jest.mjs --coverage --maxWorkers=2 --workerIdleMemoryLimit=512MB
```

Root checks include `node scripts/check-coverage-ratchet.mjs`,
`node server/src/scripts/runInventoryWriterCompatibility.mjs --check-ownership`,
`node scripts/check-migrations.mjs`, `node scripts/report-static-import-candidates.mjs --check`,
`node scripts/report-esm-test-mock-shapes.mjs --check`,
`node scripts/run-markdownlint.mjs` and `node scripts/check-copyright.mjs`.
Server npm checks are `lint`, `typecheck`, `lint:knip` and `lint:knip:production`.

## Next recommended item

Connect the canonical frozen outcome projection to
`inventoryProspectiveOutcomeRepository.mjs`, which still reads older feedback and
correction event seams. Preserve its frozen rank captures, grouped holdouts and
temporal exclusions. Measure the resulting coverage before considering a
routing change. Mutable semantic-calibration readers require a separate follow-up.
