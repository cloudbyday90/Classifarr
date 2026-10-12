# Health observation freshness: outcome

Date: 2026-10-12. Design, alternatives, pros/cons and official sources:
[health observation freshness design](health-observation-freshness-design.md).

## Delivered behavior

Cached health is now evaluated against its actual completed-check time and the
configured heartbeat interval, with 30 seconds of grace. Expired or unverifiable
active observations become unknown; their last reported status remains visible.
Fresh failures remain failures, and disabled/unconfigured services remain inactive.
An incomplete instance group cannot look healthy merely because its aggregate
timestamp is newer. A current instance fault remains visible.

The System page explains overdue checks, paused heartbeat, missing/invalid/future
time and incomplete instance checks, with exact UTC check/deadline references.
Heartbeat intervals are validated before scheduling. Raw database-focused health
and HTTP readiness, authentication and memory safeguards are unchanged. There is
no new provider polling, recovery job, migration or application-data backfill.

## Source and image

- Baseline: `0316c47403a05239bd57eb6d15e29448f7d07db5` on clean `main`.
- Final runtime source: `b23345b656a12160be286b2c2e65d28b1d3e7711`.
- No-cache Compose build used `--require-provenance`, clean source and AVX2.
- Final local Docker image `.Id`:
  `sha256:c3250d00433bdbde23a48e07c392b730401b58ca9bfcc18391d8b28a0358944a`.
- Previous local image retained for rollback:
  `sha256:35ec74bd3d5723f8316a2802a1216a45b6c1291de1ddf2d9167b42fdee2281b7`.
- Local container recreated from the exact final image at 18:41:35 UTC.
  Database archive checksum and readability were verified before replacement.
- Earlier development builds were superseded, not deployed. Final evidence below
  refers to the final image, not those intermediate builds. Final documentation
  commits do not change runtime source. No release, tag, version bump or new branch.

This is local Linux/amd64 image identity, not a published registry digest or signed
release attestation. No Unraid, Plex or shared Ollama deployment/configuration changed.

## Verification

- Focused pure timestamp tests: 38 passed, including expiry equality, missing,
  malformed and future times, canonical UTC seconds, actual cadence, paused checks,
  immutable cache reads, old failures and incomplete instance groups.
- HTTP/heartbeat regression tests cover unchanged readiness, expired service
  counts, per-instance timestamps and invalid interval rejection before any work.
- Frontend tests cover server-authoritative age, missing legacy metadata, specific
  guidance, safe text rendering, paused cadence, recovery and existing request races.
- Chromium: 2 mobile/desktop summary checks and 8 production-route asset checks
  passed. Keyboard focus and timestamp placement outside the live region verified;
  the mobile screenshot was inspected for wrapping and horizontal overflow.
- Backend/frontend lint and strict type checks, full/production dependency analysis,
  test-runner configuration, static imports, npm CLI policy, copyright and Markdown
  checks passed. Timestamp parsing uses bounded canonical round-trip comparison;
  no security-lint suppression was added. Staged secret scans passed.
- Frontend full coverage: 7,175 tests / 468 files passed; statements 87.59%,
  branches 81.54%, functions 87.26%, lines 89.31%.
- Backend full unit coverage: 56,532 tests / 1,804 suites passed; one test skipped.
  Statements/lines 89.73%, branches 86.19%, functions 91.16%; the new freshness
  projector has 100% coverage across all four metrics. The combined coverage
  ratchet passed without baseline changes. Intermediate backend runs stopped
  during review corrections are not counted as completed verification.
- Post-build isolated schema dump passed through
  `20261010_220000_source_catalog_mappings.sql`, with 22 seed migrations and no
  schema diff. Fresh synthetic data had no invented pending work or unresolved
  identities. The ownership-checked temporary container and directory were removed
  and verified absent. The existing local backup and rollback image were retained.

The actual image ran six aggregate cases and five synthetic HTTP checks against
the packaged route implementation. The fixture deliberately supplied fixed
observation times; it does not claim a real heartbeat interval elapsed. Checks
repeatedly read expired results without renewal, retained raw readiness, rejected
an oversized interval and made an incomplete group unknown. These fixture checks
attempted zero provider calls/writes. Packaged System UI text was also verified.

The running application returned HTTP 200 for `/health`, system liveness and
readiness; unauthenticated detailed service health remained HTTP 401. Deployment
retained uid/gid 1000, read-only root filesystem, 2 GiB limit, no-new-privileges
and the PostgreSQL noexec tmpfs. Scoped pgvector evidence matched the restarted
database; the diagnostic process correctly reported another application's startup
record rather than claiming that record as its own.
A spot sample at 18:49 UTC showed 376.3 MiB / 2 GiB, healthy, no OOM termination
and zero restarts. This is not a retained-memory profile or long-running soak.

Read-only local database comparison before/after replacement: 6,837 classification
rows, 10 active/covered libraries, four unresolved identities (two source review,
two retry wait), zero pending text embeddings and 6,815 pending image embeddings.
Counts were unchanged. No startup WARN/ERROR rows were present in the bounded
post-restart sample; this is not a long-running soak. Probes performed no provider
calls or data writes; normal application startup/scheduling was not disabled.

## Recommendation stack and remaining limits

1. Keep timestamp-based expiry and explicit unknown/history. Benefit: truthful
   cached status without extra provider traffic. Tradeoff: it exposes uncertainty
   and paused checks need an explicit refresh or scheduler investigation.
2. Keep bounded interval validation, existing polling and unchanged readiness.
   Benefit: no accidental 1 ms timer from malformed settings. Tradeoff: malformed
   or previously coerced interval input now gets HTTP 400.
3. Next: separate configuration-read failures from genuine absent configuration.
   `healthCheckArrServices.mjs` and `healthCheckCoreServices.mjs` still have catch
   paths that return `not configured` after database lookup failures. Freshness
   cannot correct a wrongly classified observation; fix those paths with sanitized
   diagnostic reasons and outage regressions, without enabling retry storms.
4. Then evaluate configuration-revision and in-flight completion fencing. A recent
   timestamp alone cannot prove a result belongs to the current configuration.

The client updates freshness on its existing poll, not a new browser timer. This
does not prove scheduler liveness, provider availability between checks, all
installation configurations or published multi-platform compatibility.

GitHub MCP returned zero open PRs on two checks. No random open PR could be
selected or implemented; none was merged. Production recovery was not performed.

These are local verification results. Remote CI is a separate gate and is not
claimed successful by this document.
