# Classification intake receipts: implementation outcome

Date: 2026-09-23. Design and trade-offs are recorded separately in
[classification intake receipts: design](classification-intake-receipts-design.md).

## Implemented

- A PostgreSQL receipt keeps only internal IDs, bounded state codes, timestamps,
  and attempt counts for queued classification work. It survives normal task
  queue cleanup and becomes eligible for bounded expiry after 30 days.
- Queue enqueue, dequeue, retry, completion, and classification-history writes
  update the receipt without affecting routing on a diagnostic failure. Current
  queue state wins if these diagnostic writes arrive out of order.
- The prospective inventory comparison now records a fixed reason when it is
  not captured. The reason is diagnostic, not a confidence adjustment or a
  substitute for review. No library profile, title, provider ID, description,
  webhook payload, or AI output is copied into the receipt.
- Existing queue maintenance attempts bounded reconciliation before cleanup,
  including a classification-history link where an existing decision witness
  remains available. This is best-effort, not a retroactive reconstruction of
  deleted queue rows.
- An internal-only read-only report returns separate webhook-log and receipt
  group counts plus at most 100 receipt rows. It never interprets an absent
  receipt as proof that no request arrived and never exposes a public API.

## Operator query

After a future release has run with live classification traffic:

```sh
cd server
node src/scripts/runClassificationIntakeReceiptReport.mjs \
  --since=2026-09-23T00:00:00Z --until=2026-09-24T00:00:00Z --limit=100
node src/scripts/runClassificationIntakeReceiptReport.mjs --task-id=12345
```

The default window is the preceding seven days. A supplied window must be no
longer than 31 days, must end no later than the current time, and returns at
most 100 rows; grouped counts still cover the whole requested window. The
task-ID form returns at most one receipt. Output is deliberately limited to
IDs and fixed codes. Use a restricted operator shell, because database read
access and internal IDs remain sensitive operational information.

## Verification and limits

The implementation uses disposable PostgreSQL integration tests for migration,
idempotent receipt writes, queue-cleanup survival, expiry, and reconciliation,
plus unit tests for fail-open writes, privacy validation, the read-only query,
and queue/history hooks. The full PostgreSQL integration run passed 148 suites
and 1,709 tests (one existing skip); the full backend unit-coverage run passed
1,387 suites and 40,712 tests. The fresh-install schema snapshot was
regenerated and checked in a disposable container. The release and local
container update are deferred;
this commit cannot show a live receipt from an installation that has not yet
run this code.

The retained receipt is intentionally not a complete distributed trace. It
begins when a classification task is queued, not at an unauthenticated request.
Legacy queue timestamps have no offset and are interpreted using the database
session time zone during reconciliation. Reconciliation and expiry are bounded
per maintenance run; if the source queue row and its witness were already
removed, the old link cannot be recovered. Such gaps must remain explicit in
analysis rather than being imputed as successful or absent classifications.

## Next item

After a separately authorized release, collect a live movie/TV window, compare
webhook states with task receipts and fixed comparison-reason distribution, then
repair the largest measured boundary gap. Do not tune routing or train from
uncorroborated placements until that evidence has been reviewed.
