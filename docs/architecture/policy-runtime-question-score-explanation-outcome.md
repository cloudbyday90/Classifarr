# Policy Runtime-Question Score Explanation Outcome

Status: Implemented (unreleased)

Date: 2026-08-30

## Delivered Outcome

Pending classification review now includes a collapsed **How this policy score
was calculated** disclosure whenever the persisted policy candidate has a
valid deterministic breakdown. It explains the score's position relative to
confirmation and automatic thresholds, its contributing evidence categories,
weighted base score, corroboration adjustment, and any evidence-safety
calibration.

The disclosure explicitly states that the number is neither a probability nor
an AI decision, and that it cannot bypass routing safeguards.

## Implementation

- `policyRuntimeQuestionScoreExplanation.mjs` is a standalone pure ES module
  that projects the fixed, bounded score-explanation contract.
- `policyRuntimeQuestionDecisionPresentation.mjs` composes the projection only
  from the server-selected policy candidate; it does not add a route or action.
- `policyQuestionDecisionPresentation.js` rejects unknown or malformed
  explanation fields before the Vue component can render them.
- `PendingQuestionRecommendationActions.vue` uses a native disclosure widget
  and client-owned fixed copy to keep the score mechanics understandable
  without turning the card into an interrupting status announcement.
- Server and client unit tests cover formula mechanics, calibration, no raw
  data leakage, contract validation, unknown source rejection, and rendered
  operator guidance.

## Open Pull Request Check

The GitHub Pull Requests MCP query returned zero open pull requests for
`cloudbyday90/Classifarr` on 2026-08-30. No PR was implemented locally because
substituting a closed or invented change would not satisfy the requested
workflow.

## Validation

Focused tests and the complete local suites passed: 899 server suites / 25,882
tests and 253 client files / 3,692 tests. Server and client type checks, the
client production build, client/server linting, documentation linting, ESM
checks, copyright validation, and the coverage ratchet also passed. The
security diff review covered all eight changed source/test files and found zero
reportable findings. No migration is needed because the feature derives a
bounded response from already-persisted policy-result data.

## Next Item

After using this explanation on a representative set of confirmation-band
items, compare recurring low or zero source contributions with the aggregate
candidate-set readiness signal. If the cohort supports review, improve
deterministic policy eligibility or declared scope before adding broader RAG
or AI behavior.
