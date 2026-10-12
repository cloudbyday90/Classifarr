# System health summary: outcome

Date: 2026-10-12. [Design, research and tradeoffs](system-health-summary-design.md).

## Delivered

System and the detailed-services API now distinguish unknown observations from
healthy results. Inactive services are counted separately and excluded from the
active denominator. Empty and inactive-only lists cannot produce healthy status.
Configured-only evidence remains degraded; known failures take precedence.

The System page retains cards after failed polling but labels the summary
unavailable and identifies the results as last received. Forced-refresh failures
no longer silently fall back to cached results. Request generations prevent an
older response or post-unmount completion from applying. The status region is
polite and atomic; response receipt timestamps stay outside its announcements.

Two small pure ESM modules preserve the existing deployment boundaries, with
client/server parity tests. The named client API function, API documentation and
Unreleased changelog are updated. `summary.unhealthy` now counts failed plus
degraded only; consumers must check unknown separately. Readiness, authentication,
probe cadence, memory safeguards and provider behavior are unchanged.

## Verification

- Focused client: 79 tests across four files passed, including malformed responses,
  failed and recovered polling, forced refresh, overlapping requests and unmount.
- Focused backend: 34,471 checks across nine suites passed, including aggregation,
  API counts and existing health-service/readiness behavior.
- Real summary component: two Chromium checks passed at 390 px and 1280 px;
  keyboard focus, atomic status updates, no horizontal overflow, no API requests
  and no page errors. Mobile screenshot inspected.
- Production build and eight production-route asset checks passed. Twelve client
  test-runner/configuration checks passed.
- Client/server lint and type checks, backend Knip and production dependency
  checks, static-import policy, npm CLI policy, copyright, Markdown and diff
  checks passed. Strict component typing exposed old loose helper annotations;
  those were narrowed rather than suppressing type checking.
- Full frontend coverage: 7,138 tests across 467 files passed; statements 87.51%,
  branches 81.42%, functions 87.14%, lines 89.21%. The four additional malformed/
  in-flight refresh cases were also rerun in the final 79-test focused pass.
- Full backend coverage: 56,450 tests passed across 1,803 suites; one test skipped.
  Statements/lines 89.71%, branches 86.18%, functions 91.14%. The combined coverage
  ratchet passed with no baseline changes. An earlier invocation before report
  generation finished correctly refused the missing client report; the final
  gate used both completed reports.
- Staged and implementation commit-range secret scans passed.

## Exact local image and database checks

Implementation source: `9c74f7c2a944395b0d8bfc12efbdd407fb7d9747`, clean checkout.
No-cache Compose build used `--require-provenance` and produced Docker-local ID:

`sha256:35ec74bd3d5723f8316a2802a1216a45b6c1291de1ddf2d9167b42fdee2281b7`

The OCI revision matches that source. This is local Linux/amd64 evidence, not
registry publication, a signed provenance claim or native multi-platform proof.
The smart build selected AVX2 on this host. Previous local image retained for
rollback:

`sha256:b597f0484fba827d8aba5b48c401b162f7aa5b1dd107b9bc9b2d0f6a34aba93d`

A fresh private database archive was verified by checksum and archive listing
before local replacement. Compose recreated only Classifarr using `--no-build`,
`--pull never`, `--no-deps` and the verified image. It became healthy.

Post-build `dumpSchema()` ran against that image in a disposable synthetic
database with no network or published ports, 1 GB memory, two CPUs and 256 PIDs.
The dump includes migrations through `20261010_220000_source_catalog_mappings.sql`
and 22 seed migrations; the tracked schema did not change. Fresh-database checks
found no invented pending work or unresolved identities. Owned fixture cleanup
was verified.

On the actual rebuilt local container:

- Six aggregate scenarios and compiled summary text passed.
- `/health`, liveness and readiness returned 200; the detailed-services endpoint
  returned 401 without credentials. No forced provider refresh was performed.
- User `1000:1000`, read-only filesystem, no-new-privileges, 2 GB memory cap and
  PostgreSQL tmpfs restrictions remain intact.
- Read-only database checks found 6,837 classifications, ten active/covered
  libraries and four unresolved identities (two source-review, two retry-wait),
  unchanged from before rebuild. Text pending remained zero; optional image
  pending remained 6,815.
- A cached-vector warning existed before rebuild. None had been recorded since
  the new start at the immediate post-start check; this does not establish that
  the underlying intermittent condition is resolved. These probes made zero
  provider calls and zero database writes; normal application jobs remain enabled.

Unraid, Plex and the shared Ollama deployment were not modified. No data repair,
identity approval, dependency update, release, tag or version bump was performed.

## PR review and next recommendation

GitHub MCP returned zero open PRs on retry and again before local image evaluation.
The first request timed out. No random open PR was available to implement, and no
PR was merged or fabricated.

Keep the explicit aggregate policy and last-received labeling. Next, define
age-based health freshness using each service's real check time and configured
heartbeat cadence. A successful response containing old cached observations
must not imply a new probe. That work should include paused heartbeats, failed
probes, differing cache lifetimes and operator-visible recovery guidance, without
changing liveness/readiness or triggering unbounded provider checks.
