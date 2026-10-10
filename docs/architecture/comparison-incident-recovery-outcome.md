# Comparison warning recovery outcome

Date: 2026-10-09. Scope: warning lifecycle only; no release or Unraid deployment.
See the [design, alternatives and research](comparison-incident-recovery-design.md).

## What the two reports showed

Both reports were genuine incomplete-vector warnings, not memory refusals. In
the retained logs, the local missing-description count reached zero at
22:16:01 UTC, followed by verified comparison recovery at 22:18:30. On Unraid,
the 37 missing descriptions reached zero at 21:46:05 UTC, followed by comparison
recovery at 21:48:20. The corresponding database/UI warnings remained open.
Those observations are separate from the earlier container shutdown incident.

The cause was an unconnected reporting lifecycle: the scheduler logged recovery
to the container log but discarded the warning UUID returned by persistence.
The error-log row therefore had no matching completion update.

## Implemented behavior

- Small ESM services own opaque configuration/model scopes, bounded episodes
  and exact conditional database resolution. The existing logger and UI remain
  the storage and presentation surfaces.
- New tracked warnings close only after `ready` or `revalidated` in the same
  observed scope. Original evidence remains intact; recovery has its own
  reference and timestamp. Manual resolutions are not overwritten.
- Initial and periodic callbacks share one in-flight promise through logging
  and resolution. Stop/replacement invalidates pending ownership. Database
  failures retain the exact IDs for another verified refresh, with one safe
  informational reference rather than a retry loop.
- Memory limits, vector completeness, backfill budgets, imports, routing and
  ownership safeguards are unchanged. No schema or client API change.

## Evidence

Initial focused tests: 52 passed across scope/tracker, scheduler and worker.
Isolated PostgreSQL checks: 12 passed across incident recovery and existing
failure-cause classification. The latter used a disposable migrated database,
not either installation's appdata. Actual logger persistence and scheduler
resolution were exercised together; foreign/legacy/manual records, unchanged
original evidence, lock timeout and ownership-loss rollback were verified.

Final backend unit run: 1,763 suites passed, 54,862 tests passed, one existing
platform-specific skip on Windows (425.992 seconds). Server typecheck, test and
security lint, both Knip checks, dependency tree, full server npm audit (zero
reported vulnerabilities), all 40 dependency-tooling tests, ownership inventory,
strict ESM checks, Markdown lint (2,051 files), copyright and staged secret scan
passed. No ownership baseline or scanner was relaxed.

The independent [PR 556 trial](pr-556-node-types-outcome.md) was rejected and
restored after compatibility failures; nothing was merged.

## Local image evaluation

Before replacement, the existing backup helper created a custom-format archive
under `.tmp/pre-memory-fingerprint-a64b6e28-cc03-409b-af44-5cb24dbd6587.dump`
(76,622,736 bytes), verified its checksum and archive listing, and retained the
old image under `classifarr:pre-memory-a64b6e28-cc03-409b-af44-5cb24dbd6587`.
The rollback image is
`sha256:c3e1afd39395c40454c3e4d4eae0ef17f969f73ffe36373b6bba9a8e4e5872c3`.
Docker Desktop could not copy the temporary mount directly; the existing helper
streams the generated binary backup and verifies its checksum instead.

The no-cache rebuild, health and isolated schema results follow after completion.

## Limits and recommendation

This does not retroactively resolve the two historical reports. Process-local
ownership deliberately leaves older, restarted, unscoped or overflow warnings
open. A success from another process or model is not treated as their recovery.
No production row was edited, no production container was restarted and the
shared provider was not changed.

Recommended stack: verified comparison publication → bounded correlated warning
episode → conditional resolution of owned UUIDs → existing resolved-log history.
This avoids broad log cleanup at the cost of conservative open records after a
restart. Next runtime item: design durable incident continuity across restarts,
including instance/configuration ownership and retention, before extending
automatic resolution to historical records.
