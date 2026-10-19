# Gateway same-snapshot reuse study — design

## Scope and agreed safeguards

Approved on 2026-10-19: study two duplicate SQL reads using disposable local
PostgreSQL data. Production recovery, scheduling, limits, permissions, admission,
filesystem checks, restore verification and retirement remain unchanged. No
Unraid, Plex or shared Ollama access; no release, tag or version change.

The duplicates are retention inventory during assessment/export and the three
base maintenance-table hashes during catalog scheduling/frozen capture. A
coordinator pass can contain multiple snapshots: it is not a cache lifetime.
The production snapshot capability, not a revision string or pooled connection,
must identify the original live transaction.

The prototype assumes transaction control remains exclusively inside the existing
snapshot helper. Raw caller-issued COMMIT/ROLLBACK is not a supported escape hatch;
encapsulating that authority would be a prerequisite for a runtime API. Connection
end/error events and callback completion invalidate the local scope.

This is a component experiment, not an end-to-end pressure-path optimization.
Synthetic old terminal bindings exercise the 100-entry review bound without
pretending to reach the 80,000-binding pressure trigger. Small and wider failed
job history exercise the SQL/cursor path. No fixture is valid recovery evidence
for real provider work.

## Evidence and options

Official sources were discovered through connected search/GitHub services and
retrieved on 2026-10-19:

- [PostgreSQL 18 transaction isolation](https://www.postgresql.org/docs/18/sql-set-transaction.html)
  defines the repeatable-read view; [snapshot lifetime](https://www.postgresql.org/docs/18/functions-admin.html)
  is transaction-bound. Inference: do not reuse SQL results across transactions,
  even on the same connection or with an unchanged semantic revision.
- [Node 24.21 filesystem guidance](https://nodejs.org/download/release/v24.21.0/docs/api/fs.html)
  warns about check/use races. Inference: SQL snapshot identity cannot freeze a
  dump, receipt, manifest, directory, permission or free-space observation.
- [Node performance hooks](https://nodejs.org/download/release/v24.21.0/docs/api/perf_hooks.html)
  provide monotonic timing. Observed elapsed/CPU time includes measurement cost;
  warm caches and a shared Docker host limit performance conclusions.

| Option | Benefit | Cost/risk | Decision |
| --- | --- | --- | --- |
| Keep every read | Simplest current behavior | Repeated SQL/body transfer | Production baseline |
| Scope summaries to one active snapshot | Less duplicate transfer; bounded memory | Lifetime, cancellation and accounting bugs | Test-only prototype |
| Cache by revision, job or process | Broader apparent savings | Stale authority across transactions/writes | Reject |
| Cache filesystem verification | Less repeated hashing | Check/use races; unsafe retirement | Reject |

## Prototype contract

Small ESM fixture modules wrap the existing production readers. The original
`assertArchiveSnapshot` guard runs on every operation. A lexical scope closes
and drops cached references in `finally`, including rollback/cancellation. It
rejects overlapping operations; no partially failed capture is cached. Results
are deeply immutable, contain no raw catalog rows, and never persist.

Retention keeps at most 100 validated entries. Catalog reuse keeps only the
three base-table summaries and their exact successful byte charge. Version 3
still reads and hashes `gateway_catalog.job` through the unchanged production
cursor. Successful captures have exactly equal summaries and charged bytes.
An over-budget reuse refuses before returning data; a failed operation's budget
is discarded, not resumed or treated as a successful partial capture.

No inference calls or external HTTP run in transactions. The fixture's source
role is SELECT-only; a separate owner creates fresh schemas and concurrent
synthetic changes. PostgreSQL statement/lock/idle limits and host command timeouts
bound work. One study runs at a time; no automatic retries, attempt resets,
cooldown changes, purge, retained-root mutation or production cache is added.
Fresh installs have no new work. A restart starts with an empty cache.

## Verification and completion

Commit-bound, sealed read-only fixtures execute against an immutable local image
with the production entrypoint in a fresh isolated database. Compare baseline
and prototype in counterbalanced order within the same active snapshot. Record
query count, returned UTF-8 string-value bytes, elapsed/CPU time and exact result hashes;
string-value bytes exclude protocol overhead, field names and non-string values.
do not equate physical block I/O with logical reads. Measure small and wider
history separately, without builds or other owned study workloads overlapping.

Test fabricated/cloned/wrong-client/expired contexts, next transactions, callback
failure/rollback, cancellation before and during reads, concurrent source changes,
mutation attempts, aggregate-byte overflow and oversized rows. Confirm cursor
closure, read-only denial, unchanged attempts/bindings/history and zero cleanup
operations. Tests fail closed and cleanup attempts every owned resource; no
success marker is emitted if cleanup or source binding checks fail.

Run after committing implementation and building its exact local image:

```sh
node scripts/run-gateway-online-archive-rehearsal.mjs sha256:<image-id> <full-source-sha> --snapshot-reuse
```

There is no live database override. A separate process reruns the wider comparison
to check restart-empty state; this is not a container crash or upgrade claim.

## Independently selected PR

Random selection from open PRs `[567,566,565,563]` selected
[PR #563](https://github.com/cloudbyday90/Classifarr/pull/563). Revalidated OPEN at
head `0876bcae4b6df28ac61eb49dea94ed2590c1efc3`, base
`7854126dc1eba599df25dd233e0307b1594ba3b0`. Implement Vue 3.5.44 and Pinia 4.1.0
locally without merging; use exact direct pins instead of the PR's caret ranges.
Keep unrelated upgrades and existing install/security policies out of this batch.

[Vue's official changelog](https://github.com/vuejs/core/blob/main/CHANGELOG.md)
documents reactivity/rendering fixes;
[Pinia's release commit](https://github.com/vuejs/pinia/commit/270a217851eae9f4b2d7fc3e3b05d98024348269)
includes shallow-ref patching and store-lifecycle fixes. Benefits: upstream fixes
and reproducible versions. Risk: runtime/store behavior changes despite compatible
peers. Verify focused reactivity contracts, full frontend coverage, types, lint,
production Chromium/build, strict clean installation, dependency tree and audit.

## Recommendation stack and deferred work

Use the unchanged production readers as authority, transaction-scoped summary
reuse only in the bound study, unchanged filesystem/restore fences, then observed
equality and cost evidence. Promote nothing automatically. The outcome document
will identify whether one duplicate merits a separately reviewed runtime change;
end-to-end pressure/load and crash/restore verification would still be required.

See the [measured outcome](gateway-snapshot-reuse-study-outcome.md) for results,
limitations, local image identity and the next bounded recommendation.
