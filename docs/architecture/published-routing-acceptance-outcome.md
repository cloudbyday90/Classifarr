# Published-image routing acceptance: outcome

Date: 2026-10-03. No release, registry publication or live deployment performed.

## Implemented

- Modular ESM subject resolution, orchestration and strict receipt validation.
- Native AMD64/ARM64 tag-job matrix, required before GitHub release publication.
- Release evidence v3 with both exact-index routing receipts; historical v1/v2
  validation and provider-fault evidence remain intact.
- Workflow mutation tests reject missing architectures, permissive jobs,
  cross-run downloads and bypassed receipt inputs.
- Updated release-evidence AI skill with published-identity guidance and review
  cases. It influenced the explicit distinction between local evidence, native
  published evidence and permission to release. Metadata validation passed;
  this is not a claim of a separate model-driven skill benchmark.
- Reworked `.agent/workflows/release.md` into six stages, removed stale version
  claims and unsafe tag/deployment shortcuts, and added a regression test for
  its current commands, links and safety boundaries.

## Verification

All 270 tests in 14 focused suites passed, with no skips. Repository lint/type
checks, CI preflight, workflow
contracts, ESM checks, migration/schema-integrity checks and Markdown validation
passed. Actionlint passed with ShellCheck disabled (matching the existing local
validation setup); this does not claim a ShellCheck pass. No coverage baseline
was lowered. Full workspace coverage was not rerun for this tooling-only change.

Actual native AMD64 registry inspection verified the existing signed baseline:

- Source: `a0e417fd714919bb4ca30e20f9cd2380136ca74e`.
- GHCR index: `sha256:dc95fcdd80123b6bbf5b252fec286d9e81fbbc21a1030087c0a44abacd6a187f`.
- Child manifest: `sha256:83f57dcfd9fbeeaf0c08132cdd217ca964d3a0b5a7850639f22ecfb67a70a6dd`.
- Config: `sha256:9d683e87bbfd7bec2822dec20750f63291334065f2e2975f53bcce94bb5e31c1`.

The first local inspection exposed containerd's manifest-ID representation;
the resolver was corrected and retested rather than relaxing digest checks.
This older published image was used for identity verification only, not passed
off as a new routing candidate.

A separate real local routing rehearsal passed all eight phases, including
forced-crash recovery and provider repair. It observed two movie GETs, two TV
GETs, zero provider writes, preserved history and no legacy auto-enrollment.
Owned containers, volume and temporary build tags were cleaned up successfully.

- Fixed historical source: `eef03e57ffdd26d638f32f1593c424b438041ea2`.
- Baseline image: `sha256:9eee9254024bbaa83958472ff6698833c5329ed05ad2b1aba76999e2ddf71111`.
- Candidate image: `sha256:bbada4f425292febe14b137cc3327441717bf773468e0c80a9bf7528b0219a81`.
- Candidate was built from the working tree based on `0fc91e83`, with that
  revision label. The tree contained these uncommitted tooling changes; this
  is development evidence, not a clean-source or published-image receipt.

The existing main CI run [37132242076](https://github.com/cloudbyday90/Classifarr/actions/runs/37132242076)
passed for `0fc91e83`, including full build/test, database and installation jobs.
That result predates this change. Tag-only publication jobs were correctly
skipped and are not reported as tested by that run.

## Limits and next step

There were no open Classifarr PRs in either the GitHub MCP query or saved CLI
listing, so no random PR could be selected or implemented. No PR was merged.

Both new native published-candidate jobs require an explicitly authorized tag
build; they were not run end-to-end locally. ARM64, frozen saved-template matrix,
resource soak and a new full workspace coverage run remain unverified this
round. The fixture advances selected deadlines after checking persisted budgets;
it does not prove actual cooldown durations elapsed.

Recommendation stack:

1. Keep same-image source CI plus native published-digest routing gates. Benefit:
   tested artifact identity and recovery behavior; cost: extra CI build/run time.
2. Next, move `latest` promotion behind both published consumer gates, preserving
   the tested index bytes and verifying both registries. Currently GitHub release
   publication is gated, but `latest` is still written earlier by `docker-release`.
3. Run the complete authorized release evidence chain before release claims.
   Do not replace missing evidence with local success or edited receipts.

See the [design, alternatives and official sources](published-routing-acceptance-design.md).
