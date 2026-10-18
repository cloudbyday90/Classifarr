# Selective gateway catalog reads outcome

Local evaluation on 2026-10-18 of the
[selective-read design](gateway-catalog-selective-reads-design.md), following the
[risk review](gateway-catalog-scan-reduction-review.md). This document records
measurements and their limits separately from the implementation contract.

## Implemented behavior

The shared ESM `catalogRowReader.mjs` owns schema validation, deterministic cursor
order, page size, cancellation and count/row-size limits. Full canonical capture
keeps its previous body projection. Dependency inspection returns byte/required
metadata for every job and bodies only for required verified jobs. It retains
both file checks and all existing restore/retention callers.

Excluded history still causes refusal when oversized or above 10,000 jobs,
including an empty required set and standalone retention registration. Validation
is incremental; a summary cannot return until the entire cursor completes.
Consumers hash/read files and cannot publish or register a partial scan.
Selection values are bounded UUIDv7 parameters. No database/schema or new admin
function was added, and optional services remain disabled in ordinary installs.

## Exact image and checks

- Code revision: `b87793b3a3cc92d7cd5b291e11bce0c154b7870e` on main.
- Local Docker image ID:
  `sha256:17b224cf6aeac21a36081410aa4b4b45bc94afda3b61feccbb491154fa3d5ec3`.
- Compose build used `--no-cache --require-provenance --protect-running-image`;
  image revision matched the committed code. This is local image evidence,
  not published registry provenance.
- 531 focused gateway unit tests and 327 isolated PostgreSQL integration tests
  passed. Initial fixture-only alias/uniqueness mistakes were corrected; the
  TLS unit command was rerun with the required local OpenSSL executable.
- Repository lint, server/client typechecks, server Knip, static ESM imports,
  strict ESM mock shapes, copyright and documentation checks passed.

The standard archive/catalog/retention image rehearsal passed. Four new checks
changed a dump, manifest, receipt or protection marker after a real export and
before publication; each refused publication and left no completion manifest.
These are function-level file-race tests, not scheduled retry admission tests.
Separate worker qualification exercises persisted attempt/restart behavior.

The standard rehearsal also proved standalone retention refuses an excluded
oversized failed row and 10,001 total jobs, preserving registered roots, pins
and inference counters. Existing private restore input, missing-marker,
inventory tampering, corruption, legacy receipt and resumed-retirement checks
passed, with final owned-resource cleanup verified.

## Same-snapshot comparison

The wide fixture contained 3,001 jobs: 3,000 historical failed jobs with padding
and one valid verified archive. It totaled 233,852,627 bytes of canonical job
text including row separators. The reference uses the previous full-body SQL;
its adapter derives guard metadata and filters only after full bodies cross the
database connection. Both paths then run the same real file inspection.
No application module is replaced or overlaid.

Ran reference, selective, selective, reference on one read-only repeatable-read
snapshot and the same files. Every run returned the same dependency summary
and ordered entries: three files, SHA-256
`54a5c47dba168c0d453e07ebaa75e3c3cf05617715cb0436fa8d1954bc66d715`.

| Order / mode | Returned JSON body bytes | Rows visited | Check elapsed, ms | SQL query elapsed, ms | Backend CPU ticks |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1: full reference | 233,849,626 | 3,001 | 2,575.04 | 2,289.79 | 177 |
| 2: selective | 3,296 | 3,001 | 932.14 | 923.91 | 77 |
| 3: selective | 3,296 | 3,001 | 690.82 | 684.90 | 63 |
| 4: full reference | 233,849,626 | 3,001 | 2,055.75 | 1,803.28 | 171 |

The body-byte count measures UTF-8 body fields actually returned to the client;
it excludes IDs, guard metadata and protocol framing. It is not total TCP or
socket traffic. SQL query elapsed sums client-observed query waits; total check
elapsed also includes parsing and file validation. CPU ticks come from the
identity-checked connected PostgreSQL backend and are not converted to seconds
or treated as whole-container CPU. Node CPU was not measured separately.

The comparison ran in the bounded synthetic source container, with normal local
applications still active. It is a small local experiment, not an old-binary
benchmark or proof of a universal speedup. SQL still serializes every job to
enforce the size guard; metadata rows and cursor round trips remain.

Standalone SELECT `EXPLAIN (ANALYZE, BUFFERS, SERIALIZE TEXT, TIMING OFF)` probes
were run after each measured check. Selective execution was about 651–654 ms.
Reference execution varied from 1,427 to 18,977 ms; the first probe reported
57,232 temporary blocks read and 57,289 written. Those diagnostic SELECT plans
can differ from cursor plans and do not measure network transmission. Their
cache/statistics/spill variation is another reason not to infer a fixed speedup
from a single EXPLAIN. Actual cursor timing and returned bytes are recorded above.
The diagnostic SELECTs used the fixture connection's 60-second statement timeout;
workers retained their existing per-statement limits and bounded cursor fetches.
No EXPLAIN probe ran against the ordinary local application or Unraid database.

This interpretation follows the official
[PostgreSQL EXPLAIN documentation](https://www.postgresql.org/docs/18/sql-explain.html),
found/opened through MCP on 2026-10-18. The design records the remaining official
sources and alternatives.

## Resource impact and qualification

The wide worker performed two full catalog captures in 14.322 and 16.080 seconds,
followed by independent restores in 10.527 and 12.393 seconds. Each export still
reached the 268,435,456-byte lifetime cgroup peak. The required full dump remains
part of the workload; no lower peak is claimed. The reference comparison warmed
this fixture before capture, so these timings are not directly comparable to
earlier coldness/cache conditions or previous image runs.

All six cases passed: capacity, publication, acknowledgment, interruption,
wide history and protected history. Each verified cleanup of its own containers
and volumes. All 63 worker metric records reported zero OOM, memory-limit-hit
and PID-limit events; deliberate process stops were independently distinguished
from OOM by the harness.

The protected fixture created and independently restore-verified 400 real archive
bundles, with 9,575,611 bytes of canonical job evidence and 9,296,502 bytes of
manifest/receipt payload. Marker tampering refused work; repair of the fixture
marker allowed a full catalog capture/restore, preserved source fingerprints and
pins, and retained the exhausted third-attempt refusal. Catalog capture took
18.808 seconds with a 65,728,512-byte peak; catalog restore took 5.251 seconds
with a 177,881,088-byte peak. This exercises the all-required path at deployed
worker limits, but is not a comparative throughput benchmark.

The capacity case exercised exactly 10,000 jobs, concurrent synthetic inference,
writer contention and a killed/restarted real restore. Publication and
acknowledgment cases stopped the worker at observed boundaries and recovered
from durable state; one publication committed after the process was killed.
Interruption preserved the original ordinal and refused uncertain replay.
Every case recorded zero provider calls and zero synthetic live-binding deletions.

## Local installation evaluation

Only local Docker Desktop Classifarr was recreated with the tested image, using
Compose `up --no-build --no-deps --pull never --force-recreate --wait
--protect-running-image`. The new container was healthy; `/health` and
`/api/system/health/ready` returned 200 with the database connected, and `/`
returned 200.

Optional gateway/archive/cleanup/catalog schemas remained absent. The existing
capture budget remained revision 2, `when_idle`, with zero daily/reserved calls
and tokens and the same next-check timestamp. No optional service was enabled.

Before replacement, retained
`data/backups/gateway-selective-reads-before-20261018.dump`: 76,240,278 bytes,
mode 0600, SHA-256
`b4e035cf78d342a907b35036b6213af0b19fc4db2297b46876fc0eebd53d427b`.
`pg_restore --list` succeeded; the live backup was not restored in this exercise.
The prior local image remains protected by a rollback tag:
`sha256:091a9e5ca75242bee20df98a0bef7f48b04d3954f2bf116c97cdda0add52598a`.
Ignored build, qualification and comparison logs remain under
`.tmp/selective-catalog-*` and `.tmp/selective-gateway-*`.

## Recommendation and deferred work

Keep this selective cursor and the existing ESM/PostgreSQL/file-verification
stack. It demonstrated smaller body transfer and lower local check time without
removing guards or changing retry/retention behavior. The costs that remain are
whole-history SQL size computation, cursor round trips, metadata transfer, file
hashing and full dump I/O. The first EXPLAIN outlier and unchanged export peak
limit broader performance claims.

Next: a sustained isolated local soak with synthetic inference requests and
scheduled archives, measuring request latency and queue waits alongside resource
usage. Existing concurrent-ledger checks prove consistency, not latency under
continuous request traffic. Keep the same recovery limits and verification;
no additional runtime feature or production activation is needed for that study.

Full application coverage, ARM64, live cgroup v2 sampling and remote release
evidence were not part of this scoped change. No release/tag was created, and
Unraid, Plex and shared Ollama were not targeted. GitHub MCP returned no open PRs;
none was selected, implemented or merged.
