# Gateway inference/archive soak outcome

## Result: inference passed; concurrent archive qualification failed

Measured on 18 October 2026. The new bounded rehearsal exposed a catalog
planning/capture snapshot race. It correctly exited **1**, not success. No
production recovery, shared Ollama configuration change, Unraid change or release
occurred. Rehearsal provider traffic was synthetic and network-isolated; the
normal local app was not instrumented to audit its existing background traffic.

The [design](gateway-inference-archive-soak-design.md) remains the intended
acceptance contract. Failure of that contract is a finding, not authorization to
relax its guards or silently change the runtime design.

## Exact subject

- Clean implementation revision:
  `121c533543b90dce73a9f6ac63c3a8c936bca46d`.
- No-cache local Docker image ID:
  `sha256:5e5d45a81794e8385a3d823287dc5175508af9ab2ffc398a692f1ee0aaf2ec00`.
  Its OCI revision label matches that revision. This is local identity evidence,
  not a signed published-image or multi-platform claim.
- Eight-minute synthetic workload: 528 offered requests, no dropped arrivals,
  480 foreground successes and 48 expected background busy responses. The fake
  provider received exactly 480 distinct UUIDv7 requests, one active at a time.
- Real PostgreSQL checks passed before the archive acceptance assertion:
  481 bindings/attempts/completions including one prerequisite request; 480
  distinct workload fingerprints; all workload binding/request IDs UUIDv7.
- The prerequisite inference archive was genuinely exported and independently
  restored before measurement. Then 3,000 historical **failed** archive records
  were widened to 233,852,610 bytes of catalog metadata. They were not represented
  as valid successful restores.

## Request observations

All durations below are milliseconds. The synthetic provider deliberately waited
650 ms; paired foreground requests exercise queueing rather than LLM speed.

| Window | Foreground successes | Busy responses | Request p95 | Request p99 | Pre-claim p95 | SQL claim p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Before scheduled worker | 60 | 6 | 1273.168 | 1345.543 | 612.006 | 5.389 |
| Scheduled workers active | 360 | 36 | 1269.144 | 1276.294 | 609.922 | 5.274 |
| After shutdown began | 60 | 6 | 1266.943 | 1271.812 | 609.483 | 3.268 |

Generator lateness was at most 1.461 ms. Pre-claim delay includes authentication,
parsing and validation: it is **not exact queue duration**. Short baseline windows
contain only 60 successful requests each. The last window starts when shutdown is
requested; its first pair can overlap the workers' final shutdown. These numbers
do not establish an archive-export latency improvement, because the concurrent
captures failed before export.

## Failure and cause

The unchanged long-running worker made two scheduled catalog attempts:

| UTC creation time | Status | Reason | Attempt ordinal |
| --- | --- | --- | ---: |
| 12:26:07.375739 | failed | `source_changed` | 1 |
| 12:31:11.643582 | failed | `source_changed` | 1 |

These were different source revisions. No fixture reset a counter, deadline or
budget. The first persisted retry deadline was 12:31:07.482364 UTC; the next
assessment occurred naturally after the five-minute sleep. Each new revision
received its normal attempt ordinal; that is not evidence of a global two-attempt
limit.

Repository evidence explains the result:

1. `catalogCoordinator.mjs` reads the ledger revision and hashes catalog content
   in one read-only transaction, then closes it and creates a durable job.
2. `catalogCapture.mjs` starts another read-only transaction. It refuses capture
   if the current ledger revision differs from the job's planned revision.
3. Foreground admission/completion changes the admission row or table counts
   used by `archiveRevision.mjs`. The first transaction's full catalog read leaves
   a window for that change before the second transaction begins.

Both observed failures occurred at this boundary. There was no concurrent catalog
dump or restore to measure. After requests drained, an extra explicitly invoked
assessment published a catalog candidate in about 14.3 seconds; its dump process
was observed for about 4.6 seconds. That candidate remained awaiting verification
when the strict acceptance check failed and cleanup ran. It is **not** a verified
restore or a passed concurrent archive test.

## Resources and isolation

| Container observation | Peak memory | Memory/OOM/PID-limit events |
| --- | ---: | --- |
| Source PostgreSQL + fixture gateway/provider/load driver | 360.1 MiB | 0 |
| Scheduled archiver, failed captures | 60.7 MiB | 0 |
| Scheduled catalog verifier, idle | 30.0 MiB | 0 |
| Post-drain export worker | 256.0 MiB | 0 |

Peaks are lifetime cgroup measurements, including cache—not heap-only readings
or proof of memory leaks. The idle verifier's low usage says nothing about restore
capacity. This Docker host used cgroup v1. The fixture's event-loop histogram used
a 20 ms sampling resolution; it is not production telemetry.

The test checked resource/isolation settings and used no network, host ports,
Docker socket or real provider credentials. The verifier had no source SQL
socket/configuration. After the expected nonzero exit, independent checks found
zero containers/volumes with fixture label
`io.classifarr.inference-soak=bea66928-4abe-4c9b-8c1d-de311d139289`, no source
container and no disposable schema-check data directory. No Docker prune ran.

## Recommendations, alternatives and final stack

Additional official sources were discovered through MCP search and opened on
18 October 2026:

- [PostgreSQL snapshot synchronization](https://www.postgresql.org/docs/18/functions-admin.html)
  explains that independently started transactions can see different committed
  data. Export/import can hold a common read view while its owner stays open.
- [PostgreSQL pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html)
  supports consistent exports during concurrent use and warns that restoring SQL
  can execute source-controlled code. Keep verification isolated.

| Alternative | Pros | Cons |
| --- | --- | --- |
| Keep current double-snapshot refusal | Prevents publishing mismatched evidence | Repeated busy-source failures; incomplete recovery readiness |
| Coordinate admission and capture around a frozen read view | Can preserve consistency while inference continues | Must reconcile job visibility, immutable revision/attempt accounting, maintenance fencing and transaction lifetime |
| Pause inference for capture | Simpler stable source | Adds downtime/queue delay; conflicts with the agreed online-archive requirement |

Next recommendation: design the frozen-snapshot admission/capture boundary,
preserving independent maintenance fences, immutable attempts, file revalidation,
resource/time limits and isolated restore checks. Do not simply remove the
revision comparison. Re-run this same strict soak as the regression gate before
claiming online catalog recovery readiness. Only then extend duration/history
sizes or consider further reductions in repeated scans.

Final recommended stack: **one consistent capture view → fenced durable job →
bounded export → independent sandboxed restore → verified retention → unchanged
live history**, with foreground inference continuing throughout. This is a
follow-up recommendation, not an implemented runtime change in this commit.

## Other verification and handoff

- Five new deterministic workload/accounting tests passed.
- Existing gateway tests: 531 passed across 26 suites.
- Lint, server/client type checks, Knip, static ESM and strict mock-shape checks,
  copyright, Markdown and whitespace checks passed.
- Open PR enumeration returned zero open PRs, so no PR was selected, copied or
  merged. The authorized primary work continued.
- No-cache Compose build and normal local service refresh passed. Container
  `2ccc1108855d34b36045a0a17a96cdf45b4b751bedd228636c677cfa44390839` uses the
  exact image above and is healthy. `/health`, `/api/system/health/ready` and `/`
  all returned HTTP 200; database health/readiness were connected/ready.
- The normal local database still contains zero optional gateway/archive/cleanup/
  catalog schemas. Capture budget revision 2, `when_idle`, all call/token/reserved
  counters zero and its prior `next_check_at` remained unchanged. No runtime
  modules, database schema, production limits or provider configuration changed.

The local pre-refresh backup is ignored/private:
`data/backups/gateway-inference-soak-before-20261018.dump`, 76,235,481 bytes, mode
0600, SHA-256 `adc86a749e3fca058a94ed107ff7e112e10b63ec2a582510ad461f8f8b5c0cf7`.
Its archive list was readable; that is not a restore test of the local database.
The previous image remains under rollback tag
`classifarr-local-rollback:ac5b38272783b99d700dab86b8bb5ead854018afd8237a471b9667c9dc85b3b0`.
