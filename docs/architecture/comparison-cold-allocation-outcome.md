# Cold comparison allocation outcome

Date: 2026-10-07. [Design, official research and tradeoffs](comparison-cold-allocation-design.md).

## Result

Added isolated cold-build profiling; **no production memory optimization or
safeguard change** in this round. The prior community-phase peak was insufficient
to name a leak. Matched diagnostic modes now point to normalization/revalidation
allocation activity as the next candidate, rather than neighbor storage.

Three modes each completed three cold builds of the same deterministic fixture:
5,776 descriptions, 1,024 dimensions, ten libraries, socket-only PostgreSQL and
the real repository/fitter/community implementation. Each mode verified identical
source fingerprints, output summaries and cache weights across its three cycles.
Every build completed local discovery. Three workers were created and exited per
mode, with zero remaining workers, OOM kills or memory-limit hits.

## Measurements

All values below are MiB. Independent peaks are not additive.

| Mode | Peak main heap | Peak process RSS | Peak raw container | Kernel peak | Peak worker heap |
| --- | ---: | ---: | ---: | ---: | ---: |
| Natural control | 332.96 | 577.86 | 696.11 | 697.80 | 216.19 |
| All sampled allocations | 234.01 | 488.08 | 602.50 | 610.61 | 211.48 |
| Sampled survivors | 240.18 | 503.32 | 617.10 | 621.23 | 217.48 |

Profiler overhead/GC effects mean lower sampled-run peaks are **not** an improvement.
The natural control's highest main-heap boundary was the third build's start,
after its source read, not community completion. Cold builds took 18.8–21.8 seconds
without sampling and 17.0–20.9 seconds with sampling; three repetitions do not
establish a timing benefit. No application-requested GC was performed.

| Sampled main-thread component | Allocations, cycles 1 / 2 / 3 | Survivors, cycles 1 / 2 / 3 |
| --- | --- | --- |
| Shared normalization/revalidation | 859.26 / 989.72 / 969.74 | 41.82 / 44.84 / 43.84 |
| Standalone vector normalization | 416.01 / 318.35 / 567.24 | Not sampled |
| Community centroids | 203.54 / 414.14 / 619.10 | 5.04 / 6.55 / 3.02 |
| Community graph | 169.39 / 157.87 / 134.61 | Not sampled |
| Neighbor insertion | 13.00 / 10.50 / 10.00 | Not sampled |
| All components | 1768.75 / 2085.14 / 2469.61 | 51.99 / 55.44 / 49.87 |

These are statistical self-byte estimates assigned once to the nearest recognized
component in the stack. “Not sampled” is not zero allocation or proof of absence.
Source vectors loaded before sampling and worker-isolate allocations are excluded;
separate memory observations cover those domains. Survivor samples are objects
not collected at that instant, not a strong-reachability graph or permanent retention.

The natural control's two-second idle heaps were 189.57, 180.03 and 180.02 MiB.
WeakRef observations stayed at one source/vector/handle and two community
rows/vectors, rather than accumulating across cycles. Sampled runs likewise had
one source/vector/handle and two community vectors; community-row arrays were no
longer observed. The final generation can remain observable until later GC.
This supports release of older generations in this fixture, not a universal leak
disproof or a long idle-soak result.

The earlier concurrent catalog run peaked at 636.97 MiB main heap. That run had
different work, caches, consumers and lifecycle history; this cold fixture does
not reproduce or resolve its complete peak. It does not exercise production
admission, publication, warm cache hits, real five-minute scheduler intervals,
provider calls or concurrent ingestion. No full catalog soak was repeated for this
diagnostic-only change. Normal local Classifarr and unrelated Harmoniarr stayed
running, so the host was not otherwise idle.

## Code and verification

- Small ESM modules extend the existing synthetic runner. No production service,
  API, schema, deployment template, key, ownership or retry policy was changed.
- Aggregate-only profile reduction has fixed component names, numeric bounds,
  bounded traversal and cleanup on success/failure. No inspector listening port,
  raw profiles, source paths, text, vectors or credentials are emitted.
- Regression-first: missing-module failure before implementation. Focused checks:
  five suites, 30 tests passed. Actual Node 24.21.0 inspector smoke passed in both
  modes, then the Linux image exercised the full workload.
- Full backend: 1,735 suites, 53,883 tests passed in 356.1 seconds; one Windows-only
  skip. Exact-image Linux directory-fsync, exclusive-copy and source-preservation
  checks passed separately. Backend lint/typecheck, development/production
  dependency checks, copyright and static-import checks passed.
- Post-build isolated schema dump and independent check passed through
  `20261005_180000_ingestion_compatibility_fence.sql`, with 22 seeds. Tracked schema
  unchanged; owned schema containers removed.

The recovery-change skill guided evidence-before-optimization and bounded synthetic
validation. The dependency-update skill kept the separate PR trial behind its
runtime compatibility gate.

## CI scope

For implementation commit 77270912, OSV Full, CodeQL (JavaScript and Actions),
container/filesystem security scans, secrets, copyright and queued-work resource
safety checks passed. Fresh-install/published-upgrade checks also passed in
[the implementation pipeline](https://github.com/cloudbyday90/Classifarr/actions/runs/37621447456).
Database tests subsequently passed. The main build/test job was still running at
the final check; do not treat this
as an all-green final CI receipt. Documentation-only follow-up commits are separate
from the exact image source above.

## Random PR trial

Fresh enumeration found two open PRs. Random selection chose client
[#555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`5545605b53c854de8847b44e24fa083ff4218080`. Applied its exact manifest and lock changes:
Node declarations 24.19.1 to 26.6.4, undici-types 7.24.6 to 8.9.0. Official registry
metadata confirmed version, integrity, dependency and absent scripts/peers.
The deployed-Node-major gate failed (7/8 passed). Reverted before installation;
restored gate 8/8 passed. PR remained open at the same head. No merge, retained
dependency change or installed-candidate audit/build claim.

## Immutable image and private evidence

Source: `7727091232159d8d1631905c2f2251164531093b`, committed/pushed on main.
Clean `--no-cache --require-provenance` Compose build passed; OCI revision matches.

- Image/index: `sha256:0f6b0db29d5fc7ebb9f44fab5f589668ee5985712dc870ca3058b542a3ae9e8d`.
- Native manifest: `sha256:1e5c89e43f8f6e5655e3e6d60040280230718ae386e5d4f13e6344e64188f6b8`.
- Configuration: `sha256:3a3fc3109be4eb6f9ca89f751f100274d4744f29247bd90f67d422c1f339600c`.

Each mode used a new labeled container, no network/ports/appdata, non-root user,
read-only root, dropped capabilities, no-new-privileges, 2 GiB/two CPUs/128 PIDs,
and disposable tmpfs. The diagnostic uses its own entry point, not application
startup; startup is checked separately by schema and local Compose checks.
All three containers were removed with ownership checks; a separate label query
found none remaining. Only regenerable synthetic data was removed.

Private numeric records: `.tmp/cold-natural.json`, `.tmp/cold-allocations.json`,
`.tmp/cold-survivors.json`. SHA-256 of the captured stdout for each run:

- Natural: `c62caef030acb920de5aa6573a0c9431ce9deae5ce486b037cf9b4b24d9e6aee`.
- Allocations: `b81c9429eb339190cae75cf4a459c66fc0a36d4c7dc088f96262e6015e0329dc`.
- Survivors: `0507a1a6f9f49f99b39f5f4562c18a95fc14482664da19ee191120469e22f3d6`.

Runner modes are `cold-natural`, `cold-allocations`, `cold-survivors` in
`server/src/scripts/comparisonMemoryStudy/run.mjs`. They require the explicit
`CLASSIFARR_SYNTHETIC_MEMORY_STUDY=1` flag and the enforced isolated resource budget.
Never run them in a deployed application container or mount real appdata.

## Local Compose replacement

Pinned the previous image as `classifarr:pre-cold-allocation-fd1ad7c4` before
overwriting the build tag. A fresh 75,557,653-byte database archive passed checksum
and archive-list checks, not a restore test:
`.tmp/pre-memory-fingerprint-f4c59bb9-38f2-4691-a268-0cc1021a69cf.dump`.
Its exact rollback image is also tagged
`classifarr:pre-memory-f4c59bb9-38f2-4691-a268-0cc1021a69cf`.

Only the local Classifarr test service was recreated, at 12:34:55.561 UTC, from
the measured image. Startup health passed; user `1000:1000`, read-only root,
2 GiB limit, existing security settings and mounts remain unchanged. Initial
readiness was `ready`; the latest stored comparison warning was 11:18:45 UTC,
before replacement. The read-only diagnostic helper's own memory is not the web
daemon's memory. Unraid and unrelated Harmoniarr were not changed.

The five-minute observer recorded 19 healthy samples from 12:36:37.927 to
12:41:31.805 UTC. Raw container usage ranged from 875.98 to 920.74 MiB and ended
at 875.98 MiB; kernel lifetime peak was 982.37 MiB. Zero OOM kills, limit hits or
restarts. Final readiness was `backfilling` as normal background work resumed;
the newest stored comparison warning still predated restart. The bounded log
scan showed no newer comparison event. This window does not prove backfill/warm
refresh completion, sustained stability or a production memory improvement.
Private observation: `.tmp/cold-local-memory.jsonl`.

## Recommendation stack

1. **Next: test lower-allocation normalization arithmetic**, particularly the shared
   revalidation path. Compare indexed numeric loops against the current callback
   passes on identical inputs, including mutations, corruption, signed zero and
   exact numeric output. Advantage: targets the largest measured allocation source;
   risk: accidental numeric/validation drift. Keep all checks and ownership rules.
2. **Then rerun matched cold profiles and the concurrent catalog study.** Advantage:
   distinguishes an allocation reduction from a real peak/headroom benefit; cost:
   additional test time. Do not equate this diagnostic baseline with that workload.
3. **Keep memory limits, admission and GC safeguards unchanged.** Raising limits
   would provide headroom but would not address the measured allocation activity.

No release, version bump, tag or separate branch was created.
