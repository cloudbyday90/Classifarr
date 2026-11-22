# Exact History IDs for shared routing writes outcome

November 22, 2026 Eastern. Implementation of the approved
[design and research](routing-outcome-bigint-design.md).

The shared routing metadata writer now binds safe positive integer numbers
and canonical decimal strings as exact text. Manual closeout, automatic
closeout, and the queued pre-provider marker address the intended History
row up to PostgreSQL's BIGINT maximum. The fixed partial JSONB update
preserves unrelated classification evidence. Inputs previously accepted
through coercion, including padded strings and objects, now fail before SQL.

The manual path retains its library, status, pending marker and attempt
checks. The queued path retains its claim, deadline, lineage and atomic
admission checks. An unacknowledged admission leaves dispatch withheld.
After a lost closeout acknowledgement, a fresh read can recover the saved
result without another provider call. The direct unqueued path still has
its original ID-only closeout and no durable queue replay marker.

## Verification

- The original writer rejected exact strings for adjacent IDs above
  JavaScript's safe range and for the PostgreSQL maximum. All 67 focused
  unit tests passed with the exact binding and invalid input controls.
- All 64 isolated PostgreSQL tests passed with coverage. Real SQL exercised
  the automatic owner and manual selector with in-process provider fixtures.
  Adjacent rows retained their original status and metadata. The maximum ID
  exercised stale attempts, admission rollback, and acknowledgement loss
  after real commits. Competing admissions still wrote exactly one marker.
- Astra reviewed the fixed query, sequence fixture isolation and the
  distinction between loss before dispatch and loss after closeout. The
  ownership inventory retains its existing classification and SQL analysis.
- Server lint, both type checks, CI preflight, Markdown lint, the ESM gates,
  policy checks and the staged secret scan passed. GitHub had no open PRs
  or stale Dependabot branches at review.

## Next recommended item

Trace the two remaining `INTEGER` History references in reclassification
batch items and move operations together. The move owner also applies an
int32 validator and compares a saved operation's classification ID with the
request. Settle exact request, stored and recovery identity together before
changing either column. Retain separate provider resource IDs and the
existing move reservation, reconciliation and no-replay rules. Revisit
UUIDv7 after those boundaries and a concrete identifier requirement.
