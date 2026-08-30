# Policy Confirmation Evidence Review Handoff Design

Status: Implemented (unreleased)

Date: 2026-08-30

## Decision

Classifarr will provide one contextual, read-only navigation handoff when the
existing aggregate Policy confirmation evidence report reaches
`declared_scope_review_recommended`. The handoff opens the existing
administrator-gated Native intent reconciliation page and places programmatic
focus on its existing **Policy purpose coverage** review.

This closes the gap between an aggregate observation and the configuration
surface an administrator can safely inspect. It does not derive a policy from
telemetry, open an alternate policy editor, mutate data, call AI, retry work,
or change routing.

## Research Basis

- WCAG 2.2 describes status messages as important updates that should be
  programmatically determinable without taking focus. The monitoring page
  therefore retains its polite, atomic status announcement; navigation focus
  changes only after the administrator explicitly follows the link.
  [W3C WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
- WCAG 2.2 requires components with the same function to be identified
  consistently. The link calls out the existing purpose-coverage review rather
  than inventing a second "scope" or "telemetry" editor.
  [W3C WCAG 2.2 Consistent Identification](https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html)
- NIST frames AI risk management as iterative governance, mapping,
  measurement, and management. The aggregate metric remains a measured signal;
  human review of stored configuration remains a distinct governed action.
  [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
- OWASP recommends explicitly selecting the smallest API response properties
  needed for the feature. The handoff carries one fixed focus token rather than
  a policy, library, item, model, or telemetry identifier.
  [OWASP API3:2023](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)
- OpenTelemetry specifies attribute allow-lists and cardinality limits for
  metric streams. The existing aggregate report and this navigation contract
  maintain a fixed vocabulary and introduce no new telemetry dimension.
  [OpenTelemetry Metrics SDK](https://opentelemetry.io/docs/specs/otel/metrics/sdk/)

## Design

The client utility `policyConfirmationEvidenceReviewHandoff.js` is the sole
translation boundary. It accepts only the fixed
`declared_scope_review_recommended` status and returns one immutable route:

```text
/statistics?tab=classification
  aggregate status: declared_scope_review_recommended
    -> /policy-native-intent-reconciliation?focus=purpose-coverage
      -> existing Policy purpose coverage review
```

Any missing or unknown status fails closed: no link is rendered. The target
recognizes only `purpose-coverage`; a policy ID, library ID, title, provider,
or model cannot be supplied through this handoff. The existing coverage review
already owns its data fetching, authorization, bounded configuration projection,
and guarded editor link.

The coverage review exposes a named, `tabindex="-1"` section through a small
component method. After the route's own data load completes, the target page
focuses that heading-bearing region. It does not announce an automatic alert
or move focus merely because a monitoring value changed.

## Alternatives

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Aggregate-to-coverage review handoff | Gives the user one clear next step; reuses existing authorization and editor; preserves aggregate privacy | Does not name a likely policy; still requires administrator judgment | Adopt |
| Put per-policy IDs in the telemetry response | Directly opens a single record | Breaks aggregate privacy, creates a high-cardinality telemetry index, and risks false attribution | Reject |
| Automatically edit policy purpose | Fast for an apparent scope gap | Treats a monitoring signal as authority and can change routing behavior | Reject |
| Add another policy-scope editor | Can tailor controls to telemetry | Duplicates policy authority and creates inconsistent workflow labels | Reject |
| Do nothing after the aggregate recommendation | Smallest implementation | Leaves users unsure which existing configuration surface to inspect | Reject |

## Security And Accessibility Boundaries

- The route contains one fixed, allow-listed focus token and no identity.
- Unknown readiness states and focus tokens fail closed.
- The coverage review remains read-only until its existing explicit edit action
  is chosen and authorized.
- The feature makes no API request, changes no response schema, and creates no
  telemetry, retention, AI, learning, retry, or routing path.
- The link uses an existing route name and consistent wording; focused content
  has a visible heading and is removed from sequential keyboard navigation.

## Final Recommendation Stack

1. Use the aggregate evidence panel only after its 20-observation threshold.
2. When it recommends scope review, open the existing Policy purpose coverage
   review through this handoff.
3. Inspect its static missing-coverage and broad-overlap findings together
   with representative individual score explanations.
4. Make an explicit policy-purpose change only when those two evidence sources
   support it; then let normal scheduler and routing safeguards operate.
5. Reconsider candidate eligibility, RAG, or broader AI authority only after
   declared-purpose evidence has been checked.
