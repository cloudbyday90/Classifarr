# Policy Cohort Simulator Design

Status: implemented on 2026-08-29.

## Decision to Support

Policy-purpose overlap inspection can show an ambiguous configuration shape,
but it cannot tell an operator how a proposed edit would affect recent media.
The cohort simulator therefore compares the current saved policy and an
unsaved draft against the same bounded historic input cohort before the draft
is saved.

It answers only this narrow question: **how would the shared deterministic
native-intent eligibility stage change for these recent historic records?** It
does not assert that a title belongs in a destination, forecast the AI result,
choose among competing policies, or authorize a route.

## Official Guidance Considered

- [OWASP API5:2023](https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/)
  calls for explicit function-level authorization. The endpoint therefore
  performs its own administrator check; the browser does not supply scope,
  history filters, or limits.
- [OWASP Query Parameterization](https://cheatsheetseries.owasp.org/cheatsheets/Query_Parameterization_Cheat_Sheet.html)
  recommends server-side parameterized queries. The history read is static,
  parameterized, bounded, and uses fixed method/status allow-lists.
- [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for documented evaluation, validity limits, and transparent reporting.
  The result reports its cohort bounds and its limitation to deterministic
  eligibility rather than presenting an AI or routing forecast.
- [W3C WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  calls for programmatically determinable result status. The UI presents the
  completed preview in a `role="status"` region and errors as alerts.
- [Vue composables](https://vuejs.org/guide/reusability/composables) support
  keeping request state reusable and separate from presentation. The client
  therefore uses a dedicated composable and focused component.

Research was checked against these official sources on 2026-08-29.

## Options and Trade-offs

| Option | Pros | Cons |
| --- | --- | --- |
| Configuration-only overlap review | Fast, safe, no historic reads. | Cannot show the likely operational direction of an edit. |
| Client-side simulation | Would be responsive. | Exposes historic media and configuration, duplicates policy semantics, and is not authoritative. |
| Unbounded full-history simulation | Larger sample. | Unpredictable cost, broader data exposure risk, and a misleading sense of certainty. |
| Server-side bounded native-eligibility comparison | Reuses evaluator semantics, keeps raw records on the server, is deterministic and explicit. | Does not forecast final ranking, AI verification, or routing. |
| Automatically apply a favorable draft | Removes an operator step. | Improperly turns a limited simulation into a routing-authority change. |

## Final Recommendation Stack

1. Keep static purpose-overlap inspection as the inexpensive first signal.
2. Run this administrator-initiated cohort simulator only when an operator is
   considering an unsaved draft.
3. Use the same native-intent eligibility evaluator for current and proposed
   in-memory contracts, not a second implementation of signal semantics.
4. Limit the data set to the latest 90 days and at most 100 records whose
   historical method and status are allow-listed deterministic outcomes.
5. Return only aggregate baseline/proposed outcomes and four transition counts:
   newly eligible, no longer eligible, retained eligible, retained ineligible.
6. Treat the result as advisory. Retain server validation, current policy
   authority, AI admission rules, policy selection, thresholds, and routing
   gates as the only operational decision path.

## Architecture

```text
Administrator draft
        |
        v
POST /policies/:id/native-intent/cohort-simulation
        |
        +-- administrator authorization + draft schema validation
        +-- saved-policy context (server-owned scope)
        +-- current and draft in-memory native-intent contracts
        +-- bounded read of deterministic historic rows
        +-- shared native-intent eligibility evaluator
        |
        v
aggregate comparison only -> browser status region
```

The adapter converts the validated draft into a temporary native-intent
contract solely to invoke the shared evaluator. The adapter carries a
`simulationOnly` marker in memory. It never persists the contract and does not
invoke the full policy engine, RAG, AI provider, learning, or routing services.

## Security and Privacy Controls

- The route accepts exactly `policy_intent_draft`; it rejects browser-selected
  media type, dates, limit, policy scope, or identifiers other than its path
  policy ID.
- The policy's library and media type come from the server-owned persisted
  policy context.
- Historic SQL is a single static `SELECT` with parameterized cutoff and fixed
  allow-lists. It has no mutation statement or dynamic identifier.
- Titles, classification IDs, policy terms, draft contents, metadata, item
  scores, provider state, and AI/RAG output never leave the service boundary.
- Drafts are validated and retained only for the request. The service performs
  no database write, cache write, learning update, policy save, or route.

## Non-goals and Interpretation Limits

- A result does not prove a policy is semantically correct.
- A result does not compare candidates across all destination policies.
- A result does not predict AI availability, AI verification, RAG, manual
  review, final score thresholds, or an external media-server action.
- A zero-result cohort is lack of historic deterministic evidence, not a
  positive recommendation.

## Pull Request Availability

The public GitHub pull-request API was queried on 2026-08-29 and returned no
open pull requests. No closed or unrelated pull request was substituted, and
no PR was merged.
