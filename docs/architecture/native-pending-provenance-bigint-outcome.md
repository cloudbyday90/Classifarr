# Exact History IDs in native pending provenance outcome

November 22, 2026 Eastern. See the
[design](native-pending-provenance-bigint-design.md) for sources and tradeoffs.

## Implementation

Native pending resolution and native routing outcomes now use the existing
exact database ID validator. They derive `classification:<id>` event keys
from the validated History ID. Safe IDs keep their numeric representation,
and larger valid IDs keep their exact decimal text. Invalid resolution IDs
produce no canonical intake and fail the existing audit. The terminal route
adapter declines persistence when its History ID is invalid.

Pending answer admission remains limited to positive safe integers. Existing
fingerprints, completed replay, destination IDs, outcome projections and
learning and routing authority retain their previous contracts. The repair
uses the existing database schema and transaction boundaries.

## Verification

- Before the change, adjacent IDs above the safe range produced the same
  event key in both producers. The fixed focused run passed 54 cases across
  eight suites. It also verified PostgreSQL's maximum ID, malformed and
  unsafe input refusal, and safe event and outcome bytes. Both native
  resolution intake paths remain outcome-only.
- Isolated PostgreSQL passed 27 tests across four suites. A terminal route
  outcome writes only the intended large History row. Noncanonical text and
  an unsafe number leave both adjacent rows unchanged. The HTTP test confirms
  that a safe pending answer resolves once and exact completed replay does
  not route again. Larger pending neighbors still refuse answer commands.
- Fresh backend coverage passed 64,242 tests across 1,957 suites with one
  test skipped. The coverage ratchet passed using the unchanged client
  tree, lockfile and coverage report. Lint, type checks, repository preflight,
  ESM checks, policy gates and Markdown lint passed.
- Astra traced the native, destination evidence and exact-item learning paths
  and recommended this bounded producer repair. GitHub listed no open PRs at
  intake or verification, so there was no candidate for local adoption or
  Dependabot branch to rebase.

## Next recommended item

Carry exact History IDs through resolution learning and automatic exact-item
learning while leaving pending answer admission capped. Then qualify the
answer fingerprint's decimal-string representation and historical receipt
compatibility before enabling larger web, bulk or Discord answers.
