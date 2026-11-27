# Proven native-change receipts in policy-purpose reports

A disposable PostgreSQL probe used the native change service to create a
receipt with target intent `9007199254740993` and event
`9007199254740995`. After the fixture removed the saved attempt digest,
the existing binding check failed and the normal command refused replay.
The inventory still counted one current intent with complete evidence,
recent coverage still credited one declared purpose rule to the change,
and the held-out re-audit still counted one native-change receipt.

The three readers get native changes from the same SQL source. It currently
checks the applied status and trusts the target link. A relational join to
a real revision establishes that a row exists. An older narrowing conversion
could have linked a different row and event from the original attempt.

## Proposed contract

Keep the source's existing treatment of positive safe target and event IDs.
The receipt's own primary key can be large without triggering additional
proof. If either link exceeds `9007199254740991`, require the existing
same-attempt event binding. Check the exact event and target intent IDs,
policy, operator and actor ID, event type, source and target versions, and
the target intent's version. Compare the saved JSON string digest against
the SHA-256 digest of the receipt's canonical command fingerprint, domain,
idempotency key, and target ID. An inactive historical target can still
supply evidence through the existing report rules.

Use a small SQL module for the common event and intent checks. Replay
continues to supply its current JavaScript digest. The reports compute that
same value inside the database using its built-in functions. Render the four
keys in the producer's fixed order with compact JSON and UTF-8. A safe
target is a JSON number even when its event ID needs proof. A larger target
is a JSON string. The disposable probe matched the producer's digest on
both representations, adjacent large values, and the BIGINT maximum.

Filter unproven changes out of all three existing report scopes. Apply the
predicate before the per-source recent limit so eligible older receipts
can fill the existing ordered window. The final combined order and limit
stay in place. Keep all proof material inside the database. Preserve the
public aggregate fields, versions and authorization, plus current purpose
and eligibility checks. This batch covers only read qualification of
native changes. The initial and rebuild sources, saved records, writes,
retention, and command outcome behavior stay in place.

## Official guidance and tradeoffs

Reviewed November 27, 2026. W3C models provenance through the actual
activity that produces a revision. Matching the saved attempt before
crediting a native change applies that principle to this aggregate.
[W3C PROV-DM](https://www.w3.org/TR/prov-dm/) ·
[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

RFC 8785 explains why hash verification depends on invariant bytes. Keep
the producer's existing format. PostgreSQL JSONB can reorder keys and
discard formatting, so verify the digest over an explicit representation.
PostgreSQL 17 and 18 supply SHA-256 and hexadecimal encoding in core.
[RFC 8785](https://www.rfc-editor.org/rfc/rfc8785.html) ·
[PostgreSQL JSON types](https://www.postgresql.org/docs/18/datatype-json.html) ·
[PostgreSQL 17 binary functions](https://www.postgresql.org/docs/17/functions-binarystring.html) ·
[PostgreSQL 18 binary functions](https://www.postgresql.org/docs/18/functions-binarystring.html)

| Option | Benefit | Cost |
| --- | --- | --- |
| Qualify large links in the shared SQL source | All scopes agree, and private evidence stays in PostgreSQL | Adds event and intent lookups for affected receipts and a SQL representation of the existing digest input |
| Verify after selecting a recent page in JavaScript | Reuses the existing digest builder directly | Exposes private fields to the application and leaves holes in the page unless reads widen |
| Use only the event and intent relations | Keeps the check simple | A coherent neighboring pair can still satisfy it |
| Rewrite or delete historical receipts | Could simplify future reads | Requires proof for individual historical records and changes saved evidence |

Use exact stored BIGINT links, the shared relational check, the existing
digest format, and the existing aggregate-only SQL and access controls.
Reports can show fewer qualified receipts. Filling the recent page can
require scanning more candidate receipts when recent rows lack proof.
Verify stable ordering and inspect the query plan with a
representative mix of valid and unproven records.
[PostgreSQL LIMIT and OFFSET](https://www.postgresql.org/docs/18/queries-limit.html) ·
[PostgreSQL EXPLAIN](https://www.postgresql.org/docs/18/using-explain.html)

## Verification

Use the real native change producer, replay verifier, and three report
readers in disposable PostgreSQL. Check safe historical links, a large
receipt primary key alone, large target and event links independently,
adjacent IDs, the BIGINT maximum, missing evidence, incorrect or differently
typed digest data, and a coherent event from another attempt. Verify recent
window refill, the final cap, aggregate privacy, and normal report and
authorization controls. Run fresh backend coverage and normal quality gates
before updating Unreleased and pushing on main.
