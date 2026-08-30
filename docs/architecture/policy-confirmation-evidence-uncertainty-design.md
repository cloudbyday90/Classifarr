# Policy Confirmation Evidence Uncertainty Design

Status: Implemented (unreleased)

Date: 2026-08-30

## Decision

Classifarr retains the existing content-free confirmation-evidence aggregate,
but stops treating its observed specialized-declared-evidence rate as a
conclusive maintenance signal on its own. A small or borderline sample can
otherwise produce a false policy-scope review recommendation.

The server now calculates one fixed 95% Wilson score confidence interval from
two existing aggregate counts: specialized declared evidence and eligible
confirmation observations. The existing 60% specialized-evidence threshold is
interpreted conservatively:

1. Fewer than 20 observations: `insufficient_data`.
2. The 95% interval's upper bound is below 60%:
   `declared_scope_review_recommended`.
3. The 95% interval's lower bound is at least 60%:
   `evidence_mix_observed`.
4. Any remaining representative cohort: `evidence_mix_inconclusive`.

For example, 11 specialized observations in 20 produces an observed 55% rate,
but a 95% Wilson interval of 34.2% to 74.2%. The interval overlaps the 60%
threshold, so the result is correctly inconclusive rather than a request to
edit policy scope. Two specialized observations in 20 produces a 2.8% to
30.1% interval and can safely advise an existing administrator-maintenance
review.

## Research Basis

- NIST's engineering statistics handbook documents Wilson confidence intervals
  for binomial proportions, including their use as a hypothesis-test inversion.
  The fixed method avoids treating a raw proportion as exact.
  [NIST/SEMATECH confidence intervals](https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm)
- NIST's uncertainty guidance says a reported interval needs a stated coverage
  basis. The report therefore names the fixed 95% Wilson method in the API and
  UI rather than presenting a vague confidence claim.
  [NIST measurement uncertainty](https://www.nist.gov/itl/sed/topic-areas/measurement-uncertainty)
- NIST's AI RMF calls for measurement, testing, monitoring, and documented
  interpretation within context. This remains a deterministic maintenance
  measure; it does not grant AI or routing authority.
  [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
- W3C WCAG 2.2 requires meaningful focus order and programmatically
  determinable status messages. The added result is static, follows the panel's
  reading order, and contributes concise status text without moving focus.
  [W3C Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order)
  and [W3C Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
- OWASP recommends returning only the properties a client needs. The interval
  is derived from the pre-existing aggregate read and returns only fixed method
  metadata and bounded percentages.
  [OWASP API3:2023](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)

## Architecture

```text
existing parameterized aggregate query
  -> content-free confirmation counts
    -> policyConfirmationEvidenceConfidence.mjs
      -> fixed 95% Wilson interval
        -> policyConfirmationEvidenceReadiness.mjs
          -> fixed advisory status and existing maintenance handoff
            -> Statistics view
```

`policyConfirmationEvidenceConfidence.mjs` is a pure ES module. It accepts
only non-negative counts, caps successes at observations, and returns `null`
without observations. It neither reads storage nor accepts item, policy,
library, provider, prompt, model, actor, or routing input.

`policyConfirmationEvidenceReadiness.mjs` composes that result and moves to a
versioned v2 nested contract. The confidence calculation cannot change a
threshold, call a provider, create telemetry, persist an event, retry a job,
or route media.

`policyConfirmationEvidencePresentation.js` is the client display boundary. It
allow-lists the new fixed status and the exact `wilson_score` / 95% interval
contract. Unknown status or interval content falls back to fixed unavailable
copy rather than displaying server-supplied text.

## Alternatives

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Fixed 95% Wilson interval over existing aggregate counts | Conservative and explainable; no schema, retention, or identity expansion | May defer a review while the cohort grows | Adopt |
| Point-rate threshold after 20 observations | Simple and immediate | Overstates certainty for borderline samples | Reject |
| Per-policy or per-title drill-down | Could locate a specific weak rule faster | Creates an identity-bearing API, query, and authorization surface | Reject |
| AI interpretation of the cohort | Flexible prose | Adds probabilistic authority and provider disclosure without stronger evidence | Reject |
| Auto-edit a policy after threshold crossing | Fast action | Makes observational telemetry unsafe routing-policy authority | Reject |

## Security And Accessibility Boundaries

- The database query remains static, parameterized, read-only, and aggregate
  only. No migration or new retention path is required.
- The API adds only a fixed method ID, fixed confidence level, and two bounded
  percentage values to the already-authorized aggregate report.
- The new advisory status can reveal no policy, library, item, title, actor,
  provider, model, prompt, response, or destination identity.
- Only the existing, administrator-gated purpose-coverage handoff is available
  when the weak-scope result is statistically conclusive. It carries one fixed
  focus token and no metric identity.
- The client ignores unrecognized status and interval fields, preserving a
  fixed presentation and avoiding server-supplied display content.
- The panel retains its existing polite, atomic status announcement and logical
  document order; it does not insert a new focus stop or take focus.

## Final Recommendation Stack

1. Treat individual score explanations as the diagnosis for a concrete pending
   item.
2. Use the bounded local comparison when two or three items need a direct
   evidence-mechanics contrast.
3. Use the aggregate confirmation panel only after it has at least 20 complete
   UTC-day observations.
4. Change declared purpose, scope, or eligibility only when the 95% interval
   is entirely below the 60% specialized-evidence threshold and individual
   evidence supports the change.
5. Keep AI advisory, aggregate monitoring, policy editing, and media routing
   as separate authorities.
