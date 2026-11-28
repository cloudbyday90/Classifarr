# Policy conversion rollback snapshot identity outcome

Post-upgrade conversion and native-intent reconciliation now bind each
new rollback snapshot to its creation event inside their existing
transaction. PostgreSQL returns the generated snapshot ID, owner IDs,
revision, path, and redaction state. The writer then verifies the saved
capture event, including the JSON reference's type and text, before the
transaction can commit.

Restore reuses the private `retentionSnapshotId` mapping for conversion
captures. It preserves the original reference and checks the exact
archive row, revision, producer, and path before assigning a
destination reference. Retention uses that reference and records
an empty source when proof is missing or ambiguous. Historical
path-only events remain stored and unbound. Rebuild capture proof
continues to use its separate acceptance evidence.

## Verification

- The PostgreSQL 18 probe reproduced empty sources for the two
  production entry points on snapshots `9007199254740992` and
  `9007199254740993`. After the change, the integration test verified
  both exact ID strings and the distinct actors and source events.
  The already-converted path left the original records in place.
- The restore regression merged a backup into its source database and
  verified that cleanup attributed the original and imported snapshots
  to their own creation events. Two replace restores with a re-export
  between them carried the link to `9223372036854775807`. An earlier
  restored redaction marker retained its historical contents.
- Path-only events, incompatible paths, mismatched actor types or
  sources, nonpositive actors, and competing qualifying events all
  yielded empty attribution while expiry still redacted the payload.
  An exact conversion with a caller-supplied reason shared by the
  rebuild path kept its conversion provenance.
- A real PostgreSQL trigger suppressed the creation event. Missing or
  mismatched returned rows and JSON types also exercised the real
  transaction boundary. Each case rolled back the new intent,
  snapshot, and events. A direct call that supplied a revision different
  from the admitted rollback plan failed before any conversion writes.
- Seven affected PostgreSQL suites passed 61 tests. The focused backend
  run passed 151 tests across 14 suites. Astra reviewed the transactional
  acknowledgements, restore mapping, and retention admission.

## Quality gates

The focused PostgreSQL coverage run passed 26 tests and covered all
statements in the conversion capture, restore binding, and retention
persistence modules. The full backend run passed 65,016 tests across
1,959 suites, with one existing skip and 89.31% statement coverage.
The client report recorded 7,751 passing tests and 87.84% statement
coverage. Its inputs and SHA-256 matched the prior run.

The coverage ratchet, preflight, policy gates, type checks, ESM checks,
server and documentation lint, schema check, and staged secret scan
passed. Root, server, and client production dependency audits reported
zero vulnerabilities.

The ownership report retained the restore module's operation,
analysis digest, and unresolved classification. The manifest updates
only its reviewed source digest. Disposable PostgreSQL fixtures were
removed. The local Classifarr container retained its identity, start
time, and healthy status. GitHub listed zero open PRs.

## Follow-up

Qualify retention provenance for initial native-intent establishment.
Its receipt has exact foreign keys to the rollback snapshot and the
`initial_intent_established` event, and configuration restore already
maps both. Verify those two links with the existing establishment
event proof before deciding whether the retention worker can credit
that source. Historical path-only conversion events remain unbound.

[Design, official sources, and tradeoffs](conversion-rollback-snapshot-identity-design.md)
