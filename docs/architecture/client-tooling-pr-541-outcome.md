# Client tooling PR #541: local implementation and outcome

Date: 2026-09-22. No PR merge, release or version bump.

## Selection and implementation

GitHub MCP returned open PRs #539, #541, #542 and #544. The first random draw
selected #544, which the immediately preceding commit already implemented. After
excluding that completed work, a uniform random draw from #539/#541/#542 selected
[PR #541](https://github.com/cloudbyday90/Classifarr/pull/541).

Applied its jsdom declaration change from `^30.0.1` to `^30.1.0`. Regenerated the
client lockfile with lifecycle scripts disabled. The allowed range resolved to
30.1.1, including its current compatible transitive dependencies. This is a
documented patch-level deviation from the PR's original 30.1.0 lockfile, not a
merge of its branch. Existing dependency overrides remain intact. Application
runtime dependencies and the deployed Node version are unchanged.

## Official research and tradeoffs

The PR metadata identified the official jsdom repository. Its release page was
read through web tools, following its links to the exact releases:

- [30.1.0](https://github.com/jsdom/jsdom/releases/tag/v30.1.0): DOM/selector
  correctness, lifecycle cleanup, and performance improvements.
- [30.1.1](https://github.com/jsdom/jsdom/releases/tag/v30.1.1): fixes focus/blur
  regressions introduced in 30.1.0, plus stylesheet, XML and selector behavior.

Recommendation: keep the PR's compatible range with the tested 30.1.1 lockfile.
The benefit is a more faithful test environment; the cost is dependency churn and
changed simulated DOM behavior that requires regression testing. Do not weaken
focus assertions or turn off per-file isolation to hide failures. jsdom tests do
not establish visual layout or accessibility conformance in a real browser.

## Validation

- Full client suite: 371 files / 5,173 tests passed.
- Client type checking and ESLint passed without configuration changes.
- Production build passed, followed by all seven production browser route/asset
  smoke checks.
- Dependency installation audit reported zero known vulnerabilities.

No test expectations, coverage baseline or CI workflow were changed for this PR.
It changes development tooling, not classification confidence. The separate
[organization-metadata design](classification-organization-metadata-design.md)
addresses the content-path defect.
