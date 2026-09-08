# Policy Purpose Lifecycle Provenance Receipt Outcome

## Implemented outcome

The administrator policy-purpose coverage response is now version 5 and carries
a read-only `policy_purpose_lifecycle_provenance_receipt.v1`. It summarizes the
most recent complete or bounded window of ordinary initial-intent
establishments and applied native-intent changes.

For each durable receipt, the server verifies its target revision before
reducing specialized purpose to retained, inferred-profile-only, or absent
counts. It returns only transition and aggregate count totals. If a revision is
missing or inconsistent, the result is explicitly unverifiable. If more than
100 lifecycle receipts exist, the response says that older history is omitted
and cannot claim a complete-history verification.

The purpose coverage screen now displays the receipt as an information-only
section. It has no button and the client independently rejects malformed or
unknown response data. Neither the UI nor the endpoint can create a cohort,
collect labels, change a policy, select media, call AI, or route media.

The new supporting database indexes make newest-first reads of established
initial records and applied change receipts efficient without changing the
stored authoring records.

## Validation

Validation completed on 2026-09-08:

- Focused server unit tests: 13 tests covering aggregate retention,
  profile-only purpose, absent or mismatched revisions, bounded truncation, SQL
  projection, service over-fetch, and the existing coverage contract.
- PostgreSQL integration and route tests: 10 tests covering the live coverage
  query and administrator route behavior.
- Focused client tests: 16 tests covering allow-list normalization,
  contradictory response rejection, display of fixed aggregate values, and the
  absence of mutation controls. Production client build also passed.
- Server security/test lint, server and client typechecks, static ESM import
  verification, migration validation, and documentation lint passed.
- Security diff scan: complete review of 14 changed executable files found no
  reportable findings. The Codex Security Access advisory connector was
  unavailable, so protected-output access could not be verified.
- The migration naming and schema-integrity check accepts the two partial
  lifecycle-read indexes.

The SQL tests assert that the query does not select rule values, actor IDs,
idempotency keys, command fingerprints, history, RAG, or AI data.

## Outcome against the platform goal

This reduces operator work by measuring normal authoring retention
automatically from durable records. It does not pretend that retained policy
purpose is semantic accuracy or authorization for automation. The next task is
to run the existing private eligibility audit again after normal authoring has
produced retained declared purpose. If it becomes eligible, capture one real
24–32-case cohort, obtain independent human labels, and use readiness plus
frozen-study preflight before considering review-only semantic
counter-evidence.
