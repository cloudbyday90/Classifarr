# Inventory retained references design

## Decision and existing behavior

Extend the disposable dependent-cleanup prototype with bounded preservation of
`media_requests.routed_to_library_id` and
`policy_feedback_log.selected_library_id`. Both are nullable foreign keys with
no-action deletion semantics. Their records represent requests and human feedback,
so removing a library must not delete them or rewrite their decision evidence.

`webhookLogging.mjs` already stores `routed_to_library_name` independently of the
library FK and updates request status from webhook events. Preserve both fields
exactly, including null or empty names. `queueCarsaCleanup.mjs` already clears the
feedback library FK during a reset, but does not retain a name snapshot.
`feedbackAnalysis.mjs` persists original scores, suggestions, policy IDs, reasons,
metadata and response times; these must survive detachment unchanged.

This work extends the existing isolated assessment, not production schema or API
contracts. There is no production migration or additional operator workflow.

## Retention contract

Add representative request and feedback tables to the disposable schema. Preserve
the request-to-classification-history FK and the remaining payload. Each row gains
a separate, initially null `library_snapshot`. Cleanup fills it once with the
original library ID, media-server ID, name at detachment, job ID and detachment
time, then clears only the live library FK. The snapshot name is not represented
as the name at the original request or feedback event. Existing request names are
never replaced by this later observation.

Snapshot values are derived inside PostgreSQL from the fenced parent and running
job. They contain no requester identity, metadata or feedback text. A snapshot is
provenance, not an active routing destination or a completed-deletion receipt.
Library IDs may be reused after removal; retained IDs must not resolve to newly
created libraries. The prototype prevents reattachment of archived references.

Use the existing cleanup command, source/table lock ordering, coordinator and
library locks. Requests and feedback share the same domain-row mutation budget as
item/dependent deletion, history updates and parent removal. Counters commit in
the same transaction as detachment. Restrictive FKs remain in place, so a parent
cannot disappear while references remain. Pruning inventory items does not detach
library references.

The database guard rejects late inserts, moves and edits involving a fenced parent.
Moves before fencing remain valid and are preserved. Ordinary writes cannot forge
or alter a snapshot or silently detach a reference. Cleanup may change only the
live FK and exact generated snapshot; request states, existing names, history links
and all feedback payload fields must match their old values. Retained-row deletion
is rejected in the lab. These correctness guards are not protection against the
database owner, trigger disabling or `TRUNCATE`; production needs a separate role
and retention policy.

Schema fingerprinting covers the new tables, columns, indexes, constraints and
guards. Identifiers in SQL come from fixed internal definitions, never catalog
output or caller input. The existing no-connection-argument benchmark uses generated
credentials and cleans up its disposable database resources.

## Official research and alternatives

URLs were discovered through web search and read on 6 September 2026. They support
the established August 2026 baseline; these living pages are not archived August
snapshots.

- [PostgreSQL foreign keys](https://www.postgresql.org/docs/18/ddl-constraints.html)
  distinguish dependent records from independent entities and describe nullable
  references and referencing-side indexes. Explicit bounded detachment retains the
  independent record without hiding updates in an unbounded FK action.
- [PostgreSQL locking](https://www.postgresql.org/docs/current/explicit-locking.html)
  explains row-lock conflicts and ordered locking. Reuse the existing lock protocol
  and test actual admission races rather than relying on application timing.
- [Multicolumn indexes](https://www.postgresql.org/docs/18/indexes-multicolumn.html)
  explain how leading equality columns narrow a B-tree scan. The lab tests the
  library-reference/row-ID shape rather than adding indexes from intuition alone.
- [Using EXPLAIN](https://www.postgresql.org/docs/18/using-explain.html) distinguishes
  estimates from execution measurements. Compose uses plain JSON plans; actual
  timing and buffer measurements run only against disposable fixture reads.
- [W3C PROV-O](https://www.w3.org/TR/prov-o/) separates entities, activities and
  generation/invalidation times. The snapshot records which cleanup detached a
  reference and when, without claiming the retained event itself was invalidated.
  This is a provenance-inspired JSON contract, not RDF or a conformance claim.

| Choice | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Cascade-delete requests/feedback | Simple parent deletion | Destroys independently useful evidence | Reject |
| Implicit set-null | Retains rows | Unbounded work; loses reference context | Reject for this bounded protocol |
| Retain the parent indefinitely | Preserves joins | Prevents complete removal and complicates active-library semantics | Defer |
| Explicit detachment plus snapshot | Bounded, resumable, retains evidence | Extra storage; consumers must distinguish archived references | Prototype |
| Index the FK plus row ID | Supports selective ordered batches | Adds storage and write maintenance | Measure before a production migration |

Recommended stack: automatic dependency evidence → explicit retention snapshots →
fenced admission → bounded transactional detachment → recovery and retention →
consumer compatibility → least-privilege production assessment.

## Adoption gates and next item

`autoLearningConfidence.mjs` can count a null selected library as a rejection of
another library, and several feedback readers use live joins or raw IDs. Audit and
correct that interpretation before production detachment: preserved historical
evidence must not silently become negative evidence or be attached to a reused ID.
Feedback's selected-policy FK and other restrictive reference families also remain
outside this representative prototype. Full graph closure, automatic recovery,
retention and least-privilege enforcement remain required before adoption.

The separate [outcome](inventory-retained-references-outcome.md) records the actual
measurements and validation results.
