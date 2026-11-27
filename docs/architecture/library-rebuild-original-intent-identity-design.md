# Exact original intent IDs during library rebuild

## Evidence

An isolated PostgreSQL probe returned original intent
`9007199254741001` as an exact string. Acceptance narrowed it to
`9007199254741000` before comparing it with the rollback plan,
and the transition was blocked. A deterministic contract probe
also found that a supplied unsafe numeric intent passed the old
acceptance audit when both rollback-plan positions contained the
same number. These probes used synthetic data.

The transition fingerprint hashes the normalized policy context
and the rollback-plan fingerprint. The latter covers the full
embedded plan. An older valid plan may use a numeric intent at
its root and the equivalent safe decimal string in its snapshot.
That plan has distinct, valid fingerprint bytes.

## Proposed contract

Use the existing positive BIGINT validator for the original
intent. New rollback plans and accepted contexts carry safe IDs
as numbers and larger IDs as canonical decimal strings. Require
the accepted context's consumed intent field to be canonical
before a command uses it. Validate both rollback-plan references
against that intent and hash the original embedded plan so valid
safe historical fingerprints and replay keys survive.

Carry the exact original ID through coordinator results, durable
verification receipts, scoped SQL, and transaction comparisons.
Capture checks the locked intent and the returned original-intent
links in its gate, snapshot, and event. Capture replay checks the
stored original against the accepted context. Replacement uses
the same exact comparisons with the verification receipt and
locked snapshot. Existing gates still enforce expiry, current
authority, and the matching transition.

Use the existing capture and replacement events for typed
original-intent evidence. For large originals, extend the
capture proof check before pending replay or replacement and
require the replacement event's exact original ID in removal
readiness. Keep the existing proof for large verification and
replacement IDs. The detailed reports preserve exact relational
IDs. Historical unsafe numeric acceptance requires fresh
acceptance. An accurate current foreign key cannot recover the
identity implied by an already-rounded acceptance.

Keep safe legacy behavior, lock order, selection, idempotency,
and receipt versions. No schema migration or new public field
is needed. The separate scheduled rollback retention marker
has its own identifier conversions and is a follow-up.

## Research and recommendation

Reviewed November 27, 2026. PostgreSQL supports exact BIGINT
storage and transaction-local acknowledgement with `RETURNING`.
Use the existing parameterized queries and compare the returned
links against the selected intent.
[PostgreSQL integer types](https://www.postgresql.org/docs/18/datatype-numeric.html) ·
[PostgreSQL RETURNING](https://www.postgresql.org/docs/18/dml-returning.html) ·
[node-postgres query parameters](https://node-postgres.com/features/queries)

I-JSON recommends using strings for exact integers outside the
interoperable numeric range. JSON Canonicalization Scheme guidance
explains why deterministic representation matters for hashing.
Classifarr retains its existing fingerprint algorithm and hashes
the original validated plan. Canonical decimal strings also follow
W3C's guidance on locale-neutral data.
[RFC 7493 §2.2](https://www.rfc-editor.org/rfc/rfc7493.html#section-2.2) ·
[RFC 8785](https://www.rfc-editor.org/rfc/rfc8785.html) ·
[W3C data best practices](https://www.w3.org/TR/dwbp/)

| Option | Benefit | Cost |
| --- | --- | --- |
| Widen only acceptance | Small first patch | Later verification and storage can still round the ID |
| Rewrite old fingerprints with normalized IDs | A uniform serialization | Breaks valid replay keys and can give ambiguous historical evidence new authority |
| Preserve the original plan and validate exact IDs at each stage | Keeps valid safe receipts and allows exact large rebuilds | Requires coordinated changes across verification, capture, and reporting |

Use the shared exact validator, the existing fingerprint algorithm,
and transactional acknowledgement of the chosen relational links.
Qualify scheduled rollback snapshot retention IDs afterward.

## Verification

Preserve baseline fingerprints for both valid safe plan shapes.
Test adjacent high originals and PostgreSQL's BIGINT maximum with
the real coordinator, receipt repository, capture, replacement,
and report readers in isolated PostgreSQL. Check that a neighboring
receipt, persisted reference, or event cannot authorize capture
or replacement, and that a mismatched acknowledgement rolls
back. Exercise safe replay, historical unsafe numeric refusal,
large-event proof, and the normal quality gates. Record the
results in a separate outcome document.
