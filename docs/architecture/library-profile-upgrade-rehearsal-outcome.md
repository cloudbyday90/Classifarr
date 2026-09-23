# Library profile upgrade rehearsal — outcome

## Implemented and observed

The local disposable rehearsal loaded the pinned v0.48.4-beta schema and
applied **46** later migrations through the production migration runner. Two
synthetic libraries were seeded: an active movie library and an inactive TV
library, each with one item and an unverified legacy profile.

Upgrade enrollment captured both libraries and remained idempotent on replay.
The active library was queued; the inactive library stayed paused. A synthetic
`ETIMEDOUT` became durable retry work. Fresh worker/profile-service instances
then completed that retry. After TV activation, a new planner pass processed
the TV library. Both final statuses were `current`, with source, profile, and
acknowledged revisions equal to `3`, and the profiles reflected their synthetic
inventory genres. No live container, database, routing policy, or user data was
changed, and no release was created.

Focused migration/rehearsal unit tests passed (26 tests in two suites); the
complete backend unit phase passed 1,392 suites (40,826 tests). The runner was
repeated after adding its empty-target guard; the same integrated checks
passed. The complete PostgreSQL integration phase passed 148 suites (1,715
tests; one suite and one test skipped). Server lint, typecheck, development
and production dependency checks, Markdown lint, copyright, and ESM import
checks passed. The command was run locally rather than merged from a PR.

## Limits and follow-up

The synthetic corpus cannot reveal distribution-specific failures in a real
library, provider outages, scheduling contention, or container-image startup
behavior. The simulated restart reconstructs service instances while keeping
the disposable database; it is not a Docker container restart. The next
high-value item is the opt-in, read-only installation-specific upgrade
assessment described in the [design](library-profile-upgrade-rehearsal-design.md).

The [open GitHub PR collection](https://api.github.com/repos/cloudbyday90/Classifarr/pulls?state=open&per_page=100)
returned no open PRs on 2026-09-23. Therefore no PR was selected, applied, or
merged.
