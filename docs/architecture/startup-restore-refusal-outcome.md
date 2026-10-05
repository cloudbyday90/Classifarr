# Startup restore refusal outcome

Date: 2026-10-04 (US Eastern).
Base: `572964e0d6f88064cb22f746cf18dc8f64714af7`.
See the [design, sources and tradeoffs](startup-restore-refusal-design.md).

## Finding and change

[Run 37248416500](https://github.com/cloudbyday90/Classifarr/actions/runs/37248416500)
passed Build and Test and Tests with Database. Installation acceptance failed
at `normal_rejection` after intentionally interrupting a restore. The downstream
release readout correctly blocked; image publication and release did not run.
The tested source was `2621ecae3f2d881d5292f9e62e9ade331e4d8b4e`, not this fix.

The schema worker already rejected unverified restore state, but collapsed its
reason into generic exit 1 while its parent discarded child output. Added a typed
schema refusal and reserved child exit 78. The parent emits only a fixed message
after exit and stream closure, still prevents application startup and stops the
database. Cleanup failures, signals, excess output and unrelated exceptions do
not acquire that classification. Raw child logs remain discarded.

No acceptance predicate was loosened. No schema, dependency, template, API,
permission or version change; no release and no live Unraid access. This does not
resolve unknown legacy ingestion ownership or activate protected conversion.
The saved GitHub CLI login returned no open Classifarr PRs, so no random PR was
available to implement or merge.

## Verification

Focused validation: five suites, 216 tests passed. Server lint and type checking,
CI preflight, ESM import/mock checks and Markdown lint passed. The ownership
review covers only the five changed/new startup dependencies; no unresolved path
was waived. Gate: 19 owned, 272 separately coordinated, 502 unresolved, fingerprint
`d35ba6927620d2b1a5a56135357db6e49942234d6b04aeb271ceb0526b008b84`.

Full backend validation passed: 1,685 suites, 51,950 tests, one skipped, in
319.567 seconds. The existing Linux directory-fsync unit test is skipped on
Windows. No full client test/coverage, new remote CI success or native ARM64
result is claimed here. The client production build passed inside the image.

## Image and local evaluation

The no-cache Compose build used clean code commit
`4b71d3097bd42286f178581226611f567c55c6bb`. Docker image ID:
`sha256:f12d8c5fb64e63382ba17f51981fc8cb4cd190bbf4fc44373cad4dbcd84f004e`.
The OCI revision matches; this is local Linux AMD64 evidence, not published
candidate attestation. PostgreSQL 18 schema dump/load/dump passed with zero drift
in an isolated temporary container; the tracked schema is unchanged.

The exact-image isolation drill passed all 12 core checks in 148,730 ms, including
real encrypted restore, restricted HTTP routing, interrupted manual/queued routing,
schema-before-runtime handoff, selected layout recovery and PostgreSQL restart.
Reported orchestrator peak RSS was 94,524 KiB, not total container memory. Saved
standard, custom UID 2345 and Unraid UID 99/GID 100 profiles passed; observed stops
were 2,545, 2,569 and 2,794 ms within unchanged 10-second host timeouts. Disposable
project `classifarr-isolation-drill-ebf56fd45bc2b1baf4856c175383b4af` cleanup passed;
its synthetic volumes and aliases were removed, not live data or the caller image.

Local Compose was recreated without another build and became healthy, HTTP 200,
zero restarts, no OOM. First sample: 0.88% CPU, 399.4 MiB of 2 GiB, 47 PIDs.
Existing UID 1000, read-only root filesystem and memory limit are unchanged;
local Compose still has no explicit CPU/PID limit. A short sample is not a soak.
Later sample: 0.63% CPU, 422.4 MiB, 48 PIDs; process inspection found one
application, one supervisor and zero compatible maintenance workers. After the
startup scan, read-only queries found one `mediaSync` warning and no errors:
Movies still has six legacy running records and no ingestion state. Family is
complete at 864/864 with no legacy running records. The existing warning was
neither suppressed nor repaired by this change.

The first fixed-image upgrade invocation stopped before Docker resource creation
on baseline attestation failure. Verification succeeded on retry with the same
saved CLI identity; no provenance check was disabled.

The attempted old-image comparison passed fresh crash/backlog recovery but was
inconclusive for restore: after rebuilding `latest`, the old untagged image ID
was no longer addressable at `candidate_upgrade`. Cleanup completed; this is not
evidence of an old-image restore failure. Preserve a separate tag before future
before/after rebuild comparisons. The original CI receipt remains the observed
`normal_rejection` failure.

The fixed-image bounded rehearsal
`classifarr-upgrade-drill-2a353f8d311dec17b9290d53da57e7b3` verified the pinned
published baseline, fresh scheduler/backfill crash recovery, persisted-volume
migrations, actual container kill during restore, specific normal-startup
refusal, rollback plus explicit verified retry, movie/TV recovery handoff and
verified normal restart. The acceptance runner and its refusal predicate were
unchanged. All 12 installation checks and final cleanup passed. The immutable
published baseline is `v0.48.4-beta`, source
`a0e417fd714919bb4ca30e20f9cd2380136ca74e`, image
`ghcr.io/cloudbyday90/classifarr@sha256:dc95fcdd80123b6bbf5b252fec286d9e81fbbc21a1030087c0a44abacd6a187f`.
Its saved deployment configuration was unchanged; the migration ledger advanced
from 222 to 322 entries. Both baseline and candidate reported PostgreSQL 18.6.

Fresh and upgraded scenarios used enforced 2 CPU, 2 GiB and 128 PID limits. Both
survived intentional connection exhaustion with SQLSTATE `53300`, recovered a
fresh connection and retained healthy status. Neither reported OOM, memory-limit
hits or PID-limit hits. This is bounded synthetic pressure, not a long-term soak.

| Check | Fresh | Upgraded |
| --- | ---: | ---: |
| Restart readiness | 6,520 ms | 6,359 ms |
| Original small-backfill recovery | 28,916 ms | 32,923 ms |
| Completed backlog tasks | 600 | 600 |
| Interrupted / reclaimed claims | 5 / 5 | 5 / 5 |
| Total task starts | 605 | 605 |
| Duplicate completions / early reclaims | 0 / 0 | 0 / 0 |
| Post-restart backlog observation | 583,875 ms | 589,864 ms |

The ten-minute visibility periods elapsed naturally. Sibling work progressed
before interrupted claims expired; inventory, committed ingestion and task IDs
were preserved. The owned project, volumes and network were removed after success.
The caller image and normal local Compose data were retained. This exercised the
published-upgrade producer with resource budgeting, not a complete new remote CI
run or the separate installation-with-routing receipt assembler.

## Recommendation

Keep the typed refusal and strict real-image restore test. This preserves both
operator diagnostics and fail-closed behavior, at the cost of a small explicit
worker exit contract. The recovery and release-evidence skills guided the
unchanged admission rule, secret-safe reporting and separate image proof.

Next: resume protected startup/restore integration with the verified application
layout. Fully unattended legacy ownership recovery still depends on production
writer isolation; this diagnostic repair must not be presented as that feature.
