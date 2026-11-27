# Policy-change observation receipt identity verification

Policy-change outcome observation accepts exact positive BIGINT receipt IDs.
It keeps safe IDs numeric and binds larger IDs as canonical decimal strings.
The observation transaction checks that PostgreSQL saved the selected receipt
before committing. The receipt ID remains private to persistence.

## Evidence

- The before-and-after PostgreSQL probe ran the production receipt selector
  against two adjacent BIGINT receipts with equal timestamps. It chose the
  higher ID both times. The original service reported Start unavailable.
  The repaired service reports Start available and still accepts the safe-ID
  control.
- Three isolated PostgreSQL suites passed 17 tests. The new integration suite
  uses the native change writer, authenticated HTTP routes, the observation
  transaction and production read model. It covered safe IDs, exact adjacent
  IDs, the BIGINT maximum, the receipt time bounds, and actor-scoped
  admission. HTTP responses preserved no-store, refused caller selectors
  and omitted internal IDs. Another administrator could still read and
  reuse an unexpired observation.
- During an expired replacement, the real PostgreSQL upsert returned a
  neighboring source receipt. The service refused the acknowledgement and
  rolled back both the observation replacement and deletion of the expired
  decision. A later valid request stored the maximum ID and removed the
  expired decision.
- Focused tests passed 30 cases across eight suites. Noncanonical strings,
  unsafe numeric input and values above the BIGINT maximum were refused
  before the service wrote an observation. The writer inventory's SQL
  ownership analysis and review classification matched the baseline.
  Only the persistence module's source digest changed in the manifest.

Astra's independent review found no blocking issues. The aggregate response,
receipt eligibility, singleton behavior and client contract remain the same.

## Quality gates

The full backend run passed 64,951 tests across 1,959 suites with one
existing skip and 89.33% statement coverage. The client report recorded
7,751 passing tests and 87.84% statement coverage. The client evidence
was reused after checking its SHA-256 and unchanged inputs. The coverage
ratchet, preflight, type checks, policy gates, ESM checks, server and
documentation lint, schema check, and staged secret scan passed.
Production dependency audits reported zero vulnerabilities across the root,
server, and client dependency sets.

## Follow-up

Qualify the native change receipt contract used for writing and replay. It
still converts receipt, target intent and migration event IDs to JavaScript
numbers. Trace which values reach the database and callers before changing
that path.

[Design and recommendation](policy-change-observation-receipt-identity-design.md) ·
[Original observation workflow](policy-candidate-correction-policy-change-outcome-observation-design.md)
