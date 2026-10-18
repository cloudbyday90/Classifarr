# Gateway extended study outcome

## Result: extended load blocked, not certified

Implemented on main on 18 October 2026. The
[design](gateway-extended-study-design.md) records the approved 30-minute
normal-cadence study, separate controlled rotation drill, official-source
research, alternatives and safeguards.

The varied-history experiment found a repeatable SQL timeout **before a new
catalog was admitted**. It was stopped rather than presented as a successful
archive/inference concurrency study. No complete 30-minute run, settled-memory
trend, archive headroom or leak-freedom claim is made. Production query timeouts,
resource limits, schedules, cooldowns and attempts were not increased or reset.

No release, tag, PR merge, production provisioning or live recovery occurred.
Unraid, Plex and shared Ollama were not touched. All provider traffic was
synthetic and loopback-only. There are no new tables or identities; existing
native UUIDv7 checks remain required. GitHub MCP enumeration found no open PRs,
so none could be randomly selected or implemented.

## Source and artifacts

| Subject | Exact identity |
| --- | --- |
| Initial study implementation | `cc622e28d447041090ad757f0312f5fec9ec1354` |
| Initial no-cache image | `sha256:321dd1768cfb261513725dcd5f709925beba76a517330c72f90afb4591ce4aeb` |
| Final fail-fast harness source | `410a0276f1c9dee9c45f085f0c816a869f8fc24f` |
| Final no-cache image | `sha256:24577b34af9532c6312a151d4d41cc3ae68890b1c1a1345f171120ae56bd5f50` |

Both local Compose builds used `--no-cache`, required clean-source provenance
and protected the running image. Inspected revision labels match their respective
source commits. These are local Docker image identities, not published-registry
or multi-platform acceptance evidence. This outcome is a later documentation-only
addition. The second source change affects the study harness, not the application
archive query or its production policy.

## CI ownership review correction

The prior main run,
[39133557611](https://github.com/cloudbyday90/Classifarr/actions/runs/39133557611),
failed its ownership-drift step because the v7 verifier and catalog loader had
changed without corresponding reviewed source fingerprints. Later build stages
were skipped; this was not evidence of a failed application build.

Reviewed the verifier, loader, sealer, callers and new admission-restore helper.
Updated only the two stale records and added an explicit dependency pin/review
for `catalogAdmissionRestore.mjs`. The existing separately-coordinated rationale
now covers the private v7 restore boundary. It does not authorize ingestion
writes, arbitrary supplied clients, live recovery or purge. The 100-review cap,
unresolved writer debt and fail-closed gate remain intact. Tests reject a
non-SQL change to the pinned helper. No whole-baseline regeneration was used.

## Successful checks

- Source checks: 20 bounded study-contract tests and 603 targeted backend tests
  across 30 suites passed. Ownership/preflight, copyright, both Knip modes,
  server/client lint and type checks, ESM checks, workflow contracts, syntax,
  whitespace and staged secret scans passed. These are scoped checks, not a
  full-suite coverage claim.
- The initial image passed three controlled rotation cycles: seven historical
  inference archive jobs and eight catalog jobs remained recorded; six roots
  were retired and exactly two retained. Each cycle verified obsolete-file
  removal, released old pins and preserved historical rows/counters. Admission
  attempts progressed 3 → 5 → 7. Catalog shared attempts remained `[2,3]` for
  each history revision. No cleanup operation was created.
- The initial image passed the existing mixed v6/v7 scheduling handoff and quiet
  checks. The scheduling observation was deliberately simulated; clocks and
  stored deadlines were not edited. Captures/restores/registration/retirement
  were real. This does not prove that a daily interval elapsed.
- The initial image passed the unchanged eight-minute profile: 480 foreground
  successes, 48 expected busy responses, two accepted catalogs at attempt 1,
  480 unique fingerprints and UUIDv7 load identities, and final admission and
  binding counts of 481 including the prerequisite. No active request remained.
  Observed dump windows overlapped five admissions each; the observed restore
  window overlapped four. Cleanup operations stayed zero.

| Eight-minute phase | Request p95 (ms) | Pre-claim p95 (ms) |
| --- | ---: | ---: |
| Before | 1290.094 | 612.692 |
| Archives active | 1267.852 | 609.260 |
| After | 1263.965 | 606.704 |

Maximum offered-arrival lateness was 0.771 ms. Source lifetime cgroup peak was
376,754,176 bytes; the loop verifier peak was 546,910,208 bytes and its post-load
verification peak was 646,991,872 bytes. These include cache, are not settled heap
measurements and do not demonstrate a statistically significant speedup.

## The larger-history finding

The first extended fixture contained 3,000 failed historical jobs:

| Measurement | Bytes |
| --- | ---: |
| Failed-history canonical logical data | 233,849,311 |
| Main relation | 1,744,896 |
| Indexes | 1,622,016 |
| TOAST relation and its indexes | 242,466,816 |
| Total relation storage | 245,866,496 |

The all-job logical total was 233,852,609 bytes. Deterministic public varied
padding replaced repeated-character padding, without changing row count or
production limits. PostgreSQL dumps already use `--compress=0`; this experiment
changed source/restore storage characteristics, not dump compression.

PostgreSQL recorded `canceling statement due to statement timeout` at
`2026-10-18T19:23:48.327Z` and `2026-10-18T19:28:52.319Z` for the maintenance
connection's `readArchiveHistory` query. The second occurrence followed the
normal five-minute assessment interval, not a forced retry. Both assessments
stopped before catalog admission. The final pre-stop sample showed 3,000 failed
history rows, the one verified prerequisite archive, zero catalog jobs and zero
cleanup operations. Its in-flight admission snapshot was not a drained result.

A read-only, non-executing `EXPLAIN` through the packaged query showed a hash
left join and sort before the selected-row limit/materialization, followed by
metadata byte accounting. A whole-row reference used for conditional evidence
hashing may retain wide payloads through that plan; this is a hypothesis, not a
measured operator-level diagnosis. We did not run additional heavy profiling
queries inside the traffic measurement or raise the four-second timeout.

The first fixture was stopped after the repeated failure, around 6.6 minutes of
traffic. The runner exited nonzero and verified removal of its labeled containers,
volumes and disposable data directory. Full source/worker trend evidence was not
produced; that absence is not a successful observation.

## Fail-fast harness follow-up

The final wrapper now stops an extended worker immediately on `archive_blocked`,
emits bounded partial observations with explicit failed coverage and exits
nonzero. The runner retains those records before enforcing the failed exit.
This does not change production behavior or the original regression profile.

The final image reproduced `archive_blocked` on its first larger-history
assessment. Automatic shutdown saved five observations spanning 4.684 seconds,
with `coveragePassed=false`; the host runner returned exit 1 without a manual
stop. The observed archiver peak charge was 33,751,040 bytes and its lifetime
peak 34,082,816 bytes, with no recorded OOM/PID/limit event during that brief
window. No dump was in progress. PSI and I/O observations were unavailable, not
zero. None of these partial samples establishes normal archive memory headroom.

Both failed fixtures and all successful rehearsals verified owned-resource
cleanup. The final image also passed all three separate rotation cycles, including
the same historical row/counter, two-copy, old-pin and obsolete-file checks.
Detailed local logs are ignored, regenerable `.tmp/extended-study-*.log` files.

## Local application and rollout decision

Do not refresh normal local Compose while the larger-history acceptance check
is blocked. It remains on its prior healthy image
`sha256:7892a5c37ab65a813b10befe2fc371d9e25abc6c155197499971521b2e7e6c98`.
Health, readiness and UI returned HTTP 200. Optional gateway schemas remain absent;
capture budget revision 2 and all call/token/reservation values remain unchanged
at zero. Existing private backups and protected rollback images were retained.

## Recommendations, tradeoffs and next stack

| Option | Benefit | Risk / conclusion |
| --- | --- | --- |
| Increase SQL timeout or worker resources | May let the query finish | Conceals its cost and changes the approved limits; not selected |
| Cache trust across assessments | Avoids repeat work | Can hide changed history/files and weaken fencing; reject |
| Profile and narrow metadata/evidence work under existing limits | Addresses the observed failure without changing policy | Requires SQL-plan, complete-history and tamper equivalence proof; recommended next |
| Purge failed history | Reduces data quickly | Deletes diagnostic/recovery evidence without authority; reject |

Next: reproduce the query in a separate disposable, read-only diagnostic lane;
collect bounded `EXPLAIN (ANALYZE, BUFFERS)`/spill and CPU evidence; compare narrow
projections and selective evidence hashing without removing full-history guards.
Only then implement the smallest equivalent query change. Preserve protected and
retired evidence, row/byte caps, fingerprints, attempts, deadlines and cancellation.

PostgreSQL's official [EXPLAIN documentation](https://www.postgresql.org/docs/18/sql-explain.html),
discovered/opened through MCP on 18 October 2026, distinguishes plan estimates
from actual execution/profiling overhead. Use that separation; do not infer the
operator bottleneck from a plain plan alone. The design links the other official
storage, accounting and open-load sources used for this study.

Final stack: reviewed ownership boundary → bounded SQL-plan diagnosis →
semantically equivalent metadata optimization → existing SQL/tamper and
eight-minute regressions → complete 30-minute varied-history run → separate
rotation proof → local rollout. Longer endurance, live Ollama capacity, production
purge and global trust caching remain outside this work. The shared desktop host
was not controlled, so even a later successful single run needs honest limits.
