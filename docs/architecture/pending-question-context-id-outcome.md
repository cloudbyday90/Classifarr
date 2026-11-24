# Exact pending-question context references outcome

November 24, 2026. The [design](pending-question-context-id-design.md) records
the recommendations and tradeoffs.

The pending list now reports an invalid saved context on its own row and
keeps a Retry action. The browser regression also found that the dashboard's
legacy fallback label tried to convert an invalid option. The dashboard now
skips that label for this state. The same inspection prevents the locked
answer flow and cleanup from looking up a partial context. The persistence
writer uses the existing retry placeholder without a freshness lookup for
new invalid questions. Valid references keep their order, version calculation
and fingerprints.

Cleanup inventory counts an invalid context as unavailable. Apply uses the
existing fresh-evaluation path for an affected question, including one with
a saved answer. On repeat apply, the queued records replay their cleanup
receipts. The saved answer remains available for audit. Completed answer
replay keeps its existing receipt and row-binding rules.

## Local verification

- Against the original code, isolated PostgreSQL returned zero pending rows
  after an out-of-range policy reference and an out-of-range library
  reference were stored beside a valid question. The final regression also
  covers an object-valued option that previously reached numeric coercion.
  The route kept all four rows visible, preserved the valid contract exactly,
  and refused new answers to stale questions with `409`. No classification
  rows changed and routing was idle.
- All 16 isolated PostgreSQL tests and 237 focused unit tests passed. They
  covered inventory, locked apply and replay, canonical INTEGER bounds,
  optional references, preservation of existing stamps, and inexact fields
  in each reference position.
- All 7,730 client tests across 491 files and all 11 Chromium pending-review
  cases passed. The browser used the keyboard Retry control for the affected
  row and sent its exact large History ID while the valid row retained its
  destination interaction. Client lint, type checks and production build
  also passed.
- Preflight, ESM and policy gates passed. The three workspace dependency
  audits found zero advisories. The local Classifarr container kept its
  identity, startup time and health during verification.
- The full backend run passed 64,565 tests across 1,958 suites with one
  existing skip. The coverage ratchet passed with 89.33% backend and 89.58%
  client line coverage.

GitHub listed no open PRs at intake or before delivery.

## Next recommended item

Check the independently stored destination on native question envelopes.
It still reaches display projection through numeric coercion. Verify a
malformed value beside a valid neighbor, then distinguish per-row freshness
lookup failures and primary database failures from a genuinely empty queue.
