# Catalog-scope investigation outcome

## Findings

The eleven remaining local cases were rechecked read-only on 2026-10-10. All
have Plex artwork/descriptions and unchanged source evidence across the probe.
Nine declare two TVDB IDs; each has one TMDb series mapping and one absent series
mapping. The other two declare multiple TMDb IDs with inconclusive independent
evidence. Neither missing mappings nor other-media results prove an invalid ID.

Public TVDB series pages were found and opened for eight of the nine extra IDs.
They include separate specials, follow-on and regional records, not merely
malformed identifiers. One extra record's series identity/history remains
unverified. The two multiple-TMDb cases have public TVDB records explicitly
grouping a trilogy and an anthology into seasons. These findings support a
catalog-scope investigation, not an automatic merge or permission to remove IDs.

This does not prove every Plex grouping or catalog cross-link is correct. Public
HTML does not establish a typed merge history. No new licensed provider access
was configured. Private per-item notes contain the discovered source links;
library titles, catalog IDs and provider payloads were not committed.

The former twelfth item recovered locally through the previous exact-alias fix
and normal scheduling, including metadata backfill. This round does not repair
the remaining eleven. Unraid's read-only issue list was refreshed at 08:35 Eastern
on 10 October: twelve items, ten requiring source review and two waiting for an
eligible retry; all ten library summaries were current. Its catalog lookups were
not independently replayed, and its older deployment was not changed.

## Implemented

The explicit cross-reference CLI now emits
`source_identity_cross_reference_diagnosis.v2`. It preserves overall counters
and adds `summary.stableEvidenceByProvider.imdb_id` and `.tvdb_id`, with:

- `lookups`, `matched`, `notFound`, `reviewRequired`;
- `lookupsWithOtherMediaResults`;
- `notFoundWithOtherMediaResults`: no requested movie/series match, but another
  valid media bucket had results. This is not a claim about the source ID's type.

Counts use the requested provider, never a provider field supplied in a response.
They accumulate only after the source recheck. Failed/changed items contribute
no partial lookup counts; completed items remain visible if a later item is
cancelled. Provider counters add up to the corresponding totals. No HTTP calls,
database writes, recovery attempts, caches or scheduled jobs were added.

Run using the existing deployment environment:

```sh
docker exec --user 1000:1000 classifarr node /app/src/scripts/runSourceIdentityExternalEvidenceReplay.mjs --cross-references
```

Adapt container name and runtime identity to the deployment. This command makes
bounded read-only source/catalog requests, not repairs. The default scheduled
replay, automatic acceptance, ownership and memory safeguards are unchanged.

## Recommendations

Follow the [design and tradeoffs](source-identity-catalog-scope-design.md): keep
the safeguards; use provider-specific evidence to isolate the gap; next design
an explicit source-to-catalog scope mapping with provenance and invalidation.
First prove whether a source show represents one series or multiple catalog
series/seasons. Do not rematch every item or force a one-to-one identity merely
to reduce a warning count. Licensed typed catalog/merge evidence is an optional
separate integration, not a requirement silently added to existing installs.

## PR trial

Randomly selected [#555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`4cbffcb7dd726af152382a1f92edb9dc326fe349`, was applied locally with its exact
client declaration/lockfile changes. Scripts-disabled and reviewed installs,
`npm ls --all`, both client typechecks and production build passed. The full
client npm audit reported zero advisories on 2026-10-10, including development
dependencies. However, the Node 24 declaration gate rejected Node 26 types
(39 of 40 tooling tests passed). The trial was reverted, not merged; no dependency
or runtime version change is retained.

The affected-workspace outdated review also found Playwright 1.64.0, plugin-vue
6.0.10 and Vue Router 5.4.0. Keep these in separately tested tooling/navigation
batches, with the existing client TypeScript 6 hold intact.

## Verification

Initial regression tests failed on the absent version/provider counters; after
implementation, five focused suites passed all 162 tests. Real HTTP cancellation
and response bounds remain covered. The isolated PostgreSQL suite passed three
tests, including unchanged observation fields and transaction completion before
provider HTTP. Focused coverage of the new counter module is 100% for statements,
branches, functions and lines (47 diagnostic tests); this is not full-workspace
coverage or a combined coverage-ratchet claim.

Lint, both workspace typechecks, copyright, ownership inventory, normal and
production Knip, all 40 restored-toolchain tests, static ESM checks and Markdown
lint (2,066 documents) passed. The full backend unit run and exact local-image
checks are recorded separately after completion; no release claim is implied.
