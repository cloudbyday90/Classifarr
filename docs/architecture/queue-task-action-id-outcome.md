# Queue task action ID outcome

November 26, 2026. See the [design and tradeoffs](queue-task-action-id-design.md).

Retry, dismiss, cancel, and manual classification now validate the complete
queue task ID in the client API, HTTP route, and service. Safe IDs continue
as numbers at the server, and larger IDs reach PostgreSQL as exact decimal
strings. An invalid request receives the existing `invalid_task_id` response
before a queue lookup or write.

The pending and failed list responses preserve their current ID representation.
The client uses the same canonical ID validation for the existing History
controls and for the new queue action guards. Authorization, destination library
selection, task state predicates, and manual routing replay protections retain
their existing behavior.

## Verification

- The previous retry, dismiss, and cancel paths reported success while leaving
  the selected large task unchanged. The fixed paths affect the selected task
  and preserve its adjacent row. Tests also exercise the PostgreSQL BIGINT
  maximum on all four actions and check that pending and failed lists carry
  those IDs as exact strings.
- The manual classification fixture verifies the routing call receives the
  selected task's metadata. A repeated request after completion receives 409
  without another routing call. The suite covers the real permission guard
  with a read-only principal, malformed and overflowing path selectors, and
  direct calls with an unsafe numeric ID.
- The 156 isolated PostgreSQL tests passed, including the queue action fixture
  and existing routing, retry-lineage, identity-repair, and recovery controls.
  The 86 focused server tests and 54 focused client tests passed.
- The client production build and 39 Chromium checks passed. They covered
  Command Center and History controls, the standard browser regression set,
  and the production policy asset smoke. Lint, documentation checks, and
  root, server and client dependency audits passed.
- The full local CI command passed with 64,752 backend tests, one existing
  skip, and 7,746 client tests. Fresh reports passed the coverage ratchet.
  Backend statement coverage was 89.33% and client statement coverage was
  87.84%. The preflight, type, and ESM checks also passed.
- GitHub listed zero open pull requests at intake, including Dependabot.

## Next item

Carry exact queue task IDs through witness creation, storage, and sweep
polling. Freeze a legacy v1 fingerprint as a compatibility fixture and verify
that a witness for a different queue task cannot satisfy polling. The queued
routing replay guard already validates exact IDs before locking. Keep the
distinct webhook log ID contract in the sweep. Use this evidence in the
[UUIDv7 assessment](classification-uuidv7-readiness-outcome.md).
