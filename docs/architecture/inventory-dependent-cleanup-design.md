# Inventory dependent cleanup design

## Decision

Implement the [bounded cleanup follow-up](bounded-inventory-cleanup-outcome.md) with
automatic foreign-key dependency discovery and a disposable dependent-record
prototype. Keep production SQL, routes and migrations unchanged. Discovery produces
evidence and proposed dispositions; it never executes SQL generated from the graph.

## Dependency evidence

Walk the declared foreign-key graph from inventory items, libraries and media
servers. Include transitive references and multiple constraints between the same
tables. Record cycle and resource-limit gaps instead of truncating silently. Keep
unknown tables/actions unresolved. A repository snapshot report is available offline;
a separate read-only catalog assessment adds columns, validation/enforcement flags,
referencing indexes and trigger evidence. Fingerprints exclude capture time but
include the evidence used by the report.

Structural reachability does not mean every reachable row is deleted: cascade,
set-null, restrict and no-action references require different domain decisions.
Triggers, application-only references, row-level security and concurrent DDL are
separate adoption concerns. Neither a graph nor a matching hash authorizes deletion.

## Bounded dependent work

Extend only the existing disposable lab with representative retry rows, identity
review previews, collections, sync status and classification history. Retry and
preview data follow deleted items. Collection/status rows follow deleted parents.
History remains: completed records receive the existing library-deletion failure
message/status behavior and retain a library-name fallback before their library
reference is detached. Existing error/name values and audit payloads are preserved.

Each step counts source, dependent and parent deletions plus history updates against
one shared limit of at most 128 domain mutations. Job/claim bookkeeping and repair
cache work are recorded as outside that limit. This is not a wall-clock, WAL or
total storage bound. Foreign keys in the lab restrict implicit cascades so forgotten
dependents cause failure rather than uncounted work.

A durable item claim reserves a candidate before its dependents are drained. Library
locks and source-row revision/membership checks precede the claim. A move before
the claim preserves the item and all its dependents; once claimed, source updates
and new dependent writes reject until deletion finishes. Without that reservation,
a multi-transaction drain could delete a moved survivor's dependents. Claims and
progress resume through a new connection; failed transactions roll back together.

Before each batch, acquire table locks and compare the recorded disposable schema
contract. It fingerprints monitored columns/default expressions, constraints,
indexes, triggers, rewrite rules, row-security flags and lab function definitions.
An unknown incoming cascade or changed guard therefore stops the batch before
domain mutations. The stored contract includes database-local identifiers: it is
not a portable restore receipt. Only the installer records it; drift never approves
itself. These are correctness checks, not authorization against a database owner.
Concurrent replacement of functions outside the guarded table-DDL protocol and
changes to external helper functions still require deployment discipline/privilege
enforcement before production adoption.

Dependent admission locks source/parent rows with `FOR SHARE NOWAIT` and checks
scope/claim state. Claiming uses a source update lock after the existing cleanup and
library lock order. Incoming work cannot slip between the last dependent deletion
and parent deletion. Retained history detachment uses a narrow cleanup operation;
arbitrary changes while a parent is draining remain rejected.

## Research and alternatives

Official URLs were discovered through web search and read on 6 September 2026.
They provide established guidance for the August 2026 baseline, not archived August
snapshots of living documentation.

- [PostgreSQL constraints](https://www.postgresql.org/docs/18/ddl-constraints.html)
  distinguish referential actions and explain why referencing-column indexes matter.
- [Constraint catalog](https://www.postgresql.org/docs/18/catalog-pg-constraint.html)
  exposes validation, enforcement and key-column evidence.
- [Recursive queries](https://www.postgresql.org/docs/18/queries-with.html) discuss
  explicit cycle detection; the bounded in-memory graph traversal follows the same
  principle without relying on an output row limit to stop recursion.
- [Binary string functions](https://www.postgresql.org/docs/18/functions-binarystring.html)
  provide built-in SHA-256 for the stored lab contract without another extension.
- [W3C PROV-O](https://www.w3.org/TR/prov-o/) provides provenance concepts for
  attributable evidence. Captures retain source, time, scope and derivation; this
  does not require RDF or introduce a UI/accessibility-conformance claim.

| Choice | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Automatic graph discovery | Finds new and indirect references without operator collection | Cannot infer domain preservation semantics | Generate evidence, keep unknowns unresolved |
| Implicit cascade after item limit | Simple SQL | Child work can exceed the declared limit | Reject for bounded-work claims |
| Explicit dependent batches | Shared mutation budget, exact counters | More transactions and state | Prototype in isolation |
| Drain dependents without item reservation | Allows moves throughout cleanup | A moved survivor can lose its dependents | Reject |
| Durable item reservation | Preserves the delete-or-retain boundary across reconnects | Claimed items cannot move during draining | Use with automatic forward recovery |

Recommended stack: automatic dependency evidence → explicit preservation rules →
durable scope/item admission → shared bounded mutations → exact completion and
recovery → broader graph/privilege validation → production adoption assessment.

The catalog reader casts PostgreSQL `name` values to `text` when building column
arrays, preserving composite-key structure through the existing JavaScript driver.
Its index criterion is deliberately conservative: a valid, ready, nonpartial B-tree
with the FK columns as its leading key set. Other usable index strategies are not
claimed absent; they remain unproven until assessed. Source snapshots expose their
parser limitations and do not infer columns, validation or execution readiness.

The separate [outcome](inventory-dependent-cleanup-outcome.md) records measured
results, remaining gaps and the next item.
