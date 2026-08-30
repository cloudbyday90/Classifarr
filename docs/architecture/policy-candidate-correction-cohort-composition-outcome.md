# Policy Candidate Correction Cohort-Composition Outcome

## Status

Implemented locally and verified on the unreleased branch. No release is
created by this work.

## Delivered Components

- Added a pure ESM, fixed-bucket cohort-composition comparator. It calculates
  count-only shares and TVD using unrounded values, then presents rounded
  percentages.
- Added a modular report composer for fixed score-margin distributions and the
  fixed five-state distribution of every observed evidence source.
- Advanced Correction Analytics to response contract v4. The new aggregate-only
  `cohortComposition` field is derived from the existing current and preceding
  completed-window reports; it adds no query, migration, or retention path.
- Added a strict client presentation module that revalidates bucket membership,
  counts, shares, TVD, thresholds, dimension totals, and statuses before it
  renders local text.
- Added a semantic, read-only cohort context panel to Statistics. It reports
  the aggregate score-margin mix, each observed evidence-source mix, the
  visible fixed floor and TVD screen, and no maintenance controls.

## Decision Outcome

The selected stack is a descriptive aggregate TVD guard with a fixed minimum
of 20 observations per period and a fixed 20-percentage-point material-shift
screen. It is intentionally not a confidence interval, significance test,
causality claim, or learned drift model.

This gives a policy reviewer needed context for the recurring screenshots: a
persistent or review-worthy aggregate signal can now be read alongside whether
the score-margin and evidence-state cohorts actually stayed comparable. A
material shift tells the reviewer to inspect representative decisions before
attributing the signal to policy behavior. A comparable result does not prove
that the policy is correct or permit automatic routing.

## Pull Request Check

GitHub Pull Requests MCP found no open pull requests for
`cloudbyday90/Classifarr` on 2026-08-30. There was therefore no random open
PR to implement locally; no closed, merged, or inferred pull request was
substituted.

## Validation

Focused server validation passed 4 suites / 6 tests, covering the pure
comparison, report composition, response contract, and service windows.
Focused client validation passed 2 files / 6 tests, covering the strict report
projection, malformed-comparison rejection, and semantic card. Root lint,
server and client type checks, client production build, Markdown lint,
copyright, static-import, ESM mock-shape, coverage-ratchet, and whitespace
checks passed.

The completed security diff scan reviewed all 12 changed executable source and
test files and found zero reportable findings. It confirmed fixed aggregate
containment, strict client revalidation, safe interpolated rendering, and no
new query, authorization, retention, AI, RAG, policy, retry, learning, or
routing authority. Scan `c368e03d-f5eb-42d8-8533-2003988cbacb` completed with
complete coverage.

## Next Item

After enough **comparable** completed windows accumulate, evaluate a
longer-horizon, aggregate-only trend monitor for persistent correction signals.
It should use a fixed lookback, preserve completed-window boundaries, keep the
cohort-composition guard visible, and remain an advisory cue for representative
human review rather than an automated policy or routing mechanism.
