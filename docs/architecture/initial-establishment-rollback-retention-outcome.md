# Initial establishment rollback retention provenance outcome

Rollback retention now credits the exact creation event of a verified
initial-establishment receipt. It checks the locked snapshot, revision,
policy and intent against the receipt, then shares the existing
native-intent and event proof with the policy-purpose reports. It reads
only the event ID, actor, and reason for the marker.

Restore validates claims before it assigns destination IDs. It rejects
claim duplicates, ambiguous referenced event and snapshot IDs, conflicting
owners, and source library or policy collisions that would combine
owners. Valid restores continue to use their existing relational ID
mapping. This validates new imports. The origin of an earlier ambiguous
import cannot be reconstructed from destination IDs alone.

## Verification

- The original PostgreSQL 18 probe found empty attribution on a valid
  establishment receipt before and after restore. A duplicate archive
  snapshot ID also made restore attach the receipt to the last inserted
  copy.
- The new retention regression credited adjacent BIGINT snapshots to
  distinct exact events, including an inactive original intent. The
  authenticated native-create route retained the BIGINT maximum in the
  rollback marker. Existing establishment replay still worked.
- Merge retained the original receipt, and the imported copy remained
  unattributed despite legacy evidence naming it. Two replace restores
  with a re-export between them preserved verified attribution through
  remapping. Previously redacted markers survived unchanged.
- A receipt that named a different intent's event left an empty source
  even with a legacy candidate. A competing rebuild-shaped capture also
  left attribution empty. Expired payloads still redacted in both cases.
- Merge and replace rejected duplicate event, snapshot, and receipt
  claims, conflicting row owners, and libraries or policies that would
  map to the same destination. The test verified zero restore SQL
  statements before refusal. An independent test verified duplicate
  idempotency keys across distinct completed receipts.
- Nine PostgreSQL suites passed 82 tests. The focused backend run passed
  141 tests across 15 suites. The ownership gate passed with its existing
  baseline. Astra reviewed the lookup and the archive boundaries.

## Quality gates

The fresh backend run passed 65,037 tests across 1,959 suites, with one
existing skip and 89.29% statement coverage. The client coverage report
recorded 7,751 passing tests and 87.84% statement coverage. Its inputs
and SHA-256 matched the prior run.

Preflight, policy gates, type checks, ESM checks, the coverage ratchet,
server and Markdown lint, schema checks, and the staged secret scan
passed. All three production dependency audits reported zero
vulnerabilities. The disposable PostgreSQL fixtures were removed, and
the local Classifarr container retained its identity and healthy
status. GitHub listed zero open PRs.

## Follow-up

Verify how rollback readiness and direct reversion handle a receiptless
establishment snapshot imported by merge. Readiness currently follows the
receipt's snapshot ID, while direct reversion looks up the supplied
snapshot under the policy lock. Exercise both paths in disposable
PostgreSQL to determine whether a receiptless copy is actionable and
whether the existing ownership check is sufficient.

[Design, official sources, and tradeoffs](initial-establishment-rollback-retention-design.md)
