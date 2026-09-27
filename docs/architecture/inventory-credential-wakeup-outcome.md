# Verified inventory credential wakeups: outcome

## Delivered

The [design](inventory-credential-wakeup-design.md) adds modular ESM services for
credential probing, persistence and orchestration, integrated before existing
queue refill. A new migration adds a private wakeup ledger, configuration-change
triggers, an authentication-case index and a per-item generation receipt. No
existing migration is edited, and the public settings response is unchanged.

After a corrected saved credential verifies, existing authentication cases become
eligible in batches of at most 100, with jitter and durable deduplication. Actual
metadata recovery still uses the ordinary queue, source checks and item leases.
No IDs, routing policies or library assignments are changed. 404s, rate-limited
items, malformed cases, music, inactive sources and active item leases do not
receive this cooldown override. Later source-conflict clearance or lease expiry
can make an older case eligible on a subsequent cursor pass.

Provider verification is not a permanent health guarantee. New failures after
verification keep ordinary retry policy; another credential/activation change
creates a new generation. An old in-flight failure completed after verification
also keeps ordinary cooldown because it cannot be safely attributed to the old
credential here. Environment-only TMDb credentials are outside this saved-config
workflow. Provider admission remains process-local, not a distributed quota.

The ledger retains aggregate release count/time and sanitized last probe category.
Logs distinguish a deferred verification from cases made eligible; neither means
backfill completed. Actual completion remains the existing recovery transition.

## Validation

Tests use synthetic credentials and disposable databases, not the running
application's private library data.

- Backend unit/regression coverage: 1,486 suites, 44,366 tests passed.
- Frontend coverage: 390 suites, 5,492 tests passed; no frontend code changed.
- Focused PostgreSQL integration: 39 tests passed across the new recovery suite
  and the two existing provider-configuration suites. The new suite exercises
  movie/TV backfill, restart, concurrency, rollback, credential changes during
  I/O, expired leases, source conflicts, malformed rows and durable throttling.
- Full PostgreSQL integration rerun: 179 suites and 2,022 tests passed;
  one existing suite/test remained skipped. All suites used isolated disposable
  databases; the final rerun used four workers.
- Real loopback HTTP tests cover valid configuration, malformed success, 429
  Retry-After and a compressed response exceeding the decoded-body limit.
- Coverage ratchet passed without changing its baseline. The generated frontend
  LCOV HTML index was copied to the ratchet's expected top-level report location;
  coverage values were not edited.
- Backend typecheck, test lint, security lint, dependency checks, ESM checks,
  copyright and migration checks passed. Security lint retains one pre-existing
  non-literal filesystem warning in the frozen-policy capture script.
- The schema snapshot was regenerated through the existing disposable-container
  tool. Migration application and a fresh-image snapshot consistency check passed.
  The separate test image also built the production frontend successfully.

The first full integration run exposed two older fixture resets that did not
include the new foreign-key-dependent ledger. Their explicit test-table lists
were updated; no foreign key or production safety condition was relaxed. An
earlier unit run overlapped snapshot generation and failed the schema freshness
checks; the completed snapshot and subsequent full unit run passed.

GitHub MCP returned no open pull requests in two checks on 2026-09-27, so there
was no open PR to randomly select or implement. No PR was merged. No release,
version bump, image publication or live-container deployment is included.

## Next bounded component

Measure recovery outcomes end to end: credential verified → case made eligible →
queue admitted → observation persisted, including elapsed time and remaining
blocker. Reuse durable case IDs and sanitized aggregate telemetry. This will
separate queue latency from provider/source failures before adding more retry
mechanisms, and provide an evidence-based tuning target without claiming accuracy.
