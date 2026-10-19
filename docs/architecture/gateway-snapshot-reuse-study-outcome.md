# Gateway same-snapshot reuse study — outcome

## Result and exact subject

Passed locally on 2026-10-19. Test-only transaction-scoped reuse reduced duplicate
SQL work without changing results or successful byte accounting. Production
recovery readers, filesystem checks, restore verification, schedules and limits
remain unchanged. No release, tag, version bump, PR merge or production deployment.

- Implementation: `edd60cc6439119264958fc2456c95bde23643569`, clean `main`.
- No-cache local image ID:
  `sha256:0d017d65979924ad6c01d6e615111f3e86eb32e918b403f3489920af1b4cf1b2`.
- OCI source revision matches the implementation; this is a local Docker identity,
  not evidence of a published registry digest or signed provenance.
- Fixture binding:
  `9c7d82a2b504d52b0fcee34df730ba183fc5aef2075162eab7b2816ee7bc92f5`.
  Seven committed fixture files and four exact application-module hashes were
  checked before imports. Wrong-digest refusal, read-only input protection and
  native Linux no-follow symlink refusal passed.
- Linux amd64, Node 24.21.0, PostgreSQL 18.6, pgvector 0.8.7; source isolated with
  no network/ports, 2 GiB memory and swap cap, two CPUs, 512 PIDs. The study used
  the production entrypoint and a fresh synthetic database, not local appdata.

The [design](gateway-snapshot-reuse-study-design.md) records approved scope,
official sources, tradeoffs and execution command. This outcome records measured
behavior, not a claim that the prototype has been promoted to runtime.

## Observations

Each lane ran eight counterbalanced component comparisons: four baseline and
four reuse. An independent production-reader capture supplied expected results.
Within every lane, exact retention entries, table summaries, hashes and total
successful charges matched. Catalog version 3 still read its fourth table.

| Component pair / lane | Queries baseline → reuse | Returned string bytes baseline → reuse | Median elapsed ms baseline → reuse | Charged bytes, both |
| --- | --- | --- | --- | --- |
| Small history | 67 → 36 | 411,036 → 206,517 | 35.90 → 19.87 | 351,720 |
| Wider history | 67 → 36 | 33,975,708 → 16,988,853 | 386.64 → 172.23 | 33,916,392 |
| Wider, fresh study process | 67 → 36 | 33,975,708 → 16,988,853 | 325.13 → 161.63 | 33,916,392 |

Node-process median CPU microseconds were respectively 28,033.5 → 12,963;
187,387 → 81,762.5; and 156,542 → 82,878.5. These are not PostgreSQL backend CPU
measurements. Returned string bytes count UTF-8 string values, including schema
and identity fields, not field names, non-string values, protocol traffic or disk
I/O. Charged bytes sum the two component catalog captures, not final archive size.

There were 256 failed archive-history rows, two failed catalog jobs and 110
synthetic old terminal bindings. Retention selected exactly 100 and reported
more remaining. Wider history used 64 KiB compressible padding per archive job;
it is not representative varied-TOAST or disk throughput evidence. No build or
other owned study workload overlapped these measured lanes. The existing local
Classifarr and unrelated Harmoniarr container remained running on the shared host.

The paired component query count fell by 46.3%; returned string bytes roughly
halved. Elapsed/CPU observations include instrumentation cost and warm-cache/shared
host effects. They support a narrower runtime experiment, not a production speed,
memory-headroom, inference-latency or whole-archive improvement claim.

## Safety evidence

All 15 native PostgreSQL probes passed: wrong client, cloned/fabricated/expired
capabilities, next-transaction refusal, disposed scopes after callback failure and
rollback, read-only write denial, immutable entries, cancellation before/during
cursor reads, aggregate-byte refusal, concurrent committed source changes and
oversized rows. Cursors closed after refusals. Frozen reads retained old values;
the next snapshot saw new committed values. Temporary synthetic manifest changes
were restored and the final exact catalog-content fingerprint matched.

Before/after checks preserved 110 attempts, 110 bindings, 110 completion receipts,
256 archive jobs with 256 total attempts, two catalog attempts, null active request
and cooldown, zero cleanup operations, zero protections and zero retained roots.
All binding/request identifiers were UUIDv7. No attempt or cooldown was refunded.
These synthetic rows are not verified archives and cannot authorize recovery.

Unit contracts additionally proved connection end/error invalidation, rejection
of overlapping calls and outstanding work after scope completion, cache misses
after failure, byte-boundary behavior and source-parity drift rejection. The
prototype's tail accumulator differs from production only by its reviewed range
start parameter and absolute import paths.

The fresh-process lane was a process restart, not a container crash, image
upgrade, power-loss or real cooldown-elapse test. No new dump/restore pipeline or
filesystem optimization was introduced or claimed by this component study.

## Dependency and quality verification

[PR #563](https://github.com/cloudbyday90/Classifarr/pull/563) was revalidated OPEN
at `0876bcae4b6df28ac61eb49dea94ed2590c1efc3` and implemented locally, not merged.
Vue is pinned to 3.5.44 and Pinia to 4.1.0. The reviewed lock delta contains the
Vue 3.5.44 compiler/runtime family, Babel parser 7.29.9 and Vue devtools 8.2.1;
no package additions/removals or new installers. The PR's caret declarations were
intentionally tightened to exact direct pins. Existing overrides and strict
script decisions remain intact.

- Frontend: 477 files / 7,373 tests passed with coverage: 87.79% statements,
  81.84% branches, 87.50% functions, 89.47% lines. Includes three focused shallow
  collection, store patch/watch and visibility regression tests.
- Production frontend build and all eight Chromium asset/navigation checks passed.
- Gateway tooling: 112 tests, 111 passed, one Windows symlink skip. A separate
  restricted Linux run passed all 71 selected binding/cache/sandbox/cleanup tests,
  with zero skips, including native symlink and full-size argument checks.
- Five targeted backend contract suites: 74 tests passed. An initial hyphenated
  filename filter matched no unit tests; rerunning the actual camel-case names
  provided the reported evidence. No full backend coverage/ratchet claim.
- Strict clean client installation, complete dependency tree and full client
  audit passed; zero advisories reported on 2026-10-19. All 43 tooling/install-policy
  tests passed. An audit is not proof of complete dependency safety.
- Full lint and server/client types, docs lint, static ESM check, copyright,
  ownership check and both Knip modes passed without refreshing baselines.
- Staged secret scan passed before implementation commit. No live credentials
  were copied into study fixtures or committed.

An initial ad-hoc Linux test tar omitted a bootstrap module and CI workflow;
including the committed dependencies corrected that verification bundle. A host
PowerShell empty-output check was also corrected to use array cardinality. The
final Linux run exited zero and independently verified container removal. Neither
issue changed application code or the successful PostgreSQL study.

## Local Compose and cleanup

The requested no-cache build completed, then local Compose was refreshed using
the tested image with no rebuild/pull. Container
`0a9070c96476b1e78eb4b466f4e2f17407f6dd99082b288b635badc6292641e7`
started at `2026-10-19T23:01:30.024873221Z`: healthy, root filesystem read-only,
2 GiB memory limit, no OOM. `/health`, `/api/system/health/ready` and `/` returned
HTTP 200. Optional gateway namespaces remain absent from normal local appdata.
The local capture guard remains `2|0|0|0|0|2026-10-09 16:50:11.617278-04`.

Before replacement, a 76,228,089-byte mode-0600 backup was retained at
`data/backups/gateway-snapshot-ready-20261019.dump`, SHA-256
`6386e29cc264bb273e7ec9a5df846ec82e5f359bc6634068c544d5707d612476`.
Its archive list passed; that alone is not a full application restore test.
Rollback tag `classifarr-local-rollback:e03e1a272a03eb716520d108eaadea812fbfc84184a1d448cbc194085e8df401`
retains prior image `sha256:ec72454bae0b3cdfc3f2729ecfaf0639f690d5c56228ef011f5af03367656c53`.

The source container, sealed fixture volume, stager, private input directory,
synthetic database directory and Linux unit container were removed and absence
checked. The generated test tar was removed by its exact validated path. No
Docker pruning, real history deletion or Unraid/Plex/shared-Ollama change occurred.

## Recommendation and remaining weak points

Recommended stack: existing production snapshot capability, bounded immutable
summaries, exact byte-charge replay, fresh fourth-table capture, and unchanged
filesystem/permission/admission/restore fences. Retain the current runtime until
the next separately reviewed implementation passes end-to-end checks.

Next: implement only base catalog-hash reuse inside a transaction-owned runtime
interface, then run real dump/isolated-restore/concurrent-admission and pressure
regressions. It offers the larger byte saving; retention's bounded three-query
duplicate is lower priority. Do not add a process-wide cache or admin controls.

Key outstanding risks are raw caller transaction control, budget exhaustion with
different earlier-stage charges, schema/format evolution, accidental reuse across
coordinator snapshots, and production-scale memory/latency. Failed-operation
budgets are discarded; their intermediate mutation is not interchangeable with
production's row-by-row failure accounting. Neither the 80,000-binding pressure
path nor long-running inference/restore/rotation co-load was evaluated here.
