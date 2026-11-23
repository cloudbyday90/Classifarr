# Exact History IDs in original-decision snapshots outcome

November 23, 2026 Eastern. See the
[design](original-decision-snapshot-bigint-design.md) for the alternatives and
primary sources.

## Implemented behavior

Original-decision snapshots support positive History IDs through PostgreSQL's
BIGINT maximum of `9223372036854775807`. Safe IDs retain their original JSON
number representation. Larger IDs are stored as exact decimal strings. The
shared reader rejects noncanonical values and unsafe JSON numbers. Snapshot
capture still requires the original typed decision before persisting the context.

The intake sweep can recover a previously missing context by copying the
existing original capture. The write matches the queue receipt, exact History
ID, typed media identity, and saved original. The 500-row budget, 30-day window,
cursor, and receipt locking keep the repair bounded. If the original capture
is unavailable, the receipt retains its gap.

Evaluation groups and joins snapshots by exact History ID. A retained
correction event supplies independent binding while it exists. A mismatched
context can invalidate that event's group without affecting a different
History ID. A valid frozen correction snapshot can outlive its event.

## Verification

231 focused tests and 212 tests against isolated PostgreSQL passed. The
PostgreSQL suites covered intake capture and guarded repair, adjacent large
IDs, the BIGINT maximum, missing and mismatched evidence, correction and
feedback persistence, and purpose and authorized-outcome evaluation. The
ownership gate review for the evaluation repository records one read-only SQL
change. Its analysis digest, existing classification, and limits stay the same.
All three npm audits reported zero findings. Lint, type checks, CI preflight,
and the import, test-mock, and product-policy checks passed. Security lint
reported the pre-existing Discord regex warning. Two symlink fixtures skipped
on Windows, where symlink privileges are unavailable or not assumed.

The fresh backend coverage run passed 64,422 tests across 1,957 suites. One
Linux-only filesystem test skipped on Windows. Backend statement, branch, and
line coverage were 89.36%, 86.87%, and 89.36%. The coverage ratchet passed with
the prior client report after its hashes and unchanged client inputs were
verified. GitHub listed no open pull requests eligible for local adoption or
Dependabot rebasing.

## Next recommended item

Qualify the remaining Discord completed-decision buttons for exact BIGINT IDs.
The `correct`, `verify_yes`, and `reclassify` buttons still use the safe-integer
parser. Verify delivery and authorization checks, the exact History row and
receipt, and each action's existing routing or learning boundaries before
widening it.
