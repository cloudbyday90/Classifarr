# Exact receipt identity for policy-change observation

An isolated PostgreSQL probe gave the existing selector two applied receipts
for one actor with the same timestamp. SQL chose `9007199254740993` over its
neighbor. The observation service rejected that selection when it converted
the ID to a JavaScript number. The same read path accepted a safe numeric
receipt for another actor.

## Proposed contract

Use the shared positive BIGINT validator for the selected receipt. Keep
safe IDs numeric and represent larger IDs as canonical decimal strings
at the JavaScript and database boundary. Preserve the existing version
checks, administrator access, receipt time window, and actor-scoped
selection. The server owns the selection, including the descending ID
tie-breaker when two receipts share a timestamp.

Return the saved `source_receipt_id` from the existing observation upsert
and verify it against the selected receipt inside the transaction. The
table enforces a positive receipt ID. It can store any positive BIGINT,
which makes the acknowledgement check responsible for the selected link.
A missing or different link rolls back the upsert and any expired
decision removed by the same transaction.

Keep the receipt identifier private. Existing unexpired observations
continue to use the stored read model when another administrator calls
Start. Expired observations use the current actor's eligible receipt for a
new observation. Keep the existing advisory lock, expiry, release of locks
at the transaction boundary, result envelopes, no-store behavior, and
descriptive metrics. The observation's read path remains independent of
later receipt retention. The client contract, schema, and saved rows need
no changes.

## Research and recommendation

Reviewed November 27, 2026. I-JSON recommends strings when integers need
precision beyond the interoperable numeric range. W3C guidance on provenance
and locale-neutral data representation supports keeping the exact owner ID
internally. OWASP logging guidance supports limiting recorded data to the
required context. Keep the public aggregate response free of receipt and
policy identifiers. Preserve its existing `Cache-Control: no-store` for
successful responses under the HTTP caching contract.
[RFC 7493 §2.2](https://www.rfc-editor.org/rfc/rfc7493.html#section-2.2) ·
[W3C data best practices](https://www.w3.org/TR/dwbp/) ·
[RFC 9111 §5.2.2.5](https://www.rfc-editor.org/rfc/rfc9111.html#section-5.2.2.5) ·
[OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

PostgreSQL `RETURNING` shows the actual stored values after a write. Verify
the selected receipt link before the existing transaction commits. Reuse
the parameterized BIGINT binding and current singleton lock.
[PostgreSQL RETURNING](https://www.postgresql.org/docs/18/dml-returning.html)

| Option | Benefit | Cost |
| --- | --- | --- |
| Widen receipt parsing only | Restores availability for valid high IDs | Leaves a substituted link undetected at commit |
| Widen parsing and verify the stored source link | Preserves exact ownership and verifies the transaction result | Returns one extra private scalar |
| Add schema constraints or change public IDs | Could strengthen a broader identifier contract | Requires separate retention, compatibility, and migration decisions |

Use the shared validator in the observation service, the existing
persistence module for the acknowledgement, and the existing aggregate
read model for responses. Review the native-change receipt producer's
separate numeric conversions in a follow-up.

## Verification

Use the real native change writer, observation service and HTTP entry
points in isolated PostgreSQL. Cover safe IDs, adjacent large IDs, the
BIGINT maximum, actor-scoped selection and time bounds, no-store and
identifier omission, existing observation reuse, and expired replacement.
Substitute a neighboring receipt in a real upsert and prove rollback of
the observation and expired decision. Run the affected quality gates and
record results in a separate outcome.
