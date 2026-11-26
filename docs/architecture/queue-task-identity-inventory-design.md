# Queue task identity inventory and historic refresh design

November 26, 2026. The prior [UUIDv7 assessment](classification-uuidv7-readiness-outcome.md)
focused on History. This pass traces the public application schema and
source owners that persist `task_queue.id`. The approved implementation
addresses the historic route-safety refresh receipt writer.

## Evidence boundary

Query the migrated integration database catalogs in a read-only
transaction for foreign keys to both `task_queue` and
`classification_history`. Cross-check likely queue-reference columns
against their writers, readers and retention rules. Inspect the source for
JSON links, witness bindings and diagnostics whose references cannot be
discovered from foreign keys. Use synthetic records in disposable
PostgreSQL to exercise the real retry and receipt paths.

PostgreSQL's `pg_constraint` identifies relational keys and their deletion
rules. A retained receipt can intentionally outlive a queue job, so a
missing foreign key needs a lifecycle explanation before adding a
constraint. The inventory covers known source-owned references and
catalog metadata. It cannot enumerate arbitrary keys in external exports
or prove production data volume or retention.
[PostgreSQL catalogs](https://www.postgresql.org/docs/18/catalog-pg-constraint.html) ·
[Foreign key constraints](https://www.postgresql.org/docs/18/ddl-constraints.html)

## Historic refresh repair

The retry service inserts the queue task and calls the supplied receipt
recorder on the same transaction client before closing the source
History row. The writer converts the returned task ID to a JavaScript
number and rejects large valid IDs, so the transaction rolls back. The
receipt item already has a BIGINT column, and reconciliation already
joins on that column without returning the task ID to the client.

Reuse the existing BIGINT normalizer in that writer. Preserve positive
safe numeric IDs and bind canonical large IDs as decimal text. Reject
noncanonical or already-inexact values before the receipt update. The
requested-item predicate, same-client binding, actor ownership, receipt
UUID, History identity, limits and response shape continue to apply.

No work is needed when the existing admission skips an item or the
selection is invalid. Database failures and missing requested items
retain their existing failure and rollback paths. The repair adds no
provider I/O, replay, retry, resource limit or recovery trigger. Reads
remain actor-bound and read-only across restarts. Source classification
eligibility, duplicate handling and uncertain-write reconciliation keep
their existing ownership.

## Research and recommendation

RFC 8259 describes the interoperable integer range for binary64 JSON
consumers. PostgreSQL JSONB can store larger numbers exactly, but a
consumer can lose precision when parsing them. Preserve the established
application representations and use decimal text where JavaScript
cannot carry the integer exactly. This follows W3C guidance on persistent
identifiers and compatible API evolution.
[RFC 8259, section 6](https://www.rfc-editor.org/rfc/rfc8259.html#section-6) ·
[PostgreSQL JSON types](https://www.postgresql.org/docs/18/datatype-json.html) ·
[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

| Option | Benefit | Cost |
| --- | --- | --- |
| Preserve BIGINT and validate at the writer | Exact IDs with existing joins and receipts | Requires deliberate validation at JavaScript boundaries |
| Add an independent public identifier | Can satisfy a future cross-installation reference requirement | Adds mappings, retention rules and compatibility obligations |
| Migrate the queue primary key to UUIDv7 | Supports independently generated, time-ordered identifiers | Changes relational and embedded references, ordering and recovery contracts |

Use the current BIGINT keys, exact boundary validation, bound SQL and
existing receipt ownership. Keep public or distributed identity work
conditional on a demonstrated requirement. UUIDv7 includes a timestamp
and possession of a UUID does not grant access. Those properties matter
for any future public-ID design.
[RFC 9562](https://www.rfc-editor.org/rfc/rfc9562.html) ·
[PostgreSQL UUID type](https://www.postgresql.org/docs/18/datatype-uuid.html)

## Completion

Verify adjacent high queue IDs and PostgreSQL's maximum through the real
historic HTTP retry, durable receipt and read-only reconciliation. Check
malformed repository inputs and forced receipt refusal, with rollback
leaving the source and queue intact. Record exact results and the next
intake lifecycle repair in the separate outcome.
