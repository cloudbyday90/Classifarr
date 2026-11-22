# Exact History IDs for reclassification

November 22, 2026 Eastern. Follow-up to the
[routing outcome repair](routing-outcome-bigint-outcome.md).

## Failure and decision

Classification History already uses `BIGINT`. Batch items and move operations
each store the History link as `INTEGER`. Preview forwards the raw value,
batch creation inserts it directly, and move execution applies the provider
integer range to it. Recovery compares the stored and requested IDs with
JavaScript strict equality. Those boundaries can refuse a valid History ID
or treat equivalent numeric and string representations as different rows.

Use the existing positive canonical BIGINT validator in preview, move
execution, batch creation, and the recovery comparison. Accept safe positive
integer numbers and canonical decimal strings through `9223372036854775807`.
Refuse unsafe numbers and noncanonical values before SQL or admission. Validate
all History IDs before opening a batch insert transaction. Preserve ordering,
duplicates, the existing target library rules, and the created-by contract.

Widen the two History columns in one startup migration. Both type changes
commit together, with the repository's five-second lock timeout and
sixty-second statement timeout. Preserve indexes, active-move uniqueness,
the batch parent cascade, and the deliberate absence of History foreign keys.
Plans, move UUIDs, receipt JSON and historical row values retain their
existing representation. The normal database decoder returns safe numbers
and exact decimal strings for larger IDs. History row decoding stays in
place for move revision hashes, including previously persisted plans. The
existing correction snapshot retains its numeric range, so a large History
ID can have a correction event with unavailable decision context.

## Authority and lifecycle

Administrator admission and the existing session advisory locks govern move
authority. New work still requires a saved reservation before filesystem
work. Binding a batch item still checks its active parent, execution status,
exact History and destination IDs. The move operation UUID and the target
library remain required when recovering a receipt. Existing attempt counts,
cooldowns, resource and path uniqueness, configuration revisions, cancellation
and final atomic correction/receipt writes stay with their current owners.

A duplicate or interrupted operation still follows the existing reconcile
path. An unclear write acknowledgement does not authorize another file move.
The worker checks observed placement and provider state before completing.
TMDB, TVDB, Radarr/Sonarr resource, destination library, batch, and batch-item
IDs keep their existing contracts. The browser already forwards History IDs
from the server and reads the raw batch items. Verify this with exact-string
regressions in the existing client tests.

## Official sources and tradeoffs

Sources retrieved on November 22, 2026 through the connected search service.

- PostgreSQL documents the exact BIGINT range and the exclusive locks and
  physical rewrites for column type changes. The coupled migration uses the
  existing schema and rebuilds the affected indexes through PostgreSQL.
  Deployed rewrite time and space depend on local table sizes and contention.
  An additive migration could spread the work, with extra dual-write and
  incomplete cutover states to reconcile.
  [PostgreSQL BIGINT](https://www.postgresql.org/docs/18/datatype-numeric.html),
  [PostgreSQL 18 ALTER TABLE](https://www.postgresql.org/docs/18/sql-altertable.html),
  [PostgreSQL 17 ALTER TABLE](https://www.postgresql.org/docs/17/sql-altertable.html)
- RFC 8259 gives the range for interoperable JSON integers. PostgreSQL JSON
  values can hold larger numeric tokens than a JavaScript parser can read
  exactly. Keep decimal strings outside the safe range, while preserving
  numeric responses for existing rows. W3C Web Architecture distinguishes
  resource identity from representation, which supports this compatibility
  choice without an alias or a public identifier change.
  [RFC 8259, section 6](https://www.rfc-editor.org/rfc/rfc8259.html#section-6),
  [PostgreSQL JSON types](https://www.postgresql.org/docs/18/datatype-json.html),
  [W3C Web Architecture](https://www.w3.org/TR/webarch/)
- Keep existing object checks and existing provider identity domains.
  RFC 9110 treats uncertain non-idempotent write replay separately from ID
  validation. Reservation, binding, and provider observation remain the
  evidence for move reconciliation.
  [OWASP API authorization](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/),
  [RFC 9110, section 9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2),
  [Radarr API](https://radarr.video/docs/api/), [Sonarr API](https://sonarr.tv/docs/api/)

The recommended sequence is exact request admission, a coupled type change,
stable move revision hashes, and exact receipt binding with existing recovery.
An older executable can retain the widened schema but still rejects larger
History IDs. Revisit UUIDv7 when a concrete identifier requirement warrants
changing identity rather than extending compatibility.

## Verification

Verify populated upgrades, contention rollback and fresh schema in isolated
PostgreSQL. Exercise HTTP admission, adjacent IDs above `2^53`, the BIGINT
maximum, exact receipt mismatch refusal, moved and interrupted operations,
and legacy completed replay. Assert large corrections are exact and that
older plans and batch receipts remain readable. Run focused browser/client
contracts and the affected quality gates. Record results separately.
