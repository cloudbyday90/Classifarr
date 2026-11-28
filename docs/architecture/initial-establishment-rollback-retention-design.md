# Initial establishment rollback retention provenance

Both native-intent establishment entry points use the same writer. It
saves the operator event and rollback snapshot, then completes a receipt
with both foreign keys inside the establishment transaction.

A disposable PostgreSQL 18 probe captured snapshot `9007199254740992`
and event `9007199254740993`. Their completed receipt verified the
operator event, but cleanup recorded an empty source. Merge retained
that receipt and imported a second snapshot without one. Replace restore
remapped the verified pair to snapshot `2700` and event `2800`, and
cleanup still recorded an empty source. A second probe duplicated the
archived snapshot ID. Restore inserted snapshots `3700` and `3701`
and bound the receipt to the last inserted copy.

## Proposed contract

Use the completed establishment receipt whose snapshot foreign key
matches the locked rollback snapshot. Match its policy and intent to
the snapshot owners, and require revision one. Reuse the existing policy
purpose proof for the native intent, library, event kind, operator,
reason, revision transition, and exact typed authority and request
fingerprint. Require a positive accepted actor ID. Keep historical
inactive intents eligible. The query returns the verified event ID,
actor, and reason. The existing marker format continues to represent
event IDs as safe numbers or exact decimal strings.

For a claimed establishment snapshot, missing or invalid proof leaves
the source empty. The initial-establishment restore path identifies
receiptless copies that should stay empty when only legacy evidence
claims them. The path supplies no positive proof and is carried forward
verbatim when IDs change.
Conversion, rebuild, and other capture evidence retain their existing
qualification.

Check new imports before allocating destination IDs. Reject duplicate
establishment claims and duplicate archive IDs named by their event or
snapshot references. Also refuse conflicting archive owner links when
all the referenced rows are present. Check duplicate library names
within the same media type and multiple policies for a claimed library
before restore can map them to one owner.
Use the existing restore validation error path so these cases leave the
database untouched. Incomplete old archives keep the existing handling
for missing sections. Correct archives retain their existing mapping,
including an established receipt surviving merge. The preflight check
applies to new imports and cannot reconstruct ambiguous earlier imports.

Use small modules for shared receipt proof and archive validation.
Keep the bounded retention batch, row and transaction locks, expiry,
write acknowledgement, and redaction behavior. This change introduces
no schema, endpoint, schedule, or operator recovery task.

## Guidance and tradeoffs

Reviewed November 28, 2026. PostgreSQL foreign keys prove the existence
of referenced rows. The proof also checks the policy, native intent,
revision and actor across those rows. W3C provenance distinguishes
the activity creating an entity from later derived copies. For a
restored snapshot, use the remapped receipt's exact foreign keys to
trace the creation event.
[PostgreSQL constraints](https://www.postgresql.org/docs/18/ddl-constraints.html) ·
[W3C PROV-DM](https://www.w3.org/TR/prov-dm/)

Use exact numbers or decimal strings at the JSON boundary and keep the
redaction audit limited to the provenance fields used by the marker.
[RFC 7493 §2.2](https://www.rfc-editor.org/rfc/rfc7493.html#section-2.2) ·
[OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet)

| Option | Benefit | Cost |
| --- | --- | --- |
| Verify the saved receipt and guard ambiguous imports | Reuses exact links and preserves attribution through valid restores | Ambiguous archives require a complete re-export |
| Verify only the destination receipt | Smaller code change | Restore can choose between duplicate source IDs before the runtime check |
| Add a new snapshot ID to establishment event metadata | Makes the event self-describing | Duplicates the existing receipt link and adds another archive reference to maintain |

Astra recommends the receipt and preflight checks together. Reuse the
existing exact event proof, resolve the snapshot by its unique receipt
key, and record an empty source when there is no verified relationship.

## Verification

Use disposable PostgreSQL to exercise both producer entry points,
adjacent large IDs, inactive intents, bad event proof, merge and repeated
replace restores, and an archive with competing references. Verify the
stored marker and audit event, safe refusal before destructive restore
work, and unchanged lifecycle reporting and other retention proofs.
Run the normal local gates, record the outcome separately, update
Unreleased, and push on main without a release.
