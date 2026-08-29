# Classification decision-path telemetry design

## Decision

Project a short-lived, aggregate-only decision-path snapshot through the
existing queue live-stats response only while classification work is waiting.
The snapshot uses retained `classification_history` records; it creates no
item-level event store and does not change a classification, policy, worker,
provider, or retry.

It answers four operational questions for the rolling prior 24 hours:

1. How often did a deterministic policy route mean AI was not needed?
2. How often did the recorded decision path attempt AI classification?
3. How often did an AI-unavailable result remain safely queued for retry?
4. How often did strict candidate-bound verification abstain?

The counters are dimensions, not a mutually exclusive funnel. For example, a
strict-verification abstention is also an AI classification attempt.

## Architecture

```text
classification_history (existing retained outcomes)
                │
                ▼
classificationDecisionPathTelemetryRepository
  fixed aggregate query / no selected identities or content
                │
                ▼
classificationDecisionPathTelemetryService
  five-second cache / skipped when queue is empty / fail-open read
                │
                ▼
QueueReadModel → GET /api/queue/live-stats
                │
                ▼
useCommandCenterData → ProcessingPanel → DecisionPathTelemetry
```

The server reports only a version, a fixed window size, and four non-negative
integer counters. The browser validates that version and every value before it
renders fixed local copy. Unknown or malformed data is not displayed.

## Data contract

| Counter | Existing recorded fact | Meaning |
| --- | --- | --- |
| `deterministicPolicy` | Deterministic-AI-mode contract says `skip`, `invoked=false`, `policy_auto` | A valid policy auto-route did not need AI. |
| `aiClassificationAttempt` | Deterministic-AI-mode contract says `invoked=true` | The current path tried AI, including strict verification where applicable. |
| `aiUnavailableRetry` | `pending_retry` record using the AI-only `queued_for_retry` method | AI was temporarily unavailable and routing stayed safely deferred. |
| `strictVerificationAbstention` | Candidate-bound-verification contract records `abstained` | Strict verification did not confirm a candidate. |

Older records that predate these persisted contracts are intentionally not
backfilled or inferred. This avoids reinterpreting historical media data and
makes the displayed counts precise for the current contracts.

## Research and principles

Reviewed on 2026-08-29:

- [OpenTelemetry Metrics Data Model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/)
  describes pre-aggregated time-series data and spatial reaggregation for
  removing unwanted attributes. The design reads pre-existing outcomes and
  emits four fixed aggregates rather than raw event records.
- [OpenTelemetry Metrics SDK](https://opentelemetry.io/docs/specs/otel/metrics/sdk/)
  specifies aggregation cardinality limits. The response has no selectable
  labels or identity-bearing dimensions, so it cannot multiply time series by
  library, title, provider, model, or request.
- [OWASP API4:2023](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)
  identifies unbounded API work as a risk. The projection uses the existing
  `created_at` history index, a fixed 24-hour range, no client-selected range,
  only one aggregate row, and a five-second cache.
- [Vue Security](https://vuejs.org/guide/best-practices/security) recommends
  treating external data as untrusted and not rendering it as templates. The
  component uses normal interpolation for fixed local labels and no `v-html`,
  dynamic URL, or server-provided action.

## Options

| Option | Pros | Cons |
| --- | --- | --- |
| Client derives counts from live-feed rows | No server query | Incomplete, exposes item data to presentation code, and is not an aggregate source of truth. |
| New per-item telemetry table | Can record more detail | Duplicates retained history and increases privacy, retention, schema, and operational burden. |
| Export provider/model-labelled telemetry | Familiar dashboards | Creates high-cardinality operational disclosure and does not answer whether AI was required. |
| **Fixed aggregate projection from existing history** | Minimal data, clear semantics, bounded query, no migration, and no side effects | Older records without the current contracts are excluded; dimensions may overlap. |

## Recommended stack

1. Reuse existing persisted decision and verification contracts as the sole
   source of truth.
2. Query only four fixed `COUNT` filters within the last 24 hours.
3. Serve the result only through the existing queue live-stats payload, and
   only while classification work is pending.
4. Cache the read briefly and fail open if telemetry cannot be read, so queue
   status remains available.
5. Validate the narrow versioned contract again in the Vue component and
   render fixed text only.
6. Keep it advisory and read-only: use existing AI Settings and queue controls
   for any remediation; do not add an automatic retry or provider probe.

## Security properties and non-goals

- No model, provider, endpoint, secret, digest, title, library, policy name,
  prompt, response, raw error, classification ID, task ID, or event record is
  selected or returned.
- The range and dimensions are server-owned; callers cannot turn this endpoint
  into a history browser.
- The telemetry read neither calls AI nor changes routing, retries, policies,
  configuration, or worker state.
- This does not imply that an AI outage is the reason a currently queued item
  is waiting. Queue admission diagnostics remain the source for current state.

## Transactional operational acceptance

The integration test runs the repository, telemetry service, and queue read
model on one isolated PostgreSQL transaction client. It first reads a baseline
for the fixed window, inserts one synthetic policy-auto outcome, one synthetic
verification-required abstention, one synthetic AI-unavailable retry, and one
pending classification task, then reads the public queue projection through
the real service chain.

The assertion is delta-based, rather than assuming the integration database is
empty. It verifies an increment of one for each fixed counter, the narrow
versioned response shape, and the absence of fixture identity/content in the
serialized telemetry. The transaction is always rolled back; a separate pool
query proves no fixture record remained after the test.

This follows PostgreSQL's all-or-nothing transaction model and
[`ROLLBACK TO SAVEPOINT` semantics](https://www.postgresql.org/docs/current/sql-rollback-to.html),
while retaining the fixed-dimensional aggregate and bounded-read properties
recommended by the [OpenTelemetry Metrics SDK](https://opentelemetry.io/docs/specs/otel/metrics/sdk/)
and [OWASP API4:2023](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/).

### Operational-test options

| Option | Pros | Cons |
| --- | --- | --- |
| Mock only the repository/service boundary | Fast and isolated | Does not prove PostgreSQL JSON extraction, queue summary wiring, or public projection behavior. |
| Insert committed fixtures and clean them in test hooks | Can drive a full HTTP route | Cleanup can be skipped on interruption and leave synthetic records visible to later tests. |
| **Transaction-scoped real read path with rollback** | Exercises PostgreSQL, repository, service, and queue read model without persistent fixture state | Does not by itself prove HTTP serialization or middleware behavior. |

### Resulting test stack

1. Use the isolated integration database and one explicit transaction client.
2. Read the fixed-window aggregate baseline through the real service.
3. Seed only synthetic contract-shaped metadata and a pending classification
   task through that same client.
4. Read the projection through `QueueReadModel` and assert aggregate deltas,
   fixed keys, and the absence of fixture content.
5. Roll back unconditionally and verify cleanup from a separate connection.
6. Cover HTTP serialization and authentication separately with a route-boundary
   acceptance test; do not require a live AI provider for deterministic
   decision-path contract coverage.

## Authenticated route-boundary acceptance

`GET /api/queue/live-stats` is a read-only endpoint. The shared queue router
first applies `authenticateTokenOrApiKey` to every route, then invokes the live
stats reader; it deliberately does not apply the write-only permission guard to
this `GET`. The acceptance test mounts that same `createQueueRouter` factory,
proves an unauthenticated request receives `401` before the service adapter can
run, then makes an authenticated request against a transaction-scoped real
queue read model.

The test retains the earlier four-counter fixture so it validates both the
HTTP boundary and the aggregate-only response. It supplies a narrowly scoped
test authentication adapter, rather than a production credential or external
provider. This composes the router's middleware ordering with the production
read-model contract without turning integration tests into a network or secret
management dependency.

This reflects OWASP guidance to deny access by default and test predictable
function-level access controls
([API5:2023](https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/)),
and to treat authentication mechanisms as protected boundaries
([API2:2023](https://owasp.org/API-Security/editions/2023/en/0xa2-broken-authentication/)).
It also follows Express 5's router and middleware composition model
([routing](https://expressjs.com/en/5x/starter/basic-routing/),
[middleware](https://expressjs.com/en/5x/guide/writing-middleware/)).

### Route-test options

| Option | Pros | Cons |
| --- | --- | --- |
| Mock `queueService.getLiveStats` and bypass middleware | Very fast | Cannot prove route authentication ordering or aggregate serialization. |
| Use an actual production JWT/API key | Exercises credential validation | Couples the test to secrets, token configuration, and unrelated authentication internals. |
| **Mount the real router with a test authentication adapter and transaction-scoped read-model adapter** | Proves the security boundary, response path, PostgreSQL aggregate behavior, and cleanup without secrets or persistent records | Credential-verifier mechanics remain covered by their focused middleware tests. |

### Resulting route-test stack

1. Mount `createQueueRouter` with its normal router-level authentication slot.
2. Request the endpoint without a principal and assert `401` before the queue
   service adapter is called.
3. Seed synthetic aggregate outcomes inside one PostgreSQL transaction.
4. Request the same endpoint with a test-only authenticated principal and
   assert the fixed telemetry contract and aggregate deltas.
5. Assert the write authorization middleware is not used for this read-only
   route, then roll back and independently verify fixture removal.
