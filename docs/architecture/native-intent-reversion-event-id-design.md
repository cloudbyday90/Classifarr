# Native-intent reversion event identity

## Decision

Native-intent reversion writes its migration event and reconciliation hold
in the same transaction as the authority and snapshot updates. The event
foreign key proves that a referenced event exists. In the isolated baseline,
rounding `9007199254740993` selected `9007199254740992`, the event of a
different policy. The transaction committed. At `9223372036854775807`,
PostgreSQL rejected the rounded value and rolled back the transaction.
The active hold projection and reentry audit metadata also rounded exact
stored event IDs independently.

Preserve the generated ID through the existing hold writer. Make its single
upsert select a `rollback_applied` event that belongs to the policy. A
missing or mismatched event follows the existing failed-write rollback path.
Preserve the locked source event in reentry metadata, and validate the
returned approval event before releasing the hold. Use numbers for safe
IDs and canonical decimal strings above that range. A hold's existence
continues to block reconciliation independently of its display projection.

Administrator and actor checks, row locks, active-native refusal, snapshot
eligibility, and repeat-request behavior stay in their current owners. The
reversion and reentry response contracts remain status and policy summaries.
Legacy holds retain their recorded references. A syntactically invalid event
identity cannot furnish a new audit reference. Historical investigation and
the separate rollback snapshot and intent-row identifiers need their own
evidence and decisions.

## Research and tradeoffs

Reviewed November 26, 2026. PostgreSQL transactions keep the authority
change, snapshot, event, and hold atomic. Foreign keys enforce the specified
referential match. The current single-column foreign key supplies existence,
so the upsert also checks policy and event type.
[PostgreSQL transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html) ·
[PostgreSQL constraints](https://www.postgresql.org/docs/18/ddl-constraints.html)

RFC 8259 describes the interoperable integer range of binary64 consumers.
The application convention of safe numbers and canonical decimal strings
uses a locale-neutral representation for larger IDs in JSON metadata.
[RFC 8259 §6](https://www.rfc-editor.org/rfc/rfc8259.html#section-6) ·
[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

| Option | Benefit | Cost |
| --- | --- | --- |
| Shared BIGINT normalizer and guarded upsert | Keeps existing safe values and checks the event relationship before commit | JSON readers handle numbers and strings |
| Normalize IDs only | Smallest code change | The foreign key accepts a valid event for a different policy or purpose |
| Add a composite database constraint | Extends policy identity enforcement to all writers | Requires a compatibility plan for existing rows and separate event-type enforcement |
| Convert all IDs to strings | One JSON type | Changes safe IDs in existing metadata and diagnostics |

Use the shared normalizer, the existing transaction and policy locks, and
the same-policy rollback event predicate in the hold upsert. Use this
contract for new operations and retain existing recorded history.

## Verification

Use authenticated HTTP and disposable PostgreSQL to test adjacent large
events, the BIGINT maximum, exact hold reads and audit metadata, and the
unchanged safe numeric form. Exercise an invalid source relationship,
failed-write rollback, and completed-request replay. Verify that the new
guard fits the existing transaction without an additional query, migration,
remote action, or automatic retry.
