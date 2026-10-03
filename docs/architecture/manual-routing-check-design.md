# Restart-Safe Manual Routing Checks

Reviewed: 2026-10-03. No release, deployment change or automatic provider replay.

## Decision

Capture a versioned verification intent immediately before manual routing enters
the existing provider reconciliation adapter. Persist the actual resolved media
identity, root folder, provider type/configuration ID, endpoint fingerprint and
library routing fingerprint under the server-generated attempt token. A failed
capture prevents provider reconciliation. Never store API keys or raw endpoints.

An administrator may check one History record on demand after a restart. The
check sends one bounded provider GET, never an add, search, move, delete or retry.
It verifies exact media identity and destination with the existing verifier.
Before saving an observation, recheck current configuration and history in a
short local transaction. No provider I/O occurs while that transaction is open.

Observations are separate from the original write outcome: finding the item does
not prove which request created it, that downloads completed, or that all monitor
settings match. The UI reports that distinction. Missing intent is not backfilled
from today's configuration. Older history remains reviewable but unconfirmed.

## Safety and resource limits

- Admin permission, positive record ID, no caller-supplied URL, identity or path.
- Two concurrent checks per process, one per record, route rate limiting and no
  queued work. Existing reads have a ten-second timeout, two-MiB response cap and
  reject redirects. No timers, startup sweep or polling.
- Both library and provider must still be active; media type, resolved mapping
  and endpoint must match the captured intent. Credential rotation may use the
  current credential for the same endpoint; credentials are never persisted in
  intent or returned to the browser.
- Use a semantic routing fingerprint, not `xmin` as a permanent revision ID.
  PostgreSQL transaction IDs can wrap around. Fingerprints detect changed routing
  values, not every historical edit or replacement server at the same URL.
- Parameterized updates preserve other metadata and refuse changed attempt,
  intent, decision or history state. Snapshot capture cannot be overwritten.
- Fixed public messages and content-free logs; no provider payloads or secrets.
- No new schema, dependency, queue state or permission. Ingestion ownership
  recovery is unrelated and remains unchanged.

## Options and recommendation stack

| Option | Advantage | Trade-off | Decision |
| --- | --- | --- | --- |
| Retry the old add | May finish missing work | Unknown side effects and obsolete intent | Reject |
| Guess intent from current settings | Covers older records | Can verify the wrong destination | Reject |
| Saved verification intent plus an on-demand GET | Restart-safe, bounded, no provider writes | Older records still need review | Adopt |
| Scheduled recovery worker | Less operator effort | Needs durable budgets, authorization lifecycle and upgrade tests | Later |

Recommended order: capture intent → explicit admin check → bounded provider read
→ current-state guard → separate timestamped observation → concise History status.
Next consider durable, bounded background checks, not automatic add replay.

## Official research

Discovered through web search and opened on 2026-10-03:

- [Radarr API](https://radarr.video/docs/api/) and
  [Sonarr API](https://sonarr.tv/docs/api/) distinguish existing-item reads from
  additions and lookup/search operations. Retain the application's v3 contract.
- [PostgreSQL locking](https://www.postgresql.org/docs/18/explicit-locking.html)
  supports short local transactions; do not hold row locks over HTTP requests.
- [PostgreSQL system columns](https://www.postgresql.org/docs/18/ddl-system-columns.html)
  explains why transaction IDs are not permanent unique version identifiers.
- [AWS on safe retries](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)
  distinguishes intent and ambiguous responses; mere presence cannot establish
  that this particular request created the resource.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
  supports concise, programmatically announced feedback without moving focus.
  The check uses a polite status region, not repeated alerts or polling.
