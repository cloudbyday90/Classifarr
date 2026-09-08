# Policy purpose declaration worklist window design

Status: implemented, unreleased. Research checked against the linked primary
sources on 8 September 2026.

## Problem

The declaration worklist reads a bounded policy window to constrain a
configuration-sensitive, server-side equality reduction. Its former
`no_declaration_review_required` state was derived from that window alone. If
the visible rows contained no reviewable draft while one or more active rows
were omitted, the state could be understood as a full-population result.

That claim would be false. It would also discourage the low-input, passive
evidence workflow the platform needs before a policy-only study can begin.

## Design

The nested contract advances from
`policy_purpose_declaration_worklist.v1` to v2, and the containing review to
`policy_purpose_coverage_review.v11`.

The worklist has three mutually exclusive states:

| State | Condition | Meaning |
| --- | --- | --- |
| `declaration_review_required` | A visible current draft needs declaration | Display the bounded groups and existing per-policy review action. |
| `declaration_review_window_truncated` | No visible draft needs review and active rows were omitted | No full-population conclusion is available. Show an explicit bounded-window notice. |
| `no_declaration_review_required` | No visible draft needs review and no rows were omitted | The complete report contains no declaration request. |

The existing summary remains bounded and redacted. The new state does not
query a library, add a browser parameter, expand the read, write policy data,
capture a cohort, call a provider, invoke AI, or influence routing.

```text
bounded active-policy read
  -> server-only draft equality reduction
  -> redacted groups and count
  -> complete / request-required / window-truncated state
  -> existing revision-checked declaration form only when a group is visible
```

## Security and accessibility controls

- The existing administrator-only endpoint, fixed limit, and closed response
  allow-list remain in place. The new state returns no configuration, rule,
  receipt, media, or provider data.
- The strict client normalizer rejects a global no-review state when the
  summary says the report is truncated. It also rejects a truncated-window
  state that contains a visible declaration request.
- The visible bounded-window notice uses `role="status"` and polite live
  notification so assistive technologies receive the result without a focus
  change. The empty truncated state omits an empty data table.

## Research basis

[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) calls for
metadata and data-quality information that lets people and software understand
the limits of a published view. The explicit window state supplies scope as
metadata rather than inferring a global conclusion from partial data.

[W3C WCAG 2.2 Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
explains that important status changes should be programmatically available to
assistive technology without moving focus. The bounded-window message uses the
documented status pattern.

[OWASP API3:2023 Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)
recommends minimal, explicitly selected response properties and schema-based
response validation. The v2 contract preserves its property allow-list and
adds only a fixed state identifier.

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Preserve a global no-review state for a truncated window | No contract change | Makes an unsupported global claim | Reject |
| Fetch every policy and group in the browser | Could calculate full groups | Expands sensitive data exposure and resource use | Reject |
| Add a fixed truncated-window state | Truthful, bounded, accessible, and no new authority | Requires a small versioned contract update | Adopt |
| Automatically declare matching hidden policies | Fewer clicks | Bypasses explicit declaration and revision safeguards | Reject |

## Recommendation stack

1. Use bounded, server-only reductions for current configuration data.
2. Make report scope explicit whenever a bounded result cannot support a
   whole-population conclusion.
3. Keep declaration writes in the existing revision-checked per-policy form.
4. Allow the passive aggregate lifecycle re-audit to observe durable ordinary
   authoring.
5. Only after an eligibility audit has enough eligible policy-only comparisons
   should the independently labelled 24–32-case cohort and frozen-study
   preflight run. Semantic counter-evidence remains review-only after a good
   measured error profile.

## Non-goals

This change does not reveal raw purpose terms, infer declarations, expand the
report limit, edit policy storage, select study items, collect labels, call a
provider, invoke AI, or route media.
