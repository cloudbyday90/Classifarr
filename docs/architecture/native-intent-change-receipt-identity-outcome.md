# Native change receipt identity verification

The native change transaction now preserves the exact receipt, target intent,
and migration event IDs. It verifies the event and receipt acknowledgements
before commit. Fresh and replayed results use the same exact target and event
IDs. Safe values stay numeric and larger values use decimal strings.

## Evidence

- The original PostgreSQL probe bound two rounded foreign keys to valid
  neighboring rows. The stored receipt ID was correct, but the decoder
  rounded it as well. Repeating the probe preserved all three IDs through
  construction, storage, and locked lookup. The command fingerprint was
  identical before and after.
- Five PostgreSQL suites passed 32 tests. The new authenticated HTTP suite
  exercised safe IDs, independently adjacent links, the BIGINT maximum,
  conflicts for another actor or command, a lost commit acknowledgement,
  and replay after a later revision. The raw key and command fingerprint
  remained absent from the migration event metadata.
- Real PostgreSQL writes returned a substituted event target or digest
  or a neighboring target or event in the receipt. Each acknowledgement
  failed, and the attempted revision, audit event, and receipt rolled
  back. The prior active intent remained selected.
- Historical safe links replayed even with a large receipt primary key.
  A historical high pair without a proof, and a coherent pair with
  proof for another attempt, both returned the existing unavailable
  response. The stored rows and active authority remained intact.
  A malformed receipt is refused before any fresh mutation.
- Focused checks passed 82 backend tests and 18 client tests. The ownership
  inventory confirmed that the receipt persistence file kept the same
  review classification and SQL analysis. The manifest refresh changed
  only its source digest.

Astra's independent review found no blocking issue. The existing receipt
version, command fingerprint, locks, response fields, and retention rules
remain in place. Large replay links need the saved attempt digest.

## Quality gates

The full backend run passed 64,953 tests across 1,959 suites with one
existing skip and 89.33% statement coverage. The client coverage report
recorded 7,751 passing tests and 87.84% statement coverage. The report was
reused after checking its SHA-256 and unchanged inputs. The coverage
ratchet, preflight, type checks, policy gates, ESM checks, server lint,
documentation lint, schema check, and staged secret scan passed.
Production dependency audits reported zero vulnerabilities across the root,
server, and client dependency sets.

## Follow-up

Qualify exact IDs in the active-intent integrity report. Its duplicate-case
ranking and filtering can collapse two adjacent large intent IDs and lose
the competing ID. Verify the current reconciliation readers and legacy
duplicate cases before changing that reporting boundary.

[Design and recommendation](native-intent-change-receipt-identity-design.md) ·
[Receipt lifecycle](native-intent-change-idempotency-receipts.md)
