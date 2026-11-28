# Initial establishment rollback readiness outcome

Administrator readiness checks the exact receipt and creation event for
the current policy and library. It shares those checks and the typed
initial-establishment manifest check with direct reversion. Readiness
returns maintenance review for unverified proof, an invalid manifest,
or ambiguous active authority. The GET returns the resulting state and
existing summary fields. The POST remains authoritative under its locks.

Replace restore preserves the historical manifest. A snapshot whose
archived owner IDs differ from the live policy or library is unavailable
for fresh rollback. Verified completed rollback still reports `reverted`
after expiry and redaction. The declared-rule summary is scoped to the
current policy, library, and linked intent.

## Verification

- Before the change, the disposable PostgreSQL probe reported rollback
  available after replace restore even though the command's manifest
  check rejected the remapped owner IDs.
- Authenticated GET and POST tests cover exact adjacent BIGINT snapshot
  IDs, replace restore with both owners remapped, and preservation of the
  complete archived manifest. The rejected POST leaves intent, snapshots,
  audit, and reconciliation hold intact.
- Both routes reject an invalid policy or library reference independently
  and a correctly owned manifest with a missing section. They accept
  canonical decimal-string owner IDs. An unverified receipt with a saved
  restore time cannot report a completed rollback. A verified completed
  rollback still replays after expiry and payload redaction.
- Contradictory links cannot return another policy's rules or snapshot
  metadata. PostgreSQL tests cover inactive authority after replacement.
  The unit tests cover ambiguous authority defensively because the current
  database enforces one active intent per policy.

## Quality gates

The focused runs passed 75 PostgreSQL tests across ten suites and 39
unit and route tests across four suites. The fresh backend coverage run
passed 65,050 tests across 1,959 suites, with one skip and 89.29%
statement coverage. The client coverage inputs and report SHA-256
matched the prior run, which recorded 87.84% statement coverage.

The coverage ratchet, ownership and policy gates, type checks, ESM
checks, server and Markdown lint, schema check, and staged secret scan
passed. All three production dependency audits reported zero
vulnerabilities. The disposable PostgreSQL fixtures were removed and
the local Classifarr container retained its identity and healthy status.
GitHub listed zero open pull requests.

## Follow-up

Inventory which archived identifiers have exact source-to-destination
mappings before designing restored rollback. Keep the original manifest
available as evidence. Qualify a separate live binding only if the
archive, current rows, and routing references can prove the mapping.

[Design, official sources, and tradeoffs](initial-establishment-rollback-readiness-alignment-design.md)
