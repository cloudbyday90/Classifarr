# Inferred Profile Identity Guardrail Design

## Problem

An inferred native policy can contain broad genres derived from a destination
library's current contents. Those signals describe what the library has held;
they do not prove that a new item semantically belongs there.

The local Compose investigation exposed this failure mode. The inferred
`Comedy and Standup` purpose rule listed `Comedy`, `Documentary`, `TV Movie`,
`Biography`, and `Drama` as identity values. `Deep Water` matched
`Documentary` and `Drama`, so the runtime treated it as specialized identity
evidence even though the signals were broad, profile-derived, and not
operator-declared.

## Decision

Keep inferred profile genres available to deterministic scoring, but exclude
matching broad genres from the specialized cross-candidate identity proof.
The guard applies only when a native purpose rule is both:

1. sourced from `media_server_library_profile`; and
2. marked `inferred`.

This preserves explicit, operator-declared identity and specialized keyword or
studio evidence. A candidate with only broad inferred profile genres is
classified as `insufficient_specialized_evidence`, calibrated below the
confirmation threshold, and cannot become the primary routing anchor.

## Alternatives

| Option | Benefit | Cost | Decision |
| --- | --- | --- | --- |
| Treat all native `identity` rules as proof | Simple | Repeats false-positive routing from profile-derived genres | Rejected |
| Disable profile scoring | Avoids this incident | Removes useful contextual evidence and does not address semantics | Rejected |
| Add a runtime identity guard for inferred broad genres | Narrow, explainable, preserves useful scoring | Existing bad policies still need maintenance | Selected |
| Route with an LLM whenever policy evidence is broad | Potential semantic help | Probabilistic, latency/cost, and no trustworthy evidence boundary | Deferred to an offline evaluation |

## Security and accessibility boundaries

The guard consumes only the normalized server-side policy contract and media
metadata already used for routing. It does not expose prompt text, provider
credentials, raw library inventory, or a new endpoint. The result remains an
auditable status identifier in existing decision evidence.

The evidence card should communicate this decision as status text, not color
alone. That follows W3C guidance for status messages and disclosure controls.
Any future policy-maintenance UI must keep the exact rule and its source
visible to the operator without exposing unrelated library records.

## References

- [W3C WCAG 2.2, Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
- [W3C ARIA Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
- [OWASP API Security Top 10: Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
- [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework)
