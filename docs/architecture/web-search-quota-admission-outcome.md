# Atomic web-search quota admission outcome

## Delivered

Automatic routed searches, enrichment retries and credential recovery probes now
share durable credit admission. Previously, independent workers could inspect the
same remaining allowance and send requests before usage was recorded. Each cache
miss now reserves credits inside a bounded PostgreSQL transaction before HTTP.

Two small ESM modules separate configuration admission from quota policy and
reservation persistence. Configuration generation, enabled state, rejection,
options and cooldown are rechecked under lock. Configuration locks precede the
provider-scoped transaction lock; no transaction remains open during HTTP.

Tavily advanced searches reserve two credits; other supported search modes and
current Brave/Serper searches reserve one. Completion updates the original usage
row once rather than adding another charge. An interrupted request keeps its
reservation across restart or credential rotation. Admission failure sends no
HTTP, does not penalize provider health and preserves item retry attempts.

Fresh cache hits remain free even when the automatic budget is exhausted. Daily
and monthly admission, usage summaries and retention all use UTC boundaries;
cleanup cannot discard a charge that still belongs to the current quota month.
Settings now describe automatic credit budgets and their scope. Existing API
field names and programmatic status semantics remain compatible.

## Safety and limits

- These are conservative local reservations, not authoritative provider bills.
  Uncertain remote outcomes are not refunded automatically.
- Explicit connection/diagnostic tests, usage outside Classifarr and older
  application binaries do not participate in this protocol. Update cooperating
  instances together; do not treat this as account-wide spending enforcement.
- No configured limit means no local cap. Credit admission does not yet provide
  shared per-second pacing or interpret provider-specific rate-window headers.
- Existing usage is retained, not rewritten to infer historical request costs.
  Existing inventory ownership and recovery authority are unchanged.
- No schema migration, runtime dependency, background daemon or client polling
  layer was added. No release, tag, version bump or live deployment was performed.

## Verification

Runtime changes were committed as
`896fb5c00fce6c412b0e0843c46eac8f6e1de22e`. Subsequent changes only document the
results and do not alter the tested runtime.

| Gate | Result |
| --- | --- |
| Backend with coverage | 1,536 suites; 46,517 tests passed |
| Frontend with coverage | 406 files; 5,719 tests passed |
| PostgreSQL integration | 199 suites; 2,358 tests passed; one opt-in suite/test skipped |
| Coverage ratchet | Passed; no baseline lowered |
| Clean-source installation acceptance | All 12 checks passed |

The full suites passed 54,594 tests, excluding focused reruns and installation
checks. Focused verification passed 235 backend tests, 50 PostgreSQL tests and
six settings tests. Real PostgreSQL tests include concurrent last-credit races
for all three providers, shared probe/search contention, two-credit requests,
stale configuration, crash accounting, idempotent completion, legacy Tavily,
cache hit/miss behavior, retry preservation and non-UTC session boundaries.

Backend coverage: statements/lines 90.22%, branches 84.93%, functions 92.08%.
Frontend coverage: statements 86.02%, branches 78.58%, functions 85.47%, lines
87.96%. Lint, type checks, CI preflight, ESM checks, four policy gates and the
production UI build passed. Ownership review pins were updated without claiming
that existing indirect-SQL analysis debt is resolved. No live or paid provider
request was needed; HTTP tests use fixture credentials and mocks.

### Installation evidence

The clean-source receipt completed at `2026-09-29T13:07:24.211Z` with a clean
worktree and the runtime revision above.

- Baseline: published `v0.48.4-beta`, revision
  `a0e417fd714919bb4ca30e20f9cd2380136ca74e`, verified image
  `sha256:dc95fcdd80123b6bbf5b252fec286d9e81fbbc21a1030087c0a44abacd6a187f`.
- Candidate image:
  `sha256:c210849b102212d4820d9c46b9b2f0139d0030158d36af686ba0bbbfeea87ca2`.
- PostgreSQL 18.6: fresh and upgraded installations reached 303 migrations;
  the published baseline had 222.
- Passed fresh seeds, scheduled progress, backfill crash recovery, baseline
  export, persisted-volume migration, interrupted restore, unsafe-startup
  rejection, verified retry, movie/TV handoff and verified restart.
- Disposable project
  `classifarr-upgrade-drill-19b281e01c1e10293e5b359a48fd7414`, its volumes, network
  and candidate image were cleaned up. Receipt:
  `.tmp/ci/runtime-installation-acceptance.json` (ignored, local evidence).
- Live Classifarr remained healthy with zero restarts on image
  `sha256:8993f6dfa53f74b4fe05bf8d3e81df568f00612b9b8742f1be40c5cfb170c63d`,
  started `2026-09-29T01:16:51.534281224Z`.

## Recommendation and next component

Keep modular Node ESM services, the PostgreSQL ledger and transaction locks,
existing scheduler/router, Vue settings and real-database regression tests. This
avoids new infrastructure and survives worker restarts; the trade-offs are brief
lock contention and conservative retention of uncertain costs. The separate
[design and official research](web-search-quota-admission-design.md) documents
alternatives, September 2026 provider guidance and W3C status-message guidance.

Next: shared provider rate-window pacing. Credits answer how much can be spent;
rate windows answer how quickly requests may be sent. Brave's official guidance
documents a per-second sliding window and reset headers, while the current
client returns only the response body and existing failure handling reads
`Retry-After`. Build bounded, generation-aware pacing on the existing admission
boundary, preserve cache access and item attempts, and test bursts, concurrent
workers, stale responses, reset boundaries and restart. Do not introduce a new
daemon or per-item polling to solve this.

Two GitHub MCP searches found no open Classifarr PRs during this round. No PR
could be randomly selected or implemented, and none was merged.
