# Policy Purpose Disjunctive-Overlap Review Design

Status: implemented design for the next policy-precision increment on 2026-08-29.

## Problem

The existing policy purpose coverage review counted required content terms across
both `require_all` and `require_any` rules. A policy was presented as having
distinct declared coverage when at least one configured term was unshared.

That can be misleading for a disjunctive rule. A rule such as
`require_any: [broad term, specialized term]` can still match solely on the
shared broad alternative. One unshared sibling must not hide that maintenance
risk. This matters for configurations such as broad movie, family, and anime
destinations which share media type and broad genres.

The report must help an administrator find that policy shape without exposing
configured terms in the browser, calling an AI provider, or changing a routing
decision.

## Research and Design Principles

- NIST distinguishes transparency (what happened), explainability (how it
  happened), and interpretability (why it matters to the operator). The review
  therefore reports the actual declarative-policy shape and fixed guidance; it
  does not substitute an AI explanation for a deterministic policy result.
  [NIST AI Risks and Trustworthiness](https://airc.nist.gov/airmf-resources/airmf/3-sec-characteristics/)
- OWASP recommends server-side authorization, deny-by-default behavior, and
  least privilege. The report remains administrator-only, uses a server-side
  aggregate query, and returns no configured values or raw policy JSON.
  [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- WCAG 2.2 requires status changes to be programmatically determinable. The
  review and preflight use visible, explicit status text and polite status
  regions rather than color or an icon alone.
  [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
- Vue recommends composables for reusable stateful client logic and components
  for reusable presentation. The existing composable/component split is
  retained rather than placing request state in a large view component.
  [Vue composables](https://vuejs.org/guide/reusability/composables)

Research was checked against these official sources on 2026-08-29.

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| Treat one unshared term as sufficient | Simple and preserves the prior report. | Gives false reassurance when a shared `require_any` sibling can still satisfy the rule. |
| Flag shared `require_any` alternatives, retain the current static report | Directly addresses the misleading configuration shape; deterministic, bounded, no provider cost, and no route mutation. | It is a static review, not evidence that a particular title belongs in a destination. |
| Re-evaluate historical media or simulate a policy change | Could quantify the operational impact of a proposed edit. | Requires a separate, bounded cohort design and cannot safely be inferred from configuration alone. |
| Automatically remove shared terms or lower thresholds | Reduces immediate manual work. | Silently changes routing authority and could create misroutes. |

## Recommendation Stack

1. Preserve the existing server-owned review and preflight boundaries.
2. Carry rule operator provenance internally for aggregate comparison.
3. Add a count of shared `require_any` alternatives and classify any positive
   count as `broad_overlap_review_required`, even if another term is unique.
4. Return only fixed status IDs and counts; do not return terms, draft content,
   raw rules, item metadata, AI output, RAG data, or provider details.
5. Make the guidance explicit: review the policy's broad alternative before
   lowering an automatic-routing threshold.
6. Keep the report advisory and read-only. Existing validated policy changes,
   authorization, and runtime route safeguards remain authoritative.

## Contract Changes

Both the active-policy report and draft preflight add these bounded coverage
fields:

- `sharedRequireAnyTermCount` — number of current or proposed `require_any`
  content terms that overlap another active destination of the same media type.
- `sharedRequireAnyDestinationCount` — destinations participating in that
  overlap.

The contract version increments to v2. Existing fields retain their meaning.
A zero value does not certify semantic correctness or a future automatic route;
it only says this specific broad-alternative condition was not found.

## Security and Privacy Boundary

The PostgreSQL queries compare normalized values only inside the database and
project counts. They retain parameterized inputs, the current native-policy
authority predicate, active same-media-type scope, and administrator endpoint
authorization. No state is written, cached as a decision, or logged as payload.
The preflight accepts a validated draft only transiently and reports aggregate
results; it does not persist the draft.

## Non-goals

- It does not alter the policy scoring formula, AI advisory behavior,
  thresholds, or routing action.
- It does not infer semantic correctness from one classification.
- It does not expose a policy's terms to another user or destination.
- It does not auto-repair policies.

## Follow-up

The next high-value item is a separately designed, administrator-only cohort
simulator: preview a proposed policy revision against a bounded, redacted set
of historic deterministic outcomes and show aggregate deltas before saving.
It should reuse runtime semantics, be explicitly invoked, and never route,
learn, or call AI.
