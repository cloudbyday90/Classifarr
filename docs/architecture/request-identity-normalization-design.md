# Request identity normalization design

Date: 13 October 2026. This is a prerequisite to broader approved-repair backfill,
not authorization to run repairs on Unraid or change Plex.

## Finding and scope

Classification reads nested and legacy `extra` TMDb IDs, while failed-task checks
primarily read flat IDs. First-value precedence can hide contradictory identities.
Normalization must agree across classification, webhook intake and read-only
diagnostics before any additional saved request formats can be repaired.

The reported classification error also discarded the safe provider observation.
The paired queue log identified task 3685557 and a details HTTP 404. This work
retains the actual typed lookup identity and a correlation reference in both
reports; it does not infer a replacement identity from a title.

## Contract

- Read only fixed flat/camel-case and nested `media` aliases. Accept exact legacy
  provider labels (`TMDB`, `TMDB ID`, `tmdb_id`, `tmdbId`, and IMDb/TVDB equivalents),
  case-insensitively. Do not search arbitrary object paths or use substring matches.
- Positive database integers normalize numeric strings and leading zeros. Null
  provider IDs are absent; malformed non-null declarations and disagreements
  cannot fall through to title search. Existing unsupported-media handling stays
  unchanged. Conflicting supported media types are rejected.
- Check all supported declarations, not the first one. External-ID conflicts
  block replacement evidence; movie TVDB IDs are not evidence for a movie.
- Bound legacy arrays to 64 entries and labels to 64 characters. Diagnostic SQL
  returns at most 64 KiB per saved payload, strips raw payloads before returning the
  internal task view, and never exposes credentials, titles or provider bodies in
  the new diagnostic fields. Oversized/invalid records fail closed.
- Unnamed episode/season objects in `extra` remain supported; they are not ID
  declarations. Missing provider IDs consistently normalize to `null`.
- Original payloads, webhook records, approvals and retry budgets stay intact.
  Approved repair remains restricted to its existing flat allowlist. Automatic
  same-ID recovery stays flat-only and excludes alternate identity containers;
  competitor checks conservatively recognize aliases even when they disagree.
  Their SQL trims the same outer whitespace as JavaScript, with locale-stable
  casing for the ASCII media-type vocabulary. Tabs, newlines, non-breaking spaces
  and byte-order marks cannot hide a competing request.
  An existing recovery ledger on an excluded legacy format is displayed as paused,
  not as a promised automatic check; its history and budget remain intact.
- Safe metadata failures retain provider, typed ID, details-versus-enrichment
  operation, bounded HTTP/transport observation and one random failure reference.
  Classification and queue reports share that reference and the queue task ID.
  These observations are not proof that a retry or recovery was admitted.

## Lifecycle and safety

No new job, schema, provider request, approval or write-back is introduced. Fresh
installs do no recovery work. Existing recovery concurrency (one), six-check
persisted budget, cooldowns, 10-second diagnostic deadline, transport limits,
ownership checks, row/configuration revisions and final write gates remain in
force. HTTP remains outside database transactions. A restart cannot manufacture
approval or reset a recovery budget. Memory safeguards are unchanged.

Missing records, authentication failures, rate limits, timeouts, cancellation and
unknown failures retain separate observations. Unknown or ambiguous identity
requires review, not retry-budget reset or title substitution. Historical logs
cannot be retroactively assigned evidence they did not record.

## Options and recommendation

| Option | Benefit | Cost / risk |
| --- | --- | --- |
| Keep first-value precedence | Few edits | Classification and recovery can interpret different IDs |
| Rewrite all saved requests now | One storage shape | Mutates provenance before repair eligibility is proven |
| Shared strict read normalization | Consistent interpretation without rewriting requests | Ambiguous legacy requests need review |

Recommended stack: shared bounded parser; unchanged source records; sanitized
correlated failure reports; conservative write admission; regression tests at
consumer and PostgreSQL boundaries. Next, assess alias-preserving approved repair
with complete before/after identity checks before expanding backfill admission.

## Research

Official pages were discovered and opened with MCP web search on 13 October 2026:

- [OWASP input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  supports syntax/semantic validation, allowlists and bounded input.
- [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends linking related events and excluding credentials/sensitive payloads.
- [PostgreSQL JSON operators](https://www.postgresql.org/docs/current/functions-json.html)
  distinguish structured JSON access from text extraction; missing paths require
  deliberate handling rather than accidental precedence.
- [TMDb errors](https://developer.themoviedb.org/docs/errors) distinguish missing
  resources from authentication, quota and service failures. A 404 alone does not
  establish a deleted/merged record or a replacement identity.
- [PostgreSQL string functions](https://www.postgresql.org/docs/18/functions-string.html)
  specify that default `btrim` removes spaces, not the full JavaScript set.
  The [ECMAScript whitespace grammar](https://tc39.es/ecma262/2022/multipage/ecmascript-language-lexical-grammar.html)
  explains the broader set. Regression tests verify the pinned Node runtime's
  complete whitespace set and actual PostgreSQL behavior.

## Acceptance

Prove equivalent aliases normalize identically; conflicts/malformed IDs never
reach provider lookup or title fallback; source conflicts block evidence; nested
diagnostics preserve all database columns; flat-only write gates remain intact;
and new error context contains no secrets. Run focused unit, HTTP and isolated
PostgreSQL tests, quality checks and a no-cache local Compose evaluation. Record
actual outcomes separately; no release is part of this change.
