# Frozen release rehearsal design

Date: 2026-10-01. Scope: release validation, not publication or deployment.

## Problem and decision

The existing published-upgrade drill exercises real entrypoints, migrations,
restore interruption, scheduler recovery and movie/TV backfill. However, each
deployment invocation rebuilds a candidate, and the CI installation receipt
accepts only the standard profile. Separate successful runs do not prove that
one image passed all supported saved configurations.

Add a small ESM rehearsal launcher around the existing drill. Require a clean
source revision, build one disposable production image, and run the standard,
Community Apps-style and custom-ID profiles sequentially against its immutable
local image ID. Recheck source identity before and after every phase. Preserve
the existing standard CI receipt contract and share its evidence validation.

The bounded resource profile is mandatory for this rehearsal: 2 CPU, 2 GiB,
128 PIDs, plus the existing database-pressure and interrupted-backfill probes.
Each profile starts with isolated fresh storage, then separate baseline-created
storage. Only the image may change during its published-to-candidate upgrade.

## Safety and evidence

- No arbitrary image, Compose file, project, volume or live endpoint inputs.
- A random, collision-checked image tag belongs to the launcher; children borrow
  its content-addressed image and never delete it. Each drill owns only its own
  random containers, network and synthetic volume.
- Stop on the first failure, retain bounded partial evidence, and verify cleanup.
  Cleanup failure blocks acceptance. Never prune shared Docker resources.
- Reconstruct receipt fields from validated evidence; do not serialize raw
  commands, credentials, provider payloads, SQL or exception text.
- Detached crash and backlog probes publish guarded, size-bounded failure
  markers. Retain only fixed categories, SQLSTATE and internal code locations.
  Pressure injection verifies monotonic elapsed time across early timer wakes;
  the existing five-to-fifteen-second hold contract remains unchanged.
  Before capturing unfinished work, require every configured metadata worker to
  be parked at the fixture gate. Foreground probe failures use the same sanitized
  evidence contract as detached failures.
  The fixture uses a bounded SQL sleep selected by a nonblocking shared-lock
  probe, not an advisory-lock wait that would correctly trip the production
  two-second lock deadline. All production deadlines remain in force; a missed
  eight-second fixture window fails acceptance instead of repairing task state.
- A local image ID is not a published registry manifest digest or attestation.
  This rehearsal cannot authorize publication, certify a real Unraid host,
  establish live-provider accuracy or prove all historical backup formats.
- Recovery completion remains import plus metadata. Optional AI/embedding
  services must not hold that completion open. Music remains excluded.

## Alternatives and recommendation stack

| Option | Benefits | Costs / limits |
| --- | --- | --- |
| Separate existing drill runs | No new orchestration | Different builds; fragmented evidence |
| One frozen image, three profiles | Comparable evidence; one build; reused probes | Longer serial test; local platform only |
| New runtime recovery orchestrator | Could add capabilities | Unneeded scope and release regression risk |

Recommend the frozen-image rehearsal first, exact-commit CI/security acceptance
second, then an actual saved-template installation acceptance and a bounded soak.
Version selection, multiarchitecture digest smoke and publication remain a later,
explicit release decision. Do not add unrelated features to this candidate.

## Official research

Research checked on 2026-10-01 for the September 2026 release baseline. These are
live documentation pages, not archived September snapshots.

- [Docker build guidance](https://docs.docker.com/build/building/best-practices/)
  explains mutable tags and digest pinning. Inference: test one built image ID
  throughout the local matrix; offer a no-cache build without silently changing
  the Dockerfile's version-selected base image policy.
- [GitHub artifact attestation guidance](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations)
  binds provenance verification to artifacts. Keep baseline verification and
  distinguish local test evidence from published-image provenance.
- [Unraid Community Applications](https://docs.unraid.net/community-applications/)
  documents saved user templates. Existing deployments cannot depend on newly
  added Compose settings; test saved configurations unchanged.
- [PostgreSQL backup verification](https://www.postgresql.org/docs/18/app-pgverifybackup.html)
  explicitly recommends test restores beyond integrity checks. Retain the real
  restore/restart and application-state assertions already in the drill.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  requires programmatically determinable meaningful updates. No UI changes are
  needed here; keep accessibility acceptance separate from command-line receipts.
- [Node timer semantics](https://nodejs.org/download/release/v22.4.1/docs/api/timers.html)
  does not guarantee exact callback timing. Measure the hold with the monotonic
  clock instead of assuming a requested timer delay proves elapsed duration.
- PostgreSQL documents [lock and statement deadlines](https://www.postgresql.org/docs/18/runtime-config-client.html),
  [nonblocking shared advisory locks](https://www.postgresql.org/docs/18/functions-admin.html)
  and [observable wait events](https://www.postgresql.org/docs/18/monitoring-stats.html).
  Inference: distinguish injected slow processing from a lock-timeout test;
  observe the transaction-labelled sleep without disabling runtime safeguards.

## Validation contract

Test wrong/missing profiles, image mismatch, dirty/changed source, malformed or
partial evidence, build failure, cleanup failure, collision handling and output
redaction. Then run the real three-profile rehearsal from the committed clean
revision. Record that revision and image ID in the outcome document; later
documentation commits must not be misrepresented as the tested build.
