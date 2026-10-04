# Restricted-runtime authenticated routing outcome

Date: 2026-10-04. See the [design and tradeoffs](restricted-runtime-http-routing-design.md).
No release, PR merge, production identity cutover or Unraid change.

## Implemented

The existing guarded isolation drill now exercises real administrator setup,
ordinary-user login, role denial and CSRF denial through the normal HTTP server.
Denied classification requests leave history and provider counters unchanged.
One movie and one TV request use real deterministic policies and *arr adapters,
with exactly one add and two verification reads per destination. Session secrets
stay in memory; the synthetic provider is loopback-only and closed after use.

Three small ESM modules separate HTTP transport, synthetic SQL state and scenario
orchestration. A completion marker on synthetic history appears only after all
assertions and provider cleanup succeed, preventing a read observer from reporting
success while validation is still in flight. Subsequent receipt checks are read-only.

The exercise exposed a real replace-restore defect: `routed` history lost its
library reference because retention covered only `completed`. The new PostgreSQL
regression failed before the fix (one failed, seven passed), then passed after
protecting both successful states and their media-server parents. Obsolete *arr
links are still removed. There is no schema or history-status migration.

## Verification

- 375 focused unit tests across 22 suites passed on Node 24.21.0.
- 31 isolated PostgreSQL integration tests across three suites passed, including
  restore reference recovery, schema maintenance and queue maintenance handoff.
- Backend ESLint, TypeScript and Knip passed. Migration naming/snapshot checks,
  static-import checks, copyright and Markdown checks passed.
- Ownership review passed with 19 owned, 249 separately coordinated and 501
  unresolved paths. The changed restore service remains unresolved shared-writer
  debt; this change does not reclassify it as safe for automatic ingestion takeover.
- Initial image run passed HTTP routing and denials, then failed its restored
  history check on the pre-fix restore code. Its random resources were cleaned.

The no-cache Compose build used source
`f1b3bb823b80801ecead597e3f47f2af3004a4b4`, producing local Docker image
`sha256:05b1bf7d449193b46b3bda11b31d1810086b107d9be44a1cba0f5d8fe1a1180e`.
Its OCI revision label matches that commit; this is not a registry manifest or
signed provenance claim. Both build-time npm installs reported zero vulnerabilities.

All ten restricted-boundary phases passed on that exact image, including the
authenticated routing checks, restore/restart history comparison, maintenance
exclusion, queue budget denials and legacy identity-copy rehearsal. These are
disposable synthetic tests, not recovery operations on an existing installation.

After the build, the existing `dumpSchema` implementation ran against an isolated
PostgreSQL 18 instance from that image. Fresh load/dump/load/dump passed with zero
drift; `database/schema/current.sql` has no diff and no new migration was needed.
The temporary schema container was removed after its ownership check.

All three packaged compatibility profiles passed: UID 1000, custom UID 2345 and
Unraid-style UID 99. Checks included immutable image files, on-demand maintenance,
short host-stop deadlines, clean restarts and data retention. Injected Node failure,
database loss and forced host kill also passed their expected nonzero-exit/recovery
checks. A forced kill is not a clean shutdown. The random project's containers,
volumes and image aliases were removed and cleanup inventories verified empty;
the caller's image remains available.

## Local replacement

Only the local Compose `classifarr` service was recreated from the tested image.
Container `c9a37980e1889fafd04b820982898ca285ca37db7fe2d8adb17e7603fe4012cf`
started at `2026-10-04T21:12:56.466614191Z`. Health and database checks passed;
an unauthenticated library request returned 401. Versions: Node 24.21.0,
PostgreSQL 18.6, pgvector 0.8.7.

| Observation after the first background cycle | Result |
| --- | --- |
| Owned ingestion states | 8/8 complete and updated during this start |
| New container ERROR entries | 0 |
| Existing unknown-owner warnings | 2 |
| Memory sample | 392.1 MiB / 2 GiB, approximately 19% |
| CPU / PIDs / database sessions | 1.08% / 38 / five idle sessions |
| Restart count / OOM | 0 / false |

A sample during synchronization reached 67.03% CPU and 416.8 MiB, then settled.
No runaway process was observed; one supervisor and one application process were
present with normal PostgreSQL workers. This short observation is not a resource
soak. The local memory limit is enforced; CPU and PID limits remain unset in the
existing local Compose configuration. The disposable drill has separate explicit
CPU, memory and PID limits.

Library 4 retains two legacy running markers and library 5 retains six. Neither
had an ingestion-owner row. The rebuild does not resolve or suppress these two
`legacy_owner_unknown` warnings or justify fabricating owners. Local and Unraid
databases remain separate even though both use Plex. No Unraid operation occurred.

The prior local image is retained as
`classifarr-local-rollback:before-http-routing`, pointing to
`sha256:af01f8fbb16b5ab47b40b53209c9f9d76aaa85d55fec3943be30ca1f5f91ee4a`.
Retention is not a tested previous-image rollback. Other running containers were
untouched. These results cover the listed local checks, not the full repository
test matrix or remote CI. The outcome-only commit changes no tested runtime source.

## Recommendation stack

1. Keep authenticated routing in the restricted-runtime drill. It found a real
   history-loss defect; the tradeoff is a longer disposable test.
2. Next cover interrupted/uncertain provider adds under the restricted identity.
   Prove restart never repeats an ambiguous add before considering production cutover.
3. Finish remaining privileged-adapter, saved-template and rollback evidence before
   changing production identities. Ordinary DML and synthetic transport do not prove
   execute-only ingestion fencing, live-provider compatibility or TLS behavior.

Both open-PR enumerations returned no PRs, so there was none to select or implement.
The recovery and release-evidence skills kept the fixture isolated and the ownership
review explicit. Legacy ingestion warnings remain a separate, fenced recovery task.
