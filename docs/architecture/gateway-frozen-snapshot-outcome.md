# Gateway frozen-snapshot outcome

## Scope and artifact

Implemented on main on 18 October 2026, following the user's selection of a
versioned format without an inference admission fence. The
[design](gateway-frozen-snapshot-design.md) records the official-source research,
alternatives, format contract and agreed safeguards.

Runtime source: `291fc79a3944d12934ce0c9389bbb48f40f9d1fe`.
No-cache local Compose image:
`sha256:7892a5c37ab65a813b10befe2fc371d9e25abc6c155197499971521b2e7e6c98`.
The inspected image revision label matches that exact source. This document is a
later documentation-only addition, not another runtime image build.

No release, tag, PR merge, Unraid provisioning, Plex mutation or shared Ollama
change is part of this work. New scheduled catalogs use manifest v7/catalog v3;
the explicitly provisioned optional schema has a timestamped function migration.
No new tables or identity schemes were introduced; native UUIDv7 remains required.

## What changed

Planning and export now share one bounded, read-only repeatable-read source
transaction. Its context belongs to that live session and cannot authorize a
later or different session. Inference admission and completion continue to commit
independently. Inference-only archives retain their existing format.

The new catalog representation preserves the exact frozen dump's hashes and a
separate, bounded canonical record of the newly admitted job. Publication binds
that record to the actual immutable job. The private verifier checks frozen
history and reconstructs the original attempt/cooldown before inserting exactly
that record with its restricted login. It then seals privileges/guards and checks
the resulting relationships. A supplement cannot replace a row or create runtime
recovery or purge authority.

Cancellation still rolls back the source read transaction. A cancelled result is
returned only after the admitted failure was recorded durably; a failed write
stays uncertain. Repeated work does not regain an attempt or bypass its cooldown.

## Source-level verification

- 563 gateway unit tests passed across 29 suites, including strict canonical
  admission validation, restore ordering, cancellation and persistence failure.
- 333 real-PostgreSQL integration tests passed across 19 suites on the final
  source. Tests cover live inference changes during frozen reads, original budget
  reconstruction, SQL-side tamper refusal, explicit migration parity, preservation
  of old jobs/cooldowns and refusal of unfinished upgrades.
- Lint, server/client types, Knip, static ESM, strict mock shapes, copyright,
  secret and whitespace checks passed. No current full-suite coverage claim is
  made from these scoped runs.
- GitHub MCP enumeration returned zero open PRs. None could be randomly selected,
  copied or merged; the approved primary work continued.

Local detailed logs are ignored/regenerable `.tmp/frozen-snapshot-*.log` files.

## Completed image rehearsals

The exact image passed the existing online archive/catalog/retention rehearsal:
private restore-input checks, actual restricted SQL restore, concurrent synthetic
inference, older-format compatibility, downgraded receipt and inventory refusal,
late dependency-file tampering, interrupted retirement and two-copy retention.
It preserved source history and attempt counters and cleaned up its disposable
containers, volumes and data directory.

Scheduled v7 initial capture, isolated restore and acceptance passed. Unchanged
history stayed quiet. The mixed v6/v7 handoff preserved historical jobs and shared
attempts and released obsolete files only after two replacement roots. Its
disposable resources were also verified removed.

All six catalog qualification scenarios passed: 10,000-job capacity with live
concurrent admission; lost publication acknowledgment; lost retention
acknowledgment; killed export; wide history; and protected evidence. Uncertain
exports stayed fenced, actual committed publication/registration was respected,
and shared attempts/cooldowns were not refunded. Each scenario reported zero
provider calls, zero synthetic deleted bindings and verified cleanup.

The protected-evidence case performed actual restricted restores for 400 archives
in 20 batches, preserving 9,575,599 bytes of evidence and 9,296,502 bytes of full
payload. Tampered evidence blocked both archiving and cleanup. With valid fixture
evidence restored, the final v7 catalog passed actual restore, complete historical
row/dependency checks and the unchanged attempt limit. No live cleanup was run.

The wide-history fault case used 3,001 rows and 233,852,666 bytes of stored job
metadata. Both new catalogs passed actual isolated restore. Oversized untrusted
evidence was refused without changing history or counters. Archiver lifetime
cgroup peak reached 268,435,456 bytes (its existing 256 MiB cap); the two catalog
verifier peaks were 552,222,720 and 550,400,000 bytes. Those readings include file
cache, not just JavaScript heap. No OOM or PID-limit event was recorded. Passing
does not establish spare archiver memory capacity.

## Unchanged eight-minute concurrency regression

The same strict soak that previously failed with two `source_changed` captures
passed without relaxed acceptance conditions. It used the existing 528-request
schedule, 650 ms synthetic provider, one-minute before/after phases, six-minute
archive phase, real five-minute worker cadence and unchanged service limits.
The seeded 3,000 historical rows occupied 233,852,566 bytes.

- All 480 foreground requests completed; all 48 background responses were the
  expected busy refusals. No requests were dropped, and no offered request was
  more than 1.431 ms late. Provider concurrency peaked at one.
- Both scheduled catalogs were actually restored, accepted and recorded verified
  at attempt 1. There were no failed catalog jobs or counter resets. Final
  admission attempts/binding count were both 481, including the initial
  prerequisite request, with no active request. All 480 load records retained
  unique fingerprints and UUIDv7 request IDs.
- New requests were admitted during both observed `pg_dump` windows (3 and 4)
  and both `pg_restore` windows (3 and 3). This is observed process/work overlap,
  not merely successful requests before and after maintenance.
- Cleanup operations remained zero. The post-load assessment correctly reported
  `catalog_not_due`; it did not force another export or advance retry deadlines.
- The runner and independent label checks confirmed removal of disposable
  containers/volumes; the runner also verified its data directory was removed.

| Phase | Foreground completions | Expected busy | Request p95 (ms) | Pre-claim p95 (ms) |
| --- | ---: | ---: | ---: | ---: |
| Before | 60 | 6 | 1265.525 | 607.395 |
| Archives active | 360 | 36 | 1264.688 | 607.501 |
| After | 60 | 6 | 1263.491 | 607.220 |

Pre-claim time includes admission preparation and contention; it is not an exact
queue-wait measurement. These single-run phase differences do not establish a
statistically significant performance improvement.

| Cgroup during the soak | Peak bytes | Approx. MiB |
| --- | ---: | ---: |
| Source DB plus synthetic provider/gateway/load driver | 384913408 | 367.1 |
| Scheduled archiver | 268435456 | 256.0 |
| Scheduled catalog verifier | 692957184 | 660.9 |

No recorded OOM or PID-limit event occurred. Lifetime cgroup peaks include file
cache, not just heap; this host used cgroup v1. The fixture's 20 ms event-loop
histogram reported p95 20.201 ms/max 47.383 ms. No heavy build/test ran alongside
the soak, but unrelated host applications were not stopped or controlled.

The source had its existing 2 GiB/2 CPU/512 PID limits, archiver 256 MiB/0.5 CPU/32
PIDs, and verifier 1.5 GiB/1 CPU/64 PIDs. The networkless verifier had no source
socket, provider credentials or Docker socket. No real Ollama requests were made.
Synthetic padded history is compressible; this is not a worst-case dump-size,
long-duration memory, real-model throughput or Unraid-capacity qualification.

## Tradeoffs and remaining limits

| Choice | Benefit | Cost or limitation |
| --- | --- | --- |
| One frozen read view | Removes the planning/export race without pausing inference | Holds old database tuples until the bounded transaction closes |
| Explicit admitted-job record | Preserves both exact dump evidence and immutable admission | New format and compatibility surface; older binaries cannot consume v7 |
| Restricted isolated restore | Checks actual SQL and complete logical relationships | Adds bounded CPU, memory and I/O; hashes alone are not independent trust |
| Preserve uncertainty and budgets | No silent retry refund or invented successful recovery | An ambiguous interrupted job can still require reviewed recovery |

The optional schema/role capability upgrade is explicit, not a normal application
startup migration. Older archives remain readable; populated stores are not
downgraded, rewritten or rekeyed. The verifier has no source SQL socket, provider
credentials, host ports or Docker socket. Synthetic local evidence is not proof
of Unraid capacity or real-model latency.

## Local Compose refresh and recovery point

The normal local service was refreshed with `--no-build --no-deps --pull never`
after the protected no-cache build and successful image rehearsals. Container
`bb976d53e7b2abebff65e12aebc6e52ff12515f7a5a91349f038aa30021beea9` uses the
exact image/revision above and is healthy. `/health` and
`/api/system/health/ready` reported connected/healthy and connected/ready;
`/` returned HTTP 200.

Before and after refresh, the normal local database contained zero optional
gateway/archive/cleanup/catalog schemas. Capture budget revision remained 2,
all call/token/reserved counters remained zero, and `next_check_at` remained
`2026-10-09 16:50:11.617278-04`. No optional worker was activated or provisioned.

Fresh pre-refresh backup, ignored/private:
`data/backups/gateway-frozen-snapshot-ready-20261018.dump`, 76,239,907 bytes,
mode 0600, SHA-256
`ef73a498930d24102610fa777a66a3f7f52d093773dd7bf0ea07aa2ac73f918d`.
Its `pg_restore --list` succeeded; that is not an actual restore of the local
database. The earlier task backup is also retained. The previous local image
remains under
`classifarr-local-rollback:2ccc1108855d34b36045a0a17a96cdf45b4b751bedd228636c677cfa44390839`.
No Docker prune or removal of user data occurred.

## Recommendation stack and next item

Keep the selected stack: one frozen source view, independently fenced immutable
admission, bounded versioned export, restricted isolated full restore, then
verified retention. It removes the observed race while preserving inference and
existing uncertainty, resource, attempt and cooldown safeguards. It does not add
admin buttons, authorize purge or enable automatic live recovery.

Next: a longer bounded synthetic load/rotation study with less-compressible
history and repeated verified replacements. Measure steady-state memory/cache,
transaction lifetime, I/O and retention-pin behavior before further reducing
duplicate fingerprint passes. The archiver's observed cap-level peak and this
fixture's compressibility warrant that study. Any later reuse should stay within
one validated live snapshot, not become a cross-run trust cache or skip evidence
checks. No Unraid or shared-provider deployment is authorized by this outcome.
