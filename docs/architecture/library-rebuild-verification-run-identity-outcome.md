# Library rebuild verification-run identity outcome

The verification-run receipt, execution gate, replacement event, and
removal reports now retain the same exact run ID. Safe IDs stay numeric.
Larger IDs use canonical decimal strings, including in JSONB metadata.
Capture checks the stored run and fingerprint in the completion update.
A large pending gate requires its capture event to corroborate that
binding before replay or replacement. See the
[design and tradeoffs](library-rebuild-verification-run-identity-design.md).

## Verification

Before the change, the production database adapter selected
`9007199254740993` in SQL, saved `9007199254740992` on the gate,
and accepted the lower row when the binding reader received the upper
ID. After the change, the selected and stored IDs, the capture receipt,
the bound query argument, and the returned receipt agreed on
`9007199254740993`. Both probes ran in disposable PostgreSQL.

All 38 focused PostgreSQL cases passed. The new cases use a synthetic
audited coordinator result and the production handoff and repository for
claim and replay. They cover safe IDs, adjacent runs with matching
fingerprints, and PostgreSQL's BIGINT maximum. The fixtures exercise
capture, replacement, cutover, readiness, and the final plan. For
readiness they simulate an expired, redacted rollback window.

A substituted completion link rolls back the gate, snapshot, and
capture event, preserving both verification receipts. The pinned
binding still replays when a newer valid run exists. A historical
large pending gate with no matching capture proof cannot proceed to
replacement. The tests exercise absent proof, numeric JSON, a different
run ID, and a different fingerprint. Completed replacement replay is
read-only. Readiness refuses a neighboring string and matching unsafe
numeric JSON in the replacement event. Read-only purpose coverage and
held-out audits still use historical completed gates' saved relational
links.

All 119 focused service tests passed. One existing handoff audit
fixture needed a persisted ID to exercise the stricter validator.
The writer inventory's source digest changed for the run repository.
Its analysis digest and ownership classification matched the previous
review.

Fresh backend coverage passed with 64,922 tests, one existing skip,
and 89.34% statement coverage. Unchanged client inputs and a matching
report hash verified the previous client run's 7,751 passing tests
and 87.84% statement coverage. Preflight, policy checks, type checks,
lint, migration integrity, ESM checks, and the coverage ratchet passed.
The three runtime dependency audits reported zero known vulnerabilities.

## Follow-up

Trace the native intent IDs carried beside the verification run.
Capture and replacement still compare some of those IDs through
JavaScript numbers, and the final removal plan projects them
numerically. Qualify adjacent intent rows and their authority binding
in isolated PostgreSQL.
