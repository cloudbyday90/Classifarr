# OMDb probe response wait outcome

Date: 2026-10-12 local (October 13 UTC during verification).
See the separate [design, official sources and tradeoffs](omdb-probe-response-wait-design.md).

## Delivered

Admitted System-health and automatic SSL-recovery probes now save provider wait
advice into the existing shared OMDb cooldown. The bounded transport observes
completed success and HTTP-error responses once, passing only status and headers.
Both callers supply the committed credential context to an injected observer;
the existing store rejects obsolete configuration and never shortens a matching
wait. Ordinary lookup observation retains its existing API and behavior.

No extra request, credit debit, worker, schema, dependency or UI change was added.
Existing TLS checks, request/body limits, daily quota, pacing, generation checks,
memory safeguards and inventory ownership are unchanged. Persistence failure
remains a fixed deduplicated warning, not permission to retry HTTP or refund a
credit. A confirmed miss still proves SSL recovery only, not healthy retrieval.

The changed observer's ownership review was updated after inspecting both probe
call chains and the existing bounded persistence transaction. Indirect SQL analysis
and shared queue-writer debt remain explicit; this is not new recovery authority.

## Verification

- Five focused suites: 171 tests passed, including callback-once behavior, awaiting
  persistence, committed context, sanitized failures and existing bounded HTTP
  regressions. Typechecking caught the new optional parameter's missing type
  annotation; the annotation was corrected without changing runtime policy.
- Four disposable PostgreSQL suites: 75 tests passed, including 30 new real-HTTP
  response-wait cases. Success/429/503 waits block independent health, SSL and
  lookup callers; counters remain at one. Tests cover date/invalid/oversized/capped
  advice, active selection and key/disable races, longer waits saved during HTTP,
  persistence failure and not-found semantics. A separate connection verifies
  the admission lock is released before HTTP.
- Ownership gate and its 39-test targeted suite passed after the reviewed record
  update. Typechecking, lint, copyright, normal/production dependency analysis,
  static imports and ESM mock-shape gates passed. Staged secret scan passed.
- Full backend coverage ran 1,816 suites in 1,204.347 seconds: 57,169 tests passed,
  one failed and one skipped. Its only failure was the ownership review read before
  the reviewed record update; the subsequent gate and all 39 ownership tests passed.
  This is a full-run result plus a targeted correction, not a claim that the first
  full run exited successfully. The skip is the Linux directory-fsync case on this
  Windows host. Statements/lines 89.76%, branches 86.27%, functions 91.20%.
- Two frontend coverage attempts passed 468 files and 7,162 tests, but the same
  ESLint configuration setup hook exceeded its unchanged ten-second limit, skipping
  28 tests. Recorded setup durations were 10.95 and 10.08 seconds while backend
  verification was also active. The subsequent complete run without that backend
  workload passed all 469 files and 7,190 tests in 294.34 seconds. Neither assertions nor timeouts
  were relaxed. Frontend coverage: statements 87.63%, branches 81.56%, functions
  87.30%, lines 89.34%. Concurrent host load is a timing hypothesis supported by
  this comparison, not a demonstrated application regression or a CI fix.
- Combined coverage ratchet passed without changing its baseline. Markdown lint
  checked 2,169 documents with zero errors.

## Exact image and local evaluation

Started from clean `main` at `b8eac6efa1eb635d58ebee3fb49745ddbd7ac055`.
Runtime commit: `db51ea593ed6ad0ca6fd40b64c5ad751e8167e52`.
Compose built with `--no-cache --require-provenance`, Linux/amd64 and AVX2.
Tested local image ID:
`sha256:45dfc39e91f6c0e38e9bddb3f698757703ad2447901bc1f6f36420e2b92b160c`.
Later documentation-only commits do not change this runtime. This is not evidence
of a published multi-platform image, registry signature or release.

The exact image passed an isolated rehearsal: network disabled, no published ports,
1 GiB memory, two CPUs, 256 PIDs, normal entrypoint and fresh migrations through
`20261010_220000_source_catalog_mappings.sql` with 22 seed migrations. The generated
schema has no diff. Empty state invented no work. Existing configuration, drift,
reconciliation and adapter checks passed. The packaged OMDb fixture passed five
health-admission, six SSL-recovery and eight new response-wait cases, using eleven
loopback requests and no external provider calls. Public provider configuration
stayed empty. The owned container and exact temporary data directory were removed
and verified absent.

Before replacement, a 76,153,988-byte database backup passed checksum and archive
list checks. The prior exact image was tagged for rollback:
`sha256:39d02fe0ebbec10889f8b260a9aa57a525f700715c0bfca88e03bd6db42f7f9d`.
This is not a full restore rehearsal.

Only local Classifarr was recreated with `--no-build --pull never --no-deps`.
It started at `2026-10-13T02:40:59.817138264Z`, healthy with zero restarts and no OOM.
Twenty-nine packaged runtime files match the checkout. Health, liveness and
readiness returned 200;
unauthenticated detailed health returned 401. Existing route fixtures, compiled
System information and startup-report checks passed. Deployment retains uid/gid
1000, read-only root, 2 GiB memory, no-new-privileges and PostgreSQL tmpfs with
noexec/nosuid/nodev. The initial read-only startup sample contained no warnings.

Before/after counts stayed at 6,837 classifications, ten active/covered libraries,
four unresolved identities (two source review, two retry wait), zero pending text
embeddings and 6,815 pending image embeddings. Normal startup jobs remained enabled.
No live provider failure was induced, no settings were edited and no recovery was
manually run. Unraid, Plex, shared Ollama and unrelated containers were unchanged.
These checks do not claim unrelated identity, vector or memory issues resolved.

## Recommendation stack and limits

1. Keep existing shared quota admission and the common response observer/store.
   Benefit: consistent, durable waits without new infrastructure or requests.
   Cost: a short database write when wait advice is present; remote HTTP and that
   write cannot be atomic.
2. Keep bounded parsing, conservative outcomes and credential fencing. Benefit:
   untrusted or obsolete responses cannot create unlimited or wrong-key waits.
   Cost: legitimate very long waits are capped by existing policy; uncertainty
   can delay recovery.
3. Next, evaluate reusing recent, credential-attributed lookup results for health
   and SSL recovery. Benefit: fewer synthetic requests. Cost: explicit freshness,
   failure invalidation and recovery-latency rules are required before adoption.
   Follow-up: [recent lookup design](omdb-recent-lookup-design.md).

Already admitted requests cannot be recalled. A crash or failed save can lose new
wait advice; committed quota/base pacing remain. Incomplete, cancelled or oversized
response bodies expose no completed response metadata in the current transport,
so this increment does not claim to persist their headers. The parser retains its
existing IMF-fixdate policy, not every historical HTTP-date representation.
Separate databases sharing a key and unsaved-settings tests are outside this
coordination boundary. Fixtures reconstruct callers and adjust only explicitly
identified deadlines; they are not an elapsed cooldown or heartbeat soak.

GitHub MCP enumeration found zero open PRs. No random open PR was available to
implement, and none was merged. No release, tag, version bump or new branch was made.
