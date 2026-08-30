# Policy Candidate Correction Calibration-Readiness Design

## Status

Implemented on the unreleased branch. This is an aggregate-only review aid. It
does not tune a policy, change a threshold, invoke AI, change RAG behavior,
learn, retry work, or route media.

## Problem

Correction Analytics already reports the relationship between an original
score-margin or evidence state and a later operator-confirmed selection. A raw
change rate alone is easy to overinterpret: a handful of changed selections
may be noise, while an apparently low rate may still be uncertain.

The system needs a concise way to distinguish four cases for every fixed
margin and evidence-state bucket:

1. the operator cohort is too small to interpret;
2. the observed rate is still uncertain around the review floor;
3. the rate is conclusively high enough to warrant a human review; or
4. the rate is conclusively below that floor.

This is **not score-probability calibration**. Classifarr's deterministic
policy scores are ranking mechanics, not predicted probabilities. The feature
therefore measures only the later operator changed-selection rate for a fixed
aggregate bucket.

## Architecture

```text
existing fixed aggregate correction counts
  -> count-only Wilson interval service
    -> correction calibration-readiness service
      -> v2 aggregate report
        -> strict browser projection
          -> accessible Statistics tables and overall summary
```

`policyCandidateCorrectionCalibrationReadiness.mjs` is a pure ES module. Its
only inputs are the applicable-decision count and changed-selection count. It
caps the latter to the former, returns a fixed 95% Wilson interval, and emits
one allow-listed status. It cannot read storage, receive a policy/library/item
identifier, call an AI provider, or alter routing.

`policyCandidateCorrectionAnalyticsMetrics.mjs` composes that service for the
overall aggregate plus each existing score-margin and evidence-source/state
bucket. The route, query, completed-UTC-day window, authentication boundary,
and data retention are unchanged. The nested field makes the report v2 so the
browser can fail closed if a server and client are mismatched.

`policyCandidateCorrectionCalibrationReadinessPresentation.js` is the client
display boundary. It validates the exact version, status vocabulary, fixed
floor, count agreement with the enclosing bucket, rate, and Wilson metadata.
It uses client-owned labels and messages; unknown server fields and messages
are not retained or rendered.

## Fixed Method

The advisory method is deliberately fixed and visible:

| Field | Value | Reason |
| --- | --- | --- |
| Observation | Applicable operator decision | Excludes `routed_not_applicable` because it is not a destination-selection decision. |
| Success | Operator changed the leading selection | Counts a change within or outside the original candidate set. |
| Minimum cohort | 20 applicable decisions | Prevents interpreting a sparse group. |
| Review floor | 20% changed-selection rate | An operational human-review floor, not an auto-tuning threshold. |
| Uncertainty method | 95% Wilson score interval | Avoids presenting a sparse binomial point estimate as exact. |

The statuses are conservative:

- `insufficient_data`: fewer than 20 applicable decisions;
- `review_recommended`: the 95% lower bound is at least 20%;
- `no_material_signal`: the 95% upper bound is below 20%; and
- `inconclusive`: the interval still spans the floor.

No status proves a policy correct or incorrect, identifies the cause of a
change, or authorizes an edit. A review-recommended bucket directs an operator
to inspect representative individual decisions before considering a separate,
deterministic policy-maintenance change.

## Research Basis

- NIST's [Engineering Statistics Handbook confidence-interval guidance](https://itl.nist.gov/div898/handbook/prc/section2/prc241.htm)
  identifies the method as the Wilson interval in current statistical
  terminology. The report names its fixed 95% method instead of implying that
  a raw rate is precise.
- NIST's [AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for documented, context-aware measurements with uncertainty and for
  human oversight. The feature measures feedback and preserves operator and
  deterministic-policy authority boundaries.
- W3C's [WCAG 2.2 status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  and [ARIA22 technique](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22.html)
  support concise, atomic status updates without stealing focus. The existing
  Statistics status region announces only loading, unavailable, and overall
  ready states; detailed tables remain ordinary readable content.
- OWASP's [excessive-data-exposure test guidance](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/12-API_Testing/03-Testing_for_Excessive_Data_Exposure/)
  advises server-side field selection rather than relying on UI filtering. The
  response adds only fixed count-derived status and interval fields.

## Alternatives

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Fixed aggregate Wilson readiness | Conservative, explainable, no new query/retention/identity surface | Requires a representative cohort before a signal appears | Adopt |
| Point-rate threshold only | Simple, compact response | Overstates certainty near the floor and with small cohorts | Reject |
| Per-library or per-policy drill-down | May speed a targeted investigation | Expands identifier, authorization, and retention surface | Reject |
| Ask AI to interpret corrections | Flexible prose | Adds probabilistic authority and provider exposure without stronger evidence | Reject |
| Automatically adjust policy thresholds | Fast reaction | Treats observational telemetry as routing-policy authority | Reject |

## Security and Accessibility Boundaries

- The static parameterized aggregate query remains unchanged; there is no new
  endpoint, migration, retention path, or data-access role.
- The report emits no media, title, description, item, library, policy,
  candidate, destination, actor, provider, model, prompt, response, RAG text,
  diagnostic data, or routing control.
- Each server interval is derived solely from bounded aggregate counts. The
  browser independently checks those counts against its enclosing bucket and
  fails closed on a version, vocabulary, or interval mismatch.
- The UI has no new action or configuration control. It provides the fixed
  result in existing semantic tables and preserves the polite, atomic status
  region, avoiding noisy row-by-row live announcements.

## Final Recommendation Stack

1. Use the individual pending-decision explanation for a concrete routing
   question.
2. Use the local score-explanation comparison when two or three pending items
   need a direct deterministic-mechanics contrast.
3. Use Correction Analytics to identify a score band or evidence state with
   enough completed operator decisions to inspect.
4. Treat a review-recommended interval as a reason to inspect a representative
   cohort, not as permission to auto-tune or call AI.
5. Make any later policy change through the existing deterministic
   maintenance workflow, then observe a new completed-UTC-day window.
