# Policy Destination Competition Coverage Design

Status: implemented on 2026-08-29.

## Decision

Destination competition is intentionally bounded to prevent a maintenance
preview from expanding into an unbounded policy scan. The previous UI treated
`compared count >= cap` as evidence that the cap had truncated the comparison.
That is not precise: exactly as many active competitors as the cap is a
complete comparison, while one additional active competitor makes it capped.

The preview will request one server-only sentinel competitor beyond its fixed
evaluation cap. It evaluates only the first `cap` competitors. The sentinel is
discarded after answering the single question, "were additional active
competitors excluded?" The response returns a display-safe coverage contract,
not the sentinel, a total, identities, configuration, or media data.

## Official Guidance Considered

- [W3C WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  requires important dynamic result status to be programmatically
  determinable without moving focus. The existing preview result region is a
  status region; the coverage card provides one short, complete status.
- [W3C WCAG 2.2 Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html)
  recommends enough visible instruction for an operator to act without
  confusion. The card says what was compared, what a cap means, and how it
  changes interpretation.
- [OWASP API3:2023](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)
  recommends explicitly selecting the minimum response properties. The
  contract exposes only fixed status, booleans, and the existing configured
  cap; it never serializes the sentinel or an active-policy total.
- [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework/ai-risk-management-framework-faqs)
  supports clear information about the limitations of automated system output.
  The card describes evidence coverage, not AI confidence, destination choice,
  or routing authority.

Research was checked against these official sources on 2026-08-29.

## Options and Trade-offs

| Option | Pros | Cons |
| --- | --- | --- |
| Keep `count >= cap` heuristic | No query change. | Incorrectly warns when the comparison is complete at exactly the cap. |
| Run an unbounded competitor query | Exact total. | Expands a bounded maintenance operation and reveals more internal state than needed. |
| Run a separate count query | Precise total. | Adds query work and a sensitive aggregate that is not needed to interpret this preview. |
| Fetch one sentinel row and discard it | Precisely identifies capped versus complete coverage while preserving fixed work and minimal output. | Reads one unused row internally. |

## Final Recommendation Stack

1. Retain the fixed evaluation cap of 25 active competitors.
2. Fetch at most one extra server-only sentinel row using the existing
   parameterized, same-media-type query.
3. Evaluate and attach intent only for the capped set; discard the sentinel
   before any projection.
4. Return a versioned aggregate coverage contract with fixed guidance and
   explicit non-exposure/authority flags.
5. Render an advisory status card that says whether absence of overlap is
   complete evidence or must be treated as incomplete.

## Architecture

```text
bounded active competitor query (cap + one sentinel)
                    |
                    v
sentinel present? --> capped Boolean
                    |
                    v
evaluate only the first fixed-cap competitors
                    |
                    v
aggregate coverage contract --> semantic advisory card
```

## Security and Authority Boundaries

- The existing administrator-only route and draft validation remain unchanged.
- The sentinel never reaches intent attachment, evaluation, a response, logs,
  AI, providers, persistence, learning, or routing.
- The response does not provide a total number of matching active policies or
  any information from which an identity can be selected.
- Coverage applies only to the active same-media-type competitor slice and
  bounded historic cohort; it does not certify future routing safety.

## Pull Request Availability

The GitHub pull-request page was queried on 2026-08-29 and reported zero open
pull requests. No closed or unrelated pull request was substituted or merged.
