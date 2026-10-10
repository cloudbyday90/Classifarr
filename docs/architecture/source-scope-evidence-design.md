# Fresh source scope evidence

## Decision — 2026-10-10

Extend the unsaved administrator draft with an explicit read-only evidence check.
Preserve source grouping across all libraries and supported media-server adapters.
Do not activate mappings, clear parent conflicts, schedule backfill or change
memory safeguards. Fresh installations and unopened forms perform no work.

The existing draft check remains cheap and offline. A separate authenticated
POST checks the same key, page and stored-source revision before contacting the
configured source and TMDb. Never accept URLs, credentials, verification flags
or provider responses from the browser. Recheck the active administrator,
observation/configuration and fresh source/catalog snapshots before returning.
Changed evidence is a conflict, not a partial successful review.

## Bounds and outcomes

Use the existing bounded source reader: 100 items/page, 20 pages, 2,000 episodes,
10-second requests, 1 MiB responses and no redirects. Limit a draft check to four
catalog works and 32 target seasons, with at most 10,000 catalog episodes.
Read sequentially, with a 90-second deadline, one database-scoped session lock
and a smaller HTTP rate limit. No database transaction spans provider I/O.
Disconnect, lock loss, editing and navigation cancel/discard work. No automatic
retry, persisted cooldown or durable job exists: this is a manually requested
read, not recovery. Process death releases the lock and loses the unsaved result.

Validate complete typed catalog payloads before comparison. Source-declared TMDb
episode IDs must be unique and present in the proposed target series/season;
conflicting/reused declarations, absent IDs, unmapped seasons and numbering
differences remain explicit exclusions. A partial draft must declare every
observed source season, including unmapped seasons. Catalog membership is not
independent cross-provider identity verification, and parent conflicts remain.
Movies receive a typed catalog-presence and source-declaration check, not an
episode-derived identity claim. Titles and artwork never select an identity.

Return a bounded per-position exclusion list, aggregate counts and a review
reference. Do not return source item IDs, provider credentials/URLs or raw errors.
All responses keep `canApply: false`, `persisted: false` and backfill disabled.
No result can be consumed by the existing scalar identity confirmation endpoint.
The `mapping_not_approved` backfill reason applies even when every checked episode
has matching membership. An empty source returns zero compared units, not proof
of complete identity coverage.
Invalid drafts fail before network I/O. Unavailable/invalid providers, exceeded
bounds, cancellation and unknown failures produce fixed safe messages. Only a
complete stable read produces an evidence summary; it remains advisory.

Use a separate native button and polite status. Explain what was checked and
what remains excluded, clear results on edits and discard late responses. Keep
large exclusion details in a disclosure rather than a live-region announcement.
Cancellation announces that nothing was saved. The private target query shares
the public issue-page ordering; it never exposes source keys or credentials.

The ownership-review fingerprint changes only for the addition of advisory key
`SOURCE_SCOPE_EVIDENCE_REVIEW: 2029` in `database.mjs`. Existing query, transaction,
session-cancellation and writer authority code are unchanged. The analysis digest
and review classification are retained after reviewing that exact one-line diff.

## Options and recommendation stack

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Fresh typed, revision-bound read | Explains actual mapping gaps without writes | Provider cost and strict limits | Implement |
| Trust names, artwork or season numbering | Fast and often plausible | Can map the wrong work | Reject |
| Treat episode membership as parent identity | Clears warnings quickly | Hides conflicting parent declarations | Reject |
| Persist/activate the current advisory result | Immediate backfill | No scope-aware consumer contract yet | Defer |

Next, implement scope-aware consumers and an explicit confirmation contract with
fresh revalidation before guarded activation/backfill. External-ID gap diagnosis
remains available separately; do not silently turn incomplete lookups into matches.

## Official research

Discovered and opened through MCP on 2026-10-10:

- [OWASP REST security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html):
  enforce authorization and workflow state on the server, validate inputs and
  constrain request sizes. A prior UI check is not authority for a later step.
- [TMDb season details](https://developer.themoviedb.org/reference/tv-season-details):
  seasons are addressed by series and season; typed episode members must be
  checked in that scope. Numbering alone is insufficient (our inference).
- [TMDb finding data](https://developer.themoviedb.org/docs/finding-data):
  external-ID lookup is distinct from text search; neither artwork nor a search
  hit proves that a grouped source represents one complete catalog series.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html):
  expose operation feedback programmatically without unnecessarily moving focus
  or announcing a large changing detail list.

## Independent PR trial

Current MCP enumeration found #555 and #556. Random selection chose
[PR #555](https://github.com/cloudbyday90/Classifarr/pull/555), unchanged head
`4cbffcb7dd726af152382a1f92edb9dc326fe349`. Repeat the exact Node-types 26.6.4 /
undici-types 8.9.0 local trial against Node 24.21.0. Restore the original files
if the runtime-alignment guard rejects it; do not merge or weaken that guard.
