# Exact generated intent IDs during library rebuild replacement

## Reproduction

In disposable PostgreSQL, replacement inserted intent
`9007199254740993`. The predecessor link used that exact ID, but
the rules were sent to `9007199254740992`. PostgreSQL's deferred
purpose-rule constraint rolled back the replacement, including the
attempted child writes. The prior intent remained active.

A separate control completed a replacement at the lower ID and then
substituted the upper ID in the saved gate. The event and active
intent still identified the lower row. Completed replay reported
success, and deletion readiness accepted the inconsistent evidence.
The old projections collapsed both IDs into the same number. These
tests used synthetic rows in isolated PostgreSQL.

## Proposed contract

Normalize the returned replacement header ID with the existing
positive BIGINT validator before using it in dependent writes. Use
that exact ID for the predecessor link, purpose rules, routing,
validation, event, and execution gate. Check the returned predecessor
ID and successor link, then the gate ID, successor link, and event
ID inside the existing transaction. An invalid or mismatched
acknowledgement uses the existing rollback path.

Record `replacementIntentId` in the existing migration event's
metadata. Use the existing JSON representation for IDs. It keeps
safe values numeric and represents larger values as canonical
decimal strings. Carry the exact ID through replacement, completed
replay, cutover, removal readiness, and the detailed final plan.

A large completed replacement needs its saved event to corroborate
the exact successor ID. Under the existing transaction, check the
event's identity, type, policy, intent, execution gate, transition
and typed successor reference. A successor can later become inactive,
and reversion can clear the predecessor link. Completed replay
uses the stored event and leaves current authority untouched.
Versions can be reused after reversion, so version equality alone
does not prove which historical intent was created.

Removal readiness requires the same exact event reference and
the existing sole active-intent check. Missing or numeric proof
for large historical IDs blocks affirmative replay and readiness.
Safe historical receipts keep their current contract. Existing
receipt keys, routing rules, expiry, and transaction order apply.
This work leaves original-intent admission and purpose lifecycle
reporting for separate review.

## Research and recommendation

Reviewed November 27, 2026. PostgreSQL `RETURNING` can acknowledge
the links stored by an update within its transaction. Row locks
protect the evidence during validation. A foreign key proves a
row exists, which still leaves the application's exact selection
to verify. [PostgreSQL RETURNING](https://www.postgresql.org/docs/18/dml-returning.html) ·
[PostgreSQL row locks](https://www.postgresql.org/docs/18/sql-select.html) ·
[PostgreSQL foreign keys](https://www.postgresql.org/docs/18/ddl-constraints.html)

I-JSON recommends strings for exact integers outside the interoperable
number range. W3C's locale-neutral data guidance supports the
canonical decimal spelling. Compare the JSONB string value with
the exact relational ID, retaining its type in that comparison.
[RFC 7493 §2.2](https://www.rfc-editor.org/rfc/rfc7493.html#section-2.2) ·
[W3C data best practices](https://www.w3.org/TR/dwbp/) ·
[PostgreSQL JSON functions](https://www.postgresql.org/docs/18/functions-json.html)

| Option | Benefit | Cost |
| --- | --- | --- |
| Preserve only the returned ID in child writes | Repairs the immediate write failure | Completion and historical replay can still present inconsistent evidence |
| Require the current predecessor link during replay | Uses relational evidence already stored | Reversion clears that link and would hide a valid committed result |
| Verify transaction links and record the exact event reference | Preserves replay after later authority changes | Adds a metadata field and a locked evidence read for large completed replays |

Verify all links before commit, then use the saved event as evidence
for large completed replacements. Qualify large original-intent IDs
through acceptance and migration verification next.

## Verification

In isolated PostgreSQL, test a safe successor, adjacent high IDs,
and the BIGINT maximum. Verify every dependent row, an untouched
neighbor, the normal policy engine's readback, and exact receipts
through readiness and final planning. Inject a substituted predecessor
or gate acknowledgement and verify that the replacement rolls back.
Exercise a cleared predecessor link, changed authority, and absent
or mismatched event proof. Include a safe legacy receipt without the
field and an invalid second active row in detached readiness evidence.
Run focused service tests and the normal quality gates, then record
results separately.
