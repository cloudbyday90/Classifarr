# Queue claim fencing — validation and deployment

## Scope

This implements the late-worker follow-up from
[unfinished-backfill restart validation](unfinished-backfill-restart-validation.md).
The [design decision](queue-claim-fencing-design.md) records the official sources,
ownership contract and alternatives. No release or version bump is included.

## Reproduced failure and repair

Real PostgreSQL tests held an original worker alive, expired only its fixture
lease, let another worker reclaim and finish, and then released the original
worker. All three pre-fix cases failed: late completion, retry and terminal failure
could overwrite the replacement's completed row.

Per-delivery tokens now fence completion, failure and release. The attempt budget
comes from the database row, shutdown releases only locally tracked claims, and
lease recovery no longer frees a still-running execution's local capacity.

## Validation results

| Check | Result |
| --- | --- |
| Focused unit regression | 7 suites, 226 tests passed |
| Targeted PostgreSQL regression | 3 suites, 27 tests passed |
| Fresh schema generation | Passed in an isolated container |
| Published schema replay | 76 migrations replayed, 298 total; catalog matched |
| Frontend CI coverage | 403 suites, 5,668 tests passed |
| Backend lint/typecheck and ESM checks | Passed |
| Ownership/dependency preflight | Passed after reviewed fingerprint refresh |
| Full backend unit coverage | 1,526 suites, 46,112 tests passed |
| Full PostgreSQL integration | 192 suites, 2,225 tests passed; one opt-in suite/test skipped |
| Coverage ratchet | Passed for backend and frontend |
| Migration naming and documentation lint | Passed |
| Clean-source installation acceptance | All 12 checks passed; owned resources cleaned up |
| Live no-cache Compose rebuild/recreate | Passed; healthy with preserved data and 298 migrations |

The overlap suite also checks missing tokens, legacy null-token rows, duplicate
acknowledgements, cancellation, late-but-still-current ownership, authoritative
retry budgets, shutdown isolation and an actual blocked-update PostgreSQL race.
Mocks do not substitute for the database ownership predicate.

Installation acceptance used clean revision
`d19ae43bac2368ed77a954356c76e964a1925ffa` and the digest-pinned published
`v0.48.4-beta` baseline. Fresh and upgraded databases reached 298 migrations.
The standard fresh/upgrade, scheduler, crash, interrupted-restore and restart
scenarios passed; the separate 600-item resource-budget scenario was not rerun
in this round. The opt-in provider-fault Compose integration suite remains skipped
in the default PostgreSQL run; no new skips were added.

The first full unit run reported only the outdated reviewed ownership fingerprint.
The first broad integration run exposed two older enrichment fixture files that
asserted the old acknowledgement signature; they now supply and verify the claim
token. Production ownership checks were not weakened to satisfy these fixtures.

## Deployment safety

The user authorized rebuilding and recreating the local Compose service without
cache after validation. Persistent volumes and routing settings must be retained.
A private custom-format PostgreSQL backup is kept under ignored `.tmp`, and the
previous image is tagged `classifarr:rollback-before-queue-fencing-20260928`.
The backup contains 79,981,745 bytes; `pg_restore --file=/dev/null` consumed it
successfully. This verifies archive readability, not a full restore rehearsal.

No legacy ingestion state is relabeled merely to remove a warning. Queue claim
ownership and a library's ingestion ownership are separate contracts. Old
pre-fencing binaries must be stopped before token-aware workers start.

## Live rebuild outcome

The build used clean revision `d19ae43bac2368ed77a954356c76e964a1925ffa`:

```sh
node scripts/docker-compose-smart.mjs build --no-cache --require-provenance classifarr
node scripts/docker-compose-smart.mjs up -d --no-build --no-deps --pull never --force-recreate --wait --wait-timeout 180 classifarr
```

This follows the documented [Compose build flags](https://docs.docker.com/reference/cli/docker/compose/build/)
and [recreate/health-wait behavior](https://docs.docker.com/reference/cli/docker/compose/up/).
The existing service stayed running during the build. Only Classifarr was then
recreated; its persistent mounts and settings were retained. No volume deletion,
image publication, release tag or version bump was performed.

The new image is
`sha256:8993f6dfa53f74b4fe05bf8d3e81df568f00612b9b8742f1be40c5cfb170c63d`.
Its revision label matches the tested source. Container `95557b17c965` started
at `2026-09-29T01:16:51.534Z`. During the 270-second observation ending at
`2026-09-29T01:21:22.362Z`:

| Observation | Result |
| --- | --- |
| Health and anonymous access | `/health` 200; anonymous `/api/libraries` 401 |
| Persistent data | 10 libraries, 6,696 inventory items, 6,802 history rows; unchanged |
| Schema and queue ownership | 298 migrations; claim column present; zero processing rows without a claim |
| Source-pair scheduled task | Five starts and five completions; zero failures |
| Runtime faults | Zero persisted error/fatal reports, restarts or OOM kills |
| Legacy ingestion ownership | Two warnings; libraries 4 and 5 remain blocked |
| TMDb observation unavailable | No recurrence during this observation window |

One post-start resource sample measured 408.9 MiB of the unchanged 2 GiB memory
limit and 5.50% Docker-reported CPU usage. CPU remains uncapped. This is a point
sample, not peak-load or leak evidence. All disposable test containers were gone;
the two unrelated application containers were left running unchanged.

The scheduler result demonstrates successful scheduled invocations, which may
include legitimate readiness deferrals; it does not prove evaluation accuracy.
Absence of a TMDb warning in a short sample does not prove that an upstream 404
has been repaired. The recurring ownership warnings were not hidden or marked
resolved, and no ownership-backfill implementation was started in this round.

## PR availability

GitHub MCP returned zero open PRs in `cloudbyday90/Classifarr` twice during this
round. No random open PR could be selected; no closed PR was substituted or merged.

## Recommendation stack and next component

Follow-up: the [reviewed legacy recovery design](legacy-ingestion-resume-design.md)
implements the selected next component without deploying or attesting for live
historical writers. Its validation is recorded separately.

Keep PostgreSQL, modular ESM acknowledgement services, atomic conditional writes,
bounded execution accounting and real-database concurrency tests. The benefit is
small, verifiable delivery fencing; the cost is a migration and explicit token
propagation. It does not provide exactly-once external actions.

The user selected **library-agnostic legacy ingestion ownership recovery and
backfill** as the next component after this round. Begin with read-only discovery
of unowned runs and active writers, then establish a safe ownership handoff before
resuming ingestion and checkpointed backfill. Preserve existing inventory until
a complete valid capture commits. Unknown ownership must remain explicit;
elapsed time, container health or a fabricated owner ID is not sufficient proof.
Cover Plex and Jellyfin, restart overlap, unavailable sources, fresh setup and
legacy records in the same contract. Do not start this component during deployment.

A read-only live baseline found two unowned ingestion histories (libraries 4 and
5) with foreign pending/running sync markers, while eight tracked ingestions were
complete. This identifies the next recovery cohort; it does not establish that an
unknown external writer has stopped.

Separately, enrichment persistence and provider side effects can precede queue
acknowledgement. Claim-fenced local persistence and cooperative cancellation
remain later boundaries, not guarantees of this change.
