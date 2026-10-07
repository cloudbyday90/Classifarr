# Post-stop comparison collection outcome

Date: 2026-10-07. See the [design, tradeoffs and official sources](comparison-post-stop-gc-design.md).

## Change

Added an optional five-minute natural major-GC observation to the isolated catalog
study. It requires exited workers, stopped consumers and drained admissions;
records only numeric memory/reference evidence; and distinguishes a qualifying
main-thread event from an inconclusive timeout. It never requests collection.
Weak references are sampled before and after, not polled during the wait.

Production services, cache limits, queue admission, retry/freshness/ownership
checks, schema and deployment templates are unchanged. No forced collection,
heap snapshot, remote inspector or artificial allocation pressure was added.
Counts are weak-reference registrations, not unique object or retained-byte
counts: a reused model can be registered more than once.

The recovery-change skill kept the work diagnostic-first and required a separate
outcome. The dependency-update skill kept the PR trial subject to the deployed
runtime contract. No release is part of this work.

## Verification

- Final backend run: 1,742 suites and 54,116 tests passed in 300.702 seconds;
  one platform-specific Windows skip. The first full run found only changed
  ownership-review digests for the three edited diagnostic launchers. Those
  complete paths were reviewed and only their three entries updated, with an
  explicit rationale; the final full run passed. Unresolved ownership debt was
  not reclassified or authorized.
- Initial focused checks: 12 suites / 405 tests passed. Final ownership/catalog
  retest: two suites / 91 tests passed. Coverage includes event filtering, queued
  delivery, timeout, forced flags, worker refusal, receipt bounds and scoped
  launcher options/cleanup. Mocked event tests are not natural-GC evidence.
- Server lint, typecheck, both Knip modes, static-import, copyright, npm CLI,
  Markdown and 40 tooling/install-policy tests passed. No gate was relaxed.
- The actual Linux image passed directory-fsync/exclusive-copy checks, including
  existing-target refusal and unchanged source, covering the Windows skip's
  filesystem behavior. This is not a database restore rehearsal.
- Schema dump and independent schema verification passed in separate disposable
  candidate-image containers. Both cleaned up; the tracked schema is unchanged.

## Random PR trial

Two PRs were open at fresh enumeration. Random selection chose
[#556](https://github.com/cloudbyday90/Classifarr/pull/556), immutable head
`9d74537d7917c248d15926f37b2e40ceba7559a4`. Its exact server manifest/lock diff was
applied locally: Node types 24.19.1 to 26.6.4, undici-types 7.24.6 to 8.9.0.
Registry integrity/dependency metadata matched. The runtime-major gate passed
8/8 before, failed 1/8 during the trial, and passed 8/8 after reverting.

No candidate install, dependency audit, merge or runtime upgrade is claimed.
Retaining Node-24 declarations is the recommendation; newer declarations would
allow APIs unavailable on the pinned Node-24 runtime. Other outdated packages
remain a separate bounded dependency batch, not implicit vulnerabilities.

## Exact image and observation

Source: `b1c7ff7e976538b078b5cc61b5a147e1e38d2b4f`.
The no-cache local Compose build produced
`sha256:aaff67b9616fdda1dd70ecdf07a15befac3aab916330da0af38cb67160e0b5f1`;
its OCI revision matches. Node remains 24.21.0. This image is locally built, not a
published release. The full catalog observation uses this immutable image with
allocation sampling and textual GC tracing disabled. Existing numeric memory
observers and the post-stop performance observer remain instrumentation.

The old local image is
`sha256:7aafbc29184c78b4e973894bc558e464219e6070a0e6b4c48e84ac96dc98e92a`.
The local database backup is
`.tmp/pre-memory-fingerprint-b5c175f0-4ea5-4106-9204-e7d220c401f9.dump`
(75,582,842 bytes), with verified checksum and readable archive listing. The exact
old image is retained as
`classifarr:pre-memory-b5c175f0-4ea5-4106-9204-e7d220c401f9`.
Backup readability is not proof of a successful restore. Unraid is untouched.

After the isolated study finished, only local Compose's `classifarr` service was
recreated with the measured image. Exact image/revision, existing data/media
mounts, user `1000:1000`, read-only root, `no-new-privileges` and 2 GiB limit were
verified unchanged. Nineteen samples over five minutes (20:06:32.595 through
20:11:29.293 UTC) were healthy, with zero restarts, OOM kills and memory-limit
hits. Raw container usage ranged from 338.42 to 916.16 MiB; kernel high-water was
923.01 MiB. These are container observations, not the application heap.

Read-only database checks found no comparison warning newer than 18:04:45.020
UTC, before replacement. Catalog readiness was initially `ready`, then
`backfilling` at the final check: the healthy startup window does not prove a
completed live-provider refresh. A helper process's memory-admission result was
not used as evidence of the main application's memory or cache state.

## Natural collection result

The isolated catalog run completed in 1,022.161 seconds, including 1,006.106
seconds of workload. It imported and completed all 5,776 items across ten
libraries, with 5,776 cached descriptions, no failed/pending/routing/handoff work
and no service errors. There were 36 refresh reads, seven builds and 15 worker
creations/exits. Consumers stopped with zero pending work and zero retained
groups; every admission category drained.

A natural main-thread major-GC event arrived about 15.9 seconds into the
post-stop window, with the idle flag (64), not the forced flag. All ten remaining
weak-reference registrations cleared: comparison handle, community vectors,
verification metadata, shadow/neighborhood batches and representative models.
Previously cleared source/snapshot registrations remained zero. These are sampled
registrations, not a census of every application object.

| Measurement | Before natural event | After natural event |
| --- | ---: | ---: |
| Main-thread heap used | 394.46 MiB | 39.82 MiB |
| Process RSS | 567.36 MiB | 555.04 MiB |
| Container memory | 917.59 MiB | 897.61 MiB |

Peak sampled main-thread heap was 613.11 MiB, process RSS 783.36 MiB, and kernel
container peak 1,153.12 MiB. No OOM kill or memory-limit hit occurred. Ingestion
and queue memory admission deferred work 34 and 88 times respectively; work
subsequently drained. Discovery had no memory-pressure refusal, so the receipt
correctly reports `pressureRecoveryObserved: false`. This run does not establish
the optional comparison pressure-to-recovery transition.

The result supports collection of the tracked objects after shutdown, not a
general no-leak claim. RSS did not fall with the JavaScript heap. No runtime
memory improvement is attributed to this diagnostic change, and separate runs
are not a controlled peak-memory comparison.

[Node's memory API documentation](https://nodejs.org/download/release/v24.21.0/docs/api/process.html)
distinguishes whole-process RSS from current-thread heap/external accounting;
ArrayBuffer memory is already included in external memory. These figures must
not be added as disjoint buckets. The documented glibc fragmentation example
does not establish this Alpine image's cause; no allocator change is justified
by the present evidence.

The existing [resident-memory observer](comparison-resident-memory-design.md)
also captured complete before/after process rollups. Study-process anonymous PSS
fell from 510.02 to 488.73 MiB, while reported V8 committed main-thread heap fell
from 450.84 to 74.36 MiB. PostgreSQL PSS stayed near 129.94 MiB and cgroup cache
near 299.23 MiB (including 100.66 MiB shared memory). The observation therefore
already separates a substantial Node anonymous footprint from PostgreSQL/cache;
the missing evidence is its native/mapping-level cause and subsequent lifetime.
These asynchronous measurements are not an additive accounting identity.

Receipt:
`.tmp/resource-study/classifarr-resource-study-e9b041750bb15ff758a0ef8695f02bf5/result.json`.
SHA-256: `5586cf46ac5435a951c0553c68a6a6cb1a7204d160b13f744e5325b892d2ec7a`.
The runner reported cleanup passed; no containers, networks or volumes for its
exact project remained. Raw trace and receipt stay in ignored local evidence.
The sibling `comparison-trace.json` SHA-256 is
`105421994974c60a7d41fb4cf7876a68075264ea615a1367e8c69a16cca67857`.

## CI finding

The source [CI run](https://github.com/cloudbyday90/Classifarr/actions/runs/37677016163)
failed its database job in the existing queue-maintenance integration test:
`eligible backend recovery vacuums real dead tuples only after durable admission
on an idle platform`. It raised `QueueVacuumAttemptError:
queue_vacuum_attempt_unverified`. The other 2,937 integration tests passed, with
one skip. Neither that executor nor its test changed in this patch. A fresh local
isolated reproduction passed all 13 cases in the affected suite; that does not
resolve or invalidate the CI failure.

The same source passed Build and Test (including coverage, browser and image
smokes), Fresh Install and Published Upgrade, OSV, Trivy, CodeQL, Gitleaks,
Copyright and Resource Capacity Regression. The failed database job still makes
the source unsuitable for a green-CI or release-ready claim.
Run attempt 1 concluded failed; its release-acceptance readout correctly blocked
isolated runtime acceptance, and publication/promotion jobs were skipped. The
release-evidence skill kept these remote results separate from local-image
evidence; no earlier passing run was substituted and no gate was waived.

The CI output omitted the error's sanitized category and diagnosis. The test
re-enables table autovacuum immediately before maintenance, leaving a possible
concurrent-maintenance race. That is a hypothesis, not an established cause.
PostgreSQL's official [VACUUM documentation](https://www.postgresql.org/docs/18/sql-vacuum.html)
confirms that `SKIP_LOCKED` can skip a conflicting relation. Keep the executor's
completion verification and durable cooldown intact; do not turn a skipped or
unverified attempt into success to make the test pass. No blind retry or gate
waiver was used.

## Recommendation stack

1. Diagnose the queue-maintenance CI failure first. Preserve a bounded sanitized
   category, notices and before/after completion counters in an isolated test
   reproduction, then distinguish contention from observation/verification
   failure. A local pass alone is not sufficient release evidence.
2. Use the existing resident-memory observer as the baseline for a controlled
   native/anonymous-memory investigation on the same image. Establish whether
   the post-GC anonymous footprint persists or falls during a bounded quiescent
   period, then isolate its mapping/native-allocation source before choosing an
   allocator, cache or worker-lifecycle change. Do not repeat the already-present
   Node/PostgreSQL/cgroup separation as though it were missing.
3. Keep representative membership/fingerprint temporary-allocation work as a
   separate measured optimization, with unchanged memory admission and results.

The benefit of resident-memory attribution is that it follows the observed gap;
the cost is additional platform-specific instrumentation. Another cache rewrite
now would be simpler to propose but lacks a demonstrated retained-reference
cause. Forced collection or relaxed limits would change the experiment and are
not recommended.

## Follow-up: queue fixture boundary

The [queue-maintenance follow-up](queue-vacuum-verification-outcome.md) reproduced
autovacuum competing after admission and corrected the success fixture, with a
separate deterministic test for the skipped-attempt cooldown. Production
verification remains unchanged. That reproduction does not retroactively prove
the exact cause of the historic CI failure. Continue with the native/mapping-level
investigation above once the new source's CI evidence is checked.
