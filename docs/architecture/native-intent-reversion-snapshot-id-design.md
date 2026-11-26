# Exact snapshot and intent IDs during native-intent reversion

## Decision

The administrator reversion command receives a snapshot ID in the path.
In isolated PostgreSQL, a request for `9007199254740993` restored
`9007199254740992` for the same policy. The audit and replay identified
the lower snapshot. A request for the BIGINT maximum rolled back when the
rounded selector exceeded the database range.

Validate a canonical positive BIGINT snapshot ID before opening the
transaction. Keep the existing 404 for invalid, missing, and wrong-policy
selectors. Compare the requested ID with the locked snapshot and verify
that the restore update returns that same ID. Carry it through response,
replay, and audit metadata. Safe IDs remain numbers and larger IDs use
canonical decimal strings.

Use exact intent IDs within this command too. Compare the snapshot's
intent and its saved successor with the loaded policy intents. Carry the
same identities into deactivation, reactivation, and migration evidence.
This protects both compatibility and prior-native reversion destinations
when the newly reachable snapshot references large intent IDs.

Keep the existing administrator and actor checks, policy-scoped locks,
expiry and manifest checks, active-authority conditions, and atomic event
and hold writes. Matching replay uses the locked snapshot's completion
marker. A failed update or inconsistent returned ID follows the existing
transaction failure path without a new automatic retry.

## Research and tradeoffs

Reviewed November 26, 2026. Parameterized SQL carries the exact selector
to PostgreSQL. Its row locks protect the selected row through the current
transaction. Locking by policy and ID supplies the existing ownership
boundary. The application verifies that the affected row agrees with it.
[PostgreSQL row locks](https://www.postgresql.org/docs/18/explicit-locking.html) ·
[node-postgres queries](https://node-postgres.com/features/queries)

RFC 8259 describes the interoperable safe integer range. Larger IDs use
locale-neutral decimal strings. This retains the safe numeric response
used by existing callers and makes the exact larger value reusable.
[RFC 8259 §6](https://www.rfc-editor.org/rfc/rfc8259.html#section-6) ·
[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

| Option | Benefit | Cost |
| --- | --- | --- |
| Normalize both identities within reversion | Protects snapshot and authority targeting throughout the transaction | JSON consumers handle numbers and strings |
| Widen the snapshot selector and refuse large intent IDs | Keeps the authority contract small | Valid snapshots can remain unavailable until a follow-up |
| Change all snapshot producers and readers at once | Covers more callers in one release | Broadens the compatibility surface and evidence needed for each writer |

Use the shared BIGINT normalizer for both identities in this command and
keep the existing SQL and transaction ownership. Snapshot producers and
their receipt projections have a separate compatibility boundary.

## Verification

Exercise adjacent snapshots, the BIGINT maximum, exact replay and audit,
wrong-policy and malformed selectors, and restoration through both target
paths in isolated PostgreSQL. Verify that a failed write rolls back and
that adjacent intent IDs cannot satisfy a different authority reference.
