# Image-index repair capacity outcome

## Delivered

`node scripts/run-resource-study.mjs --image-index` now runs the real compatible
maintenance child against disposable synthetic data. Separate ESM modules own
the fixture, worker lifecycle, observations, receipt validation and Markdown
summary. The existing Compose launcher supplies fresh-install checks, immutable
image identity, maintenance-mode isolation, resource limits and verified cleanup.

Production repair budgets, API contracts, schedules, schema and templates are
unchanged. This adds execution evidence, not a new recovery authority.

## First local measurement — 1 October 2026

Docker 29.8.1 reported 16 CPUs and 16,731,422,720 bytes of host memory. The
disposable application used cgroup v1, a 2 GiB memory ceiling and host-default
unlimited CPU/PID quotas. The study completed in 183.56 seconds, including
synthetic seeding and the interruption check.

| Scenario | Vectors | Outcome | Seconds | Valid indexes | Raw container peak MiB | Worker RSS peak MiB | Container CPU p95 cores |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| Small build | 1,000 | Complete | 1.02 | 3/3 | 177.8 | 70.3 | 1.11 |
| Recovery after interruption | 1,000 | Complete | 1.01 | 3/3 | 194.5 | 68.3 | 1.11 |
| Large build | 10,000 | Complete | 19.74 | 3/3 | 734.1 | 68.1 | 1.10 |
| Capacity build | 50,000 | Incomplete | 120.43 | 0/3 | 2,035.9 | 70.1 | 1.17 |

The 50,000-row worker exited with code 1, without the study watchdog firing.
Its runtime is consistent with the existing 120-second executor deadline, but
the production child's sanitized exit protocol does not expose the exact SQL
failure cause. Of 238 polling observations, 237 saw the building phase, 19 saw
an I/O wait and none saw a lock wait. These are sampled observations, not exact
wait durations or proof that no short lock wait occurred.

The intentional interruption observed the writer-wait phase, stopped the child,
waited separately for its PostgreSQL DDL to stop, verified an invalid index and
rotated the claim. The old claim was rejected; the replacement completed and
all three index definitions were valid. Synthetic row counts, vector dimensions
and identity sums were preserved. No OOM, memory-limit-hit or PID-limit-hit
counter increased. Every worker and observed DDL stopped, and the launcher
removed and verified absence of its owned container, volume, network and image.

Raw container memory includes file cache and all container processes. It is
not Node RSS or a cache-adjusted Docker CLI value. PostgreSQL backend sampled
RSS was 151.4 MiB in the largest case; RSS can include shared mappings. The
study did not measure anonymous/cache decomposition or establish a memory leak.

The first receipt is local at
`.tmp/resource-study/classifarr-resource-study-bd168a1f675cc2e234a4bb2730d85680/result.json`.
Its immutable image was
`sha256:4d1eef140093f946dfcc9264a4cd0ca679563ce2ecdad5088a8529cadff8eebc`.
Raw generated artifacts are ignored; this document preserves the useful outcome.

## Repeat measurement

A second fresh disposable installation reproduced the outcome: 1,000-row build
and recovery both completed, 10,000 rows completed in 27.95 seconds, and 50,000
rows remained incomplete after 120.25 seconds (exit 1; no study watchdog).
All data/claim/cancellation checks and owned cleanup passed again. No OOM or
limit-hit counter increased. The largest build sampled 1,992.1 MiB raw container
memory, 70.2 MiB worker RSS, 198.2 MiB PostgreSQL backend RSS and 1.21 CPU cores
at p95. Its 237 observations included 236 building, 15 I/O-wait and zero lock-wait
samples. Total study duration was 204.28 seconds.

The repeat container reported PostgreSQL 18.6 and pgvector 0.8.6. It used image
`sha256:bb79060068672e0363633fc8448abee2be83700f982823c8d17938bcf319c97f`;
receipt:
`.tmp/resource-study/classifarr-resource-study-f2a65ad88c6a9d97440449d70db336f3/result.json`.
This includes the tightened receipt checks added after the first run, not a
production executor change. Host test suites ran concurrently during the repeat;
timing differences are not a controlled performance comparison. Two runs show
a repeatable local capacity boundary, not a universal 50,000-item threshold.

## Verification and scope

- Focused tests: 124 passed across four suites, covering fixed receipt categories,
  incomplete-vs-complete semantics, missing RSS telemetry, SQL filtering, fixture
  bounds, environment refusal, child teardown, claim rotation, restore refusal
  and Compose cleanup.
- Full frontend coverage: 412 suites and 5,835 tests passed. Statement coverage
  86.14%, branches 78.80%, functions 85.59%, lines 88.05%.
- Full backend coverage: 1,598 suites and 48,868 tests passed, with one existing
  skipped test. Statement/line coverage 90.02%, branches 85.32%, functions 91.71%.
  All five new server study modules have 100% line coverage; worker function
  coverage is 66.66% and branch coverage 93.33%, so this is not a claim of
  exhaustive failure-path coverage. The combined coverage ratchet passed
  without changing thresholds.
- Lint, server/client type checks, documentation lint, CI preflight, ownership
  inventory, naming/language/delivery/runtime-maintenance gates and ESM checks
  passed. No production dependency or frontend code changed.

GitHub MCP and the saved GitHub CLI login both returned no open PRs for
`cloudbyday90/Classifarr`; no random PR could be selected or implemented.
No PR was merged, release created, version bumped or live container updated.
The ownership review explicitly covers the isolated tooling; all 490 existing
unresolved writer classifications remain unresolved.

## Recommendations and tradeoffs

Retain the current fixed operation, claim fencing, verified catalog recovery and
durable automatic-attempt limits. The small recovery succeeds, but the observed
large build does not fit the current execution window. Repeating it with the
same limits may consume its automatic attempts without resolving the problem.

The preferred next component is a **capacity-aware image-index repair policy**:
distinguish bounded timeout, lock contention and other failures, then evaluate
one explicitly resource-admitted larger-build execution class. Keep single-flight
operation, interruption cleanup, ingestion/backfill priority and durable retry
limits. Do not globally raise memory, reset attempts or require template edits.

The benefit is a path for large installations to complete repairs rather than
repeat ineffective attempts. The cost is longer database occupancy and a need
to validate cancellation and memory pressure under concurrent workload. Changing
to half-precision or another index representation is an alternative, but adds
schema, compatibility and search-recall validation beyond this execution study.

The next component's acceptance criteria should include completion of this
50,000-vector fixture within its declared finite budget, retained interruption
and stale-claim checks, no OOM/limit-hit events, and measured foreground impact
under concurrent ingestion. Failure categories must be fixed and secret-free;
large-build eligibility must not silently reset an exhausted repair episode.

The recommendation stack is: fixed safe worker; honest catalog and failure
evidence; size-aware bounded admission; mixed-load validation before activation.
Official source links, alternative tradeoffs and W3C report considerations are
in the [design document](image-index-resource-study-design.md).
