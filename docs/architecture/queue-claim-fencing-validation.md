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
| Full backend unit and PostgreSQL suites | Final runs pending |
| Clean-source installation acceptance and live no-cache rebuild | Pending |

The overlap suite also checks missing tokens, legacy null-token rows, duplicate
acknowledgements, cancellation, late-but-still-current ownership, authoritative
retry budgets, shutdown isolation and an actual blocked-update PostgreSQL race.
Mocks do not substitute for the database ownership predicate.

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

## PR availability

GitHub MCP returned zero open PRs in `cloudbyday90/Classifarr` twice during this
round. No random open PR could be selected; no closed PR was substituted or merged.

## Recommendation stack and next component

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

Separately, enrichment persistence and provider side effects can precede queue
acknowledgement. Claim-fenced local persistence and cooperative cancellation
remain later boundaries, not guarantees of this change.
