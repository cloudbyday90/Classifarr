# Exact History IDs for reclassification outcome

November 22, 2026 Eastern. Implementation of the approved
[design and research](reclassification-history-bigint-design.md).

The migration widens the History link in both reclassification tables to
`BIGINT` in one transaction. Preview, execution and batch creation validate
the exact History ID before lookup or writes. Recovery checks that the
receipt's exact History ID and destination match the batch item before
binding it. Safe IDs stay numeric in existing responses. IDs outside the
JavaScript safe range cross the API as canonical decimal strings.

Plans, History-derived revision hashes, provider and library IDs, reservation
rules and queue admission keep their existing contracts. The correction event
can reference a large History ID while its legacy decision snapshot remains
unavailable. Move recovery still reconciles actual placement and reads the
saved receipt before completing. A delayed or lost final acknowledgement
does not authorize another file move or correction.

## Verification

- The packaged PostgreSQL 18.7 instance upgraded the previous schema in one
  transaction. A fresh snapshot loaded with the same two BIGINT columns, and
  the repository dump check reproduced the committed snapshot exactly.
- On PostgreSQL 17.11, a held lock on the second table caused `55P03`.
  The first change rolled back with the second. A later attempt widened both
  populated columns and preserved their values, active uniqueness indexes,
  and the batch parent cascade.
- All 152 focused server unit tests and 69 isolated integration tests passed.
  The HTTP and PostgreSQL tests moved adjacent IDs through the BIGINT maximum,
  rejected an out-of-range batch before writing, and refused an adjacent
  item's recovery receipt before binding. A legacy numeric receipt and its
  original plan survived the migration and recovered without file replay.
  Final correction rollback and delayed or lost acknowledgement exercised
  real PostgreSQL commits and preserved a single file move.
- The client API contract kept large IDs exact in both directions. Chromium
  passed the existing batch rediscovery and controls check. The client
  coverage run passed 7,598 tests, and the production build passed. Astra
  reviewed canonical comparison, numeric compatibility, migration atomicity
  and the verification boundaries.
- GitHub showed no open PRs or Dependabot branches eligible for rebase at
  intake or at the final branch check. Production state and provider services
  were outside the rehearsal.

## Next recommended item

Trace the classification retry command's remaining `INTEGER` boundary
through the API, History controls, historic refresh receipts and notification
cleanup. Its strict admission parser caps targets at `2147483647`, and the
notification match still casts the trusted target to `INTEGER`. Settle the
existing receipt and replay contract before moving those two boundaries to
exact BIGINT. Retain the current BIGINT History identity until UUIDv7 solves
a separately demonstrated requirement.

The [ordinary retry follow-up](classification-retry-bigint-outcome.md) widens
the shared retry command and leaves the historic receipt path as the next
compatibility change.
