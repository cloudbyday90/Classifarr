# AI Provider Capability Metrics Failure Category Coverage Outcome

## Delivered Outcome

AI Settings now automatically loads completed-window safe-category coverage
only when the existing rolling capability-metrics health aggregate identifies an
active persistence warning. It compares the three most recent completed UTC
days using fixed counts and a count-derived percentage.

The panel answers a narrow question: did a completed day’s retained warnings
carry the new safe metadata contract? It does not diagnose the database,
interpret raw logs, test an AI provider, or change any runtime decision.

## Design And Security Outcome

- The report is a separate ESM repository, service, and route rather than an
  expansion of the health singleton or a client-side log calculation.
- The endpoint is administrator-only, parameter-free, rate-limited, and sends
  `Cache-Control: no-store`.
- It receives three adjacent server-owned completed UTC-day periods and binds
  only fixed reason, stage, and category values into the aggregate query.
- It returns no provider, model, media, policy, RAG, endpoint, raw SQLSTATE,
  error text, stack, or individual record identifier.
- The client ignores server prose, recomputes percentages from decimal counts,
  accepts exactly the fixed periods, and renders an unavailable state for an
  incoherent report.
- The existing health summary owns the live status announcement. This panel
  updates automatically without focus changes or duplicate announcements.

## Validation

- Focused ESM-aware server tests passed: 14 unit tests and 2 PostgreSQL
  integration tests, including fixed-window validation and administrator route
  enforcement.
- Focused client presentation, component, API, and AI Settings tests passed:
  52 tests.
- Full workspace tests passed: 1,001 server unit suites / 27,896 tests; 80
  server integration suites / 873 tests, with one existing skipped test; and
  304 client files / 4,121 tests.
- Server/client linting, TypeScript checks, migration integrity, ESM static
  import and test mock-shape checks, documentation linting, and the production
  client build all passed.
- Local Compose rebuilt with `--no-cache`, recreated with
  `--force-recreate --wait`, and reached a healthy state. The new endpoint
  returned `401` without authentication, confirming its protected boundary.

## Pull-Request Outcome

The public [Classifarr pull-request listing](https://github.com/cloudbyday90/Classifarr/pulls)
reported zero open pull requests when checked. No unrelated or invented pull
request was transplanted locally.

## Follow-Up Outcome

The bounded completed-window warning-recency follow-up is now delivered; see
[AI Provider Capability Metrics Failure Recency
Design](ai-provider-capability-metrics-failure-recency-design.md) and [AI
Provider Capability Metrics Failure Recency
Outcome](ai-provider-capability-metrics-failure-recency-outcome.md).
