# Policy Destination Competition Shared-Eligibility Explanation Design

Status: implemented on 2026-08-29.

## Decision

The destination-competition preview reports whether an unsaved draft and one
or more active destinations were deterministically eligible for the same
bounded historic records. A count alone can be difficult to act on, but
exposing a competing policy's names, rules, values, titles, or individual
outcomes would disclose configuration and create a misleading diagnostic path.

The explanation therefore returns a deliberately smaller answer: which
**allow-listed declared-purpose category** appears in both the proposed draft
and one or more anonymous active competitor configurations. It does not state
that any values are equal or that a category actually caused an individual
match.

## Official Guidance Considered

- [OWASP API3:2023](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)
  treats excessive property exposure as an authorization concern. The response
  omits values, raw rules, identities, item outcomes, and configuration IDs.
- [OWASP API6:2023](https://owasp.org/API-Security/editions/2023/en/0xa6-unrestricted-access-to-sensitive-business-flows/)
  highlights unbounded sensitive flows. The explanation reuses the preview's
  fixed 90-day, 100-item, and 25-competitor bounds and adds no query or model
  work.
- [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework/ai-risk-management-framework-faqs)
  distinguishes explainability and transparency from an assertion of reliable
  automated authority. The UI labels categories as possible contributors and
  explicitly keeps AI, ranking, and routing outside the explanation.
- [W3C WCAG 2.2 Info and Relationships](https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html)
  supports semantic headings and lists for related explanatory information.
  The card uses a nested heading and a real list rather than color-only cues.

Research was checked against these official sources on 2026-08-29.

## Options and Trade-offs

| Option | Pros | Cons |
| --- | --- | --- |
| Show competing policy names and rules | Most specific diagnosis. | Discloses configuration and encourages manual ranking. |
| Show matching rule values | Explains apparent collisions. | Exposes sensitive policy terms and item-level inference. |
| Explain only shared-item counts | Maximum privacy. | Leaves operators without a practical next step. |
| Show allow-listed category aggregates | Gives an actionable review cue while preserving term and identity privacy. | Cannot prove a category caused a historic result. |

## Final Recommendation Stack

1. Use the existing competition preview to establish that shared deterministic
   eligibility exists in the bounded cohort.
2. Show category aggregates only when that shared count is non-zero.
3. Permit only `genres`, `keywords`, `studios`, and `media_type` to become
   stable presentation categories.
4. Count anonymous competitor configurations per category, never rules,
   values, policy names, IDs, libraries, media, or evaluator outcomes.
5. Describe categories as *possible contributors*; keep policy ranking, AI,
   verification, thresholds, and routing authoritative elsewhere.

## Architecture

```text
Transient proposed contract + anonymous current competitor contracts
                         |
                         v
allow-listed purpose-category intersection and anonymous policy counts
                         |
                         v
aggregate explanation attached to existing preview response
                         |
                         v
semantic explanation card in existing-policy maintenance
```

The pure explanation module accepts contracts already obtained by the existing
preview service. It makes no database, provider, RAG, AI, routing, cache, or
write call.

## Privacy and Authority Boundaries

- If no shared eligibility was observed, the response contains no categories.
- Unknown or unsupported signal types never become presentation categories.
- A category means only that the type exists on both sides; it does not compare
  the values, operators, weights, or effective match paths.
- The UI handles the returned projection as display-only and does not infer a
  safe destination or mutate the draft.

## Pull Request Availability

The GitHub pull-request API was queried on 2026-08-29 and returned no open
pull requests. No closed or unrelated pull request was substituted, and no PR
was merged.
