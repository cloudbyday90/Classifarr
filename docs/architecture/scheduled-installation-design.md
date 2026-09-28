# Scheduled installation acceptance

Date: 2026-09-28. Follow-up to the durable inventory/backfill handoff.

## Evidence gap

The existing installation harness boots real images, but its recovery probe calls
sync, refill, task processing and profile writers directly. That proves the
services can work, not that startup schedules them. HTTP health is also insufficient.

Extend that harness with the same observer-driven scenario on a fresh candidate
database and after the published-baseline upgrade and verified normal restart.
Keep the existing restore interruption and direct-service recovery checks.

## Scenario and safety

1. Boot the unmodified image entrypoint in the existing randomly named, internal
   Compose project. No host ports, live mounts, real credentials or privileged mode.
2. Seed only synthetic Jellyfin configuration and two active movie/TV libraries.
   A loopback HTTP fixture serves wire responses, including unsupported audio.
3. Observe an actual scheduled ingestion request held at the HTTP fixture. Assert
   ingestion readiness deferral and no metadata tasks for the new libraries.
4. Release ingestion while retaining the ordinary refill advisory lock. Observe
   completed scans, zero queued work and backfill readiness deferral.
5. Release the lock. Without invoking any writer service, wait for normal scheduled
   refill, queue completion and revision-matched profiles. Assert four supported
   items, music exclusion and no routing tasks.
6. Close the fixture and lock connection even on failure. Remove and verify only
   the harness-owned container, volume, network and candidate image.

Real production timers and cron schedules are retained; no forced retry times,
accelerated scheduler, writable test API or production configuration switch is added.
Polling is bounded. A timeout is failed evidence, not successful recovery.
No AI/model configuration is supplied; this measures orchestration, not AI quality.

## Evidence contract

Full installation acceptance requires both scheduler scenarios in addition to all
previous checks. Missing, partial or manual-service evidence cannot pass. Receipts
contain fixed statuses/counts, not credentials, provider payloads or raw errors.

The explicit local `--fresh-only` drill builds only the current checkout. Its result
is labelled `fresh-only`, has no published baseline, and cannot satisfy full runtime
installation acceptance. It does not bypass the mandatory provenance verification
for the separate full upgrade path. This permits useful local validation when
GitHub CLI credentials are unavailable without claiming upgrade success.

Run `node scripts/run-published-upgrade-drill.mjs --fresh-only` for that limited
local scenario. Run `node scripts/run-runtime-installation-acceptance.mjs` for
the full contract; CI retains its existing `--ci` clean-checkout requirement.

## Options, pros and cons

| Option | Benefits | Costs / limits | Decision |
| --- | --- | --- | --- |
| More direct service calls | Fast, deterministic unit isolation | Cannot detect missing startup wiring | Retain for narrower tests |
| Accelerate or replace the scheduler | Short execution | Tests a different timing/lifecycle path | Reject for acceptance |
| Real scheduler plus read-only outcome probes | Exercises wiring and durable progress together | Several minutes per scenario; synthetic source only | Implement |

Recommendation stack: unit contracts → PostgreSQL fault/restart tests → isolated
real-scheduler fresh installation → provenance-verified published upgrade → release
review. None of these alone establishes live-provider quality or routing accuracy.

## Official research

URLs discovered through connected GitHub/web tools and checked in September 2026:

- [Docker Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/)
  distinguishes running containers from dependency readiness. Application progress
  assertions are our additional acceptance requirement, not a Docker guarantee.
- [Testcontainers Node wait strategies](https://node.testcontainers.org/features/wait-strategies/)
  supports bounded startup and condition-specific waits. We retain bounded polling
  of actual database outcomes instead of treating an open port as completion.
- [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  calls for programmatically determinable status updates. This backend/test change
  adds no UI; its fixed stages can later support concise accessible progress text.

Measured results and remaining evidence limits are recorded in the separate
[outcome document](scheduled-installation-outcome.md).
