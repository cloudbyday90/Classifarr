# Route-Safety Calibration Evidence Design

Status: implemented on the unreleased branch.

## Decision

Add a strict, checked-in synthetic corpus that exercises the existing
`classificationRouteSafetyGate` with a current high deterministic policy score.
The corpus proves that a policy action eligible for automatic routing remains
blocked whenever a stronger route-safety condition applies.

The evaluator is offline and aggregate-only. It does not read a live policy,
library, database, configuration, provider, model, prompt, response, RAG
document, or media item. It cannot invoke AI/RAG, learn, retry, persist, change
policy, or route media.

## Problem

The policy score and the route decision intentionally have separate authority.
The screenshots make that distinction visible: a score can be above the
confirmation threshold, the policy can choose a library, and AI can align with
that library, yet an Arr route can still be unsafe. Before this evidence layer,
unit tests covered individual gate behavior but did not provide one versioned
fixed corpus that proves a high score cannot bypass every relevant gate or the
defined gate ordering.

## Research And Recommendations

Research was completed on 2026-08-31 using official sources current through
August 2026.

- NIST's AI RMF frames trustworthy AI work as ongoing Govern, Map, Measure,
  and Manage activity, while its August 2026 TEVV-Athlon work describes a
  structured approach to evaluation. That supports repeatable evaluation of
  the deterministic control surrounding an advisory model rather than treating
  one successful model response as authorization. [NIST AI RMF
  overview](https://www.nist.gov/itl/ai-risk-management-framework) and [NIST
  TEVV-Athlon](https://www.nist.gov/artificial-intelligence/ai-research/tevv-athlon-framework-evaluating-ai-systems)
  were reviewed.
- OWASP API Security's resource-consumption guidance supports bounded test
  inputs and no unbounded provider work. The corpus therefore has a fixed
  9–16 fixture limit and cannot accept endpoint, provider, prompt, response, or
  runtime fields. [OWASP API Security Project](https://owasp.org/API-Security/)
  was reviewed.
- W3C's WCAG 2.2 error-identification and status-message guidance favors a
  programmatically determinable state and clear explanation when a future UI
  presents a gate result. This change adds no UI, so it deliberately does not
  add a live region or a second UI-specific state; a future presentation must
  consume the existing bounded gate projection. [WCAG 2.2 Error
  Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification)
  and [Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  were reviewed.

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Test live policies and providers | Closest to a deployed installation | Could expose data, depend on network/model behavior, and make CI nondeterministic | Rejected |
| Duplicate the gate logic in a test-only simulator | Small isolated fixture | Can drift from the authority that prevents an Arr write | Rejected |
| Run the existing gate resolver against a strict synthetic corpus | Deterministic, bounded, exercises production authority, safe for CI | Requires fixture maintenance when the gate contract deliberately changes | Selected |

## Architecture

```text
checked-in scenario + expected gate IDs
              |
              v
strict fixture contract ---- rejects runtime/authority-bearing fields
              |
              v
synthetic high-score input builder
              |
              v
existing classificationRouteSafetyGate
              |
              v
aggregate-only offline evaluation ----> human-only approval packet
```

`policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationRouteSafetyFixtureContract.mjs`
owns the allow-list, fixture bounds, required controls, and coherent expected
projection validation. `...RouteSafetySyntheticInput.mjs` owns the generic
synthetic library IDs and fixed 90/85 score/threshold pair.
`...RouteSafetyOfflineEvaluation.mjs` calls the existing resolver and returns
only fixture count, match count, mismatch count, status, versions, and a
no-authority declaration. No fixture-level results leave the evaluator.

The corpus includes one allowed baseline plus blocks for provider recovery,
weak deterministic evidence, AI advisory output, stale/mismatched
`policy_auto` provenance, installation-wide confirmation, fallback,
low-confidence output, and an explicit clarification. A final compound case
pins the actionable order: provider recovery precedes AI advisory and
installation confirmation.

## Final Recommendation Stack

1. Keep native policy scoring, AI advice, and route-safety authorization as
   separate layers.
2. Treat the checked-in route-safety corpus as a release-quality regression
   control, not a live policy calibration or routing test.
3. Require the admission corpus, score-band corpus, and route-safety corpus to
   pass before the existing packet format is available; retain human approval
   as a separate non-automated action.
4. For a future operator screen, display the server-projected primary gate and
   secondary gates with W3C-conformant programmatic status communication; do
   not infer them in the browser.

## Security And Non-Outcomes

The contract rejects unknown fields and constrains identifiers, boolean
controls, expected gate IDs, and fixture count. The synthetic input contains no
real library or media identity. The aggregate evaluator has no transport,
database, configuration, queue, scheduler, API route, or browser dependency.

This is not an AI quality benchmark, an Ollama test, a RAG retrieval test, a
provider capability test, a policy recommendation, a configured-threshold
test, a historical record replay, or an authorization to route an item.
