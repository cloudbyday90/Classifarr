# Fixed-Band Calibration Evidence Outcome

## Status

Implemented on the unreleased branch. This change does not create a release,
tag, version bump, policy proposal, threshold change, AI/RAG invocation, or
routing action.

## Delivered

- `policyCandidateDecisionBandSpecification.mjs` records the versioned current
  default baseline: selection 40, confirmation 60, and automatic candidate 85.
- `policyCandidateDecisionBand.mjs` is a pure ESM resolver for the four
  ordered actions. `PolicyCandidateRanker` now uses it after its existing
  ambiguity and weak-evidence safeguards.
- A strict, checked-in nine-case band corpus covers the lower floor, all three
  boundaries, their preceding scores, the policy ceiling, and the score ceiling.
- A pure offline evaluator emits aggregate-only pass, mismatch, or invalid
  statuses, with no fixture-level data in its report.
- The existing fixed-path calibration command now evaluates both corpora and
  requires both to pass before it exposes its already-human-gated packet.
- A JSON Schema describes the independently reviewable corpus shape.

## Deliberate Non-Outcomes

- No live policy is read, and no customized library threshold is evaluated.
- No owner approval, signature, policy proposal, threshold persistence, or
  automated tuning is recorded.
- No browser view, endpoint, database access, migration, queue, scheduler,
  export, AI/RAG call, provider request, retry, classification, or route is
  added.
- `auto_classify` remains a policy action only. Route-safety gates retain final
  authority over an Arr side effect.

## Open Pull Request Evaluation

The GitHub MCP query found one currently open pull request:
[PR #522](https://github.com/cloudbyday90/Classifarr/pull/522), the Axios,
Vue, and Vue Router client-runtime update. Its exact diff was already applied
and tested locally in the preceding commit, so there was no duplicate package
change to make in this work. It remains open and was not merged or modified.

## Validation

Completed on 2026-08-31:

- Focused service, contract, evaluator, fixture-document, approval-packet, and
  ranker tests passed: 9 suites and 53 tests.
- The fixed-path offline command passed both corpora: 3 of 3 admission cases
  and 9 of 9 decision-band cases matched their expectations. Its resulting
  packet remains `human_approval_required`, with no approval, policy, AI/RAG,
  retry, or routing authority.
- Full workspace tests passed: 969 server unit suites / 27,283 tests; 75
  server integration suites / 868 tests, with one existing skipped test; and
  288 client files / 3,974 tests.
- Full workspace coverage passed and the coverage ratchet reported no
  regression. Static ESM, lint, typecheck, documentation lint, copyright, and
  production client-build checks also passed.
- Both server and client high-severity dependency audits reported zero
  vulnerabilities.
- A complete working-tree security review found zero reportable findings. It
  confirmed that the fixed fixture path, resolver, evaluator, and approval
  packet cannot authorize AI/RAG, policy change, retry, or routing.
- The clean, provenance-verified Docker Compose rebuild passed with
  `--no-cache`; the recreated Classifarr container became healthy and the
  local HTTP probe at `http://localhost:21324/` returned `200`.

## Follow-Up

The route-safety matrix was completed in the follow-up [route-safety evidence
outcome](policy-candidate-correction-policy-change-review-history-calibration-route-safety-evidence-outcome.md).
