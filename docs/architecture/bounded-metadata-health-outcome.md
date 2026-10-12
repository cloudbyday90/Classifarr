# Bounded Arr and metadata health: outcome

Date: 2026-10-12. See the separate
[design, alternatives and official sources](bounded-metadata-health-design.md).

## Delivered

Radarr and Sonarr health now make one authenticated, validated status request
per configured instance instead of calling the richer four-request settings
test. TMDb validates configuration data rather than treating any HTTP 200 as
healthy. OMDb retains its response classifier and now exposes safe authentication,
quota and rate-limit reasons. Malformed or oversized responses remain unknown.

Small ESM adapters share a 1 MiB decoded-body cap, redirect rejection and a
body-inclusive deadline: five seconds for TMDb, ten for OMDb, and at most ten
for Arr, honoring shorter positive saved timeouts. Arr URL/base-path precedence
and explicitly saved TLS compatibility settings remain supported; certificate
verification is never disabled automatically. Fixed metadata endpoints use HTTPS.

Failed provider observations remain watched for saved-setting changes. A corrected
credential invalidates an old authentication failure without causing another
provider request during reconciliation. Incidental quota-counter updates still do
not invalidate health. Raw provider bodies, credentials and error text are not
returned to the UI. Last-success history is preserved on failure.

Rich settings tests, classification, imports, ownership, retry budgets and memory
safeguards are unchanged. No migration, backfill or credential replacement is
needed. Normal future health checks use the new behavior after deployment.

## Verification

- Focused unit/real-HTTP run: six suites / 341 tests passed, including payload
  validation, credentials, legacy endpoints, redirects, compressed oversize and
  actual body-stall cancellation.
- Isolated PostgreSQL: three suites / 71 tests passed. Saved columns, active
  membership, incidental changes, commit/rollback and failed-observation
  invalidation are covered with real database connections.
- Frontend coverage: 469 files / 7,190 tests passed in 339.20 seconds. Statements
  87.63%, branches 81.56%, functions 87.29%, lines 89.33%.
- Full backend coverage: 1,813 suites passed, 57,044 tests passed and one was
  skipped, in 1,096.122 seconds. Statements/lines 89.75%, branches 86.25%,
  functions 91.19%. The combined coverage ratchet passed without baseline changes.
- Lint, backend/frontend type checks, copyright, normal/production dependency
  analysis, ownership review, static imports, ESM mock shapes and staged secret
  scan passed. Final Markdown validation checked 2,163 files with zero errors.

## Exact local image and data

Started on clean `main` at `1940c2cf59df51b703bd1a6c6e1030f2b5a7aa94`.
Runtime source is `de638eec0dd5857242eccada713a0736449bb336`. The no-cache Compose
build used `--require-provenance` from a clean checkout, Linux/amd64 and AVX2.
Tested local image identity:
`sha256:f2f9fe259c53bae1a15b05ab164936f5364313118201726f65e1d6612434cc65`.
This is not a published registry digest or a signed multi-platform release claim.
Subsequent outcome-document edits do not change runtime code.

Before local replacement, a 76,045,987-byte database backup passed checksum and
archive-list checks, and the exact previous image was retained. This is not a
full restore rehearsal. Only local Classifarr was replaced; Unraid, Plex, shared
Ollama and unrelated containers were unchanged. Normal local startup jobs stayed
enabled. No branch, release, tag or version bump was created.

The exact built image first ran in an owned disposable container with no external
network or published ports, 1 GiB memory, two CPUs and 256 PIDs. Fresh migrations
produced no schema diff, through `20261010_220000_source_catalog_mappings.sql`,
including 22 seed migrations. Checks passed for an empty installation, five
PostgreSQL configuration cases, six cross-connection cases, all eight health
projections, OMDb counter retention and credential invalidation, and two
failed-provider observation cases. Nineteen packaged adapter cases used seventeen
synthetic loopback requests and no external provider requests or real database
queries. Separate SQL cases wrote only fixture tables. The disposable container
and its data directory were removed after verification.

Local replacement started at 23:14:00 UTC. Nineteen checked runtime files match
the checkout. Packaged routes passed six aggregate and five freshness cases,
configuration-read failure, in-flight drift and completed-cache reconciliation.
Observation time in these fixtures was controlled, not a timed heartbeat soak.
Health, liveness and readiness returned 200; unauthenticated detailed health
returned 401. Compiled System information remained concise.

After browser reload, seven of seven active services reported healthy, zero
unknown, one disabled and four not configured. TMDb and OMDb showed completed
checks; local Arr configurations were absent, so Arr's operational coverage is
synthetic rather than a live Arr check. No manual provider refresh or setting
change was performed. The local container remains uid/gid 1000, read-only root,
2 GiB memory, no-new-privileges and PostgreSQL noexec tmpfs.

Read-only before/after counts stayed at 6,837 classifications, ten active/covered
libraries, four unresolved identities (two source review, two retry wait), zero
pending text embeddings and 6,815 pending image embeddings. An existing optional
comparison warning was present before replacement; the initial new-container
sample had none. This does not establish that vector coverage, unresolved IDs or
retained-memory behavior have been repaired.

## Recommendation stack and next item

1. Dedicated bounded health probes: fewer requests and explicit success evidence;
   the cost is maintaining small provider-specific validators alongside the richer
   settings-test APIs.
2. Safe structured failure reasons and configuration reconciliation: actionable
   failures retire after a settings correction, but unknown failures deliberately
   omit private provider details and may need a separate support investigation.
3. Preserve existing security and compatibility boundaries: no automatic TLS
   downgrade, credential regeneration or recovery writes. A healthy status check
   does not prove every provider operation or every permission will succeed.
4. Next, measure and account for OMDb health traffic before choosing quota-aware
   admission/cadence changes. The default fifteen-minute heartbeat implies 96
   scheduled checks per uninterrupted day per installation, plus startup/manual
   checks. This is calculated cadence, not a measured request count. Health
   requests currently consume upstream quota outside the local lookup counter;
   multiple installations sharing a key would consume the same provider budget.
   Do not simply hide failures or extend freshness without matching policy.

GitHub MCP enumeration and recheck returned zero open PRs. No random open PR was
available, and none was implemented or merged. Remote CI remains separate evidence
from the local checks above.
