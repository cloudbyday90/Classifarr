# Observed-evidence retention identity verification

Observed-evidence retention now returns each redacted snapshot's exact
BIGINT ID and stores the exact intent and establishment IDs in the marker.
Safe IDs remain numeric. Larger IDs remain canonical decimal strings.
The worker checks the updated row and typed marker owner fields before
committing the batch.

## Evidence

- The original PostgreSQL probe returned both adjacent relational IDs
  exactly. The old marker narrowed the upper intent and establishment
  IDs to the lower ID as a JSON number, and the old result counted one
  of the two redacted rows. The repeated probe saved both exact string
  references and counted both rows.
- Four isolated PostgreSQL suites passed 15 tests. The retention fixture
  used the real initial-establishment writer, a stored synthetic profile,
  the scheduled retention entry point, and the database redaction trigger.
  Safe IDs, adjacent large IDs, and the BIGINT maximum survived redaction.
  The cleanup result and saved marker omitted the original evidence
  labels. The marker retained the original payload digest.
- A competing cleanup received the existing locked status. A row locked
  by another transaction was skipped and then redacted on a later run.
  Repeat cleanup left the saved markers intact. The unexpired row and an
  existing marker with rounded numeric IDs were preserved. The linked
  intents remained active.
- Fault injection changed the second real PostgreSQL update in a batch
  to target a neighboring snapshot, save a neighboring intent or
  establishment in the marker, or save a high ID as a JSON number.
  Each update returned the injected values. Each failed acknowledgement
  rolled back the full batch, and the next valid cleanup succeeded.

The implementation keeps the existing marker version, expiry, digest
algorithm and scheduler contract. Historical rounded marker values retain
their saved representation and cannot establish exact JSON identity.

## Quality gates

The full backend run passed 64,947 tests across 1,959 suites with one
existing skip and 89.33% statement coverage. The client report recorded
7,751 passing tests and 87.84% statement coverage. The client evidence
was reused after checking its SHA-256 and unchanged inputs. The coverage
ratchet, preflight, type checks, policy gates, ESM checks, server and
documentation lint, schema check, and staged secret scan passed.
Production dependency audits reported zero vulnerabilities across the root,
server, and client dependency sets.

## Follow-up

Qualify exact native change receipt IDs in policy-change outcome observation.
Its receipt reader currently drops large IDs before recording observations.
Trace the route, stored observation and review readers together before
widening that contract.

[Design and recommendation](policy-observed-evidence-retention-identity-design.md) ·
[Original provenance workflow](policy-observed-evidence-provenance.md)
