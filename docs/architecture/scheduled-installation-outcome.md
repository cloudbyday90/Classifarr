# Scheduled installation acceptance: outcome

Date: 2026-09-28. Design: [scheduler acceptance](scheduled-installation-design.md).

## Delivered

The installation harness now observes production startup scheduling instead of
using service calls as a substitute for scheduling evidence. It runs the same
synthetic movie/TV scenario after a fresh install and after the full published
upgrade/recovery path. Runtime acceptance version 2 requires both new checks;
fresh-only, missing-stage and manual-driver results cannot satisfy that contract.

The new fixture and observer are separate ESM modules. They preserve production
timers, worker logic, database locks, provider parsing and profile revision checks.
The local fresh-only option is explicitly partial evidence; full upgrade provenance
requirements and release gates remain unchanged.

An older direct-service upgrade fixture left its synthetic source disabled during
refill. Durable handoff correctly excludes disabled sources. The fixture now enables
that source while running in restore mode and disables it before normal restart.
A dedicated PostgreSQL test covers the real probe and its final disabled state.

The full integration run also exposed a pre-existing retention-test clock mismatch:
samples used a fixed transaction clock while history used wall time. Crossing a
five-minute boundary correctly expired one sample but made the fixture fail.
History now uses the same synthetic clock. Production expiration rules and the
expired/future-point assertions are unchanged; all 12 sampling tests passed.

## Validation

Two isolated fresh-install image runs passed all scheduler milestones, including
four supported items, ingestion/backfill deferral, matching profile revisions, music
exclusion and zero routing tasks. The final rebuilt image was
`sha256:82a342d6f0d6c81eb8134f587b92e2822c06434e61ebdf3d203f1c21317baecd`,
with PostgreSQL 18.6 and 296 migrations. Its result also passed the final shared
evidence validator. Owned containers, volume, network and image were removed and
cleanup verified; the live deployment was untouched.

- Backend unit coverage: 1,512 suites and 45,504 tests passed.
- PostgreSQL integration rerun: 190 suites and 2,181 tests passed. The existing
  opt-in AI-provider Compose suite/test was skipped by the normal integration
  command; it is not included in the passing count.
- Frontend coverage: 401 files and 5,648 tests passed.
- Final focused scheduler/receipt/transport checks: 5 suites and 84 tests passed.
- Coverage ratchet passed without changing its baseline.
- Lint, backend/frontend type checks, documentation lint, migration/schema
  checks, inventory ownership, dependency checks, ESM import/mock checks and
  the four existing policy maintenance gates passed.

The full published-upgrade run remains unverified locally: GitHub CLI provenance
verification returned HTTP 401. No credential extraction, authentication changes or
provenance bypass was attempted. Fresh-only results do not erase this limitation.

## Operational scope and next action

- No live container, persistent user data, routing settings or paid provider was used.
- This is scheduler and persistence evidence, not media placement accuracy or AI
  evaluation quality. The synthetic wire provider is Jellyfin, not a live account.
- [PR 552](pr-552-socket-runtime-adoption.md) is adopted locally without merging.
- No release is created; the changelog stays under Unreleased.

Immediate follow-up: restore GitHub CLI authentication and run the full runtime
installation acceptance command to verify the published upgrade. After that evidence
passes, extend this observer with a container kill between ingestion completion and
enqueue, requiring autonomous restart recovery without reseeding or calling workers.
That adds a distinct crash boundary instead of another diagnostic-only component.

Follow-up implemented: [scheduled backfill crash acceptance](scheduled-backfill-crash-outcome.md)
now verifies that boundary and advances the evidence contract to version 3. The
published-baseline authentication limitation remains separately visible.
