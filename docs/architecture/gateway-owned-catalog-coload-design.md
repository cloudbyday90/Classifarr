# Owned catalog co-load study — design

## Approved scope

Approved 2026-10-20 after the [owned snapshot outcome](gateway-owned-catalog-snapshot-outcome.md).
Extend the existing sealed synthetic study, not runtime administration. Measure the
implemented catalog owner during the existing 30-minute arrival plan plus one
minute idle tail. Stay on main, no version bump, release, tag, live recovery or
Unraid/Plex/shared-Ollama access. No new tables or identities; existing UUIDv7
checks remain. Fresh application installations do not start study/gateway work.

Separately implement randomly selected open PR #565's dependency updates and the
approved related Undici patches. Keep dependency and measurement commits distinct.
Use the final patched image for the study. This is current-build headroom and
before/during/after evidence, not a matched old/new comparison or causal speedup
claim. Do not broaden the runner to arbitrary historical images or fixtures.

## Evidence and official research

Official sources were discovered through connected search/GitHub services and
opened on 2026-10-20:

- [PostgreSQL 18 monitoring](https://www.postgresql.org/docs/18/monitoring-stats.html)
  distinguishes current backend activity from cumulative statistics; transaction
  start and xmin are observations, not proof of an exported snapshot's lifetime.
  Database I/O counters do not distinguish kernel-cache hits from physical reads.
- [Docker runtime metrics](https://docs.docker.com/engine/containers/runmetrics/)
  describes cgroup memory/cache, CPU and block-I/O accounting. Keep RSS/heap,
  anonymous/file charge and lifetime container peaks separate; never sum them.
- [Node 24 performance APIs](https://nodejs.org/download/release/v24.21.0/docs/api/perf_hooks.html)
  documents event-loop sampling modes and units. Keep the existing timer mode and
  nanosecond-to-millisecond conversion; do not compare different modes as peers.
- [Undici's content-encoding advisory](https://github.com/nodejs/undici/security/advisories/GHSA-xjj6-f33q-929c)
  includes installed 8.11.2 and nested 6.29.0, with fixes in 8.12.2/6.29.1.
  The baseline full npm audit reports zero advisories; it is not sufficient
  evidence against that official affected-version notice.
- [Undici 8.12.3](https://github.com/nodejs/undici/releases/tag/v8.12.3)
  additionally fixes HTTP/2 connection replacement after timeout and queued
  caller async-context preservation. Test both transport and identity behavior.
- Official [dotenv changelog](https://github.com/motdotla/dotenv/blob/master/CHANGELOG.md),
  [js-yaml changelog](https://github.com/nodeca/js-yaml/blob/master/CHANGELOG.md)
  and [Zod releases](https://github.com/colinhacks/zod/releases) describe parser,
  argparse and patch changes. Parsing compatibility needs tests, not assumptions.

| Choice | Benefit | Cost / decision |
| --- | --- | --- |
| Extend existing fixed study | Preserves timing, offered load, real worker/dump/restore and input binding | Bounded local evidence only; selected |
| Merely rerun the old sampler | No code change | Misses the new private owner and confuses cumulative transactions with connections; reject |
| Paired old/new endurance comparison | Better attribution if properly controlled/repeated | Requires reviewed shared fixtures, matched dependencies and longer runs; deferred |
| New runtime controls or relaxed limits | Could manufacture more work/headroom | Changes the behavior under study; reject |

## Measurement contract

Observe only the three fixed application names in the isolated fixture database:
archive source, archive coordinator and private catalog snapshot. Report current
counts per application and their sum as **managed connections**, not cluster-wide
connections or available database capacity. The observer, inference ledger and
pg_dump have separate connections and are not included in that sum. Application
names are diagnostic labels, not authorization or ownership proofs.

Keep the existing bounded source transaction history, adding private-owner
transactions rather than lowering the existing minimum of four observations.
Add owner-specific observed transaction count, current snapshot-bearing
transaction count and maximum observed transaction age. Require real owner
observations during the loaded study and zero managed connections throughout
the settled idle phase after packaged workers stop. A one-second observer can
miss short transactions; do not assert exact lifetimes or absence between ticks.

Use a parameterized SELECT-only pg_stat_activity query, a fixed small result cap,
bounded private identity sets and strict number/name/duplicate validation. Never
emit PID/start identities, SQL text, credentials or provider payloads. Retain the
read-only observer's 500 ms SQL/1-second query limits. Its client is never passed
to runtime services. Missing/invalid observer data must fail coverage, not become
a zero count. Keep 2,048 samples, 64 bins, nonoverlap, five-second gap limit,
90% mandatory field coverage and at least 45 idle observations.

Preserve cgroup v1/v2 optional I/O/PSI handling. A missing interface stays
unavailable, not zero. A supported empty I/O counter reports no attributed block
I/O, not proof that the application performed no logical reads. Report field
coverage, sampling wall time and CPU/memory observations; wall time spent sampling
is not a calibrated estimate of total observer perturbation. No forced GC, cache
flush, statistics reset, new timing collection or process-wide trust cache.

## Workload and failure behavior

Reuse the eight-minute regression and the existing extended profile: 60 seconds
before, 1,680 seconds archive-active, 60 seconds after, then 60 seconds idle.
Retain 1,800 foreground successes, 180 expected busy responses, four client slots,
500 ms arrival lateness cutoff and 650 ms synthetic service. No retries/catch-up
bursts. Seed the same 3,000 varied failed-history rows and preserve their digest.

Keep five-minute worker/verifier cadence, actual pg_dump/pg_restore, two verified
roots and exact attempt/cooldown/UUIDv7 accounting. Require genuine admission
overlap with dump and restore windows. This does not require dumps and restores
to overlap each other or establish daily rotation. The separate existing
scheduling/rotation drill is not elapsed-time evidence.

Source remains 2 GiB/no swap, 2 CPUs, 512 PIDs; archiver 256 MiB/no swap, 0.5 CPU,
32 PIDs; verifier 1.5 GiB/no swap, 1 CPU, 64 PIDs. Network disabled, fixed loopback
provider, read-only worker roots, UID 1000, dropped capabilities, no-new-privileges,
no ports. Verifier has no live source socket/configuration or Docker socket.
Inputs remain committed, sealed and mounted read-only; observations are separate.

Disabled/fresh studies do nothing. Missing prerequisites refuse before work.
Transient read failures invalidate evidence; do not silently retry the study.
Blocked workers, permanent refusals, unknown results, timeout, cancellation,
OOM/PID events, malformed output or inadequate coverage fail nonzero. Cleanup
must attempt every exact-name/label-owned resource even after failure. Verify
absence afterward; ambiguous cleanup cannot produce a passing outcome. Do not
delete live history, reset attempts/deadlines or weaken any runtime safeguard.

## Random open PR and exact dependency batch

MCP enumerated open PRs `[566,565]`; random selection chose
[PR #565](https://github.com/cloudbyday90/Classifarr/pull/565). Revalidated OPEN,
unmerged at head `d95dd1abfab335812ae98b7656f62f5a66cacd46`, base
`2149220bffe289803f8cf10942896a4e6b9894a0`. Apply locally without merging:

- dotenv 18.0.7 → **18.0.8**;
- js-yaml 5.4.3 → **5.5.0**, reviewing its argparse 2.x → 3.x dependency;
- direct Undici 8.11.2 → **8.12.3**, the approved newer patch above PR's 8.12.2;
- Zod 4.6.6 → **4.6.7**;
- Discord/@discordjs/rest Undici overrides 6.29.0 → **6.29.1**.

Pin direct versions exactly. Keep the existing other overrides and strict
lifecycle-script policy. Registry metadata reports no lifecycle installers in
these candidate packages; engines fit Node 24.21.0. Discord and REST declare
`^6.27.0`, compatible with the narrow 6.29.1 override. Inspect lock generation with
scripts disabled before clean installation. No unrelated upgrades or forced audit
fix. This does not update Node's separately bundled HTTP implementation or prove
that the entire dependency tree has no vulnerabilities.

## Verification and recommendation stack

Add regression contracts before the study: malformed/overflowed/duplicate session
data, correct current/cumulative separation, private-owner visibility, coverage
loss, idle connection leak, missing optional metrics, unchanged profile bounds,
sealed closure and sanitized output. Use isolated real PostgreSQL to validate
the observer against actual named connections/transactions and disappearance.
Test parsing and real local HTTP/TLS behavior of the patched dependency imports,
including safe rejection of adversarial responses in a bounded child process.

Run strict clean installation, full tree/audit, dependency-policy checks, affected
tests, lint/types, ownership/ESM/Knip, docs and staged/range secret scans. Build a
clean exact-source image with no cache; execute native regression before the
30-minute study, with no heavy builds/tests overlapping measured traffic. Do not
retrospectively tune acceptance to observed timings. Record outcomes/limitations
separately; no leak-freedom or causal optimization claim from one local run.

Stack: patched dependency baseline → source-bound observer contracts → real
database/HTTP tests → exact-image regression → normal-cadence co-load → independent
restore/history checks → verified cleanup → backed-up local Compose evaluation.
Only then recommend further profiling, a controlled comparison or optimization.
