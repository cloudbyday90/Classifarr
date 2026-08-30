# Policy Score Explanation Comparison Outcome

Status: Implemented (unreleased)

Date: 2026-08-30

## Delivered Outcome

The Command Center can now compare two or three operator-selected pending
score explanations. The comparison displays only deterministic score mechanics
and fixed evidence categories that were already visible in each item review.
It is local, read-only, and has no AI, policy, retry, learning, or routing
authority.

## Implementation

- `policyScoreExplanationComparison.js` is a pure ES module that validates and
  caps the content-free comparison projection.
- `PolicyScoreExplanationComparison.vue` is an isolated display component with
  semantic score summaries and an evidence-contribution table.
- `NeedsAttentionPanel.vue` owns ephemeral selection, concise status updates,
  and explicit focus after the operator asks to compare.

## Pull Request Check

The GitHub Pull Requests MCP query found no open pull requests for
`cloudbyday90/Classifarr` on 2026-08-30. No unrelated or closed pull request
was applied locally.

## Validation

Focused client coverage passed 5 files / 15 tests. The complete client suite
passed 257 files / 3,722 tests, and the server unit suite passed 900 suites /
25,901 tests.

The client production build, root lint and type-check commands, documentation
lint, ESM static-import and mock-shape checks, coverage ratchet, copyright
check, and `git diff --check` passed.

The completed security diff review covered all six changed source and test
files and found zero reportable findings. It verified the allow-listed local
projection, the absence of a new data-egress or action path, the bounded
selection state, upstream version validation, and identity/provider-output
containment. The final source scan `7b44ea5a-82cd-436b-bd45-835bfc852b36`
completed with 4,876,465 measured tokens and complete coverage.

## Next Item

After operators have reviewed a representative real-world sample, evaluate a
separate aggregate-only maintenance insight that summarizes evidence-category
patterns without storing or exposing the selected items. Do not add it until
the sample and its policy-maintenance decision criteria are defined.
