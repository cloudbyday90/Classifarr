# Policy Candidate Correction Representative Review Handoff Outcome

## Status

Implemented on the unreleased branch. No release is created by this work.

## Delivered Components

- Added a narrow ESM presentation module that recognizes only the strict,
  server-derived `sustained_review_signal` status.
- Added a conditional Statistics card with a native router navigation link to
  the existing Command Center **Needs Attention** section.
- Added concise status-region feedback, a visible boundary explanation, and
  an accessible description for the link.
- Added unit and component coverage proving the one allowed handoff target,
  denial for every other status, the exact route, and the absence of buttons
  or mutation behavior.

## Decision Outcome

The operator has a concrete next step only when two fixed comparable 28-day
aggregate periods satisfy the established review criterion. The handoff does
not claim that current pending records are the historical cohort, select any
record, or carry analytic context into the URL. It simply makes the existing
operator-owned review workflow discoverable.

## Pull Request Check

GitHub Pull Requests MCP found no open pull requests for
`cloudbyday90/Classifarr` on 2026-08-30. There was therefore no random open
PR to implement locally; no closed, merged, or inferred pull request was
substituted.

## Validation

Focused client coverage passed in three files (12 tests). The full workspace
suite passed: 1,803 server tests and 3,854 client tests, with three intentional
skips. Project lint, typecheck, production build, Markdown lint, copyright,
ESM-import, test-mock-shape, and coverage-ratchet checks passed. The final
security diff scan is recorded in the commit handoff for this change.

## Next Item

Before adding any historical sampling, evaluate a separate representative
review-corpus design: define a deterministic sample frame, authorization
boundary, retention policy, redaction rules, and operator audit outcome. Do
not derive or reveal individual historical records from aggregate analytics
until that design has been evaluated and approved.
