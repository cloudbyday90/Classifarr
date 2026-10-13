# OMDb SSL recovery admission outcome

Date: 2026-10-12 (local); image checks continued into October 13 UTC.
See the separate [design, official sources and tradeoffs](omdb-ssl-recovery-admission-design.md).

## Delivered

Automatic queue SSL-recovery probes now reserve through existing OMDb quota and
pacing, with HTTP after confirmed commit. The caller supplies the saved credential
revision; an active-configuration read after HTTP rejects stale recovery. A reset
or newer local pause also invalidates in-flight results. One processor cannot
launch overlapping recovery probes. The legacy unbudgeted helper is no longer used
by this queue path.

One small ESM service owns admission and the bounded probe. It keeps strict TLS,
ten-second HTTP timeout, 1 MiB decoded-body limit and no redirects. A validated
success or confirmed miss can clear the SSL pause; neither is stored as item
enrichment. Other outcomes retain work for retry, with fixed safe diagnostics.
The actual item lookup still needs its own admission and can be paced immediately
after a successful probe. This is expected, not lost enrichment.

The existing local interval, block expiry, credential rejection policy, memory
safeguards and ownership boundaries are unchanged. No migration, dependency,
worker, deployment setting or historical usage backfill was added. The two changed
inventory-writer review entries were reviewed with the admission call chain and
remain unresolved writer debt; their digest updates do not grant new authority.

## Verification

- Five focused queue/recovery suites: 238 tests passed. The first test run caught
  an unsupported Jest matcher in the new tests; the assertions were corrected to
  existing Jest matchers, with no production workaround or weakened expectation.
- Three disposable PostgreSQL/real-HTTP suites: 45 tests passed. They cover
  recovery/System-health/lookup competition, visible commit and released lock
  before HTTP, rollback, lost commit reply, inherited cooldown, lock contention,
  disabled/rejected/rotated settings, in-flight configuration changes, malformed
  responses, redirects and oversized bodies. Restart evidence reconstructs the
  caller against retained database state; it is not a timed container restart soak.
- Full frontend coverage: 469 files, 7,190 tests passed in 309.73 seconds with phase
  diagnostics enabled. Statements 87.63%, branches 81.56%, functions 87.30%,
  lines 89.34%; no test timeout, assertion or baseline was relaxed.
- Full backend coverage passed with exit code zero: 1,816 suites, 57,156 passed
  tests and one skipped test in 1,038.097 seconds. The complete JSON result was
  retained locally. Statements/lines 89.76%, branches 86.27%, functions 91.20%.
  The skip is the platform-specific Linux directory-fsync test on this Windows host.
  The combined backend/frontend coverage ratchet passed without baseline changes.
- Type checks, lint, copyright, normal/production dependency analysis, ownership,
  static imports and ESM mock-shape gates passed. Markdown check: 2,167 documents,
  zero errors. Staged runtime secret scan passed.

## Image and local deployment

Started from clean `main` at `44208148f01dd675cc565bda8e2a8b37714af4a9`.
Runtime source: `d736072eab233900b695cf1acd781c51b8e0d026`.
The clean-source Compose build used `--no-cache --require-provenance`, Linux/amd64
and AVX2. Exact tested local image ID:
`sha256:39d02fe0ebbec10889f8b260a9aa57a525f700715c0bfca88e03bd6db42f7f9d`.
Later documentation-only commits do not change that runtime source. This is not
published multi-platform, registry-signature or release evidence.

The image ran in an owned disposable container with network disabled, no published
ports, 1 GiB memory, two CPUs and 256 PIDs. Fresh migrations passed through
`20261010_220000_source_catalog_mappings.sql`, including 22 seed migrations;
the generated schema has no diff. Empty state created no invented work. Existing
configuration, cross-connection, adapter and System-health admission fixtures
passed. Six new packaged SSL-recovery checks passed: admitted, paced, exhausted,
rejected, changed-generation and uncertain-commit outcomes. The combined OMDb
fixture sent three real loopback requests and no external provider requests.
Fixture state was reset between independent cases; the lost-commit case retained
its committed credit without sending HTTP. No public provider configuration was
changed. The owned container and exact data directory were removed and verified
absent after the rehearsal.

A 76,070,164-byte local database backup passed checksum and archive-list checks.
The prior exact image, `sha256:16a4fb49fe9f4ed14e249af45cec7a274cf0991daa6b829f19e605cf52666420`,
was retained for rollback. This is not a full restore rehearsal.

Only local Classifarr was recreated, using `--no-build --pull never --no-deps`.
It started at `2026-10-13T01:50:07.91543851Z`, healthy, with zero restarts and no
OOM. Twenty-seven packaged runtime files match the checkout. Health, liveness and
readiness returned 200; unauthenticated detailed health returned 401. Existing
route fixtures, compiled System information and startup pgvector report checks
passed. These use controlled observations, not an elapsed-time heartbeat soak.
Deployment retains uid/gid 1000, read-only root, 2 GiB memory, no-new-privileges and
noexec/nosuid/nodev PostgreSQL tmpfs. No startup warnings appeared in the initial
read-only sample.

Before/after inventory remained at 6,837 classifications, ten active/covered
libraries, four unresolved identities (two source review, two retry wait), zero
pending text embeddings and 6,815 pending image embeddings. No live TLS failure
was induced and no manual recovery or settings update was performed. Normal local
startup jobs stayed enabled. Unraid, Plex, shared Ollama and unrelated containers
were untouched. Unrelated identity, optional-vector and memory problems are not
claimed resolved.

## Recommendation stack and remaining boundaries

Follow-up: the response-wait increment below is now implemented and evaluated in
the separate [probe response wait outcome](omdb-probe-response-wait-outcome.md).
The numbered list records the recommendation at this admission increment's completion.

1. Keep shared PostgreSQL admission and the modular recovery service. Benefit:
   durable accounting without new infrastructure. Cost: recovery consumes a credit
   and can wait behind other OMDb traffic.
2. Keep credential/local-state fences and conservative deferred outcomes. Benefit:
   old responses cannot clear a newer pause. Cost: uncertainty delays recovery.
3. Next, persist bounded, credential-fenced `Retry-After` observations from both
   System-health and SSL probes. They currently obey existing cooldowns but do not
   create new cooldown evidence from their own responses. This closes a response
   handling gap before altering cadence; it is separate from admission accounting.
4. Then evaluate reusing recent attributable lookup results to reduce synthetic
   health traffic, with explicit freshness and recovery-latency rules.

Separate databases sharing an OMDb key and explicit unsaved-settings tests remain
outside the local admission guarantee. No guessed historical debit is appropriate.
GitHub MCP enumeration found zero open PRs, so no random open PR was available or
implemented. No PR was merged. No release, tag, version bump or new branch was made.
