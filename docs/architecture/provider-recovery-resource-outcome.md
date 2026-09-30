# Provider recovery resource study — outcome

Date: 2026-09-30. See [design, official research and trade-offs](provider-recovery-resource-design.md).

## Implementation

The isolated study now produces version 6 receipts with separate unique item,
task-completion, provider HTTP, charged retry and waiting-work counts. Its
eight-item fault cohort uses real HTTP and production retry persistence. Bulk
optional metadata is synthetic and is not counted as provider HTTP throughput.
Provider settings remain active through drain; successful settlement, not
disabling demand, is required before idle observation.

The comparison receipt is version 3. Old rollback-cohort receipts cannot satisfy
the new validator. Existing rollback tests remain as SQL regressions.

## Validation

Repository validation passed:

- Backend coverage: 1,557 suites, 47,280 tests; 90.22% statements, 85.07% branches.
- Frontend coverage: 411 files, 5,795 tests; 86.11% statements, 78.76% branches.
- Coverage ratchet: no regression.
- Focused resource-study unit tests: seven suites, 270 tests.
- Disposable PostgreSQL provider/outcome/rollback integration: three suites,
  17 tests, including real HTTP and real persisted cooldowns.
- Separate legacy-ingestion reconciliation integration: 35 tests.
- Ownership source-review gate: passed with no unreviewed drift. Its 490
  unresolved entries remain unresolved; this is not production compatibility.
- Server lint and type checking, development/production dependency checks, ESM
  import/mock checks, Markdown lint, npm CLI flags and copyright checks passed.

The isolated Compose smoke study passed with 400/400 unique completed items and
512 task completions. Its eight-item provider cohort finished with 11 HTTP
requests, two charged retries, zero remaining retries and zero requests during
pressure. Recovery after credential repair took 127.28 seconds; the shortest
observed transient wait was 32.14 seconds. Peak Node RSS was 304 MiB and raw
container memory was 410.8 MiB, with no OOM, PID-limit or memory-limit events.
The smoke run overlapped local validation activity and is not a clean capacity
comparison.

### Final-source capacity observation

The separate baseline capacity run passed after the full test suites finished.
Its owned container, network and volume were cleaned up. Image:
`sha256:89003b272ad45766a0b79535c78ac9922bb5e83db5151cb7dc43d95d12dd2345`.
The reproducible command is `node scripts/run-resource-study.mjs --capacity`;
raw receipts remain ignored local intermediates under `.tmp/resource-study/`.

| Measurement | Observed result |
| --- | ---: |
| Total duration, including drain and idle | 373.78 seconds |
| Unique completed inventory | 1,600 / 1,600 |
| Task completions, including repeated passes and held work | 1,972 |
| Provider fault cohort completed | 8 / 8 |
| HTTP attempts / charged retries | 11 / 2 |
| Pending / failed / routing tasks at finish | 0 / 0 / 0 |
| Provider recovery after credential repair | 170.29 seconds |
| Shortest observed transient wait | 46.50 seconds |
| Unchanged waiting checks / pressure deferrals | 126 / 16 |
| Provider HTTP during injected pressure | 0 |
| Held queue cohort completed | 20 / 20 |
| Drain duration | 36.32 seconds |
| Peak sampled probe RSS / raw container memory | 508.31 / 640.75 MiB |
| Container CPU p95 / maximum sampled | 1.84 / 2.91 cores |
| Maximum sampled PIDs / event-loop p99 | 46 / 28.10 ms |

The baseline had a 2 GiB memory ceiling and host-default unlimited CPU/PIDs.
No OOM, memory-limit, PID-limit or CPU-throttling counter increase occurred.
Resource-admission permits and retry claims were released at finish. During the
20-second idle window, median container memory fell about 6 MiB while process
RSS rose about 1 MiB and external/ArrayBuffer memory rose about 6.27 MiB. This
short mixed observation is neither proof of a leak nor proof of its absence;
ArrayBuffers overlap external memory and must not be added twice.

The live Classifarr container remained the same healthy instance with zero
restarts. No heavy local test suite overlapped this capacity observation, but
the host was not dedicated and this was only one baseline run.

No live runtime change or resource-limit recommendation is implied.

## PR availability and operational scope

GitHub MCP returned no open Classifarr pull requests at both inspections.
No PR has been selected or merged. This work creates no release, changes no
routing or production configuration, and does not delete historical evidence.

## Next recommendation

The newly reported [unknown-ingestion-owner incident](legacy-ingestion-september30-incident.md)
is separate from provider/resource recovery. Prioritize a design and disposable
upgrade test for database-enforced writer fencing before attempting
confirmation-free legacy recovery. Benefit: safe automatic recovery across
libraries. Cost: compatibility and migration work across all writer paths.
Do not fabricate historical ownership or silently weaken the current guard.

For resource tuning, retain current live limits and collect repeated matched v6
observations before expanding the bounded fault cohort to web-search fallback.
This study does not establish external-provider behavior, AI accuracy, a
30-minute soak result or a three-budget capacity comparison.
