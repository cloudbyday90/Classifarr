# Saved replacement and routing evidence outcome

November 21, 2026 Eastern. Implementation of the approved
[design and tradeoffs](retry-lineage-routing-evidence-design.md).

The existing Queue **Why this stopped** disclosure can now say that Classifarr
saved the local replacement and routing remains unverified. It does so for a
generic classification retry refusal when the same task has both durable
completion fields. Recorded refusal categories keep their specific text. Older
rows and rows without completion evidence keep the general explanation.

The authenticated failed-list read checks the proof by its task primary key
within the existing bounded query. Its only added field is a positive boolean.
The read works when the History row is absent, a later claim has a different
token, or the routing pointer is absent or contradictory. The completion
record establishes a local save using database evidence. Routing remains unverified.
The disclosure can be expanded with the existing keyboard controls. Retry,
Dismiss and routing replay still follow their existing rules.

## Verification

- The focused server suites passed 80 tests. The isolated PostgreSQL and HTTP
  suites passed 78 tests, covering the uncommitted and committed states, exact
  task binding, a contradictory pointer, a later claim, and a replacement
  without a History row. The response omitted internal proof values.
- The focused client tests passed 21 cases. The 21-case Chromium sweep passed,
  including the 320 CSS-pixel Queue disclosure and its existing actions. The
  production client build and its eight Chromium checks passed.
- The full server coverage run passed 64,096 tests with one existing skip.
  The client coverage run passed 7,592 tests. The coverage ratchet, lint, type
  checks, CI preflight, database ownership check, and policy and ESM gates passed.

## Next recommended item

Restore the synthetic replay CI job's dependency-free execution. Its static
import graph reaches `pino` through candidate diagnostics and scored intent
rules. Check whether the replay and production projections can share a small
pure viability module, then verify the exact job in a clean checkout without
installed packages. [Observed failure](https://github.com/cloudbyday90/Classifarr/actions/runs/43828981357/job/133169423729)
