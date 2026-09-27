# Provider recovery and evaluation: local deployment outcome

Date: 2026-09-27. Local Compose only; no release or published image.

## Purpose and diagnosis

The repeated `automatic-source-pair-evaluation` report at 10:42:03 UTC was checked
against the database and running image. The stored cause was `evidence_budget`;
the container still ran revision `a93a1e34` and did not contain the lossless worker
transport. The next eligible attempt was 11:42:03 UTC. This established an
undeployed fix, not proof that the new transport had failed.

Deploy the previously validated recovery/transport build first, then the tested
external-ID diagnostic. Verify actual scheduled execution separately from basic
container health. Keep current cooldowns, evidence thresholds, memory admission,
provider budgets, routing configuration and persistent mounts unchanged.

## Controlled rollout

Before replacement, a custom-format PostgreSQL 18.6 dump was written to the
ignored local path `.tmp/pre-provider-recovery-20260927.dump`. Its 79,700,955 bytes
matched the container copy's SHA-256, and `pg_restore --list` accepted its catalog.
This is archive/readability verification, not a full restore rehearsal. The dump
contains private installation data and must not be committed or published.

The original image remains tagged `classifarr:pre-provider-recovery-20260927`.
The intermediate, already validated recovery build remains tagged
`classifarr:pre-identity-revalidation-20260927`. Keeping an image alone does not
reverse migrations or restore changed data; assess schema compatibility before
rollback and use a separately verified restore procedure if data restoration is
actually required. No production restore was performed.

The existing smart wrapper built clean revisions `9911a0a9` and then
`67ba437fd38252d6f8008c9ce23742c07ea106bb` using:

```text
node scripts/docker-compose-smart.mjs build --no-cache --require-provenance classifarr
node scripts/docker-compose-smart.mjs up -d --no-build --pull never --force-recreate --wait --wait-timeout 240 classifarr
```

The final local image ID is
`sha256:0f2af11e276995104db4388e29e7732c0f7cad24f8c3e5523cea6b267c3cc824`.
The running container reports revision `67ba437f`. Both `/app/data` and the media
bind mount are preserved. Other running containers were not changed. The first
rollout advanced the applied migration count from 286 to 287; the diagnostic adds
no further migration. At the initial post-upgrade read, there were 10 libraries,
6,696 inventory rows and 6,798 history rows. Normal background jobs remain enabled.

[Docker build documentation](https://docs.docker.com/reference/cli/docker/compose/build/)
defines `--no-cache`; it does not mean application-level caches are erased.
[Compose up documentation](https://docs.docker.com/reference/cli/docker/compose/up/)
documents mounted-volume preservation and health waiting.
[PostgreSQL pg_dump documentation](https://www.postgresql.org/docs/18/app-pgdump.html)
describes consistent database exports and custom archives. These URLs were
discovered with web search and opened during this task.

## Validation outcome

- Backend: 1,482 suites / 44,194 tests passed.
- PostgreSQL integration: 177 suites / 2,004 tests passed; one existing suite/test skipped.
- Frontend: 387 files / 5,426 tests passed; coverage ratchet passed for both workspaces.
- The final image passed a disposable fresh-database schema round-trip through all
  287 migrations. The temporary database/container was removed; live data was not used.
- The live container is healthy; `/health` returned 200, anonymous inventory
  access returned 401, and synthetic native bcrypt hash/compare passed.
- Both the new identity diagnostic and the earlier evaluation transport are present.
- No open PR was available on either GitHub MCP check. No PR merge, release tag,
  version bump or image publication was performed.

The first eligible minute tick ran at **11:43:00 UTC**. At the 11:45 UTC read,
the persisted evaluation and report were both `complete`: **300 samples**, split
equally between **150 movies and 150 TV items**, with a reported scoring duration
of **10,998 ms**. The failure count was zero, the failure code was null, and the
next check was scheduled for 11:48:20 UTC. No cooldown was reset, evaluation
forced, memory limit increased or admission threshold lowered. This verifies
normal scheduled recovery of the reported transport failure on this installation;
one successful run is not a sustained-load or classification-accuracy claim.

An earlier admission read saw approximately 729 MiB available, below the unchanged
1 GiB start requirement. Headroom was sufficient when the scheduled attempt ran.
The temporary observation does not establish a memory leak or justify bypassing
the guard. Longer-running memory and evaluation-duration trends remain useful.

No new scheduler error appeared in the ten-minute aggregate log read. Inventory
provider recovery records were still empty: existing cooldowns were preserved and
the reported movie 491851 was not forcibly retried. Its new external-ID diagnosis
and eventual recovery remain unverified against the live provider; fault-path
coverage comes from the synthetic provider and real PostgreSQL tests above.

## Recommendation stack

Use an exact committed image, private verified backup, retained rollback image,
mounted-data preservation, health/security smoke checks, then observed scheduled
recovery. This is slower than treating startup as completion, but distinguishes
an undeployed fix from a runtime regression without weakening safety guards.
For application recovery, retain the existing queue/lease and guarded PostgreSQL
write, add bounded external-ID evidence, and expose one actionable administrator
view next. See the [identity design](inventory-identity-revalidation-design.md)
and [implementation outcome](inventory-identity-revalidation-outcome.md).
