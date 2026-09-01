# AI Provider Capability Metrics Persistence Outcome

## Delivered Outcome

The capability-metrics upsert now explicitly casts its shared
`model_digest_mismatch_count` placeholder to `BIGINT` before comparing it to
zero. PostgreSQL can therefore use the parameter consistently both as the
table's `BIGINT` counter and as the timestamp condition.

The correction is intentionally limited to telemetry persistence. It does not
change provider selection, AI authority, strict-verification admission,
classification scores, policy routing, RAG retrieval, or stored media data.

## Regression Coverage

- The unit test guards the type cast and continues to require the conflict-safe
  parameterized upsert.
- The PostgreSQL integration test writes a mismatch observation followed by a
  normal observation. It verifies two requests, one mismatch, and a retained
  mismatch timestamp, then removes its synthetic row.
- Local Compose verification completed the same real repository write with a
  synthetic provider/model key and removed it afterward. Successful AI work
  no longer emits the misleading capability-metric warning.

## Operator Impact

Successful candidate adjudication and verification activity remains visible as
normal classification behavior. The metrics table now receives its aggregate
counter update without producing a warning that looks like an AI failure.

There is intentionally no new per-request UI notification. Such an
announcement would add noise while the user has not taken an action; W3C
status-message guidance is reserved for meaningful, user-visible changes.

## Pull-Request Outcome

No project PR could be implemented locally: GitHub reported zero open pull
requests at the time of the change. The commit contains only the independently
reviewed telemetry repair and its documentation/tests.

## Follow-Up

The next high-value item is an aggregate administrator-only health signal for
capability-metric persistence failures. It should remain status-only and
privacy-bounded, use the existing polite live-region convention, and never
influence AI, policy, RAG, classification, or routing authority.
