# Exact History IDs in resolution learning outcome

November 22, 2026 Eastern. See the
[design](resolution-learning-bigint-design.md) for references and tradeoffs.

## Implementation

The resolution producer now validates the History ID before building its
outcome-only event and patch. Automatic exact-item learning validates the
same identifier before dispatching the guarded command. Safe IDs retain
their existing numeric representation and event keys. Larger valid IDs
travel as canonical decimal strings. Invalid input keeps its existing
blocked or not-applicable status.

The automatic command still locks and validates the recorded resolution and
destination, revalidates the actor and uses its existing receipt transaction.
Pending answers still accept only positive safe integers. The manual learning
route, answer fingerprints, schema and authorization retain their existing
contracts.

## Verification

- The isolated regression reproduced a receipt committed for the neighboring
  row before the fix. The fixed run passed 29 PostgreSQL tests across three
  suites. It verifies exact committed receipt and evidence rows for adjacent
  IDs and the maximum PostgreSQL BIGINT. The command reports receipt replay on
  repeat, and an unsafe numeric ID dispatches no command. The existing HTTP
  fixture verifies the safe cap and pending answer replay.
- The focused suite passed 150 tests across 11 suites, including both learning
  producers, downstream command guards and pending resolution. GitHub's open
  PR list was empty at intake and verification.
- The fresh backend coverage run passed 64,267 tests across 1,957 suites
  with one test skipped. The coverage ratchet passed with the unchanged
  client tree and report. Lint, type checks, repository preflight, ESM checks,
  policy gates and Markdown lint passed.
- The preceding commit's GitHub database job failed in an inventory refresh
  cancellation fixture outside this diff. The same suite passed all 10 tests
  on the local isolated database. [Preceding database job](https://github.com/cloudbyday90/Classifarr/actions/runs/45090079418/job/137417425429)
- Astra confirmed that the two producers were the source of numeric coercion
  and reviewed the implementation and isolated regression.

## Next recommended item

Harden the manual exact-item memory route's History ID parser and verify the
command receives the exact requested row. Then qualify pending-answer
fingerprints and completed-receipt replay for large IDs before widening
the public pending-answer limit.
