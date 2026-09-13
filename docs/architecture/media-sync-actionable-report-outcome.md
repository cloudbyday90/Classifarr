# Actionable media-sync report outcome

Date: 2026-09-13

## Implemented

The [design](media-sync-actionable-report-design.md) explains the selected
read-time projection, research, alternatives and security boundaries.

Existing administrator log details and copied bug reports now include retained
affected titles, years, movie/TV labels, library names, catalog explanations and
Plex Fix Match / Refresh Metadata instructions. The current report omits the old
forum pointer without rewriting the stored warning. Future warnings retain only
counts, owning IDs and a recovery explanation.

An offline Plex lookup leaves titles and steps available. Reopening, copying or
automatically refreshing the same log retries the link lookup. Once Plex returns
a valid machine identifier, the same item receives a token-free app.plex.tv link.
There is no durable negative cache or new warning emitted by this read path.
This is live enrichment of the log's repair section, not a background rewrite of
historic events or already exported files.

The new Vue component reuses SWR with memory-only state and 30-second visible-tab
polling. Pause freezes displayed items even if an in-flight automatic response
arrives; manual refresh remains available. Unmount cancels polling. Links use
descriptive labels, fixed-host validation and safe new-tab attributes; titles
are escaped. Copied Markdown also escapes title markup. Responses are private
and no-store, behind the existing administrator middleware.

## Limits

At most 50 matching retained source observations are shown. A record must still
belong to the current active Plex library, predate the original warning and be
within the existing 30-day retention period. No matching records means the
diagnostic is no longer available, not proof that Plex was fixed. Missing or
malformed server/item identifiers produce manual title-search guidance, not a
guessed URL. Old exports remain static; copying again gets current information.

Repairing the link and repairing metadata are separate. This feature makes no
Plex writes, metadata guesses, routing decisions, training updates or resolved
log writes. Existing verified source recovery and scheduled metadata backfill
continue unchanged. Plex matching or refresh cannot guarantee an upstream
catalog correction.

## Verification

- Server regressions cover offline-to-online recovery on the same old warning,
  rejected lookup retry, concurrent request sharing, bounded requests, malformed
  IDs, safe projection, truncation, unavailable records and Markdown escaping.
- Real PostgreSQL and API tests cover movie/TV details, copied reports, no-store,
  authorization ordering, historical association, retention, active ownership
  and non-Plex exclusion. The targeted group passed 3 suites / 32 tests.
- Vue tests cover the same warning gaining a link, private SWR, hidden-tab and
  explicit pause, cleanup, safe links, manual retry and stale detail display.
- The isolated Chromium browser test passed: the old warning gained a link after
  simulated Plex recovery, keyboard pause/resume worked, no API writes occurred,
  and no private SWR data was persisted. Desktop/mobile captures were inspected;
  the 390-pixel layout passed the overflow check. This is not a full WCAG audit.

Full frontend and PostgreSQL suites, the coverage ratchet and final lint/ESM/
copyright/migration checks passed. Backend stress-test deadlines and the exact
full-run/rerun distinction are recorded in the [CI outcome](feedback-cohort-ci-repair-outcome.md).
The final targeted client group passed 48 tests, including the in-flight pause
race. Production build and all seven production route-asset browser checks passed.

## Local Compose verification

The rebuilt local service is healthy with a read-only root filesystem. A
read-only authenticated smoke checked the exact historic warning supplied by the
user: two retained items, two non-placeholder titles, two valid Plex item links
and five repair steps. Its stored metadata and resolved state were unchanged.
Both enriched detail and copy-report reads succeeded; anonymous access returned
401 and private/no-store was verified. No real titles, links, tokens or local
server address are published in this document.

This first smoke used the working-tree build, correctly labeled VCS_REF=unknown;
it is not release provenance. The final committed build can be rebuilt through
the same smart-Compose command without changing the report or recovery behavior.

## Recommendation and next product evaluation

Keep read-time repair details and nonpersistent SWR: existing warnings improve
without another job, new database retention or log rewriting. The cost is a
bounded read-only identity request and dependence on retained observations.

The original AI/RAG generation comparison remains outstanding. A fresh
[300-item readiness run](refreshed-inventory-benchmark-readiness-outcome.md) now
covers all ten libraries, with 150 movies and 150 TV shows. It identifies 23
adjudication-ready fallback targets but makes no AI-generation calls. The prior
[self-healing outcome](source-identity-self-healing-outcome.md) measured eight
recovered imports and completed metadata backfill, but explicitly did not claim
better classification. Next, evaluate refreshed movie/TV descriptions on the
same library-balanced benchmark, comparing strict and calibrated retrieval and
separating reference-placement agreement, mistakes, coverage and review holds.
Do not equate a reachable Plex link or imported metadata with accurate routing.

No release, version bump or PR merge is part of this change. GitHub returned no
open Classifarr PR to randomly implement. The CI repair is documented separately
in the [CI outcome](feedback-cohort-ci-repair-outcome.md).
