# Proven library rebuild receipts in policy-purpose reports

A disposable PostgreSQL probe ran the existing capture and replacement
services with large intent, run, gate, snapshot, and event IDs. The rebuild
qualified in policy-purpose inventory, recent coverage, and held-out re-audit.
Changing the saved replacement intent reference from an exact decimal string
to a JSON number kept all three counts, even though completed replay and
removal readiness refused the link. After restoring the replacement proof,
removing the capture event's verification run reference also kept all three
counts. The capture proof failed, while completed read-only replay and
removal readiness still returned their results.

The shared report source already joins the exact replacement event, original
and replacement intent headers, and verification run. Those joins establish
row identity and revision consistency. The report also needs to establish
which original intent and run the capture selected and which links the
replacement recorded. This matters because older numeric conversions could
save a coherent neighboring link.

## Proposed contract

Use a small read-only SQL module in the existing rebuild receipt source.
Keep the existing terminal state, relations, verifier checks, and ordering.
Preserve the existing eligibility of rebuilds with safe original intent,
replacement intent, execution gate, rollback snapshot, and verification
run IDs. A large primary key for a capture or replacement event alone
does not trigger new metadata checks.

When the original intent or verification run is large, require the linked
capture event to prove the original row and verification run. Match the
event type and reason, policy, original intent, the typed snapshot and
verification run references, and both fingerprints used by the existing
capture proof. Require the extra typed original-intent metadata when the
original ID is large. This qualifies evidence for reporting even when
completed read-only replay can return a historical result.

When any of the five ownership links is large, require the already joined
replacement event to agree with the gate, snapshot, run, transition and
verification fingerprints, and every large intent reference. When either
intent is large, also enforce the current replay proof's typed gate and
replacement intent references. Use canonical strings for high IDs. Preserve
the applicable existing safe metadata representations for companion IDs.
Compare only exact typed values and keep the capture comparison and
replacement comparison independent.

Apply these checks before the rebuild source's recent limit. Eligible older
receipts can fill the existing ordered window. Keep the final aggregate
fields, caps, permissions, and privacy projection. Historical evidence can
still qualify after the snapshot payload is redacted or the replacement is
no longer the active intent. Current-policy counts continue to apply their
existing active-revision test. The change is confined to lifecycle reporting.

## Guidance and tradeoffs

Reviewed November 27, 2026. PostgreSQL JSONB extraction returns SQL NULL
when a key is missing. Typed equality distinguishes JSON strings from
numbers. Construct the expected value from a trusted BIGINT column and
compare it to stored JSONB. I-JSON recommends strings for exact integers
outside JavaScript's interoperable numeric range.
[PostgreSQL JSON functions](https://www.postgresql.org/docs/18/functions-json.html) ·
[RFC 7493 §2.2](https://www.rfc-editor.org/rfc/rfc7493.html#section-2.2)

Correlated `EXISTS` can establish that the linked capture event qualifies
without multiplying report rows or projecting metadata. Keep qualification
before the existing ordered limit. W3C provenance guidance distinguishes a
derived revision from a pair of related records. The stored capture and
replacement activities provide that connection here.
[PostgreSQL EXISTS](https://www.postgresql.org/docs/18/functions-subquery.html) ·
[PostgreSQL LIMIT](https://www.postgresql.org/docs/18/queries-limit.html) ·
[W3C PROV-DM](https://www.w3.org/TR/prov-dm/)

| Option | Benefit | Cost |
| --- | --- | --- |
| Require typed event proof for large links inside the shared report | Keeps the three readers aligned and private | Adds metadata comparisons and a capture lookup for affected rebuilds |
| Require full removal readiness for all receipts | Applies one stricter operational standard | Drops historical and active rollback-window evidence and changes the purpose of the reports |
| Verify after reading the recent page | Reuses existing command readers | Expands private application inputs and can leave the current page short |
| Keep the relational joins alone | Adds no read work | Can count an ambiguous historical link as verified lifecycle evidence |

Use exact PostgreSQL links, typed JSONB evidence from the capture and
replacement events, and the existing aggregate SQL. Qualify before limiting
results. A recent page may scan more candidates when newer rebuild receipts
lack proof. Review the isolated query behavior and preserve the existing
writer, replay, readiness, payload-retention, and other receipt contracts.

## Verification

Exercise the real capture and replacement services and all three report
readers in isolated PostgreSQL. Check a safe legacy rebuild, independent
large ownership links, adjacent IDs, the BIGINT maximum, and event IDs
that are large on their own. Compare missing, neighboring, and differently
typed metadata with genuine producer output. Verify recent-window refill,
privacy, existing aggregate and authorization contracts, rollback payload
redaction, and completed history. Run fresh backend coverage and normal
quality gates before updating Unreleased and pushing on main.
