# AI Provider Capability Metrics Failure Breakdown Outcome

## Delivered Outcome

AI Settings now automatically retrieves a compact diagnostic breakdown only
when the existing rolling health aggregate reports active capability-metric
persistence warnings. The breakdown separates the fixed metric-write stage
from a bounded database-condition category while keeping the count view behind
a native user-controlled disclosure.

New persistence warnings retain only the fixed reason code, stage, and SQLSTATE
class category. They no longer persist provider, model, authority mode, raw
exception text, or stack trace through this logging path.

Historic warning records remain visible in the existing aggregate count. They
are reported as uncategorized until new safe metadata is present; the system
does not inspect their free-form diagnostic text to manufacture a category.

## Security And Accessibility Outcome

- The fixed endpoint is administrator-only, rate-limited, parameter-free, and
  returns `Cache-Control: no-store`.
- The client ignores server labels, messages, unknown categories, raw SQLSTATEs,
  and incoherent count contracts.
- The component carries no additional live region because the parent health
  status already announces meaningful warning-state changes. Its category
  counts are exposed through native `<details>` / `<summary>` controls.
- The breakdown has no AI-provider, policy, RAG, classification, retry, or
  routing authority.

## Validation

- Focused client presentation, component, API, settings-view, server category,
  repository, service, and route tests passed.
- A real PostgreSQL integration test passed, proving safe category aggregation
  and legacy uncategorized handling.
- Full workspace validation passed: 997 server unit suites / 27,824 tests; 79
  server integration suites / 872 tests, with one existing skipped suite/test;
  and 302 client files / 4,104 tests.
- Type checks, server/client linting, documentation linting, migration
  integrity, ESM static-import checks, and the production client build passed.
- Local Compose was rebuilt with `--no-cache`, recreated with
  `--force-recreate --wait`, and reached a healthy database-connected state.
  The new aggregate endpoint returned `401` without authentication.

## Pull-Request Outcome

The public [Classifarr pull-request listing](https://github.com/cloudbyday90/Classifarr/pulls)
reported zero open pull requests when checked, so no open PR could be applied
locally without inventing one.

## Follow-Up Outcome

The recommended completed-window safe-category coverage signal has now been
implemented. See [AI Provider Capability Metrics Failure Category Coverage
Design](ai-provider-capability-metrics-failure-category-coverage-design.md) and
[Outcome](ai-provider-capability-metrics-failure-category-coverage-outcome.md).
