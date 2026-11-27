# Rollback retention identity verification

Scheduled rollback retention preserves exact snapshot, original intent, and
source event references through PostgreSQL and JSON. Safe IDs keep their
numeric encoding. Larger IDs use canonical decimal strings. Source fields
remain null when a capture event cannot prove the selected snapshot.
Cleanup can still redact the expired payload and save its maintenance event.

## Evidence

- The baseline PostgreSQL probe returned both a sibling event for a
  different snapshot and a historical unsafe JSON number. The marker
  rounded the original intent and source event ID, the result collapsed two
  adjacent snapshots into one, and a missing event threw an exception.
  The same probe verified exact IDs, two result entries, and absent
  attribution in all three unsupported cases after the repair.
- Seven isolated PostgreSQL suites passed 52 tests. The retention tests used
  the scheduled entry point and production retention worker with synthetic
  snapshots. They covered safe numeric and string references, adjacent
  large IDs, the BIGINT maximum, contradictory or missing source evidence,
  an untouched historical marker, and an unexpired snapshot.
- A transaction holding the advisory lock refused a second cleanup. A
  separately locked snapshot was skipped and cleaned on the next pass.
  The repeat run created no duplicate audit event. Active native intent
  authority remained intact in the fixture.
- A second update aimed at a neighboring snapshot caused the batch to roll
  back. A mismatched snapshot or source reference in the second audit insert
  also rolled back, as did a constraint failure. The subsequent valid cleanup
  succeeded. The marker and audit event retain the same digest without
  retaining the original payload.

Older unbound capture events remain in migration history. Their source
fields are null on newly redacted snapshots unless a saved capture event
explicitly matches. The applied change leaves existing redacted markers as
written and uses the same digest, expiry, scheduling, and locking rules.

## Quality gates

The full backend run passed 64,942 tests across 1,959 suites with one
existing skip and 89.33% statement coverage. The client report recorded
7,751 passing tests and 87.84% statement coverage. The client evidence
was reused after checking its SHA-256 and unchanged inputs. The coverage
ratchet, preflight, type checks, policy gates, ESM checks, server and
documentation lint, schema check, and staged secret scan passed.
Production dependency audits reported zero vulnerabilities across the root,
server, and client dependency sets.

## Follow-up

Qualify exact IDs in observed-evidence provenance retention. Its marker
narrows the original intent and establishment IDs, and its result can
collapse adjacent snapshots. Verify the stored evidence and transaction
acknowledgements in isolated PostgreSQL before deciding on a wider UUIDv7
migration.

[Design and recommendation](policy-rollback-retention-identity-design.md) ·
[Existing retention workflow](policy-rollback-snapshot-retention.md)
