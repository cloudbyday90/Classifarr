# Exact alternative-title identity recovery

## Evidence and decision — 10 October 2026

The [provider investigation](source-identity-provider-guidance-outcome.md) found
one source title that exactly matches a TMDb alternative title, with independent
IMDb/TVDB agreement on a declared candidate and the same year. Nine disputed
TVDB identities and two missing cross-references remain separate problems.
Artwork and summaries are not identity evidence.

Use a candidate-bound alternative-title read only after valid typed details and
exact year agreement, when primary/original titles do not match. Keep NFC,
case-folding and whitespace normalization; never strip punctuation, suffixes or
use fuzzy search. The fallback is for both movie and TV endpoint contracts; it
cannot select a different candidate or resolve independent-ID disagreement.

## Contract and bounds

- No work on clean/fresh items, denied claims, reusable receipts, primary matches,
  malformed details, wrong years or structurally insufficient evidence.
- Preserve eight attempts per library sync, sequential provider calls, existing
  shared rate limiting and durable 24-hour retry admission. Add at most one GET
  per admitted attempt: ten-second transport timeout, 1 MiB decoded-body limit,
  no redirects, at most 100 alternative titles of at most 500 characters each.
- Require the response ID to equal the independently verified candidate and the
  correct movie `titles` / TV `results` array. Validate every title before matching;
  empty/nonmatching arrays abstain, malformed or excessive arrays fail closed.
  Duplicate aliases for the same candidate do not imply multiple identities.
- Cancellation propagates before/after credentials, rate-limit admission and
  transport, and prevents source rechecks or completion. Transport failures use
  existing sanitized outcomes; malformed responses and title/year refusal stay
  distinct. No raw provider bodies, URLs, aliases or credentials are logged.
- Recheck current source type/digest after all catalog reads. Existing capture,
  active-library/configuration and ownership checks fence atomic persistence.
  No HTTP runs inside that database transaction. A crash keeps the durable retry
  limit; no migration, reset, startup sweep or live recovery command is added.
- Recent server-owned receipts retain version 1: their contract is independent
  external-candidate agreement, not primary-title spelling. Reuse still requires
  the same source digest, candidate, 24-hour age and a fresh source check.
- Complete only when verified inventory, receipt and conflict removal commit
  together; existing metadata backfill remains eligible. Optional AI work and
  memory safeguards are unchanged. Production deployment is not authorized here.

## Alternatives and recommendation stack

| Approach | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Primary title only | No extra request | Rejects valid catalog aliases | Keep as fast path |
| Candidate-bound exact alias | Fixes demonstrated mismatch with existing ID/year proof | One bounded read; depends on catalog aliases | Recommended fallback |
| Fuzzy matching / suffix removal | Higher apparent resolution | May conflate remakes or regional series | Reject |

Stack: existing external-ID agreement → strict typed details/year → bounded exact
alias fallback → fresh source digest → existing fenced PostgreSQL persistence.
Next, investigate the remaining cross-reference gaps without choosing disputed
IDs or asking operators to rematch correct Plex entries blindly.

Random open PR trial: #555, head `4cbffcb7dd726af152382a1f92edb9dc326fe349`,
was drawn from the two currently open dependency PRs. Apply its exact client Node
26 declaration patch locally and test; retain Node 24 declarations if the runtime
compatibility gate rejects it. Do not merge, close or weaken that gate.

## Official sources

Retrieved through the search/GitHub MCP services on 10 October 2026:

- [TMDb alternative titles](https://developer.themoviedb.org/reference/tv-series-alternative-titles)
  and its linked [OpenAPI contract](https://developer.themoviedb.org/openapi/tmdb-api.json)
  define candidate-ID endpoints and the differing movie/TV response arrays.
- [TMDb finding data](https://developer.themoviedb.org/docs/finding-data) distinguishes
  external-ID lookup from text search. Alias acceptance limits above are our safety
  policy, not a guarantee from the provider.
- [Node cancellation](https://nodejs.org/api/globals.html) documents AbortSignal
  propagation and `throwIfAborted`; existing Node 24-compatible APIs are retained.
- [DefinitelyTyped version guidance](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md)
  aligns declaration major/minor versions with the corresponding library.
