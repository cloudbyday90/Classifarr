# Scheduled backfill crash acceptance

## Decision — 28 September 2026

Prove that normal startup resumes metadata backfill after ingestion commits but
before any enrichment task is queued. Extend the existing isolated installation
drill, not the production scheduler. Preserve movie/TV scope and music exclusion.

## Contract

1. Start the ordinary candidate image on a fresh, owned, internal-network volume.
2. Let its actual startup scheduler ingest two synthetic movie and two TV items.
   A session advisory lock holds back metadata refill while the probe verifies
   ingestion and backfill readiness deferrals.
3. Flush an exclusive, bounded checkpoint of committed run and inventory row IDs.
   Publish readiness only afterward; independently verify the lock remains held
   and no enrichment task exists.
4. Send SIGKILL only to the collision-checked disposable Compose app. Require
   exit 137 with no OOM kill, then recreate normal startup on the same volume.
5. Observe without reseeding, repairing rows, starting workers or restarting the
   fixture provider. Require unchanged run/row identities, exactly four completed
   enrichment tasks, acknowledged handoffs and current movie/TV profiles.

The fixture provider deliberately disappears with the killed container. Recovery
must use committed inventory, not a replacement scan. Waits are bounded. Cleanup
removes only resources owned by this random drill project, never local libraries.
The full acceptance receipt advances to version 3 and requires explicit crash
evidence. Fresh-only evidence still cannot claim published-upgrade acceptance.

## Official research and tradeoffs

Sources discovered and reviewed on 28 September 2026:

| Choice | Benefit | Cost / limitation |
| --- | --- | --- |
| Real container SIGKILL | Exercises Node and PostgreSQL recovery together | Slower than a mocked exception; not a host power-loss simulation |
| Session advisory-lock barrier | Deterministic pre-backfill boundary, released on owner loss | A test barrier, not a production availability policy |
| Persisted row/run evidence | Rejects duplicate work and replacement-scan false positives | More strict fixture assertions to maintain |
| Shared installation drill | Uses existing isolation, deadlines and cleanup | Full upgrade remains dependent on verified baseline provenance |

[PostgreSQL advisory locks](https://www.postgresql.org/docs/18/functions-admin.html)
release session locks on session termination, including ungraceful disconnection.
[Docker container kill](https://docs.docker.com/reference/cli/docker/container/kill/)
documents explicit signal delivery. These support testing process loss without
adding an application-specific unlock or manual repair path.

[W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
supports programmatically exposed status changes without moving focus. This change
adds no UI; fixed textual pass/failure classifications remain the operator output.
No accessibility-conformance claim is made for command-line evidence.

## Recommendation stack

1. Keep the existing durable handoff; require real crash evidence before release.
2. Keep published-image provenance fail-closed; report partial testing honestly.
3. Next, measure sustained resource headroom and task concurrency during a bounded
   mixed-library workload before tuning CPU, heap or process limits.

See the separate [outcome](scheduled-backfill-crash-outcome.md) and
[resource assessment](runtime-resource-assessment.md).
