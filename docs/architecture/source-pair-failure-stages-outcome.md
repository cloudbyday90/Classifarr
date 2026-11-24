# Scheduled source-pair failure stages outcome

November 24, 2026. See the [design and recommendations](source-pair-failure-stages-design.md).

Scheduler error metadata now carries `failure.stage` on failed source-pair
evaluations observed by the worker. Stages distinguish
`advisory_lock`, `state_read`, `admission`, `snapshot_read`,
`quality_collection`, `evaluation`, `snapshot_recheck`, `publication`,
and `failure_record`. If failure recording itself rejects,
`failure.originStage` retains the preceding known stage. Both values come
from the exact failed execution and use fixed vocabulary.

The same log event and scheduler receipt remain in use. Durable failure
codes, backoff, SQL, and public status retain their existing behavior.
Replacement errors use the wrapper that actually rejected. Sibling evaluators
retain their existing thread call arguments. The additional fields contain no
raw causes, media identifiers, credentials, or SQL. A stage identifies a
failed operation and cannot reconstruct the cause of the original alert.

## Verification

- 235 focused tests cover phase attribution, nested snapshot rechecks,
  replacement errors, reason sanitization, cancellation and sibling thread
  arguments.
- 69 isolated PostgreSQL tests passed, including 40 controls for sibling
  evaluators, readiness cancellation, and admission. A real publication constraint failure
  rolled back the report, history and cursors. The same scheduled run wrote
  one error with `failure.stage: publication`, retained the existing failed
  receipt and durable cooldown, and later recovered through normal publication.
- Root, server and client npm audits each returned zero advisories.
- Full backend verification passed 64,690 tests across 1,958 suites with
  one test skipped. Coverage reached 89.33% on lines and statements, 86.93%
  on branches and 90.81% on functions. The ratchet used unchanged client
  inputs and verified client coverage report hashes.
- Lint, type checking, CI preflight, policy and import gates, Markdown lint,
  and staged secret scanning passed.

## Next recommended item

Replace source-pair failure classification's broad `budget` message match
with typed, allowlisted evidence-budget codes. The real rollback control
returned `publication` for an adjudication-budget constraint error that the
current classifier labeled `evidence_budget`. The stage already exposes the
distinction. Changing the durable classification merits its own verified
compatibility decision.
