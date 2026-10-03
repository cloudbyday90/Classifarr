# Interrupted-restore CI investigation outcome

Date: 2026-10-03. Started on clean `main` at
`b85d479530e76018d771ab6b9c13fe101c2f685c`. No release, version bump, branch,
live recovery or deployment. See the [design and sources](restore-ci-diagnostics-design.md).

## Findings and implemented fix

The earlier [failed installation job](https://github.com/cloudbyday90/Classifarr/actions/runs/37142677429/job/111260170320)
exited during `normal_rejection` after the deliberate restore interruption. Its
container exited 1, was not OOM-killed and had no recognized startup signal.
The downloaded receipt marked acceptance blocked but omitted workflow identity
and candidate image ID. The separate sanitized failure file was not uploaded.
The available evidence cannot identify that failure's root cause or recover its
exact candidate image. A newer local build is not the missing CI artifact.

The subsequent [installation job](https://github.com/cloudbyday90/Classifarr/actions/runs/37143837935/job/111263612784)
passed on the starting commit; that entire CI run subsequently completed
successfully, including database tests, build/test and release acceptance readout.
Release-only jobs were skipped. A local standard-profile rehearsal also passed
all 12 upgrade/recovery checks before this change. Neither result proves the
older intermittent failure fixed.

This patch addresses the verified evidence gap:

- A small ESM parser retains bounded, exact-vocabulary database/supervisor
  events from stdout and stderr, without private fields or inferred chronology.
- Failure files retain the validated candidate image ID, requested image role,
  mode and phase even if Docker can no longer locate the failed container.
- Verified CI run/attempt identity survives in blocked acceptance receipts.
- CI uploads generated failure files separately for 14 days. The acceptance
  artifact layout, read-only job permissions and strict release gate stay intact.
- Expected restore rejection still requires exit 1 and the restore-specific
  message. A supervisor event, missing message or unrelated crash cannot pass.

## Verification

Pinned tools: Node 24.21.0 and npm 12.2.0. No dependency or lockfile changed.

- New tests failed before the fix: failed receipts lost workflow identity;
  unavailable containers lost all diagnostics; tested image identity was absent.
- Focused recovery/diagnostic tests: **9 suites, 262 tests passed**, no skips.
  Broader overlapping container/workflow run: **15 suites, 340 tests passed**,
  no skips. These counts overlap; they are not additive.
- Backend full lint and typecheck passed. Installation, publication, provenance
  and release-installation workflow contract checks passed. Both Knip modes passed.
- Ownership-drift check passed without manifest changes. Its existing
  `productionCompatible: false` and unresolved classifications remain visible;
  this static result does not authorize any legacy writer.
- Static-import, npm CLI flag, copyright and Markdown checks passed.
- Staged Gitleaks 8.30.0 scan passed with no findings; no scanner exclusion added.
- Real Docker stdout/stderr fixtures passed using synthetic lifecycle events.
  Each ran with no network, read-only filesystem, no capabilities, a 1 CPU /
  128 MiB / 64 PID limit, and was removed with its anonymous volumes. These
  parser checks intentionally override the entrypoint; they are not startup proof.

The pre-change standard rehearsal used local image
`sha256:166c364d663b3f96e7e7e4a8e660d0bae189d9c4361b9f15b79ba1d715b9afb4`.
It verified published baseline provenance, fresh setup, scheduler/backfill crash
recovery, persisted migrations, interrupted restore, normal refusal, rollback,
explicit verified retry, movie/TV handoff and restart. Owned-resource cleanup
passed. That profile limits memory to 2 GiB but does not impose CPU/PID limits.

An initial extended resource-profile attempt used image
`sha256:b769fdf8282c7273378d035152f07e46a3624c8817dfc8d7cbe58a5f6cde57aa`.
It passed the fresh-install pressure/restart and 600-item backlog portion,
including actual ten-minute lease expiry. At `normal_rejection`, an extra local
observer failed because its Compose lookup omitted the fixture environment.
This was a verification-harness error, not a reproduced application failure.
The saved diagnostic correctly recorded PostgreSQL ready, application exit,
restore-specific rejection on stderr, exit 1 and no OOM. Cleanup completed;
container, volume and network absence was checked independently afterward.

The observer was corrected to pass the exact fixture environment. The final
rerun uses all standard CI upgrade scenarios plus the existing 2 CPU / 2 GiB /
128 PID Compose overlay. It does not claim the extended upgraded 600-item
resource-profile case, which was not reached in the initial attempt. No scenario
assertion, recovery policy or deadline was changed.

The corrected standard-scenario rehearsal **passed all 12 checks** and cleanup.
The observer also verified the actual restore refusal's database-ready and
supervisor/application-exit events, plus the stderr admission signal. Docker
inspection confirmed the configured CPU, memory and PID limits. The saved
deployment digest stayed unchanged between baseline and candidate.

- Final candidate image ID:
  `sha256:a83500883159304d57e73e9b155ca030381ed7ce09b0d841fd5344e4719e3540`.
- Published baseline: `v0.48.4-beta`, source
  `a0e417fd714919bb4ca30e20f9cd2380136ca74e`, verified by the existing attestation gate.
- Baseline digest:
  `sha256:dc95fcdd80123b6bbf5b252fec286d9e81fbbc21a1030087c0a44abacd6a187f`.
- Database: PostgreSQL 18.6; migrations 222 on the published baseline and 315 on
  the candidate and fresh install.
- Both scheduler runs: committed ingestion, metadata backfill and current
  profiles; music excluded and routing tasks zero.

The candidates were local builds from the starting revision plus this working
tree, not clean CI receipts or signed published candidates. Test-only edits and
documentation were finalized separately; no application runtime logic changed.

The image exercise uses the published-upgrade runner, not the full CI
installation-plus-routing acceptance wrapper. A new same-image routing rehearsal,
full backend/frontend suites, coverage ratchet, native ARM/NAS execution,
live providers and browser/WCAG testing are not claimed in this scope. No raw
PostgreSQL log, environment, private error or provider payload is uploaded.
The new failure-artifact step needs a future failing CI scenario to demonstrate
hosted upload; its configuration and rejection boundaries are tested locally.

## PR availability

GitHub MCP and the saved-login GitHub CLI returned no open Classifarr PRs. A
second CLI check also returned an empty list. No random selection was possible;
no closed or unrelated upstream PR was substituted and nothing was merged.

## Recommendation stack

The subsequent Testcontainers review and current-CI comparison are recorded in
the [dependency-update outcome](../testcontainers-refresh-outcome.md).

1. Keep strict restore admission and evaluate the new commit's CI. If the
   failure recurs, use its same-run diagnostic artifact to reproduce the cause;
   do not retry away the error or accept an arbitrary exit-1 container.
2. Update `@testcontainers/postgresql` 12.1.0 to 12.2.0 in a separate tested batch.
   The registry lists 12.2.0 and its matching core dependency. The official
   [12.2.0 release notes](https://github.com/testcontainers/testcontainers-node/releases/tag/v12.2.0)
   include log-stream disposal and tag-plus-digest reference fixes. These are
   useful test-infrastructure improvements, not a diagnosis of the restore issue.
   Review lockfile/native dependencies and run real PostgreSQL tests before adoption.
3. Review Supertest 7.3.0 to 7.3.1 and Knip 6.38.0 to 6.39.0 afterward. These
   versions were confirmed through `npm outdated` and registry metadata, not yet
   implemented or fully evaluated. Keep Node typings on 24; the registry's
   latest 26.x major does not match this runtime. Keep Vue TypeScript 7 separate.

The recovery/release-evidence skills kept runtime safety unchanged and prevented
passing local results from being presented as proof about an unavailable CI
image. The dependency-update skill kept the next package review separate.
Benefit: actionable, private-by-default evidence. Cost: maintained allowlists and
limited diagnostic history. This is preferable to speculative recovery changes.
