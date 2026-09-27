# Emby catalog compatibility outcome

Date: 2026-09-27. Status: Unreleased; no version bump, release or deployment.

## Finding and implemented change

Emby and Jellyfin shared a single array-only library discovery implementation.
The documented current Emby API instead exposes a paginated query envelope.
Classifarr now injects an Emby-specific reader into the existing service factory;
Jellyfin retains its separate array contract. Small ESM modules separate network
enumeration, envelope validation and legacy array transport. No dependency or
database migration was added.

Emby discovery reads the current query endpoint first. Only an initial HTTP 404
or 405 permits one legacy-array attempt. The decision is not cached, so a later
discovery can recognize an upgraded server. Authentication failures, malformed
successes, rate limits, later-page failures and cancellation do not switch APIs.

The reader enforces stable bounded totals, unique IDs, consistent identity aliases,
progress, response-size and request-count limits, and a shared operation deadline.
All pages must validate before reconciliation can open a write transaction. Failed
enumeration leaves existing inventory and the successful-sync timestamp untouched;
it cannot partially import page one or justify an archive review.

Music is counted when advancing offsets but remains excluded from ingestion.
Library names do not determine eligibility. Source IDs remain authoritative; no
automatic remapping, deletion, archive, routing change or evaluation job was added.

## Operator impact and limits

- Use the existing **Sync Libraries** action. No new configuration is required.
- Existing libraries remain available locally if discovery fails. Check source
  connectivity and access before retrying; do not remove preserved libraries to
  work around an incomplete response.
- Legacy servers incur one extra request per discovery. Limits intentionally fail
  closed rather than accepting a partial catalog. There is no immediate retry loop.
- Tests use synthetic contract fixtures, a local HTTP server and disposable
  PostgreSQL. They do not certify particular released Emby/Jellyfin versions.
- Offset pagination is not an atomic remote snapshot. Even a stable total cannot
  exclude every concurrent same-count change; the non-deleting merge and separate
  administrator archive review remain necessary.
- The existing Vue/SWR interface and status semantics are unchanged. W3C status
  guidance was considered; no new accessibility conformance claim is made.

## Verification

- Focused provider, parser and source-preflight checks: 6 suites / 126 tests passed.
- Focused actual-HTTP/database and archive checks: 2 suites / 30 tests passed.
- Full integration run: 184 suites / 2,111 tests passed. One opt-in Compose AI fault
  suite remains intentionally skipped; it is not required by this provider change.
- Full frontend coverage run: 400 files / 5,620 tests passed.
- Private capture and existing study-writer regression checks: 6 suites / 65 tests
  passed, including the additional directory-boundary tests.
- Backend coverage rerun: 1,503 suites / 45,088 tests passed. The newly added
  five-case directory-boundary suite also passed separately in the focused run.
- Coverage ratchet passed: backend lines/branches 90.31% / 84.70%; frontend
  lines/branches 87.89% / 78.37%.
- Server and client lint passed with zero warnings. Both typechecks, frontend
  production build, dependency checks, ESM static-import and mock-shape checks,
  copyright checks, npm flag checks and Markdown lint passed.
- Inventory ownership gate passed with no new unreviewed drift. Existing reviewed
  legacy writer debt is not certified by this compatibility change.

The user's follow-up to address pre-existing validation issues also removed the
frozen-policy capture warning and corrected its container storage-root mismatch.
Details and filesystem trust limits are in the separate
[private capture storage design and outcome](private-capture-storage-design-and-outcome.md).

## PR request

GitHub MCP returned no open PRs for `cloudbyday90/Classifarr` on the research date.
There was no random open PR to implement. No closed or unrelated PR was substituted,
and no PR was merged.

## Recommendation stack

1. Keep provider-specific ESM contract readers with narrow capability negotiation.
   Benefit: current/legacy compatibility without a guessed version cutoff. Cost:
   one additional request on legacy Emby and explicit adapter maintenance.
2. Keep bounded native HTTP cancellation and complete validation before the existing
   PostgreSQL merge. Benefit: controlled resource use and no partial local writes.
   Cost: unusual or very slow catalogs require investigation, not silent acceptance.
3. Retain the current Express/PostgreSQL and Vue/SWR stack. No SDK, queue framework
   or persistent capability cache is needed for this compatibility boundary.

## Next follow-up: actionable discovery diagnostics

The adapter still intentionally exposes only `library_catalog_invalid` or
`library_catalog_unavailable`. That protects secrets but leaves operators unable
to distinguish access failures, transport outages and incomplete catalogs.

Add a bounded, sanitized discovery outcome record with a source-configuration
revision, selected API contract, reason category, attempt time and last successful
complete catalog time. Show one concise next action. Reuse the existing read-only
SWR/status presentation; reading diagnostics must not start provider work. Never
persist tokens, raw bodies or provider-supplied URLs, and never treat a cached
success as fresh archive authorization. Verify outage/recovery, permission errors,
source edits and retention before adding automated recovery decisions.

This improves explainability without weakening validation or hiding failures with
broad fallback. It is a follow-up proposal, not functionality delivered here.

Official research, alternatives and the detailed safety contract are in
[the design document](emby-catalog-compatibility-design.md).
