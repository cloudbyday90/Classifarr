# OMDb recent lookup reuse outcome

Date: 2026-10-13.
See the separate [design, sources and tradeoffs](omdb-recent-lookup-design.md).

## Delivered behavior

Ordinary title, IMDb-ID and search requests can supply one minute of process-local
connectivity evidence. Health accepts verified success; SSL recovery also accepts
a confirmed miss. Reuse retains original check timestamps and latency and makes
no provider request or quota debit. The existing classifier and TLS transport are
unchanged; no response body, title, key or raw error enters the record.

New requests, overlap, failure and queue SSL pauses invalidate evidence. Reads
check both monotonic and wall-clock age, plus current saved configuration,
credential rejection, budget and pacing in a short bounded transaction. Probe
fallback remains unchanged. Process restart loses the observation. Status views
do not acquire provider-call capability. No schema, dependency, new worker,
memory safeguard change or inventory repair is included.

Ownership review covers the changed lookup/queue paths and their new reader.
Existing queue shared-writer and indirect-analysis debt remains unresolved.

## Verification

- Three focused suites: 105 tests passed. Five disposable PostgreSQL/real-HTTP
  suites: 102 tests passed, including 27 new reuse cases. These verify original
  timestamps, no additional credit/request, all three ordinary lookup entry points,
  expired/restarted evidence, confirmed-miss semantics, active selection/key/disable/
  rejection/budget/wait changes, database failure and a real conflicting lock.
  A separate connection acquires the configuration lock while HTTP is in flight.
  Queue tests invalidate both completed and in-flight evidence on a new SSL pause,
  repeated certificate failure and reset. Saved probes cannot seed the record.
- Full backend coverage: 1,817 suites and 57,245 tests passed, zero failures,
  847.519 seconds. The single skip is the Linux directory-fsync case on Windows.
  Coverage: statements/lines 89.76%, branches 86.27%, functions 91.20%.
- Typechecking, lint, copyright, reviewed ownership, normal/production dependency
  analysis, static imports and ESM mock-shape checks passed. Markdown lint checked
  2,171 documents with zero errors. Staged secret scan passed.
- Full frontend coverage ran separately after backend completion: all 469 files
  and 7,190 tests passed in 260.24 seconds. Coverage: statements 87.63%, branches
  81.56%, functions 87.30%, lines 89.34%. The combined coverage ratchet passed
  without baseline changes. Neither timeouts nor assertions were relaxed.

## Exact image and local evaluation

Started from clean `main` at `618a5b35a9c127b23bf44627ab86842a44ea6895`.
Runtime commit: `077a43342659434ffd7b9c8b7021a8297bdc93f2`.
Compose built with `--no-cache --require-provenance`, Linux/amd64 and AVX2.
Tested local image ID:
`sha256:11f1fd56c0b8cb4e117b209024b26319ceb503db6b346a3a5123278820ef88aa`.
Later documentation-only commits do not change this runtime. Local labels and
tests are not published multi-platform, registry-signature or release evidence.

The exact image passed the isolated runner with network disabled, no published
ports, 1 GiB memory, two CPUs and 256 PIDs. Normal entrypoint and fresh migrations
through `20261010_220000_source_catalog_mappings.sql` ran with 22 seed migrations;
the generated schema has no diff. Empty state invented no work. Existing
configuration, reconciliation and adapter checks passed. The OMDb fixture passed
five health-admission, six SSL-recovery, eight response-wait and seven recent-lookup
cases using fourteen loopback requests and no external provider calls. Public
provider configuration stayed empty. Owned container
`classifarr-schema-check-bb3cffee-96a8-45ae-8ca7-32808d6c777a` and its exact temporary
data directory were removed and verified absent.

The first pre-replacement backup attempt stopped before dumping: Docker could no
longer resolve the previous running image ID after its mutable build tag was
replaced. Neither the running container nor data was stopped or changed by that
failed precheck. The existing earlier verified rollback image was retained instead:
`sha256:39d02fe0ebbec10889f8b260a9aa57a525f700715c0bfca88e03bd6db42f7f9d`
(source `d736072eab233900b695cf1acd781c51b8e0d026`). This is explicitly **not** an
exact rollback to the replaced running build. A fresh 76,284,855-byte database
backup then passed checksum and archive-list checks; this was not a restore test.
Local artifact: `.tmp/pre-memory-fingerprint-ca808cd7-658e-45bb-8d29-186932c9dedd.dump`.
Lesson: preserve the running image under a separate immutable-reference rollback
tag **before** rebuilding a mutable tag, not just before container replacement.

Only local Classifarr was recreated with `--no-build --pull never --no-deps`.
It started at `2026-10-13T10:46:20.311804255Z`, healthy with zero restarts and no OOM.
Thirty-two packaged runtime files match the checkout. Health, liveness and readiness
returned 200; unauthenticated detailed health returned 401. Existing route fixtures,
compiled System information and startup-report checks passed. Deployment retains
uid/gid 1000, read-only root, 2 GiB memory, no-new-privileges and PostgreSQL tmpfs
with noexec/nosuid/nodev. This startup report is not loaded-binary attestation.

Before/after counts stayed at 6,837 classifications, ten active/covered libraries,
four unresolved identities (two source review, two retry due), zero pending text
embeddings and 6,815 pending image embeddings. The old process had four retained
comparison memory-pressure warnings; the immediate new-startup sample had none.
That short sample does not demonstrate a memory fix. Normal startup jobs remained
enabled. No live provider failure, manual recovery or configuration change was
induced. Unraid, Plex, shared Ollama and unrelated containers were unchanged.
Controlled fixture clock/deadline changes prove decision logic, not elapsed
cooldown/heartbeat behavior or production request savings.

## Recommendation stack and limits

1. Strict existing response classifiers and HTTPS transport: validated evidence
   without new provider behavior; inconclusive responses still need a future check.
2. Single short-lived local record: constant retained state, no database migration
   and fewer redundant requests; restart, concurrency and separate processes reduce
   reuse opportunities. It does not establish cross-host TLS health.
3. Current-setting/budget/wait checks and admitted-probe fallback: existing limits
   remain effective; a reusable result costs a short database read transaction.

Next from the rebuild finding: automate rollback-image preservation before the
build step, with an exact-image check before replacement. Then measure eligible
reuse and fallback reasons with bounded, credential-free aggregate diagnostics
before considering a longer lifetime or distributed cache.
The rollback follow-up is documented in the
[local rebuild design](local-docker-rollback-design.md) and
[verification outcome](local-docker-rollback-outcome.md). Further reuse diagnostics
are deferred until after release preparation, per the maintainer's direction.
Synthetic tests prove behavior, not savings under production workload. Unraid,
Plex and shared Ollama are outside this local deployment. No release or merge.

GitHub MCP enumeration found zero open PRs; no random open PR was available to
implement. No new branch, version bump, tag or release was created.
