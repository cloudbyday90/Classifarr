# Retry maintenance batching outcome

Implemented September 29, 2026. No release, version bump, production database
operation or container deployment. The [design document](retry-maintenance-batching-design.md)
records the official research, alternatives, tradeoffs and recommended stack.

## Delivered

- Replaced three unbounded retry updates with 50-row transaction batches. Fixed
  SQL policy, transaction execution and pass orchestration are separate ESM files.
- Retry transitions and derived item status now commit or roll back together.
  Missing state receipts are failures, not successful maintenance.
- The existing dispatcher runs one maintenance pass before provider selection.
  Full batches can request one coalesced five-second continuation. Partial,
  empty or busy batches wait for normal scheduling; cancellation prevents stale
  continuation timers. No additional daemon or backlog-draining loop was added.
- Statistics reads no longer mutate retry or item records. Fresh setups and
  disabled providers do not require an observer or outbound requests for cleanup.
- Existing metadata and historical monthly-quota waits cannot be failed simply
  because they fall beyond the first completion/normalization page. Ordinary
  exhausted Tavily rows with null reasons are no longer stranded by SQL null
  semantics. Monthly dates remain UTC-based; undated legacy rows are withheld.

Current/partial claims and unknown historical processing ownership remain
untouched. The changes neither infer stopped ownership nor authorize routing,
library deletion or metadata replacement. Ordinary retry attempts are preserved;
only the existing historical monthly-normalization rule resets attempts to zero.
Canonical zero-limit monthly rows do not create an endless maintenance loop.

## Verification

- Focused unit/ownership regression run: 8 suites, 161 tests passed.
- Real disposable PostgreSQL regression run: 7 suites, 117 tests passed. Covers
  121-row batches, all three operation rollbacks, locked retry/media rows,
  concurrent workers, reconstructed services, metadata changes before locking,
  read-only statistics transactions, active/legacy/partial claims, future-due
  rows for all four bookkeeping types, missing state receipts and UTC boundaries.
- Type checks and CI preflight passed. The ownership review explicitly watches
  the new policy, executor and pass files. The indirect-query analysis limitation
  and existing service shared-writer debt remain documented; a passing drift
  gate is not a general production-ownership certification.

- Full frontend coverage: 411 suites / 5,795 tests passed; 86.11% statements,
  78.76% branches, 85.56% functions and 88.03% lines. Production build passed.
- Repository lint, documentation lint, ESM import/mock-shape checks, all four
  policy maintenance gates and 32 dependency-tooling regressions passed.

- Full backend coverage: 1,542 suites / 46,810 tests passed; 90.21% statements
  and lines, 84.97% branches and 92.02% functions. The new policy, batch executor
  and pass modules each have 100% coverage across all four metrics.
- The coverage ratchet passed against both fresh reports without changing its
  baseline or thresholds. No reported validation failure remains.

### Synthetic batch observation

An additional disposable-database run processed 121 records per operation as
`50, 50, 21, 0` across four calls (three tests passed). Total elapsed observations
were 466 ms for completion, 442 ms for exhaustion and 539 ms for monthly recovery.
Observed Node heap deltas were respectively 5,869,888, 4,220,080 and 3,815,712 bytes.
These include test assertions and reads, run alongside other validation, and are
not peak memory, retained-memory measurements, before/after comparisons or a
production throughput/CPU estimate. The enforced row limit and transaction
deadlines, not these timings, define the operational bound.

## PR disposition

Both initial and final GitHub MCP searches returned no open pull requests for this repository.
There is no eligible PR to select randomly. No closed PR is represented as open,
and no PR was merged or reopened.

## Recommendation and next component

Keep the existing scheduler and PostgreSQL rather than introducing another queue
engine. Benefit: bounded writes and atomic recovery with no new infrastructure.
Tradeoff: more short transactions and temporarily visible maintenance backlog.
The limit bounds selected/returned/changed rows, not total candidate scan cost;
database deadlines remain necessary. A skipped lock is not proof of completion.

Next: **shared OMDb request pacing**. Daily credit reservation is already atomic,
but lookup spacing still uses process-local timing and recovery probes use a
separate transport. Evaluate a common, credential-generation-fenced admission
boundary for automatic lookups and probes. Persist valid provider wait windows,
keep cache hits free, and avoid holding database locks during HTTP. Verify
concurrent workers, restart, credential changes and the second title/year lookup
with deterministic clocks and real PostgreSQL. Do not describe local pacing as
an account-wide guarantee for external clients.
