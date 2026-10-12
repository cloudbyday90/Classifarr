# Description corpus controlled-load outcome

Date: October 11, 2026 (America/New_York). Main; no release.
See the separate [design, tradeoffs and official research](description-corpus-profile-design.md).

## Result

Implemented a modular ESM, offline profile of the unchanged description-refresh
SELECT. The verified synthetic run did **not** reproduce the historical 15-second
timeout. It does not establish why the deployed query slowed down, and no SQL,
index, timeout, memory safeguard, recovery state or ownership policy was changed.

The standalone CLI reuses the existing disposable PostgreSQL lifecycle. It has
no source-database/credential/size override, no application startup or provider
request, and no connection to Unraid, Plex or Ollama. Only sanitized aggregates
leave memory; the synthetic tables and owned container are removed afterward.

## Reproduction and reference point

With the pinned Node 24.21.0/npm 12.2.0 toolchain and the existing local
`postgres:18.6-alpine` image, run from the repository root:

```sh
node --max-old-space-size=512 server/src/scripts/runDescriptionCorpusProfile.mjs
```

No application environment file is loaded. Exit zero means all measurements,
controls and cleanup checks completed; failure exits nonzero with a fixed message.
The Node heap cap applies to this host diagnostic process, not Classifarr.

The accepted full-size run used PostgreSQL 18.6, with inspected 1 GiB memory,
two CPUs, 256 PIDs and a loopback-only ephemeral port. Immutable local image:
`sha256:d3e1620b530c944afa6e887d22eb899824da68e19c52024bf98f5220c88a65b2`.

- Corpus query SHA-256:
  `a62f731a962022879c655c57f32fff6bcafe84401a0b13129788a287e95fd08f`.
- Schema snapshot SHA-256:
  `6f8f391d44d7005094227b4517d623ac59687b4e5eeb39f402e1e687e5b60b50`.
- Five schema-derived tables, nine primary/unique constraints and six selected
  existing B-tree indexes; foreign keys, triggers and other indexes omitted.
- 6,500 identities across ten libraries; 19,500 synthetic history rows. Thirteen
  source conflicts excluded, leaving exactly 6,487 prepared descriptions.
- `work_mem`: 4 MiB; shared buffers: 128 MiB; JIT on; I/O timing off. No tuning.

Each distribution has three single-reader and three paired-reader cycles,
alternated after a warm-up. Ordinary-read result fingerprints agree across both
distributions and concurrency levels. These are observed ranges, not latency SLOs.
Other host containers were not stopped; workload concurrency is controlled, but
the host itself is shared. No throughput or machine-isolation claim is made.

| Measurement | 20 history fallbacks | All eligible rows use history |
| --- | --- | --- |
| Single ordinary read, client elapsed | 144–194 ms | 164–188 ms |
| Paired ordinary reads, per-reader elapsed | 181–506 ms | 180–513 ms |
| JavaScript preparation, per read | 214–244 ms | 217–270 ms |
| EXPLAIN, node timing off: execution | 96.546 ms | 128.626 ms |
| SERIALIZE TEXT, timing on: execution | 104.998 ms | 132.435 ms |
| Reported serialization time / volume | 2.771 ms / 6,982 KiB | 4.627 ms / 6,982 KiB |
| Root shared blocks hit / read | 1,218 / 0 | 32,530 / 0 |
| Root temporary blocks read / written | 501 / 502 | 0 / 0 |

The sparse-fallback plan had one disk sort; the all-fallback plan had none.
Both estimated 3,233 rows versus 6,487 actual. This is a fixture-specific plan
difference, not evidence to add an index or increase work memory in production.
EXPLAIN arms are separate queries with different instrumentation and no result
network transfer. Do not subtract their times to infer an exact network cost.

Ordinary-cycle wait samples were mostly active/no-wait, with one IO and one IPC
sample in the sparse distribution; no sampled Lock wait in ordinary cycles.
This does not prove CPU saturation or exclude brief missed waits. Synchronous
preparation shares a Node event loop between readers and can delay another
read's completion callback. Client elapsed time includes that effect.

Each deliberate held-lock control produced `55P03` at the unchanged two-second
lock deadline, with 64 and 65 Lock samples respectively. After rollback, the
ordinary query succeeded with the same fingerprint. This proves the instrument
detects that controlled failure, not that a lock caused the historical incident.

Host-process RSS moved from about 83 MiB before the first warm-up to 251 MiB at
the first scenario's last snapshot; the second ended at about 251 MiB too.
Heap-used snapshots varied, including a fall between scenarios. This is neither
a retained-heap/leak finding nor a profile of Classifarr workers and caches.
There was no forced GC, heap snapshot, sustained soak or measured container peak.
Full refresh-cycle retained-memory work remains open.

## Failures caught during development

- A first unit-table case used Jest's empty argument-row form accidentally;
  corrected the fixture shape, not the test timeout.
- Real PostgreSQL rejected duplicate synthetic library names. Fixed generated
  names, retaining the schema's uniqueness constraint.
- Inspection caught the borrowed Testcontainers memory-unit mistake: this API
  expects GiB, not bytes. The exploratory run lacked the intended effective cap
  and is **not** accepted as bounded evidence. Corrected this runner to `memory: 1`,
  added actual Docker-property validation and reran the full-size study. The
  accepted figures above are from the corrected, inspected run.

## Random open PR trial

Fresh enumeration returned #556 and #558. The random draw again selected
[#558](https://github.com/cloudbyday90/Classifarr/pull/558), immutable head
`e8a7ee2e490e5437375aa3a4628943657fa1783e`. Applied its exact client manifest and
lockfile patch locally: Node types 24.19.2 → 26.6.4, undici-types 7.24.6 → 8.9.0.

Strict installation, the complete dependency tree, both client typechecks and a
zero-advisory full npm audit passed. Tooling passed 40/41: the runtime-major test
correctly rejected Node 26 types for Node 24. Restored the exact patch, reinstalled
and passed 41/41. No client diff remains; the PR was not merged, closed or changed.

Fresh client outdated metadata also lists vue-router 5.4.0 (wanted/latest versus
5.3.1 installed), TypeScript 7.0.2 (versus pinned 6.0.3), and Node types 26.6.5.
These are update candidates, not proven security defects or accepted upgrades.

## Verification

Focused tests: 37 unit tests across three suites; real PostgreSQL integration:
one end-to-end test covering both distributions, concurrency, serialization,
lock controls, unchanged public inventory and cleanup. The corrected full-size
standalone run verified actual Docker limits and container removal independently.

Full backend coverage completed in 1,032.265 seconds: 1,796 suites and 56,236
tests passed, one test skipped, and one ownership-review test failed. That run
started before the explicit review for these three new offline SQL paths was
added. The reviewed paths remain unresolved/not production-compatible; the
ownership gate then passed with zero connections, writes or provider requests.
The complete ownership test file then passed separately: 39/39 in 25.293 seconds.
The full suite was not repeated after that review-only correction; no runtime
source changed after the full coverage run began.

Backend coverage: 89.71% lines/statements, 91.13% functions and 86.13% branches.
The ratchet passed using this current backend report and the earlier October 11
frontend report for the unchanged, restored client source/dependencies. No
coverage threshold or baseline changed; frontend coverage was not rerun here.

Server typecheck, full server lint, both dependency-boundary checks, ESM import
and mock-shape gates, copyright and Markdown checks passed. Restored dependency
tooling passed 41/41. Staged secret scanning found no leaks. These local results
are not a claim that remote CI or a published multi-platform image has passed.

## Local image and schema verification

No-cache Compose build from clean implementation commit
`3da379102da042af1adf4a5e4644dd174cd53bba` passed with required revision metadata.
The local Linux/amd64 image ID is
`sha256:8f5a33192f73d9579ed48afc2d88005de321d7d10dea82833043e092e3c6fbbb`;
its OCI revision matches that commit. This is local image identity, not a claim
about a published registry digest, signed provenance or ARM64 validation.

Before replacement, the 75,628,571-byte local database archive passed checksum
and `pg_restore --list` readability checks; no full backup-restore exercise was
performed. The exact prior image was retained under a private rollback tag.
Only the local `classifarr` service was recreated, using `--no-build --pull never`.
It became healthy, with zero restarts and no OOM flag. The two-GiB memory limit,
UID/GID 1000, read-only root filesystem and no-new-privileges setting are unchanged.

Read-only checks at 01:12:49 and 01:30:29 UTC on October 12 (October 11 local)
agreed: ten active/covered libraries; four unresolved identities (two source
reviews, two retry-wait); 6,835 classification rows; zero pending text embeddings
and 6,813 pending image embeddings. The ten-row embedding batch remained unique.
No startup warning/error rows were returned in the checked window. These probes
made zero writes and provider calls; normal application background services were
not disabled. This is a startup check, not a sustained memory soak or proof that
the historical refresh timeout is fixed. Unraid, Plex and Ollama were untouched.

After rebuilding, the exact image initialized a separate fresh database with
network disabled, one GiB, two CPUs and 256 PIDs. The schema-dump runner completed
through `20261010_220000_source_catalog_mappings.sql`, including 22 data-only seed
migrations; `database/schema/current.sql` has no diff. Fresh-state checks found
no invented classification, embedding or identity-recovery work. The owned
container and its exact temporary data directory were independently confirmed
absent. No existing application data, backup or rollback image was removed.

## Next recommendation

First correct and verify resource-quota units in the two older diagnostic paths:
`runRetryQueryBenchmark.mjs` and the `profiling-maintenance` integration test both
pass byte counts to `withResourcesQuota`. They were not executed or modified in
this iteration. Audit their actual Docker limits before relying on old resource
claims. This is a diagnostic-tooling issue, not a demonstrated cause of the app's
production memory warning.

Then extend the controlled profile with representative season mappings and
application refresh-worker/cache lifecycles, followed by an isolated retained-
memory soak. Current synthetic reads are healthy; do not call the historic
slowdown fixed or loosen safeguards without reproducing the limiting resource.
