# Provider-specific unresolved identity guidance

## Decision — 9 October 2026

The twelve-item investigation found usable Plex descriptions and artwork alongside
conflicting catalog identifiers. Make that distinction visible using the existing
observation's `provider_fields`; do not introduce another provider request, queue,
database column or backfill. The parser records the first detected conflict, not
necessarily every conflict on an item. Wording must preserve that limitation.

Extend the existing read-only, no-store, bounded 50-item endpoint with optional
`providerFields`: only `tmdb_id`, `imdb_id`, `tvdb_id`, unique and canonical order.
Discard malformed stored diagnostics as an empty list. Never expose raw IDs,
source keys, URLs, credentials or provider payloads. The client accepts older
responses without this additive field; malformed supplied fields reject the
snapshot rather than guessing. Empty diagnostics mean unspecified, not healthy.

Explain conflicting versus invalid identifiers separately. A correct-looking
match is not proof that its catalog cross-links agree. For source-review results,
tell the operator to verify the intended match, correct it only if wrong, then
sync. If the visible match is correct, recommend a Classifarr issue with the
recorded reason/provider, not bulk rematching. The title/year refusal requires
separate investigation: never imply both fields differ or relax exact matching.

## Safety and lifecycle

This is a status projection only. Existing authorization, rate limits, capture
generation, active-library scope and 30-day retention remain in force. Fresh or
empty installations require no work. Old records need no migration. Existing
transient retry waits, permanent/source-review outcomes, cancellation, cooldowns,
attempt limits and unknown outcomes are unchanged. No new concurrency, timeouts,
external side effects or completion writes exist. Interrupted reads can safely
repeat; they cannot authorize identity repair. Memory safeguards are unchanged.

Completion means existing observations identify the detected provider and offer
accurate next steps; it does not mean the twelve upstream conflicts are repaired.
Test SQL projection and stale-capture exclusion with disposable PostgreSQL,
malformed/legacy responses, escaped text, accessible status and pagination.

## Options and recommendation stack

| Option | Benefit | Cost / risk |
| --- | --- | --- |
| Reuse stored provider fields (selected) | Immediate, bounded, no new storage or network | First detected provider only; no count or raw IDs |
| Persist every candidate count | More detail | Migration and capture changes; unnecessary for naming the current problem |
| Probe Plex on every dashboard read | Fresh detail | Provider load and credential/availability coupling; reject |
| Select an ID or weaken title matching | Clears the warning | Could misidentify media; reject |

Use existing PostgreSQL observations → allowlisted ESM projection → strict client
contract → plain-language Vue guidance. Investigate the one title/year refusal
with bounded, read-only catalog queries before designing any acceptance change.

## Official research

Discovered through MCP search and opened on 9 October 2026:

- [Plex Fix Match](https://support.plex.tv/articles/201018497-fix-match-match/):
  show-level match review and explicit catalog-ID search; a correction option,
  not evidence that every conflict means a wrong visible match.
- [TMDb finding data](https://developer.themoviedb.org/docs/finding-data) separates
  external-ID lookup from text search.
- [TMDb alternative titles](https://developer.themoviedb.org/reference/tv-series-alternative-titles)
  provides candidate-bound aliases for investigation; no automatic acceptance
  policy is inferred from the existence of that endpoint.
- [W3C error suggestions](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html)
  supports specific corrective guidance where known. Applied by analogy to these
  diagnostics; this is not a claim of whole-application WCAG conformance.

## Separate random PR trial

Two open PRs were enumerated; random selection chose
[PR #555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`4cbffcb7dd726af152382a1f92edb9dc326fe349`, upgrading client Node declarations
24.19.2 → 26.6.4 and undici-types 7.24.6 → 8.9.0. The immutable patch changes only
the client manifest and lockfile. Apply locally and test, never merge. Retain the
Node 24 declarations if the runtime-major policy fails; do not weaken that guard.
[DefinitelyTyped version guidance](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md)
ties declarations to the corresponding library major/minor, and the
[Node release table](https://nodejs.org/en/about/previous-releases) distinguishes
release lines. A declaration-only upgrade is not a runtime migration.
