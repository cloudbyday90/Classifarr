# Frozen release rehearsal outcome

Date: 2026-10-01 local; final Docker observations completed on October 2 UTC.

## Decision

The rehearsal tooling is implemented, but **release acceptance is blocked**.
Do not publish a release, update live containers, relax claim deadlines or count
unexecuted deployment profiles as accepted. The separate
[design](frozen-release-rehearsal-design.md) records the alternatives, official
research and recommendation stack; the
[release audit](release-readiness-audit.md) records remaining release gates.

## Frozen candidate evidence

The clean source was `c1ff42daa2cc5c1921a59076c6451df146bdfe94`.
One no-cache production build produced local image ID
`sha256:bc9da4ba26963aefb9fd24068740e93da5b41b7248903f526b3ab7b92ccf335e`.
The fixed published baseline is `v0.48.4-beta`, verified by its existing
digest-bound provenance check. No release version was changed.

| Saved profile | Result from this frozen candidate |
| --- | --- |
| Standard | Fresh install passed; interrupted 600-item backfill evidence failed |
| Unraid-style | Not executed after the standard-profile failure |
| Custom IDs | Not executed after the standard-profile failure |

The failing assertion requires each originally interrupted task to have exactly
two starts and each originally pending task exactly one. Completion alone is not
enough to pass. The original sanitized receipt identified the assertion location
but did not retain its expected/observed values, so it cannot establish whether
this was a crash-checkpoint timing race or a production recovery defect.

The launcher wrote a blocked receipt under `.tmp/release-rehearsal/`. Its
`worktreeClean: false` and `candidateCleanup: not_verified` are conservative
incomplete-result defaults, not proof of dirty source or leaked resources.
The run started from a clean revision. Independent post-run checks found the
owned project absent and its image ID removed. The live Classifarr container
remained healthy and was not rebuilt or restarted.

Later diagnostics/documentation changes are not part of the image-tested source
above. They must not be presented as a new successful frozen rehearsal.

## Faults found and corrected in the test tooling

1. Explicitly provide the existing two-GiB memory budget; the previous launcher
   omitted a required Compose interpolation variable.
2. Gate both movie and TV fixture writes and observe all configured metadata
   worker slots before checkpointing. Do not assume worker ordering or change
   configured concurrency.
3. Measure database-pressure hold duration using a monotonic clock. An early
   timer wake must not count as the required five-second hold; retain the
   existing upper bound and bounded wake loop.
4. Replace the fixture's blocking advisory-lock wait with a nonblocking shared
   probe and bounded SQL sleep. The old injection correctly hit the production
   two-second lock timeout and created ordinary retries before the crash.
   Keep production lock, statement, transaction and visibility deadlines intact.
5. Retain guarded, bounded diagnostic markers for detached and foreground
   failures. The named synthetic start-count assertion now permits only bounded
   numeric expected/observed counts, never arbitrary assertion values, task
   identities, credentials or provider payloads.

The last change improves diagnosis; it does not waive or resolve the outstanding
frozen-run start-count discrepancy.

## Focused Reproduction

A subsequent isolated fresh-only repeat completed at approximately 02:50 UTC
on October 2. Its image was
`sha256:ef9dbcc43757cd3c532eb13e799caba3d0e6a266155bb0279d5cfd80fc024c93`.
It used the same runtime/fixture implementation as the failed frozen candidate;
it was not a new clean-source, three-profile acceptance run.

All 600 tasks completed, including five reclaimed interrupted tasks after their
original ten-minute leases. The observer recorded 605 starts, no start-count
differences, no duplicate completions and no early reclamation. Original IDs,
inventory and checkpoint were preserved, profiles became current, TV work
progressed before lease expiry, music was excluded and routing remained zero.
Observation took 580,643 ms. Owned resource cleanup passed.

This repeat did not reproduce the failure. A race between checkpoint verification
and the host-injected crash is a hypothesis, not an established production cause.
Do not merge separate runs into a passing matrix or loosen the exact-count check.
The next investigation should retain boundary-to-crash timing and bounded count
evidence so that this hypothesis can be tested directly.

## Validation

- Full backend unit run for `c1ff42da`: 1,615 suites, 49,403 passed tests and one
  existing skip.
- [Exact-source CI/CD](https://github.com/cloudbyday90/Classifarr/actions/runs/36953823331)
  passed build/tests, database tests, ordinary fresh/published upgrade acceptance
  and release readout. Same-source CodeQL, Gitleaks, OSV, Trivy, copyright and
  resource-capacity workflows passed. Tag-only publication jobs were skipped.
- A separate real fresh-install diagnostic before the frozen run completed all
  600 original movie/TV tasks, reclaimed five expired claims without early
  reclamation, recorded 605 total starts and no duplicate completions, preserved
  inventory/checkpoints, excluded music and produced no routing tasks.
  PostgreSQL 18.6 applied 312 migrations. This is useful component evidence,
  **not** a substitute for the failed frozen matrix.
- That diagnostic verified two CPUs, two GiB and 128 PIDs. Its six resource
  snapshots observed at most 344,145,920 memory bytes and 84 PIDs, with no OOM,
  memory-limit hit or PID denial in those observations. These are sampled values,
  not peaks, minimum requirements or a sustained workload result.
- Follow-up diagnostic and related drill tests passed: six suites, 216 tests.
  Server lint, static/import, mock-shape and server type checks passed. These
  checks are recorded separately from runtime acceptance; none can override the
  failed crash assertion. Scoped Markdown lint and whitespace checks also passed.

## PR and release scope

Both GitHub discovery and saved-login CLI checks returned no open pull requests
for this repository. No random open PR could be selected; no closed PR was
substituted and no PR was merged.

No production behavior, API, schema, dependency, UI or version changes are part
of this work. All new implementation code is ESM and uses small test-orchestration
modules. No live library data or unrelated Docker resources were changed.

## Next recommendation

First resolve the start-count discrepancy with explicit crash-boundary evidence
and rerun all three profiles on one clean image. Then perform a bounded sustained
soak and actual saved-template operator acceptance. Defer new runtime features,
compatibility removal and release publication until these results are accepted.

The next investigation should measure checkpoint verification, kill dispatch
and observed container exit on one monotonic timeline, preserving the strict
claim/count assertions. Only change the fault-injection coordination after those
observations distinguish a missed fixture window from a runtime defect.

From a clean committed checkout with Docker and baseline-verification credentials
available, the complete rerun is:

```sh
npm run test:local:frozen-release-rehearsal -- --no-cache
```

Each profile includes real ten-minute claim expiry on fresh and upgraded storage.
Allow for those waits; do not override production leases to accelerate acceptance.

This costs more time than relying on unit tests and health checks, but directly
tests upgrade/recovery claims and prevents unrelated passing runs from masking a
release blocker. Do not change production ownership rules to make a fixture pass.
