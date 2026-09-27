# Library-agnostic adoption and recovery

## Decision — 2026-09-27

Use the existing ingestion controller for new **and populated legacy** libraries.
Inventory size, library name, provider identity and a historical completed sync
are not proof that a complete import under the current ownership protocol exists.
No library IDs or content genres determine eligibility. The supported content
boundary remains movies and TV; this does not admit music.

This work prioritizes the reported legacy-recovery incident and the request for
platform-wide recovery over the previously proposed catalog-removal work. Catalog
deletion has not been changed by this patch; it remains a separate follow-up.

## Root causes

The watchdog required an empty inventory when no ownership ledger existed. A
legacy library containing even one item could therefore miss automatic adoption.
Separately, background readiness checked only the newest sync status, allowing
an older unfinished import to disappear behind a later completed record. A first
incremental caller could also begin without requiring a full adoption scan.

The incident's `legacy_owner_unknown` warning was a different, intentional fence:
an unfinished pre-ownership record had no verifiable current owner. Clearing it
by age, container restart, or lack of an advisory lock would not prove that an
uncooperative external writer had stopped.

## State and behavior

| Observed state | Next action | Data safety |
| --- | --- | --- |
| Enabled/configured library, no ledger, no foreign markers | Watchdog schedules full adoption regardless of item count | Keep inventory until media and collection enumeration complete |
| Owned interrupted run | Durable cooldown and full replay | Same leased session, ownership checks and atomic completion |
| Unknown legacy marker | Affected library and operator review steps | No age-based takeover; preserve markers and inventory |
| Verified stopped legacy worker | Existing disabled-library, revision-bound admin reconciliation | Atomic audit and retry state; re-enable separately |
| Unavailable/incomplete source | Preserve data and retry after cooldown | No empty fallback or premature pruning |
| Disabled/unconfigured source | Wait | No automatic enable or credential changes |
| Complete owned import | Leave watchdog recovery cohort | Periodic sync continues; evaluation requires other readiness checks |

The watchdog remains a bounded ten-library sweep with the existing two-slot
import limit. Selection is advisory: the owner path rechecks configuration,
foreign markers and cooldown before any provider request. Every first claim
requires full enumeration even if requested incrementally; first adoption does
not inflate restart counters. Completed adoption is durable across restarts.

`libraryIngestionPredicates.mjs` centralizes read-side lock and unfinished-marker
conditions. The claim transaction retains independent write-side checks.
Background learning considers all unfinished markers and populated server-linked
libraries lacking an ownership ledger. Standalone libraries without a media-server
connection retain their existing behavior. Reads remain read-only.

Existing library endpoints expose `awaiting_import`; the list offers a concise,
keyboard-accessible link to each pending/blocked library. Detail status uses
existing non-persistent SWR polling and `role="status"`, without inventing a
completion percentage or retry deadline. Deduplicated unknown-owner reports
include a library name, type, local path and concrete review/re-enable steps.

## Recommendations and tradeoffs

| Option | Benefit | Cost / limitation | Recommendation |
| --- | --- | --- | --- |
| Extend the existing controller | Durable, bounded adoption; one recovery lifecycle | One full scan per previously unowned library | Implement |
| Treat any inventory as complete | Avoids scanning | Leaves partial legacy data and missing provenance untreated | Reject |
| Clear unknown ownership automatically | No operator intervention | May overlap a live old writer and corrupt completeness decisions | Reject |
| Add another workflow engine | Additional scheduling capabilities | Competing state without solving ownership proof | Not needed |
| Database-enforced fencing of historical writers | Stronger cutover guarantees | Requires complete writer/privilege inventory and upgrade design | Separate future hardening |

Final stack: PostgreSQL session ownership + durable ingestion state + bounded
existing watchdog + complete-scan validation + audited legacy reconciliation +
small ESM policy services + existing Vue/SWR status controls. No new dependency,
migration, singleton, timer, routing rule or automatic AI call is added.
Existing backfill and evaluation workers resume through their normal readiness
checks; a completed import is not a claim of classification accuracy.

## Official research

Sources discovered and read through search/browser services on 2026-09-27:

- [PostgreSQL explicit locking](https://www.postgresql.org/docs/17/explicit-locking.html):
  advisory locking depends on cooperating applications. Retain session exclusion
  without claiming it proves historical writers are stopped.
- [Kubernetes controllers](https://kubernetes.io/docs/concepts/architecture/controller/):
  reconciliation compares current and desired state repeatedly. Applied here as
  a design principle, not a Kubernetes dependency: require durable completion
  instead of guessing from inventory size.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages):
  make meaningful results programmatically available without moving focus.
  Status regions and explicit text links communicate waiting and recovery.

## Acceptance and next boundary

Test adoption and reviewed reconciliation for Plex, Emby and Jellyfin, with
movies and TV: partial inventory, outage, cooldown, incremental callers,
completion, older hidden markers, owner contention and disabled configuration.
These synthetic orchestration tests are not live certification of all provider
versions. Existing adapter and pagination tests remain applicable.

Next: **catalog completeness and reviewed removal reconciliation**. Discovery
currently treats absent libraries as deleted; reduced visibility must not erase
inventory before recovery can run. Preserve absent libraries during discovery,
validate provider catalog contracts, and retain intentional cleanup through a
separate fresh, reviewed, audited operation.

See [test and incident outcomes](library-adoption-recovery-outcome.md).
