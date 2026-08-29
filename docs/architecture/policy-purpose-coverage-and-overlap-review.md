# Policy Purpose Coverage And Overlap Review

Status: implemented for 12R.2 on 2026-08-16; semantic overlap coverage amended on 2026-08-29.

## Decision

Classifarr now provides an administrator-only, read-only review of active,
validated native policy purpose coverage. It identifies two deterministic policy
configuration conditions without inspecting a classified item:

- a policy has no required `genres`, `keywords`, or `studios` purpose signal;
  or
- every such required signal is shared by an active destination with the same
  media type.

The review is not a route decision and does not claim that a unique configured
term is semantically correct. It only reports the current declarative coverage
shape, so the operator can use the existing validated policy editor to make an
explicit correction.

### 2026-08-29 semantic-overlap amendment

The v2 report and draft preflight separately count shared `require_any`
alternatives. A policy is now marked for broad-overlap review when a shared
alternative can satisfy an `any` rule, even if that rule also contains an
unshared term. The earlier one-unshared-term heuristic could otherwise imply
that a disjunctive rule was safely specific. This remains a static, advisory
configuration review; it neither changes route scoring nor proves that an item
belongs in the policy.

## Research

NIST describes trustworthy systems as accountable, transparent, explainable,
privacy-enhanced, and resilient. Its explainability principles also require an
explanation to reflect the system's actual process. The review therefore uses
the same current native-purpose rule taxonomy as runtime calibration and does
not substitute an AI narrative for a deterministic comparison.

OWASP recommends server-side authorization checks on every request, least
privilege, and careful control over the information returned and logged. The
endpoint is consequently admin-only, executes the comparison server-side, and
returns only bounded count/status summaries rather than rule values or source
data.

Sources:

- [NIST AI RMF trustworthy characteristics](https://airc.nist.gov/airmf-resources/airmf/3-sec-characteristics/)
- [NIST IR 8312: Four Principles of Explainable Artificial Intelligence](https://doi.org/10.6028/NIST.IR.8312)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| Server-owned static native-purpose report | Deterministic, current, bounded, no provider cost, and matches runtime taxonomy. | Identifies configuration shape, not semantic correctness. |
| Client-side policy comparison | Fast to display and avoids a new endpoint. | Exposes policy configuration and makes authorization and taxonomy enforcement unreliable. |
| AI policy review | Can produce natural-language suggestions. | Probabilistic, costly, can expose configuration to a provider, and cannot become routing authority. |
| Automatic policy repair | Could reduce operator work. | Would silently alter destination authority and violates the explicit policy-authoring boundary. |

## Recommendation Stack

1. Query only active, validated native contracts on the server.
2. Compare required content-bearing purpose terms within PostgreSQL and return
   only counts, fixed status IDs, and policy/library identities needed to open
   the existing editor.
3. Limit the response to 50 rows by default and 100 rows maximum, fetching one
   additional row solely to disclose truncation.
4. Keep the client panel read-only; it can only open the established policy
   editor after an administrator explicitly chooses to review a policy.
5. Do not write a review record, call a provider, queue a classification,
   inspect classification/history/profile/RAG data, or change routing.

## Contract

`GET /api/policies/native-intent-reconciliation/purpose-coverage?limit=N`
requires an authenticated administrator. The response contains:

- `policy` and `library` identities required to find the existing policy;
- bounded counts of required content signal types, required terms, unshared
  terms, shared terms, overlapping active destinations, shared `require_any`
  alternatives, and destinations participating in that `require_any` overlap;
- one of `declared_specialized_coverage`,
  `missing_specialized_coverage`, or `broad_overlap_review_required`; and
- a server-authored editor action when review is required.

It excludes raw `values`, configured terms, policy JSON, classification records,
item metadata, profile/history/RAG data, provider data, prompts, AI output, and
any route or queue mutation capability. The route does not log the returned
report payload.

The shared-term calculation is deliberately limited to different active
libraries of the same media type. Multiple policies attached to the same
destination do not create a cross-destination overlap finding.

`require_any` overlap is deliberately conservative: any shared alternative can
be sufficient for that rule and therefore requires maintenance review. The
report still does not disclose the term, policy JSON, or draft contents.

## Verification

The implementation has focused unit coverage for the contract, bounded
over-fetch behavior, SQL projection, endpoint authorization, client API,
composable, and presentation. A real PostgreSQL integration test provisions
native policy contracts that demonstrate distinct coverage, missing coverage,
and no configuration-value leakage.

No database migration is required: the report reads the existing native intent
storage and does not persist its result.
