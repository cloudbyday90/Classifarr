# Queue witness task ID outcome

November 26, 2026. See the [design and tradeoffs](queue-witness-task-id-design.md).

The witness builder and read API now preserve exact queue task IDs through
PostgreSQL's BIGINT maximum. Safe task IDs retain their numeric v1 witness,
and larger IDs use the decimal-string v2 witness. The shared queue ID guard
serves the existing witness route and task actions. The reader checks the
requested and persisted task identities, the witness and saved fingerprint,
and the existing History binding. The database schema and retention rules
continue to govern both versions.

The queued sweep preserves the task ID in submission, lifecycle and witness
report fields. Polling requires the response and nested witness to identify
the submitted task and the two History IDs to agree. An unbound response
contributes no History row, aggregate counts or evaluation. A correctly
bound response can still arrive during the existing polling window.

## Verification

- A fixed pre-change v1 SHA-256 value matches the new builder's result. Tests
  also exercise the safe-integer boundary, PostgreSQL's BIGINT maximum, and
  rejected unsafe numeric inputs, alternate spellings and version swaps.
- The previous production persistence path withheld witnesses above the
  safe-integer limit. The isolated PostgreSQL and HTTP tests now round-trip
  adjacent large queue IDs from the classification writer. A valid witness
  copied to an adjacent row is rejected. Existing History ID and queue action
  regressions also passed.
- Loopback CLI tests exercise the requests and webhook paths. The requests
  run skips wrong envelope, wrong witness and mismatched History responses
  before recording and grading the correct evidence once. The webhook run
  with only a wrong-task witness produces no History or evaluated result.
  Webhook log IDs remain numeric in both reports.
- The 169 focused tests and 19 isolated PostgreSQL tests passed. Scoped
  authorization still allows the witness read and refuses queue mutations.
- The full local CI run passed with 64,769 backend tests, one existing skip,
  and 7,746 client tests. Fresh coverage passed the ratchet with 89.33% backend
  and 87.84% client statement coverage. Lint, documentation, type and ESM
  checks passed. Root, server and client dependency audits found no advisories.
- GitHub listed zero open pull requests, including Dependabot.

## Next item

Review the remaining safe-integer limits in the queue metadata check and
identity-repair workflow. Trace exact task IDs through preview, receipt,
retry and backfill binding before widening those controls. Carry the result
into the [UUIDv7 assessment](classification-uuidv7-readiness-outcome.md).
