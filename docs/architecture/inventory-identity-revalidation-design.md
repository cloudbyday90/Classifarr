# Inventory 404 identity revalidation: design

Date: 2026-09-27. Scope: bounded diagnosis, not automatic identity replacement.

## Problem and decision

A syntactically valid movie/TV TMDb ID can return 404. Retrying the same details
endpoint records availability but cannot distinguish an obsolete ID, disagreement
between external IDs, or missing upstream data. A 404 alone proves none of those
causes. Library names and content categories must not determine identity.

Use the existing inventory recovery lease and queue, not another scheduler.
After a claimed details request returns 404, examine only the current database
source snapshot's IMDb ID and (for TV) TVDB ID. Use the existing exact external-ID
resolver; every supplied supported ID must agree. Fetch details only for a
different, unambiguous candidate, then require the requested media type, exact
normalized title and release year. This corroborates a review candidate; it does
not independently verify the media server's match or authorize replacement.

Keep a bounded, allowlisted identity-check result in the existing recovery JSON:
time, outcome and optional corroborated candidate ID. Never persist provider
bodies, credentials, exception text or titles in this record. Source comparison,
live lease, active-library and source-conflict guards remain prerequisites for
the single atomic write. A changed source discards the old result. A successful
future observation of the original ID still resolves and backfills normally.

At most two external-ID lookups and one candidate-details request are added per
eligible 404 attempt. Calls share the current TMDb process rate limiter, use
10-second request deadlines and a 1 MiB decoded-response budget. Stop on provider
failure and retain Retry-After timing in the existing bounded cooldown. No title
search, immediate retry loop, AI inference, music ingestion or routing write.
The process limiter is not a distributed quota across separate installations.

## Research and alternatives

Official sources were discovered using web search and opened on 2026-09-27.

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Retry only the original ID | Minimal cost; heals temporary outages | Cannot explain identity mismatch; retain as the primary attempt |
| Exact external-ID diagnosis | Reuses known evidence; queryable reasons; bounded cost | Up to three extra calls; may remain inconclusive; recommended |
| Replace from title similarity | Can find superficially plausible candidates | Ambiguity and false repairs contaminate learning; reject |
| New recovery orchestration service | Separate lifecycle | Duplicates leases, retries and authority; unnecessary here |

TMDb documents [external-ID finding](https://developer.themoviedb.org/docs/finding-data)
separately from text search, and its [error codes](https://developer.themoviedb.org/docs/errors)
distinguish unavailable IDs from authentication and throttling. Its
[rate-limit guidance](https://developer.themoviedb.org/docs/rate-limiting) requires
respecting 429 responses; historical numerical limits are not a guaranteed quota.

[AWS retry guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html)
supports idempotent retries and separating transient from non-transient failures.
[PostgreSQL concurrency semantics](https://www.postgresql.org/docs/18/transaction-iso.html)
support guarded updates that recheck the row after competing writes; no lock is
held over provider I/O. [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
supports excluding secrets and sanitizing untrusted data.

For a subsequent recovery view, follow W3C's
[status-message guidance](https://www.w3.org/WAI/WCAG21/Understanding/status-messages):
provide a short textual result and programmatically announced updates, not a
color-only badge or forced focus change. This backend increment makes no new UI
or WCAG-conformance claim.

## Recommended stack and acceptance

Current source snapshot → leased details attempt → bounded exact-ID diagnosis →
source-guarded recovery record → deduplicated actionable report → scheduled recheck.
Preserve existing routing, metadata and identity until separately verified repair.

Test movie/TV agreement, disagreement, missing IDs, malformed/oversized responses,
provider throttling, stale source, duplicate leases, interruption, and original-ID
recovery. Use synthetic provider responses and disposable PostgreSQL. Verify the
older scheduler fix in the real local deployment without resetting its cooldown.
No release, published image or PR merge is included.
