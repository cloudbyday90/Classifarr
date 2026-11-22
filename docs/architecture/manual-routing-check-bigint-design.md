# Exact History IDs for manual routing checks

November 22, 2026 Eastern. Follow-up to the
[intake linkage repair](classification-intake-bigint-outcome.md) and the
[background routing check design](manual-routing-background-design.md).

## Failure and decision

The three admin routes for checking routing and reading or setting its
background state parse path IDs with `Number.parseInt`. That accepts a
decimal prefix and can round a large identifier to a different row. The
coordinator and checker use the Radarr/Sonarr integer validator for History
IDs. `manual_routing_check_state` also stores an `INTEGER` foreign key to
`classification_history.id`, which is `BIGINT`. The History list and scheduler
already pass exact decimal strings when the database driver needs them. The
two History controls currently declare numeric props only.

Use the existing positive `BIGINT` validator at the three route and check
service boundaries. A safe positive number and its canonical decimal text
name the same History row. Use that text for queries and the checker's
in-process duplicate guard. Reject partial, signed, padded, fractional and
out-of-range representations before work. Invalid HTTP paths keep the
validation response and code. Valid absent rows keep the current behavior.
The two History controls accept both established database representations.
The API methods validate the path segment and preserve the exact digits,
including refusal of unsafe numbers that might already have rounded.

Widen the single background state key in the normal startup transaction.
Preserve its primary key, partial due index and cascading History foreign
key. Existing attempt bindings, cooldown timestamps, counters and enablement
stay with their rows. The migration uses the repository's five-second lock
timeout and sixty-second statement timeout. Retry a migration refused by
contention only through normal startup. An application rollback can retain
the widened column. The earlier executable still has the original parsing
and admission limits.

## Authority and lifecycle

Admin authorization, rate limiting and the response contract remain in the
existing route. A status request reads local state. Manual checks and the
existing once-per-minute scheduler require a saved routing intent, current
configuration, and the shared try-lock. Background checks require explicit
enablement. They keep the same three-attempt budget, durable pre-read
admission, delays and provider cooldowns. The checker still permits at most
two direct checks, with duplicate suppression by exact History ID.

Radarr/Sonarr configuration, TMDB/TVDB and provider resource IDs use their
existing provider types and validation. The provider work remains a bounded
read outside SQL transactions. Cancellation, transient failure handling and
the final attempt/configuration/observation recheck retain their existing
meaning. A saved observation says what the provider read found and cannot
authorize an add or replay. The original add's outcome writer is shared
with automatic routing and is a separate compatibility decision.

## Official sources and tradeoffs

Sources retrieved on November 22, 2026 through the connected search service.

- PostgreSQL documents the signed 64-bit range and the exclusive lock,
  table rewrite and index work that can accompany a type conversion. The
  one-column upgrade avoids dual writes and backfill, with a bounded lock
  and a deployment cost that depends on table size and contention.
  [PostgreSQL numeric types](https://www.postgresql.org/docs/17/datatype-numeric.html),
  [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/18/sql-altertable.html)
- RFC 8259 specifies the interoperable range for JSON numbers. Decimal text
  preserves larger identities through the browser. W3C Web Architecture
  supports separating identity from its representation. Keep the same
  route and unambiguous decimal path segment. Preserve native controls and
  the existing status regions for asynchronous feedback.
  [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259.html#section-6),
  [W3C Web Architecture](https://www.w3.org/TR/webarch/),
  [W3C ARIA22](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22.html)
- An identifier does not convey access rights. Retain the current admin
  check and saved destination checks regardless of integer width. Keep
  status retrieval read-only and mutations on their existing POST routes.
  Provider APIs have their own identity and retrieval contracts.
  [OWASP API authorization](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/),
  [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html),
  [Radarr API](https://radarr.video/docs/api/), [Sonarr API](https://sonarr.tv/docs/api/)

The recommended sequence is exact History admission, exact state storage,
and existing authorization and provider verification. Widening only the
database key would still refuse valid checks before admission. Adding a
UUID alias now would duplicate identity and compatibility work. Verify the
remaining History boundaries before choosing a new identifier scheme.

## Verification

Use real HTTP and isolated PostgreSQL to test invalid paths, adjacent large
IDs, exact check and background-state lookup, the maximum BIGINT, and an
existing populated state upgrade. Verify lock refusal, rollback, due index,
foreign-key cascade, stale-attempt refusal and safe provider IDs. Exercise
the two existing controls and their exact HTTP paths, including unchanged
status feedback. Run the History case in the existing single-worker Chromium
step and record local and quality-gate results in a separate outcome.
