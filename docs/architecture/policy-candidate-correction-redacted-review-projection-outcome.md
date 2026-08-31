# Policy Candidate Correction Redacted Review Projection Outcome

## Status

Implemented on the unreleased branch. No version, release, or tag is created
by this work.

## Delivered Component

- Added modular ESM contract, persistence, creation service, retention service,
  and route modules for an administrator-only redacted review projection.
- Added a purpose-fixed migration that persists snapshot metadata, fixed
  non-identifying sample rows, and append-only creation/view/expiry audit
  events. It has no history identifier or media-content column.
- Added server-owned completed 28-day sampling with a hard five-row cap per
  available period/margin/outcome stratum and a global 160-row cap.
- Added security controls: positive administrator actor validation, no-store
  responses, separate read/create rate limits, transaction-scoped creation,
  an advisory lock, strict allow lists, and scheduled expiry deletion.
- Added a self-loading Security Settings section with a concise status, one
  explicit creation action, expiry information, and an accessible native table
  for the fixed redacted fields.
- Updated the existing safeguard control state to indicate that the separate
  redacted snapshot is now available while source historic-record access
  remains false.

## Security Outcome

The component does not make `classification_history` browseable. Source IDs
are used only to order a server-owned random sample inside one SQL statement;
they are not returned or stored. Each retained item is limited to categorical
period, margin, outcome, and evidence-state data. It cannot call AI/RAG, read
or write policies, retry work, learn, route media, or receive a caller-selected
source record.

The snapshot's expiration is durable and cleanup deletes the snapshot and its
cascaded items in one transaction. The accompanying audit log is intentionally
content-minimized and append-only. The selected retention period applies when
the snapshot is created; a later acknowledgement creates a new control
revision and prevents the old revision's snapshot from being read.

## Open Pull Request Check

GitHub Pull Requests MCP returned zero open pull requests for
`cloudbyday90/Classifarr` on 2026-08-30. No random open PR was available to
implement locally; no merged or closed PR was substituted.

## Validation

Completed locally on 2026-08-30:

- Focused server contract, service, retention, route, and migration tests:
  7 suites / 20 tests passed.
- Focused client API and presentation tests: 3 files / 7 tests passed.
- Full workspace suite: 945 server suites / 26,793 server tests passed;
  275 client files / 3,885 client tests passed. The server integration phase
  also reported one existing skipped suite and test.
- `npm run typecheck`, `npm run lint:client`, `npm run lint:server:security`,
  `npm run lint:docs`, `npm run esm:check-static-imports`, and
  `npm run esm:check-test-mock-shapes` passed.
- Production client build passed, as did an authoritative fresh-container
  schema check against `classifarr:test`. The local Compose service was rebuilt
  without cache and recreated; startup applied migration
  `20260830_130000_add_policy_candidate_correction_review_projection.sql`.

## Next Item

The highest-value follow-up is an **offline evaluation report that aggregates
these redacted snapshots across completed periods**. It should compare outcome
rates by margin and evidence state with uncertainty bounds, support a manual
policy-change hypothesis, and remain read-only. It should not introduce
content-level history access or automatic policy/AI/RAG tuning.
