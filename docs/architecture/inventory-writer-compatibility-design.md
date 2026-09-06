# Inventory writer compatibility design

## Decision

Implement the next [scoped-repair recommendation](library-scoped-repair-outcome.md)
with an automatic repository inventory and an isolated sync adapter. Keep the
production persistence service and its three-attempt optimistic retry behavior.
Reuse its exact read/upsert SQL, binding only the fixed table clauses to the
allowlisted disposable schema. Do not add a production gateway or migration yet.

## Automatic source inventory

Scan version-controlled and unignored source files under `server/src`, `scripts`,
`execution`, database migrations and the authoritative schema. Exclude tests,
dependencies, private configuration and symlinks. Extract JavaScript string and
template literals with the existing ESLint parser, without importing or
executing scanned modules. Record path, line, operation, relation, source digest,
scope and unresolved dynamic SQL targets; emit no source SQL or data values.

Use foreign keys from the schema snapshot to discover parent deletions/updates
that can modify inventory indirectly. Record inventory triggers and migration
references separately. The report is a static candidate inventory, not proof of
runtime reachability or complete SQL data-flow analysis. Unresolved queries and
unsupported languages remain explicit gaps. A source fingerprint makes the
assessment reproducible and exposes repository drift without operator capture.

A separate catalog-only reader uses a database-enforced read-only snapshot to
inspect deployed clock columns, non-internal triggers, foreign keys and direct
table ownership/write privileges. It returns no item rows, identities or role
names and never upgrades the source database. Static and deployed evidence retain
separate contracts because neither establishes end-to-end writer compatibility.

## Isolated sync transaction

Analysis occurs before any transaction, using the production persistence service.
For each upsert attempt, the adapter acquires these locks in order:

1. Compatible source-table lock.
2. Transaction advisory lock for the canonical `(media server, external ID)` key.
3. Distinct current/destination library locks in numeric order.
4. Source-row locks taken by the existing upsert.

The identity lock prevents two compliant missing-row inserts from discovering
different destinations concurrently. Hash collisions only serialize unrelated
identities; they never grant access or identify a source row. Read the current
membership/revision after the identity lock, then recheck after library locks.
Any stale revision returns zero affected rows before mutation so the production
loop recomputes retention decisions. Keep its final `xmin` comparison as well.

Use one item per transaction, fixed query tokens, parameterized values, bounded
payload/key validation, timeouts and rollback on error. Never run analysis or
provider I/O inside these locks. The adapter accepts only the production read and
upsert operations; it is not a general SQL passthrough. Do not nest it inside an
existing transaction or invoke it concurrently on the same client.

Extend only the disposable prototype source with sync columns, uniqueness and an
identity sequence. Tests must preserve retained identity/observation/rating data,
clear incompatible observations, serialize same-key inserts across libraries,
retry intervening moves/deletes, and demonstrate unrelated progress. Include
cascade failures to show why parent writers cannot be omitted from rollout work.

## Security and promotion boundary

The existing database trigger checks actual old/new library locks. It remains a
correctness guard, not protection against an owner disabling triggers. Arbitrary
writers, parent cascades, restore paths and bulk pruning are not made compatible
by adapting sync alone. Production adoption still requires writer coverage,
privilege enforcement, bounded bulk handling and crash/storage evidence.

## Research and tradeoffs

Official sources were discovered through web search and read on 6 September 2026.
They supply established PostgreSQL 18/W3C guidance for the August 2026 baseline;
living pages are not represented as archived August snapshots.

- [PostgreSQL INSERT](https://www.postgresql.org/docs/18/sql-insert.html) and
  [transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html):
  conflict handling can encounter concurrent rows, and a conditional update can
  leave no returned row. Preserve the compare-and-retry contract.
- [Explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html):
  use transaction-scoped advisory locks and consistent acquisition order.
- [Trigger behavior](https://www.postgresql.org/docs/18/trigger-definition.html)
  and [CREATE TRIGGER](https://www.postgresql.org/docs/18/sql-createtrigger.html):
  foreign-key actions fire affected-table triggers; parent writers belong in
  the compatibility assessment.
- [W3C DQV](https://www.w3.org/TR/vocab-dqv/): retain measurement provenance,
  scope and limitations. This Working Group Note does not require a new UI or RDF.
- [ESLint custom rules](https://eslint.org/docs/latest/extend/custom-rules):
  traverse parsed literal/template/call nodes without executing repository code.
  The installed TypeScript 7 package does not expose the older `ScriptTarget`
  API used by many compiler-API examples; use the existing ESLint parser instead.
- [Constraint catalog](https://www.postgresql.org/docs/18/catalog-pg-constraint.html)
  and [trigger catalog](https://www.postgresql.org/docs/current/catalog-pg-trigger.html):
  inspect deployed referential actions and trigger activation separately from code.
- [PostgreSQL privileges](https://www.postgresql.org/docs/18/sql-grant.html):
  ownership includes definition-changing rights. A future runtime role should not
  own the tables whose guard it is expected to obey.

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Hand-maintained writer list | Easy to start | Misses new writers and indirect changes | Replace with reproducible discovery |
| Static candidate inventory | Automatic, attributable, inexpensive | Cannot prove arbitrary dynamic SQL or deployed privileges | Use with explicit gaps |
| Library locks alone for sync | Fewer locks | Missing rows lack an old library to declare | Add identity ordering in isolation |
| Reuse existing sync persistence | Preserves normalization, retention and retries | Requires a narrow SQL-binding adapter for the lab | Prefer over duplicated upsert logic |
| Production rollout now | Earlier adaptive repair | Bulk, cascade and restore writers remain unproven | Defer |

Recommended stack: automatic source inventory → preserved sync semantics → ordered
identity/library transactions → bounded bulk and parent-writer compatibility →
coherent automatic coverage → independently evaluated review-only AI evidence.

The separate [outcome](inventory-writer-compatibility-outcome.md) records measured
discovery, transaction behavior, deployed-schema differences and the next item.
