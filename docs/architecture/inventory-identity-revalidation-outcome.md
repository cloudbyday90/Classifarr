# Inventory 404 identity revalidation: outcome

## Implemented

The [design](inventory-identity-revalidation-design.md) is implemented in small
ES modules for evidence reading, provider diagnosis, recovery policy and reporting.
Only a successfully claimed, source-bound observation returning 404 invokes the
new checks. The original source snapshot supplies identity; queued title/ID hints
and newly enriched provider metadata do not override it.

Known supported external IDs must unanimously resolve to one typed TMDb ID. A
different candidate also needs valid details with the exact normalized source
title and year. Music, ambiguous evidence and invalid source IDs are rejected.
Movie TVDB IDs are not used as a movie lookup source. A successful empty lookup
is distinct from a failed lookup, including a lookup endpoint returning 404.

The bounded recovery record retains `identity_check.version`, `outcome`,
`checked_at` and `candidate_tmdb_id`. Unknown fields are discarded. The existing
2 KiB database constraint still applies; no schema migration is needed. A new
outcome or candidate produces one update warning; changed timestamps alone do
not. Repeated identical failures retain their case ID. Successful original-ID
metadata capture resolves the case and retains the last diagnostic's timestamp.
That historical candidate is not applied when the original ID recovers.

The two provider identity endpoints now enforce 1 MiB decoded-response limits in
addition to existing rate admission and ten-second timeouts. This also bounds
their existing manual-review/source-recovery consumers. Rate limiting remains
process-local; no distributed quota or circuit breaker is claimed. Provider
throttling during diagnosis can extend the existing persisted retry deadline,
subject to its thirty-day maximum. The five-minute lease still fences late writes.

There is no new identity replacement, public endpoint, dashboard percentage, AI
call or routing permission. No existing source metadata is discarded, and old
logs are not retroactively assigned a diagnosis. Original-ID recovery and source
correction continue to use the existing automatic backfill path.

## Querying the result

An administrator can read current cases without starting work:

```sql
SELECT id AS item_id, library_id, title, media_type, tmdb_id,
       inventory_tmdb_recovery->>'case_id' AS case_id,
       inventory_tmdb_recovery->'identity_check'->>'outcome' AS identity_outcome,
       inventory_tmdb_recovery->'identity_check'->>'candidate_tmdb_id' AS candidate,
       inventory_tmdb_recovery->'identity_check'->>'checked_at' AS checked_at,
       inventory_tmdb_retry_after AS next_recheck
FROM media_server_items
WHERE inventory_tmdb_recovery->>'status' = 'open'
ORDER BY inventory_tmdb_retry_after, id
LIMIT 50;
```

An absent check means not recorded, not passed. A candidate is a review hint, not
proof of correct media-server identity. Verify the item's match in the media
server before changing it; a subsequent source sync invalidates stale recovery
state and enables ordinary metadata backfill. Existing manual missing-ID review
does not become an API for replacing an already populated ID.

## Validation and deployment

Focused tests cover movie/TV agreement, no match, conflicting IDs, incomplete
evidence, malformed results, title/year mismatch, deduplicated reporting and
retained evidence after resolution. Real loopback HTTP tests exercise both
identity adapters with valid, malformed and compressed oversized bodies. Real
PostgreSQL tests cover review-only candidate persistence, stale-source rejection,
durable throttling and original-ID recovery.

The final backend coverage rerun passed **1,482 suites / 44,194 tests**. Full
PostgreSQL integration passed **177 suites / 2,004 tests**, with one existing
suite/test skipped. The focused database run passed 32 tests. The new evidence
reader and revalidation service both achieved 100% statement and branch coverage.
The initial unit run identified three older exact-request assertions that lacked
the new response limit; those contracts were updated and the full rerun passed.

Backend type checking, test/security lint, dependency checks, ESM imports/mock
shapes, migration/snapshot integrity, copyright and Markdown checks passed.
Security lint retains one pre-existing non-literal-path warning in
`captureOperatorCorrectionFrozenPolicy.mjs`; this change introduces no new warning.
The frontend regression run and exact-revision local deployment are being
validated separately; their final observations belong in the deployment outcome.

GitHub MCP returned no open repository PRs on two checks on 2026-09-27. No random
open PR could therefore be selected. No PR was merged and no release created.

## Next bounded component

Unify recovery cases in an authenticated administrator view: affected title,
original identity, diagnosis, candidate (if any), next retry and one clear action.
Reuse verified media-server item links where available, with explicit missing-link
state and later backfill. Keep compact counts and accessible textual statuses;
do not present candidates as classification accuracy. Any automated replacement
must first add current-source corroboration and atomic repair-to-backfill tests,
not merely promote an external-ID lookup to authority.
