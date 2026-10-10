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

Built with `docker-compose-smart.mjs build --no-cache --require-provenance` using
the existing local Compose override and AVX2 selection. Exact source revision:
`039bef517faf036c31d7462eb85cf32bc49c7120`. Docker image ID:
`sha256:3bdd05d25e3d9402afed7f674c61d2b0ed4aeb7ebbd49a65312a5fed2159ffaa`.
This outcome-only follow-up does not change its runtime source.

Only local `classifarr` was recreated, preserving its data and media mounts.
The candidate started at 2026-10-10 00:03:49 UTC (October 9 locally). At
00:04:23 and 00:05:30 UTC it reported healthy, HTTP 200, zero restarts and
`OOMKilled=false`. Description refresh reported `up_to_date` at 00:04:56 UTC.
One container-memory sample was 631.1 MiB of the unchanged 2 GiB limit; this is
a startup observation, not a sustained memory soak or leak conclusion.

The Linux-only directory-fsync, complete/exclusive-copy and unchanged-source
behavior skipped by Windows Jest passed using the candidate image's module in
a network-disabled, resource-bounded disposable container. No production data
was mounted. Its container was removed after the check.

After rebuilding, `check-schema-snapshot-container.mjs --dump` applied fresh
migrations and generated the schema from a separate disposable database.
`database/schema/current.sql` is unchanged. Verified removal of the schema
container and its temporary host data. A read-only local query confirmed that
the original historical warning remains unresolved and has no fabricated
incident/recovery metadata. These are local checks, not a production upgrade
rehearsal or a claim that remote CI has completed.

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
