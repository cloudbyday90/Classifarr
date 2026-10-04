# Selected database startup outcome

Date: 2026-10-04. See [design, tradeoffs and official sources](selected-database-startup-design.md).

## Delivered

A small ESM composition now revalidates durable selection inside the existing
supervisor's adoption phase. Cancellation is forwarded and checked before
database launch. Schema maintenance is mandatory before restricted runtime;
the existing supervisor retains monitoring and ordered shutdown responsibilities.

The disposable legacy-copy drill holds the journal lease across this lifecycle,
runs the actual schema maintenance command as the database OS identity, and
checks a committed write using a restricted-role runtime probe. A separate
process attempts the lease while runtime is alive and sends an actual SIGTERM;
the worker verifies the database stopped before leaving its lease scope. Another
startup and the existing read-before-write probe check persistence independently.

Ordinary startup, saved templates, permissions, fresh installs and live library
records remain unchanged. This is not production activation or a new background
daemon. The recovery skill kept unknown ownership blocked; the release-evidence
skill requires the final image to be tested separately from source-only checks.

## Validation

Results will be recorded after the focused checks, full backend unit run and
no-cache image rehearsal. No passed image or deployed upgrade is claimed yet.

## Remaining work

The saved GitHub CLI login returned no open Classifarr PRs on 2026-10-04, so no
random PR could be implemented. No PR merge or release is part of this work.

Next: a fixed-path production start/adopt adapter and capability-aware entrypoint
that preserve forced-non-root compatibility. Complete privileged maintenance and
database-enforced ingestion-writer admission before enabling unattended legacy
recovery. The source database must remain intact; unknown ownership must not be
silenced or replaced with fabricated owners. Recovery ends after import and
metadata backfill, not optional disabled AI work.

The tests use a synthetic PostgreSQL 18 legacy cluster and restricted SQL probe,
not the full application against a published old-image database. No physical
Unraid/Synology, power-loss durability or sustained resource-soak claim is made.
