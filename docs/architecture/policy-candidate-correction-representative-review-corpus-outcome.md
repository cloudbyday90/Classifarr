# Policy Candidate Correction Historical Review-Corpus Preflight Outcome

## Status

Implemented on the unreleased branch. No release or tag is created by this
work.

## Delivered Component

- Added a modular ESM server contract for historical review-corpus readiness.
- Composed it into the existing long-horizon aggregate response as contract
  v6, without changing the aggregate query or adding a record-level endpoint.
- Added strict browser validation that fails closed if the corpus preflight and
  verified long-horizon signal disagree.
- Added a concise, accessible Statistics disclosure explaining that historical
  records are not enabled and what safeguards a future corpus requires.
- Added server, client, and component coverage for the no-record-access
  invariant and malformed-contract rejection.

## Decision Outcome

The product now states the important distinction directly: a sustained
aggregate signal can prompt a review of current decisions, but it cannot imply
that a historical sample has been selected or may be exposed. The new contract
is a preparatory security control, not a data-access feature.

## Open Pull Request Check

GitHub Pull Requests MCP returned zero open pull requests for
`cloudbyday90/Classifarr` on 2026-08-30. No random PR could be selected or
implemented locally; no closed or merged change was substituted.

## Validation

Focused coverage passed: five server suites / 13 tests and five client files /
19 tests. The complete workspace suite passed: 936 server unit suites / 26,615
tests, 75 server integration suites / 868 tests with one intentional skip, and
271 client files / 3,860 tests. Lint, typecheck, production build, and Markdown
lint also passed. The final security diff review is recorded with the commit.

## Follow-up

The administrator-only configuration and append-only audit control plane is
now implemented. Its design and outcome are documented in
[Review-Corpus Control Plane Design](policy-candidate-correction-review-corpus-control-plane-design.md)
and
[Review-Corpus Control Plane Outcome](policy-candidate-correction-review-corpus-control-plane-outcome.md).
