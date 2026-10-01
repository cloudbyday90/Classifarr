# Image-index reconciliation outcome

## Implemented behavior

The platform now has the missing producer for its bounded image-index worker.
Configured image search can recover missing or invalid expected indexes after
ingestion/backfill is ready. The producer queues one fixed job; the worker
independently rechecks eligibility and records started attempts before DDL.

The durable episode survives queue retention and restarts. Three started attempts
and a one-hour cooldown bound repeated execution even when a process dies before
normal queue failure accounting. Invalid or mismatched definitions are not
silently treated as healthy. System health says “Unavailable indexes,” covering
missing and invalid indexes without changing the API shape.

See the [design](image-index-reconciliation-design.md) for admission conditions,
official research, options, residual risks and rollback considerations. The
security-hardening review favored a local extension of the existing boundary;
shared identity/authority is unchanged, not a completed privilege separation.

## Validation

Final source validation on 1 October 2026:

- Backend: 48,702 tests passed across 1,592 suites; one existing skip.
- Frontend: 5,795 tests passed across 411 suites; the final wording change was
  included in a fresh full coverage run and production build.
- Focused unit/service checks: 172 passed. Real PostgreSQL integration: 39 passed
  across reconciliation, index maintenance and inventory/backfill handoff suites.
- Coverage ratchet passed: backend 90.01% statements / 85.28% branches; frontend
  86.11% statements / 78.76% branches. All four new service modules have 100% line
  and function coverage. No baseline thresholds were lowered.
- Full lint, type checks, Markdown lint, CI preflight, four policy gates, static
  ESM import/mock checks and `git diff --check` passed. The ownership review gate
  retains all 490 unresolved paths; it does not authorize those paths.
- Migration replay and generated fresh-install schema consistency passed in
  disposable containers. The snapshot includes the new ledger and migration.
- The embedded isolation drill passed its eight core scenarios and standard
  UID 1000, custom UID 2345 and Unraid-style UID 99 profiles. Existing index
  worker checks include stale claims, restore quarantine, killed builds,
  invalid-index recovery and real queue completion. Stop verification measured
  3.419 s / 2.090 s / 2.736 s respectively on the small synthetic fixture; this
  is not a production capacity guarantee. Owned test resources were cleaned up.

The new automatic producer/budget path was tested against real PostgreSQL; the
existing supervised worker was separately exercised across deployment profiles.
No provider was contacted, paid tokens consumed, live database modified or
deployed container restarted. No large-table throughput claim is made.

## PR selection and delivery

Both GitHub MCP search and the saved GitHub CLI login returned zero open PRs for
`cloudbyday90/Classifarr` on 1 October 2026. No open PR could be randomly selected;
no closed PR was substituted and nothing was merged.

The change is under Unreleased. No release, tag or version bump is created.

## Recommendation and follow-up

Keep the existing fixed SQL, claim ownership and restore gates; layer durable
criteria-based admission on top; then expose the durable outcome read-only.
The benefit is automatic bounded recovery without template edits. The cost is
periodic database observation and explicit review when an episode cannot verify
recovery. An invalid index on a very large table may exceed today's execution
budget; that is a measurement question, not permission to retry forever.

Next: a read-only repair progress view with a clear waiting/running/verified/review
state, next action, attempts and next eligible time. Validate real index-build
progress on representative large fixtures before extending any time budget.
Do not fabricate percentages or add an automatic budget-reset button.
