# Alias-consistent reviewed queue repairs

Date: 13 October 2026. Extends [reviewed repair](queue-identity-repair-design.md)
after [request normalization](request-identity-normalization-design.md).
No release, production repair, or automatic backfill is authorized by this change.

## Finding and decision

The diagnostic reader now understands root, nested `media`, and legacy `extra`
identity declarations. The repair writer still changes only root `tmdb_id` and
therefore correctly refuses other shapes. Simply removing that refusal would
leave contradictory IDs behind. This change must replace every present supported
TMDb declaration in one saved request, or change nothing.

Use a small pure ESM payload planner with the shared identity parser. Admit only
unenriched manual/webhook requests with allowlisted fields. Extend the existing
root allowlist with camel-case identity aliases, `media` and `extra`; nested media
accepts identity aliases and basic presentation fields only. Legacy entries accept
provider name/value pairs or known season/episode coordinates, not arbitrary nested
metadata. Unknown fields remain unresolved rather than being dropped. This is
library-agnostic and does not change episode mappings or source placement.

## Contract and lifecycle

- Require one valid movie/TV identity before planning. All supported non-null
  declarations must agree; conflicts, malformed IDs, unknown structures and
  oversized requests fail closed before provider reads. Keep the existing 64 KiB
  saved-payload ceiling and 64-entry legacy-array bound.
- Change only non-null root/nested `tmdb_id`/`tmdbId` and exact recognized TMDb
  legacy name/value entries. Preserve number/string representation, key names,
  null placeholders, type declarations, external IDs and all unrelated values.
  Never accept client-selected JSON paths or replacement IDs.
- Normalize the planned result again: only the TMDb ID may differ. Require the
  replacement to be valid, different and of the same media type. No title-based
  guessing. Return a new payload; never mutate the input.
- Reuse current administrator authorization, CSRF, per-process single flight,
  five requests/minute/IP, ten-minute persisted preview, ten-second provider
  deadline, at most five sequential GETs and one MiB response limit. Evidence is
  revalidated outside transactions. Task/source/provider revision changes,
  disablement, changed candidate or revoked authority invalidate confirmation.
- Commit all planned ID paths, receipt marker and existing durable receipt
  in the same transaction under the existing final write locks. Check the task
  revision in the update as well. No schema or approval-API change is needed:
  source/repaired revisions already bind the complete saved request. Original
  webhook evidence stays unchanged; never copy raw payloads into receipts/logs.
  Check the resulting PostgreSQL document's byte size before inserting a receipt;
  a result exceeding the diagnostic ceiling rolls back rather than becoming a
  repaired task that its separate retry can no longer read.
- Preserve attempts, cooldowns, recovery history, source link and failed status.
  Retry remains a separate one-time command that validates the repaired identity,
  receipt, revisions and competing-work exclusions. Generic/bulk retries and
  automatic recovery still exclude repaired tasks. Automatic recovery remains
  flat-only; this change does not expand its admission.
- Existing one-second lock wait, three-second statement and five-second
  transaction bounds remain. No provider writes or I/O under database locks.
  Cancellation before commit and unknown database failures roll everything back.
  A lost response is resolved by reading the receipt; duplicate confirmation after
  restart does not rewrite IDs or contact the provider.
- Fresh installations and tasks with no approved repair do no new background
  work. Transient errors, rate limits and unavailable providers make no repair;
  permanent missing/conflicting evidence stays unresolved. Memory safeguards and
  ownership fencing are unchanged; this is not mixed-version writer isolation.

Completion means every admitted declaration resolves to the approved replacement,
the durable receipt exists, and the task is still failed with its original budget.
It does not mean classification completed or that another task was approved.

## Options and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep flat-only repair | Smallest write surface | Legacy failures remain manual investigations | Superseded for explicitly supported shapes |
| Flatten or discard alternate fields | Simple storage | Loses request detail and can hide conflicts | Reject |
| Allowlisted shape-preserving atomic repair | Consistent consumers; preserved evidence and budgets | More validation; unknown shapes still need review | Recommended |
| Automatically replace/backfill every matching ID | Less operator work | Consent and work/edition ambiguity across requests | Defer |

Recommended stack: shared strict normalization → bounded payload planner → fresh
server-owned preview/evidence → explicit same-work/edition approval → atomic repair
and receipt → separately guarded retry. Next, assess a bounded opt-in scheduler
for already-approved receipts, without treating one approval as permission to
remap other requests.

## Official research

Discovered and opened with MCP search on 13 October 2026:

- [OWASP transaction authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html?trk=article-ssr-frontend-pulse_little-text-block)
  supports server-generated transaction data, ordered authorization steps and
  invalidating approval when the approved data changes.
- [PostgreSQL 18 transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html)
  establishes all-or-nothing visibility and durability for related writes.
- [PostgreSQL 18 JSON functions](https://www.postgresql.org/docs/18/functions-json.html)
  distinguishes whole JSON values from targeted path replacement. Our engineering
  choice is to validate the complete bounded document, then parameterize fixed
  allowlisted path/value patches in one update. Do not round-trip the entire JSON
  value through JavaScript: PostgreSQL JSON numbers can exceed JavaScript's exact
  numeric precision. SQL fragments contain generated placeholders, never request
  values or caller-selected paths; at most 68 ID patches are possible.

## Verification plan

Test all aliases, multiple equivalent declarations, string/number IDs, nulls,
legacy labels, preservation, invalid replacements and unsupported structures.
Use isolated PostgreSQL for atomic rollback, preview/retry drift, competing
writers, duplicate commands and unchanged budgets. Exercise the packaged image
with synthetic data, no external network and a same-image restart; do not call
that an upgrade test. Run quality/coverage gates, rebuild local Compose without
cache, evaluate health and record separate outcome evidence.
