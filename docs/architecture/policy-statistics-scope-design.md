# Policy statistics scope design

Date: 2026-09-07 UTC. Guidance cutoff: August 2026.

## Problem and decision

Following the retained evidence breakdown in `6513dae9`, the dashboard still
offers 7 Days, 30 Days and All Time buttons. They only update `timeRange`; no
request, computed population or watcher uses that value. A selected button can
therefore imply a period that the figures do not represent.

Replace these controls with visible descriptions beside the affected sections.
Keep automatic loading and the existing named API functions. This gives users
the reporting context without adding configuration or work before they can
understand the available observations.

## Verified data scopes

The implementation, rather than a generic dashboard convention, defines these
scopes. Sources are `statsRoutePolicies.mjs`, `statsRouteMonitoring.mjs` and the
`policy_feedback_learning_stats` view in migration
`20260907_010000_add_feedback_evaluation_views.sql`.

| Display | Population and period |
| --- | --- |
| Overview totals, evaluated coverage and auto rate | All retained feedback associated with current policies, including disabled policies. Auto rate uses all observed decisions as its denominator. |
| Average evaluated accuracy | Equal-weight mean of available policy accuracies, each calculated over retained evaluated feedback. Policies without evaluated evidence are excluded from the mean. |
| Policy performance cards | Enabled policies; retained feedback totals and accuracy, plus separately labeled last-7-day accuracy. |
| Trend badges and improving count | Last-7-day accuracy compared with last-30-day accuracy. Improving/declining requires a difference greater than five percentage points; unavailable periods produce an unknown trend. These windows overlap. |
| Available evidence | All retained history and feedback in separate populations, including pending/retry history. Existing component labels this scope. |
| Live activity | At most 20 newest events combined: retained feedback decisions without a date cutoff, plus patterns and suggestions created within the last seven days. |
| Detail totals | All retained feedback for the selected policy. |
| Detail activity and decision breakdown | Rolling last 30 days through database current time. |
| Detail comparison | Rolling last seven days versus the preceding seven days, rather than calendar weeks. |

The existing alerts retain their individual rules: declining trend plus retained
accuracy below 80%, seven-day correction observations above 20%, or at least five
currently pending suggestions. They are not controlled by a dashboard period.
The monitoring queries for patterns, suggestions and correction alerts currently
apply a lower date bound only; this change does not add timestamp validation.

## Official research

URLs were discovered through web search and opened on 2026-09-07. The dated W3C
recommendations predate the requested cutoff. Live Vue documentation was checked
for established template safety guidance; it is not an August archive snapshot.

- [W3C WCAG 2.2, 12 December 2024 recommendation](https://www.w3.org/TR/2024/REC-WCAG22-20241212/)
  calls for descriptive headings and labels (2.4.6), programmatic relationships
  (1.3.1), text contrast (1.4.3) and readable reflow (1.4.10). Apply native section
  headings, adjacent text descriptions and `aria-describedby`, with no focusable
  scope controls. Inspect both the dark dashboard and light detail modal.
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) recommends
  descriptive metadata and quality information. Applying this to the dashboard
  is our design inference: identify populations and windows so observations can
  be interpreted before they inform classification research.
- [Vue security guidance](https://vuejs.org/guide/best-practices/security)
  recommends trusted templates and automatic text escaping. Keep scope text in
  source-controlled templates and dynamic values in normal Vue interpolation.

These sources inform this scoped improvement, not a claim of whole-platform
accessibility conformance or a repository-wide security audit.

## Alternatives and recommendation stack

| Option | Advantages | Costs | Decision |
| --- | --- | --- | --- |
| Passive scope descriptions | Immediate context, no operator choice, no new requests or storage | Labels must change when query semantics change | Implement |
| Functional global date filter | Supports period exploration | Requires coordinated query contracts for several different populations and adds operational choice | Defer until a concrete reporting need exists |
| Disabled date buttons | Small implementation | Still presents unavailable choices and does not explain mixed scopes | Reject |

Recommended stack: existing read-only aggregates → named client API functions →
small existing Vue components with semantic section descriptions → browser checks
for scope, automatic reads and mobile reflow. Keep calculation ownership on the
server. No new service, dependency, schema or API parameter is needed for static
presentation context. The existing modular ESM structure is sufficient.

## Verification plan

Exercise dashboard loading and refresh through existing component tests; verify
the obsolete controls are absent and section descriptions are accessible in the
real browser. Open policy details and verify 30-day and rolling comparison
labels. Test a populated policy grid at narrow width. Run relevant client tests,
lint, type checking, ESM checks and a local container build. Record actual results
and remaining findings in the separate outcome document. No release is planned.
