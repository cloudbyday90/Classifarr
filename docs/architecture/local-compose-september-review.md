# September local Compose rebuild and release review

Date: 2026-09-07.

## Scope and design

The user requested a no-cache local Compose rebuild and review of work since the
last release. GitHub MCP's release collection identifies
[v0.48.4-beta](https://github.com/cloudbyday90/Classifarr/releases/tag/v0.48.4-beta),
published 2026-08-29, as the most recent published release. GitHub's `latest`
endpoint excludes prereleases and points to an older version; it is not the
comparison baseline here. The starting main revision was `ab240487`, 126 commits
after that release, with 27 added migration files.

Review concentrates on database upgrade compatibility, authentication boundaries,
inventory observation/identity, feedback eligibility and idempotency, and the
accumulated statistics changes. Full unit suites, selected PostgreSQL integration
tests, browser checks, a fresh-schema check and live HTTP observations complement
the source review. This is not an exhaustive line-by-line audit of every changed
file or a classifier accuracy study.

The existing Compose service is rebuilt using the repository's smart wrapper
with `build --no-cache`, then recreated with `up -d --no-build --force-recreate
--wait`. Preserve its mounted data. Before replacing it, keep a custom-format
PostgreSQL backup and the old image locally. The private backup is checksum-checked
and readable by `pg_restore`; it remains ignored under `.tmp`.

## Findings and changes

1. `.dockerignore` did not exclude mounted database data, private `.tmp`
   observations, credential files or browser artifacts. Added explicit exclusions.
   Existing explicit Dockerfile COPY statements do not establish that these files
   were included in prior final images; this change closes unnecessary build
   context exposure and reduces unrelated build inputs.
2. The HTTP transport test setup used `clearAllMocks()` followed by default mock
   responses. The repository's full code-health check rejected this because queued
   once-responses survive clearing. Reset each mock and reinstall the constructor
   implementation before each test.
3. Router guard tests compiled eager dashboard/setup view trees within the first
   navigation test's timeout. That test timed out during the concurrent no-cache
   build/full regression run. Stub those eager pages in the guard test while
   preserving real router construction, guards and navigation assertions. Page
   behavior remains covered separately; no production timeout is increased.
4. Pino's formatter converted numeric `level` values to strings before worker
   routing to stdout and rolling files. A real two-target test reproduced empty
   log files. Removing that formatter restores numeric levels, correct per-target
   filtering and redaction. The test console adapter maps numeric levels back to
   their console methods. External file consumers should accept standard numeric
   Pino levels. Quiet startup output before this fix was not proof of no errors.
5. A new source-library history event lacked original provenance. The queue
   membership writer and manual queue writer bypass classifier persistence.
   They now capture fixed non-classifier origin in a shared metadata builder,
   replacing caller-supplied candidate data. No legacy backfill is performed.
6. The full serial backend unit run reached Node's default approximately 4 GB
   heap limit. Validation uses two workers with a 512 MB idle recycling threshold;
   this bounds accumulation between test files without increasing production heap
   limits. Making this the standard full-suite workflow is a follow-up.

## Official guidance and tradeoffs

| Recommendation | Pros | Cons / limits | Source |
| --- | --- | --- | --- |
| Exclude private and irrelevant local build inputs | Smaller context and less exposure to builders | Must maintain exclusions as tooling changes | [Docker build context](https://docs.docker.com/build/concepts/context/) |
| Separate no-cache build from service replacement | Validate the completed image before restart | Slower than cached development builds | [Compose build](https://docs.docker.com/reference/cli/docker/compose/build/) |
| Recreate and wait for service health | Applies the built image and checks startup readiness | Health alone does not validate authenticated features | [Compose up](https://docs.docker.com/reference/cli/docker/compose/up/) |
| Preserve numeric Pino levels | Restores worker routing and severity filtering | Collectors expecting string levels must adapt | [Pino transports](https://github.com/pinojs/pino/blob/main/docs/transports.md) |
| Recycle bounded Jest workers | Limits memory accumulation across files | Worker restarts add initialization cost | [Jest configuration](https://jestjs.io/docs/30.4/configuration#workeridlememorylimit-numberstring) |

Recommended stack: restricted build context, no-cache local build, verified backup,
fresh and upgrade schema checks, preserved Compose data, authenticated read-only
smoke checks, focused browser checks and regression tests. No image publication,
release tag or version bump is requested.

## Outcome

The initial no-cache build transferred a 19.44 MB context, installed dependencies
with zero reported audit vulnerabilities, and passed fresh schema comparison.
The local service recreated successfully and became healthy. Its existing
database advanced from 234 to 249 applied migrations while preserving all 6,772
history records, 10 libraries and zero feedback records at the upgrade check.
The private backup was 42,137,471 bytes and its checksum and archive catalog were
verified. Docker Desktop could not copy the file directly from container tmpfs;
streaming it through `docker exec` into a binary file descriptor preserved its
exact checksum.

Seven authenticated read-only HTTP requests returned 200: statistics overview,
policy totals, alerts, activity, library observation health/history and overlap.
Statistics evidence was available and retained unknown legacy recording times;
anonymous overview access returned 401. The overview took 403 ms in that single
observation; observation health and overlap took about one second each. These
are local observations, not latency guarantees. A live browser displayed seven
tables and 11 recorded-library groups with no page errors, failed HTTP responses
or requested writes. A background source observation arrived after startup and
exposed the writer gap above; normal background processing was not disabled.

The first image was intentionally marked `VCS_REF=unknown` because its source
tree was still being edited. Maintenance evidence correctly refuses that image.
The final no-cache build used clean revision
`793038e28c9cf5e7b8d9150ee75c1d47bda2d9d7`. The recreated container reports that
same OCI revision and is healthy with the writer and logging fixes active. This
outcome update is a subsequent documentation-only commit; application code is
identical to the running image.

The final HTTP recheck again passed all seven authenticated requests and the
anonymous 401 assertion. The live browser again found seven tables and 11 groups,
with no page errors, failed responses or requested writes. The database retained
6,774 history records, 10 libraries, zero feedback records and 249 migrations.
The two additional source observations predate the final restart and correctly
remain unknown origin; the fix does not fabricate provenance for existing rows.
Overview latency was 362 ms; observation health and overlap took approximately
1.7 and 2.1 seconds during the concurrent smoke checks.

Actual stdout now contains numeric Pino levels, and both rolling files receive
records. The final startup/smoke log sample had 1,268 informational records,
seven warnings and no error/fatal records. Six warnings were slow database
queries; the other was existing multiple-active-row configuration drift for
OMDb and TMDb. Earlier runtime warnings reported 19 rejected source identities
and one unavailable provider observation. These are observations from the local
installation, not proof that external providers or source data are healthy.
Do not silently select or disable provider credentials to clear a warning.

Follow up by checking provider selection semantics before repairing duplicate
active configurations, and profiling the inventory queries responsible for the
slow-query warnings. Preserve source-identity rejection and explicit unknowns;
relaxing those guards would weaken future classification evidence.

Focused runtime-fix/code-health validation passed 21,122 tests, and the writer
and identity integration recheck passed 14 tests. Broader integration validation
passed 300 tests across 17 suites. After the router fix, the complete client
rerun passed all **4,761 tests across 341 files** in 286.51 seconds. The initial full
backend run was incomplete because of the heap exhaustion above. The recycled
worker run and final delivery checks are summarized in the
[feature outcome](original-observation-types-outcome.md).

## Inventory read follow-up

The [inventory read performance outcome](inventory-read-performance-outcome.md)
records the completed health/overlap optimization and a subsequent no-cache
Compose build. On the same 6,692-row local population, measured database execution
fell from 2,272 to 917 ms for health and 2,114 to 645 ms for overlap. The canonical
projection, identity checks, unknown states and bounds remain unchanged; automatic
fair sampling shares the narrowed health projection. Real PostgreSQL and browser
regressions passed, and the rebuilt container was healthy with no error/fatal
records in its startup/smoke sample. Slow-query warnings and the existing provider
configuration warning remain explicitly recorded. Provider selection integrity
is the next recommended investigation.

## Metadata provider follow-up

The [provider selection outcome](metadata-provider-selection-outcome.md) records
the completed writer/selection repair and another no-cache rebuild. Repeated
backup restore was allocating new TMDb/OMDb rows instead of conflicting on the
existing ID. Shared ESM reads and serialized stable-ID writes now prevent this.
The local migration consolidated only exactly equivalent active settings, retained
every credential row, and reduced the provider integrity result to zero invalid
providers. Distinct legacy settings remain untouched by the migration. The new
startup/smoke sample had seven slow-query warnings and zero error/fatal records.
Atomic OMDb quota admission is the next recommended fix.
