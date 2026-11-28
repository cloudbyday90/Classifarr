# Initial establishment rollback reversion proof

Reviewed November 28, 2026. Merge restore can retain the original
establishment receipt and import another snapshot for the same policy,
intent, and revision. The PostgreSQL retention regression already
verifies that the original keeps its receipt and the imported copy has
none. The establishment readiness read follows the receipt's snapshot
foreign key. Direct reversion checks the requested snapshot's policy,
manifest, and intent revision without checking the receipt.

## Proposed contract

- Treat a snapshot as an initial-establishment snapshot if a receipt
  claims its exact ID or its stored path is in the namespace reserved
  for that producer. The path flags when proof is required. The exact
  receipt and event supply the proof.
- Within the existing reversion transaction, require the completed
  receipt to match the locked snapshot, current policy and library,
  revision-one native intent, and positive accepted actor. Reuse the
  shared event checks for ownership, actor, revision, reason, and typed
  request metadata. Do the comparison in PostgreSQL and keep the public
  number-or-decimal-string ID behavior.
- Require proof before accepting a fresh reversion or reporting that a
  claimed or reserved-path snapshot was already reverted. A verified
  completed reversion can still replay after expiry or payload redaction.
  A fresh initial reversion requires the established intent to be active
  and returns the policy to compatibility. The existing authority checks
  continue to support a prior native intent for other snapshots.
- Use the existing blocked response for missing proof. Keep the admin
  route, policy and snapshot locks, manifest validation, atomic writes,
  audit and reconciliation hold, and legacy snapshot rules. Readiness,
  backups, historical rows, and retention stay outside this change.

## Guidance and tradeoffs

OWASP places the final authorization check at execution on the server.
PostgreSQL row locks serialize changes to the selected policy and
snapshot during reversion. The establishment receipt supplies the exact
cross-row relationship beyond the existence checked by foreign keys.
[OWASP transaction authorization](https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Transaction_Authorization_Cheat_Sheet.md) ·
[PostgreSQL explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html) ·
[PostgreSQL constraints](https://www.postgresql.org/docs/18/ddl-constraints.html)

W3C PROV distinguishes the generation of a record from the derivation
of a later copy. Applied here, a copy can remain useful as history while
the exact receipt identifies the snapshot available for reversion.
[W3C PROV-DM](https://www.w3.org/TR/prov-dm/)

| Option | Benefit | Cost |
| --- | --- | --- |
| Check the exact receipt during reversion | Reuses stored proof and preserves the existing route and archive format | An initial snapshot missing proof is unavailable for direct reversion |
| Check only the snapshot in the readiness view | Small change to the preflight display | Direct callers still bypass the receipt check |
| Require producer proof for every snapshot family now | Provides one stronger baseline across all reversions | Requires a separate compatibility review for conversion, rebuild, and legacy history |

Astra recommends the first option, with the existing proof shared in a
small persistence module. Keep artifacts with missing proof available
for historical inspection. Validate restored manifests under the
existing policy and library checks. A replace restore can remap owner
IDs while preserving their archived manifest values, so remapped
manifest compatibility is a separate follow-up.

## Verification

Use isolated PostgreSQL and the existing administrator route. Confirm
readiness selects the receipt-backed snapshot after merge. Verify blocked
requests leave both snapshots, the active intent, audit events, and
hold unchanged. Cover adjacent large IDs, invalid event proof, an
inactive initial intent with a successor, and successful reversion and
completed replay for the verified snapshot. Run existing conversion,
rebuild, legacy reversion, and retention controls, plus the repository
gates. Record the outcome separately, update Unreleased, and push on
main without a release.
