# Exact History IDs for manual exact-item memory outcome

November 22, 2026 Eastern. See the
[design](manual-exact-item-memory-id-design.md) for sources and tradeoffs.

## Implementation

The manual exact-item memory route validates the decoded History ID using the
shared positive BIGINT validator. Malformed and out-of-range values return the
existing HTTP 400 before command dispatch. The command and audit log receive a
number for safe IDs and exact decimal text for larger IDs. The client forwards
the ID with its existing empty-body POST.

The route retains its read/write and actor checks, row lock, stored resolution
guard and receipt transaction. Pending answers still accept only positive
safe-integer IDs.

## Verification

- The baseline HTTP fixture recorded a receipt for the adjacent row when
  the route rounded a large ID. After the fix, all 30 tests across four scoped
  PostgreSQL suites passed. They verified exact committed receipts and evidence
  for adjacent IDs and the BIGINT maximum, a missing row, read-only refusal,
  invalid input and replay without a duplicate write.
- The focused route and service run passed 61 tests across eight suites.
  It covered safe and large command and log values, percent-encoded digits,
  decoded invalid text and pre-dispatch refusal. The focused client API run
  passed all 23 tests, including the exact decimal path and empty POST.
- The backend coverage run passed 64,282 tests with one skip and one failure
  in the unchanged Discord transport fixture. That fixture passed all eight
  tests on a separate run. Lint, type checks, repository preflight, ESM checks,
  policy gates and Markdown lint passed.
- The concurrent client run timed out during lint setup. A separate client
  coverage run passed all 7,605 tests across 490 files. The combined coverage
  ratchet passed with the fresh backend and client reports.
- Astra reviewed the command boundary and isolated HTTP fixture. GitHub's
  open PR list was empty at intake and verification.

## Next recommended item

Qualify the pending-answer fingerprint for exact History IDs and prove that
completed replay remains bound to the requested row. Preserve safe fingerprint
bytes before changing the pending-answer limit for web, bulk and Discord.
