# Proven initial-establishment receipts in policy-purpose reports

In disposable PostgreSQL, the real establishment service wrote intent and
event IDs of `9007199254740993`. The fixture created a second valid event
for adjacent intent `9007199254740992` with the same policy, actor, event
kind, revision, and metadata. PostgreSQL accepted a receipt linked to the
second event while retaining the first intent. Inventory still showed one
complete policy, recent coverage credited one declared purpose rule, and
held-out re-audit counted one initial establishment.

The schema independently validates that the referenced records exist.
The report currently checks only the receipt's terminal state and intent
link. The original establishment writer and the native policy-create path
use the same event producer. Its relational fields and saved request
metadata can establish which intent the event describes.

## Proposed contract

Qualify initial establishments in the shared SQL source for all three
reports. Apply the same check at every ID size. The referenced intent must
be native revision 1 and agree with the saved policy and library. The
referenced event must agree with the exact intent, policy, and accepting
actor. Match the establishment event kind, operator and reason, null
source revision, and target revision 1. Compare the stored request
fingerprint and authority source as JSON strings with the values on the
receipt. The request fingerprint describes the admitted request.

Do the matching before the existing recent limit so older verified
receipts can fill the page. Preserve aggregate fields, report ordering,
permissions, and privacy. Valid receipts can still support historical
reporting after a later revision or rollback payload redaction. Current
policy credit continues to depend on the active revision. A historical
receipt with missing or contradictory event evidence stays stored and
contributes no report credit. This batch changes only the initial source
of the reports. The writer, replay, and readiness services keep their
current contracts.

## Guidance and tradeoffs

Reviewed November 27, 2026. PostgreSQL foreign keys establish that the
referenced values exist. A qualified join or an existence predicate can
check the relationship among several saved fields. Match native BIGINT
columns exactly and extract typed JSONB so missing or wrong-type metadata
cannot qualify. W3C PROV-DM ties generation to the activity that produced
the entity. Credit the recorded event that produced the exact revision.
[PostgreSQL constraints](https://www.postgresql.org/docs/18/ddl-constraints.html) ·
[PostgreSQL table expressions](https://www.postgresql.org/docs/18/queries-table-expressions.html) ·
[PostgreSQL JSON functions](https://www.postgresql.org/docs/18/functions-json.html) ·
[W3C PROV-DM](https://www.w3.org/TR/prov-dm/)

| Option | Benefit | Cost |
| --- | --- | --- |
| Verify the existing event in shared SQL | All three readers use the same evidence and keep details private | Adds relational and metadata checks to the read |
| Add proof only above the safe range | Limits the number of checked receipts | An unrelated event can also be linked at safe IDs |
| Enforce an expanded constraint and migrate stored rows | Could prevent some bad links at write time | Needs a write and upgrade design, including a policy for historic gaps |

Use exact relational identity, typed saved metadata, and the current
aggregate-only projection. Apply qualification before the existing
deterministic ordering and limits. A recent read may examine more
candidates when newer receipts lack matching evidence.
[PostgreSQL LIMIT and OFFSET](https://www.postgresql.org/docs/18/queries-limit.html)

## Verification

Run the real establishment and normal native-create owner plus all three
report readers in isolated PostgreSQL. Cover safe and adjacent large IDs,
the BIGINT maximum, mismatched event ownership, wrong event shape and
metadata, and recent-window refill. Verify that an intact inactive initial
revision remains historical evidence after redaction. Exercise existing
authorization, projections, replay, and the normal quality gates with
fresh backend coverage. Update Unreleased and the separate outcome, then
commit and push on main.
