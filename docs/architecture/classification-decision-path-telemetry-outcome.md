# Classification decision-path telemetry outcome

## Delivered behavior

When one or more classifications are waiting, the Command Center now includes
**Recent decision paths** in the Queue Waiting panel. It shows four fixed,
aggregate counters for the last 24 hours:

- **AI was not needed** — a deterministic policy auto-route skipped AI.
- **AI classification attempted** — the persisted current decision path invoked
  AI.
- **AI unavailable — retry queued** — a safe no-route retry was recorded after
  a temporary AI availability failure.
- **Strict verification abstained** — candidate-bound verification did not
  confirm its candidate.

The card explicitly says that signals can overlap. It is context for the
operator, not a causal explanation for a currently queued task and not a
remediation control.

## Implementation outcome

- `classificationDecisionPathTelemetryRepository` makes one parameterized
  aggregate query over existing retained history and returns no source rows.
- `classificationDecisionPathTelemetryService` is an ESM factory with a
  five-second cache. It skips the database read when no classification is
  pending and fails open when the telemetry read is unavailable.
- `QueueReadModel` adds the projection beside the prior queue-admission
  diagnostics without changing queue totals or worker behaviour.
- `DecisionPathTelemetry.vue` accepts only the versioned, fixed-shape contract
  and renders no server-supplied markup, URL, or action.

## Local PR check

GitHub MCP searches on 2026-08-29 returned no open pull requests for
`cloudbyday90/Classifarr`. Therefore no unrelated pull-request change was
available to apply locally, and none was merged or released in this work.

## Verification outcome

Targeted service, repository, queue read-model, component, and Command Center
integration tests cover the new projection. The normal client and server test
suites plus lint, type, documentation, migration, ESM, build, coverage, and
security-diff gates are run before this work is committed.

## Transactional operational-test outcome

The integration suite now uses a single transaction-scoped PostgreSQL client
to exercise the real aggregate repository, telemetry service, and queue read
model together. It seeds synthetic policy-auto, verification-required, and
AI-unavailable retry records, measures only the four aggregate deltas, and
asserts that fixture metadata and titles do not enter the public telemetry
object. The test explicitly rolls the transaction back and verifies from a
separate connection that no fixture row persisted.

## CI schema-snapshot remediation

The failed [CI run 33248610569](https://github.com/cloudbyday90/Classifarr/actions/runs/33248610569)
stopped at the schema snapshot container check. The source schema was current;
the checked-in snapshot was emitted by PostgreSQL 18.4 while the CI image now
uses PostgreSQL 18.6, whose dump representation of one existing `CHECK`
constraint differs.

The local long-running development container is deliberately left unchanged:
it is an older image that does not contain the two latest migrations. Instead,
an isolated `classifarr:test` image from this checkout initialized a temporary
database, applied all migrations, and regenerated `database/schema/current.sql`.
The resulting change is limited to the generated timestamp and PostgreSQL 18.6
canonical constraint representation. No migration or runtime schema change was
introduced.

## Security outcome

- Only four aggregate counters leave the server; all identity-bearing and
  content-bearing fields are absent from both SQL selection and API payload.
- The response has no caller-controlled period, group-by key, or filter.
- The read path cannot make provider, worker, routing, retry, policy, or
  configuration changes.
- The browser rejects malformed or unknown contract data instead of displaying
  it.

## Release status

No release, tag, version update, PR merge, or provider operation is created by
this work.

## Next recommendation

Add an authenticated route-boundary acceptance test for
`GET /api/queue/live-stats` using `createQueueRouter` and a transaction-scoped
queue-service adapter. It should assert the same fixed telemetry contract at
the HTTP response boundary and reject an unauthenticated request, without
using committed fixture records or invoking an AI provider.
