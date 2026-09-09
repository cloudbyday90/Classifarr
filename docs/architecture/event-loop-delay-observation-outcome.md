# Event-loop delay observation outcome

**Completed:** 2026-09-09
**Status:** Implemented and locally validated

## Outcome

Classifarr now collects a passive, process-local event-loop delay histogram
after scheduler initialization. A fixed five-minute schedule and a delayed
startup observation reduce the p99 to one of six durable aggregate buckets:
`unavailable`, `under_25ms`, `25_to_49ms`, `50_to_99ms`, `100_to_499ms`, or
`500ms_or_more`.

The new `event_loop_delay_receipts` table has a two-column fixed key,
`receipt_version` and `p99_delay_bucket`, with database constraints that reject
other values. It retains only a counter and freshness timestamp. No raw delay,
sample count, process or replica identity, operational context, media, library,
provider, configuration, policy, AI, decision, error, or routing data can be
stored.

The observation runs independently in every replica because process stalls are
local evidence. It is passive: it does not request input, change configuration,
call a provider, select semantic evidence, label a cohort, alter policy, or
route media.

## Adjacent reliability correction

The root workspace test launcher no longer uses `spawn(..., { shell: true })`
on Windows. It now launches the fixed `npm.cmd` shim through explicit
`cmd.exe` arguments with Node shell mode disabled, and rejects invalid script
names before command construction. This removes the repository source of the
Node 24 DEP0190 warning while retaining cross-platform workspace test commands.
If the command interpreter itself cannot be started, the launcher now resolves
that attempt as a failed test command instead of waiting indefinitely.

## Local validation

- Focused event-loop receipt, persistence, lifecycle, scheduler-registration,
  and workspace-launcher tests: 19 passing assertions.
- Full backend CI: 1,156 suites and 33,059 tests passed in 339.26 seconds.
  Full client CI: 356 suites and 4,935 tests passed in 213.99 seconds.
- Server and client typechecks, server security and test lint, Knip production
  dependency checks, documentation lint, copyright checks, static ESM import
  checks, strict ESM test-mock checks, and the coverage ratchet passed.
- A no-cache Docker Compose build completed, the service became healthy, the
  migration applied, and the authoritative schema snapshot check passed.
- The workspace launcher completed a root script with `--trace-deprecation`
  without DEP0190. A repository scan found no remaining Node process launch
  using `shell: true`.
- A complete security diff review examined all 12 executable changed files and
  found no reportable vulnerability. It covered scheduler lifecycle, aggregate
  persistence, and the Windows process boundary.
- A read-only local PostgreSQL check confirmed only the safe aggregate form was
  written: `event_loop.delay_receipt.v1|under_25ms|2`.

The aggregate root `test:ci` command remains blocked before its test phase by
an existing production-naming ratchet: it counts 24 legacy uses of `phase` in
unrelated recovery and media-source modules against a baseline of zero. The
current diff adds none of those production references; its focused checks and
the underlying server/client suites passed.

No open pull requests were available when the work began, so no random PR could
be selected for local implementation.

## Recommendation stack

1. Keep the fixed histogram resolution and p99-only aggregate as the passive
   baseline; do not tune it from library or provider configuration.
2. Observe receipts through normal workload before interpreting a single high
   bucket as a defect.
3. If high buckets persist, add a coarse connection-pool wait aggregate to
   distinguish database acquisition pressure from process stalls.
4. Inspect a specific workload only after aggregate evidence supports it; keep
   task identity, query text, media data, and policy/AI/routing state outside
   passive receipts.
5. Add external telemetry only when a collector and an accountable operating
   model exist.
