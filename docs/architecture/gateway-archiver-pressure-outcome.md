# Archiver pressure attribution — outcome

2026-10-20: local archive correctness passed; memory attribution improved;
comparative runtime attribution remains inconclusive. No production optimization,
release, Git tag, version bump, new admin control or Unraid/shared-Ollama change.
The approved [design and official research](gateway-archiver-pressure-design.md)
remain the scope of this work.

## Exact subject and execution

Final clean-source revision: `b34eb19eb1efb31ea65f590fd44e5be6716b5305`.
Local Docker image ID:
`sha256:2d79a63a5fba389df3f1b0ddfe7436bd64470fe40687e7df5883e1ecb1da6107`.
This is local image evidence, not published registry or signed provenance proof.
Later documentation commits do not change the tested source files.

The final Compose build used `--no-cache --require-provenance`, retaining a rollback
image. Linux/amd64, Node 24.21.0, PostgreSQL 18.6 and pgvector 0.8.7 were used.
The four sequential runs started at 13:43:53 UTC; completion was observed by
14:03:43 UTC. The source remained committed and clean throughout them.

Reproduce with that image and its matching clean checkout:

```sh
node scripts/run-gateway-online-archive-rehearsal.mjs \
  sha256:2d79a63a5fba389df3f1b0ddfe7436bd64470fe40687e7df5883e1ecb1da6107 \
  b34eb19eb1efb31ea65f590fd44e5be6716b5305 --archiver-pressure-study
```

All arms retained archiver 256 MiB/no swap/0.5 CPU/32 PIDs, verifier 1.5 GiB/no
swap/1 CPU/64 PIDs, and source 2 GiB/2 CPUs/512 PIDs. Worker roots stayed read-only,
UID 1000, capability-dropped and network-isolated. Inputs were sealed and checked
before fixture imports; writable results never became executable inputs.

Fixed input-manifest SHA-256 values, repeated unchanged within each arm type:

- Unsampled: `9a325c8e649a5088122b1ac7c21962ad95b8a59819f99d1d83039854388bd483`.
- Sampled: `90fa68ac95dba899b6f1505faf5e6f1b719fe91011355b4554240db7c0e24acb`.

The ignored local `.tmp/pressure-study.log` has SHA-256
`c9baff1987c949d4aa4a3ba82e948efa32f5770b5478fe63a402c43ec537fbec`.
This local log digest is not an independent attestation. Source bundles and logs
remain ignored intermediates, not committed artifacts.

## Results

Times below are packaged-worker spawn-to-close elapsed seconds, excluding setup,
endpoint accounting and restore verification. Captures within a run are not
independent repetitions; there are only two runs per treatment.

| Run | Periodic probe | Capture 1 (s) | Capture 2 (s) | Kernel peak, both | Catalog restores |
| --- | --- | ---: | ---: | ---: | --- |
| 1 | No | 35.645 | 44.411 | 256 MiB | 2 passed |
| 2 | Yes | 28.530 | 38.768 | 256 MiB | 2 passed |
| 3 | Yes | 60.056 | 61.457 | 256 MiB | 2 passed |
| 4 | No | 27.509 | 33.029 | 256 MiB | 2 passed |

All eight large captures reported zero OOM, OOM-kill, memory-limit-hit and PID-limit
events. Each arm also performed a real prerequisite inference-archive restore:
eight large catalog restores plus four prerequisite restores in this study.

All arms passed quiet unchanged-history behavior, original attempt exhaustion,
oversized-evidence refusal and zero cleanup-operation checks. Failed-history
fingerprints were unchanged through capture, restore and quiet checks. Subsequent
fault drills deliberately added/changed synthetic rows; refusal checks then proved
that workers did not mutate that fault state or refund attempts. No live history
was deleted and no provider was called.

Every arm verified cleanup before completion: exact owned containers, volumes and
disposable source-data directories were absent. Independent final label checks
found no qualification containers or volumes. Native tooling containers were also
removed; retained images, backups and ignored input bundles are intentional.

## Matching and memory findings

Each arm used 3,000 inert failed rows with varied 75,000-byte padding, no old
read-comparison warm-up, and uncompressed dumps. Canonical failed-history size
ranged from 233,849,266 to 233,849,336 bytes. Each had 242,466,816 TOAST bytes;
total relation storage varied from 245,579,776 to 245,866,496 bytes. These are
matched shapes, not byte-identical physical databases.

The shared deterministic padding SHA-256 was
`b9872c5cd649c86a2d1ff158ae23786e43a29bf766185ca9212daa83babf2253`.
Per-run history fingerprints differed, as expected from fresh UUIDv7 IDs,
timestamps and prerequisite receipts:

| Run | Failed-history SHA-256 before fault injection |
| --- | --- |
| 1 | `98a8d18ad9751112a1dc789120d0ca46ae4add21a028cf1d6867e4eb4c2e7b17` |
| 2 | `53858a54dde8b98c59beb7d47754c2636d088b65d0fb06dcb4e179bce6e9c75e` |
| 3 | `2b6f6830ec36970dbaaa61e8316d7fec7a0708a1c90c9691646b8a1b3d4fd3cf` |
| 4 | `29b700f7eb0e3a3bb647b61346fd98c9c7197bce778b58a1c67cef8f219d6081` |

The four sampled near-peaks were 255.961–255.996 MiB. All observed the identified
pg_dump child present. At those observations, cgroup file-cache charge was
180.992–185.703 MiB and anonymous/RSS charge was 60.121–65.855 MiB. File cache was
therefore a substantial contributor to the observed total, not process heap alone.
Dirty/inactive cache values overlap file cache; process RSS values include shared
pages and must not be added together or added again to cgroup charges.

This reproduces the ceiling without periodic sampling and explains much of the
sampled charge composition. It does not prove comfortable headroom, exact kernel
reclaim behavior, absence of a long-lived leak, or safety under sustained inference
contention. These workers were one-shot processes. Keep the distinctions described
by [Docker's accounting guidance](https://docs.docker.com/engine/containers/runmetrics/).

## Availability, coverage and timing limits

Native execution used cgroup v1. Memory and throttling counters were available.
The fixed throttle, ordinary and recursive block-I/O interfaces were all absent
inside these containers; memory PSI was absent too. This is not proof that the
host lacks those facilities, and it is not zero physical I/O or zero pressure.
v1 charging/uncharging and page faults are not v2 reclaim counters or disk reads.
No host-global fallback, privilege increase or control-file write was used.
Native v2 attribution remains untested; v2 formats have unit coverage.

Sample counts were 55, 75, 114 and 117. Current-memory coverage was 100%; cgroup
coverage was 100%, 100%, 99.12% and 100%. Process observations remained partial;
summaries recorded 3, 2, 6 and 5 partial samples, zero failed samples, and no cap
hits. Maximum gaps were 586.4, 575.3, 588.6 and 719.9 ms. Common endpoint reads
took 1.50–4.56 ms in these captures, under the cooperative 100 ms budget.

Probe-await totals were 0.956–2.435 seconds, not CPU time and not total observer
overhead. Unsampled runs still included lifecycle polling and common endpoint
accounting. No cache flush or forced GC was used; a no-cache build is not a
cold-cache experiment. Endpoint snapshots cannot locate internal phases.

Task-owned builds and tests finished before measurement. However, unrelated
Harmoniarr deployment activity occurred on the shared Docker host: the observed
container start changed to `2026-10-20T13:57:13.265584359Z` during run 3. Its resource
impact was not measured, and it was not stopped or modified by this task.
Consequently, the slower third run cannot be assigned to sampling. Balanced order
and matched payloads do not remove this confound or uncontrolled cache/background
database effects. Do not publish a causal sampling-overhead percentage from this
study; [NIST's blocking guidance](https://www.itl.nist.gov/div898/handbook/pri/section3/pri332.htm)
supports controlling nuisance factors, not treating this small comparison as proof.

## Dependency PR and verification

MCP enumeration selected the only open candidate, [PR #566](https://github.com/cloudbyday90/Classifarr/pull/566),
randomly from `[566]`. Its reviewed head stayed
`a4beccb1edd141da7b4014dec70b9518122b5f4b`, unmerged. A later MCP refresh returned an
internal service error; GitHub CLI independently reconfirmed OPEN and the same head.
No PR merge or branch creation occurred.

Pinned @testcontainers/postgresql and testcontainers to 12.2.1. Lock review removed
unrelated transitive drift, including a new installer-bearing package. Direct
Undici 8.12.3, nested 6.29.1 security pins and strict install policy were retained.
The [official release notes](https://github.com/testcontainers/testcontainers-node/releases)
were reviewed for port-binding, reaper-ownership and stream changes. Installation
and audit are evidence of this batch, not a universal security guarantee.

- Strict server install, full dependency tree and development-inclusive audit:
  passed; zero reported advisories on 2026-10-20.
- Dependency/install-policy tooling: 43 passed.
- Gateway tooling: 129 passed plus one Windows symlink skip; final restricted
  Linux image execution passed all 130, including symlink and command boundaries.
- Full real PostgreSQL integration: 291 suites / 3,787 tests passed; one suite/test
  remained skipped because provider-fault Compose testing requires its dedicated
  opt-in runner. No skipped case was described as tested.
- Focused memory/structural checks: 3 suites / 36,387 tests passed, dominated by
  generated code-health checks, not that many independent behavioral scenarios.
- Server/client lint and types, normal/production dependency ownership, copyright,
  static ESM imports, mock-shape checks and documentation lint passed.
- Final-image archive regression passed real restores, private-input and corruption
  refusal, late-file fences, resumed retirement, original attempts and cleanup.

No fresh full frontend test/coverage run or combined coverage ratchet is claimed;
frontend/API/runtime logic and database schemas were not changed by this batch.

## Local Compose and recommendation

Local Compose was refreshed only after private backups and with `--no-build
--no-deps --pull never`, using the no-cache-built candidate. Earlier images and
backups remain available. Final container:
`5ced862feab49c773d917febc32ed95e79d37a5dbac779aa51e0a2ebf300f0f5`, started at
`2026-10-20T14:05:04.897079586Z`, running the exact image above. Health was healthy,
root read-only, memory limit 2 GiB, OOM false; health, readiness and UI returned 200.
Node/PostgreSQL/pgvector versions matched the image checks.

The final pre-refresh backup is
`data/backups/gateway-pressure-20261020-b34eb19e.dump`: 76,207,027 bytes, mode 0600,
SHA-256 `e8765b54336501dde3e2d2f5b7fbc2a771c799a56e30e1f3daeb1fd5cc70b11d`.
`pg_restore --list` passed; this is not a claim that the live backup was restored.
The preceding image remains protected by local rollback tag
`classifarr-local-rollback:f07b7b1252b8e68ee4f982088303f16497e66307f56fe353f0128a4c122b05db`.

Normal appdata had no optional gateway namespaces before or after refresh.
Capture revision 2, zero daily calls/tokens and reservations, and
`next_check_at=2026-10-09 16:50:11.617278-04` remained unchanged. No gateway,
capture or shared-provider setting was enabled by this work.

| Recommendation | Benefit | Cost / limit |
| --- | --- | --- |
| Keep bounded streaming, hashing, fsync and recovery checks | Preserves durability and verified recovery | Does not make page-cache charge disappear |
| Keep existing memory/CPU/PID limits | Avoids hiding an unmeasured problem | Still requires sustained-load evidence |
| Preserve explicit missing telemetry and partial coverage | Prevents false zero-pressure claims | Physical-I/O/reclaim attribution remains incomplete |
| Repeat timing work in a quiet window or dedicated local host | Removes the observed deployment confound | Needs coordination; this study must not silently retry |
| Then repeat sustained matched co-load with latency gates | Tests the real inference/archive interaction | Short isolated captures cannot substitute for it |

Final stack: exact reviewed dependencies → sealed bounded ESM study fixtures →
matched varied history → real restores and refusal drills → explicit attribution
limits → quiet timing qualification → sustained inference co-load with predeclared
latency/coverage gates. Do not disable fsync, validation or memory safeguards, add
purge buttons, or change production limits on these results.

Next item: arrange the quiet/dedicated local measurement window, requalify timing,
then run the sustained comparison before selecting a runtime optimization. That
requires agreement on the window, not authority to stop another application.
