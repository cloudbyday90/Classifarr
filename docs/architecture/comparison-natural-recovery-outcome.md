# Natural comparison recovery outcome

Date: 2026-10-06. [Design, tradeoffs and official sources](comparison-natural-recovery-design.md).

## Implementation and verification

The isolated launcher now accepts `--comparison-recovery`. Small ESM modules own
real schedule registration, lifecycle cleanup, recovery evidence and orchestration.
The existing refresh fixture is shared without changing prior study contracts.
An opt-in synchronous admission observer records the exact numeric decision; the
normal runtime has no observer, and limits, hysteresis, priorities, reservations,
backoff and garbage collection remain unchanged. Traces retain at most 256
allowlisted checkpoints, including failure runs, never provider bodies or secrets.

Local checks passed: 160 backend suites / 2232 tests, 40 tooling tests, server
lint/typecheck, copyright, normal/production dependency analysis, static ESM imports,
Markdown lint and whitespace checks. The ownership audit required review of the
three changed complete launchers and their new callees before updating their hashes.
Isolation and protected inventory behavior are unchanged; existing unresolved
writer debt is not declared resolved. No full application coverage rerun is claimed.

Fresh random open-PR selection chose #556 at
`9d74537d7917c248d15926f37b2e40ceba7559a4`. Its exact manifest/lockfile diff was
applied locally. Seven runtime-policy checks passed; the server Node-major check
failed. Only trial edits were reverted, and all eight checks then passed as part
of the tooling suite. No installation, merge or retained dependency update.

The preceding main commit's seven workflows completed successfully, including CI,
resource regression and security scans. Those results do not validate this new change.

## Image observation

An initial pilot was deliberately stopped after review found a completion-order
edge case: source mutation could coincide with an older successful revalidation.
The tightened receipt requires recovery and revalidation after the recorded
source-change time. Cleanup now also joins active callbacks if timer destruction
or worker shutdown throws. These checks have dedicated regressions; the stopped
pilot is not accepted as recovery evidence.

The corrected image was built without cache from clean commit
`0d0e1cd1f9b998df16791c32c598b92add3ad70e`:

- Image/index: `sha256:6604eb9bf2c2df8b9909092cfc91ff709ed1f88a6404da9e4642c888eb599069`.
- Native manifest: `sha256:fd974ce69b1d6fba5c24ce272026737edb0ea9cec0122b4d133cef75ac887558`.
- Config: `sha256:02c0a4e4c952ac5f75d59002eded6c294088fcacfd328b317c512965dbe7c2b4`.

The 25-minute run used real schedule registrations and wall clocks. It built
comparison context at 81.5 seconds, changed the synthetic source at 381.9 seconds,
built its replacement at 454.0 seconds, then revalidated at 772.9, 1132.9 and
1493.4 seconds. Representative profiles published twice and revalidated three
times. There were 26 callbacks per worker, 20 snapshot reads and four fitting
workers created/exited, with zero active workers in the final summary.

All ten shared-admission attempts were allowed. The lowest available memory at
an actual decision was **1121.32 MiB**, above the unchanged **1024 MiB** requirement.
Reservations before each decision and recovery hysteresis were zero. No
`memory_pressure` refusal occurred, so the mandatory pressure/recovery assertion
correctly rejected the receipt. This is **inconclusive for post-pressure recovery**,
not a failed comparison refresh, a passing recovery test or release-capacity proof.
The later receipt assertions were not reached; no complete receipt is claimed.

The distinction matters: high memory between attempts is not proof that the
admission budget was insufficient when work was requested. The earlier studies
invoked the two refreshers back-to-back at five-minute intervals; this study used
their separate real minute offsets and existing deadlines. This is a plausible
explanation for the different result, not an isolated causal comparison.

## Retention findings

The saved checkpoints show temporary snapshot/source objects and community row
containers becoming unreachable while both refreshers remained alive. After each
successful cycle, main heap returned to approximately 174 MiB and RSS later fell
to approximately 279 MiB, with raw container memory around 472–481 MiB. One cached
comparison handle and two sampled normalized vectors remained reachable, consistent
with the live model intentionally retaining shared vectors. They are not expected
to disappear while that verified cache is serving. Immediate post-stop reachability
is not proof of a leak: the study does not force collection.

Largest saved RSS checkpoint: 828.36 MiB. Kernel container high-water: 1053.63 MiB.
All saved limit/OOM counters were zero. The rejected run retains allowlisted
checkpoints, not the complete one-second phase-peak summary; do not label its
checkpoint maximum an instantaneous or one-second RSS maximum. The private extra
PostgreSQL cluster also contributes to cgroup memory. No concurrent agent-launched
builds or test suites ran during measurement; unrelated host applications remained
running. No production leak fix or allocator diagnosis is claimed.

The 99-checkpoint private trace has SHA-256
`aae89ec4c161e9ffa3cd32fa8cc4ac828ec7fb94f91d4a22408e40b833514785`.
Both random study projects, including the stopped pilot, removed only their owned
containers, networks and volumes. No caller image was removed.

## Local rebuild evaluation

The same corrected image replaced only the local test Compose container at
18:12:29 UTC. Existing mounts, user 1000:1000 and the 2 GiB limit were preserved.
A private 75,649,476-byte database archive passed checksum and archive-list checks;
this is not a restore rehearsal. Tagging the immediately previous image failed
because Docker no longer exposed its old index/native/config IDs after retagging
the new build. The earlier retained rollback image
`sha256:ee57e3a1a541cd69ad1e3d4234bf7d3f59dc855af4a7caa97eba020bffef3957`
was verified available; its database and production services match the previously
running image. Do not describe it as an exact backup of the previous image.

Local startup is healthy. Read-only checks found PostgreSQL 18.6, pgvector 0.8.7,
323 migrations and 5846 inventory items. Fresh isolated schema dump and independent
schema check passed, left `database/schema/current.sql` unchanged and cleaned their
disposable resources. Unraid was not accessed or modified. No release, tag or PR
merge was created. The five-minute local observation (18:13:33–18:18:28 UTC)
recorded 19 healthy samples, raw cgroup memory 385.58–600.17 MiB, kernel high-water
784.06 MiB, no limit events, OOM kill or restart. This is a startup/health check,
not a sustained capacity or leak soak.

Bounded local logs independently show memory-pressure warnings at 17:36:45,
17:45:45 and 17:53:45 UTC followed by automatic recovery at 17:39:45,
17:48:37 and 17:56:35 respectively, before replacement. These are observed
production-scheduler recoveries on the earlier local image, not a controlled
pressure test of this candidate. They support retaining the retry path and
testing the missing concurrent-workload conditions. After replacement, a
read-only readiness query initially reported `ingesting`; a separate diagnostic
process's allowed memory check does not prove the main comparison cache is ready.

## Recommendation stack

1. Keep memory admission and ordinary-retrieval fallback unchanged. Benefit: bounded
   work remains safe; cost: legitimate temporary pressure can delay optional context.
2. **Next: run real schedules with ingestion/metadata against one isolated application
   catalog/database.** Benefit: removes the extra cluster and tests actual concurrent
   allocation and invalidation; cost: more fixture work and elapsed observation.
   Preserve this healthy scheduled control and the prior failed back-to-back studies.
   Do not invent a refusal or change memory limits to manufacture recovery evidence.
3. Choose a worker-input allocation change only after that matched evidence identifies
   its contribution. Packed transferable input may reduce cloning, but adds ownership,
   cancellation and exact-number compatibility risks. No new allocation fix is
   justified by this run alone; automatic recovery after pressure remains unproven here.
