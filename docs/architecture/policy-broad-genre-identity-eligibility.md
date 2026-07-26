# Policy Broad-Genre Identity Eligibility

## Status

Implemented for Phase 6R.2 as the server-owned eligibility boundary that
decides whether a broad observed genre can be proposed as destination identity.

`policyBroadGenreIdentityEligibility.mjs` is a pure ES module. It accepts only
normalized evidence entries and has no database, media-server, provider,
learning, routing, quota, or browser side effects. The profile-to-intent reducer
uses it before placing an observed broad genre in `belongs_here`; the intent
draft audit applies the same contract to detect a forged or weak supporting
entry.

## Problem

Genre observations such as `Animation` are often common across unrelated
libraries. Treating a frequent broad genre as destination identity turns a
useful compatibility signal into an over-broad policy. The prior reducer only
required any non-broad, non-metadata entry, so one sparse or uncertain observed
value could promote a broad genre.

The eligibility policy must be deterministic and explainable. It must not
depend on browser selections, AI responses, metadata, legacy templates, or
runtime provider state.

## Official Guidance Reviewed

Current guidance reviewed as of June 2026:

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends recomputing state-relevant values on the server and enforcing
  workflow rules outside the UI. Classifarr derives promotion eligibility from
  bounded evidence rather than trusting a client-side indicator.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side allowlists and semantic validation. Source/authority
  pairs, candidate kind, count, confidence, and freshness are all validated as
  one policy decision rather than as independent UI fields.
- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for documented, objective, repeatable testing and validation. The
  versioned eligibility result has fixed reason IDs and threshold-boundary
  regression tests.

## Options

### Promote Any Broad Genre With a Specific Neighbor

Pros:

- Smallest rule.
- Allows more inferred proposals from sparse libraries.

Cons:

- A single noisy entry can redefine destination meaning.
- Does not distinguish metadata, stale data, weak confidence, or forged
  provenance.
- Cannot explain the strength of the supporting observation.

### Let Frequency Alone Promote a Broad Genre

Pros:

- Easy to calculate from a library profile.
- Gives large libraries more weight than small libraries.

Cons:

- Frequency does not make a broad label specific.
- Ignores source authority and confidence.
- Can convert a general-purpose library into a genre-specific destination.

### Require Explicit Operator Declaration Only

Pros:

- Strongest authority boundary.
- No inferred promotion risk.

Cons:

- Loses useful library-derived suggestions.
- Adds manual work where a consistent library profile already offers safe
  proposal context.

### Use Versioned Eligibility With an Operator Override

Pros:

- Keeps observed proposals useful without treating them as durable authority.
- Makes every promotion condition explicit, testable, and server-owned.
- Defers weak, stale, metadata, and malformed evidence without blocking an
  explicit operator decision.
- Reuses the same evaluation in both suggestion generation and draft audit.

Cons:

- Conservative thresholds may defer identity suggestions for sparse libraries.
- Threshold changes require a versioned code and test change.

## Final Recommendation Stack

1. Bounded evidence input:
   `server/src/services/policyEvidenceBoundary.mjs`
2. Broad-genre eligibility:
   `server/src/services/policyBroadGenreIdentityEligibility.mjs`
3. Deterministic suggestions:
   `server/src/services/policyProfileIntentSuggestionRules.mjs`
4. Intent-draft validation:
   `server/src/services/policyIntentEngine.mjs`
5. Explicit declared-intent command and later native transaction:
   `server/src/services/policyDeclaredIntentCommand.mjs`

## Implemented Contract

For an observed broad genre to enter `belongs_here`, at least one separate
specific identity entry must meet all of these conditions:

| Condition | Requirement |
| --- | --- |
| Source | `media_server_library_profile` |
| Authority | `media_server_contents` |
| Specificity | Not a broad genre label or `genre:` key |
| Freshness | Not marked stale |
| Observed item count | At least `2` |
| Confidence | At least `0.70` |

An operator-declared specific identity is the explicit authority override. It
uses the paired `operator_declared_intent` source and authority plus the
server-derived `operatorDeclared` marker, and does not need inferred count or
confidence thresholds.

Metadata, manual outcomes, routing outcomes, AI output, legacy templates,
invalid source/authority pairs, stale entries, broad genres, missing counts,
and confidence below `0.70` cannot establish supporting identity. They may be
handled by their own evidence or review contracts, but cannot promote a broad
genre here.

The module returns only bounded control data:

```text
version
eligible
supportTypeId
qualifiedObservedSpecificIdentityCount
minimumObservedItemCount
minimumObservedConfidence
reasonIds[]
```

It deliberately returns no library labels, provider payloads, policy IDs,
browser state, or write capability.

## Security Outcome

- Promotion eligibility is recomputed on the server from provenance-bearing
  entries; the UI cannot claim it.
- Allowlisted source and authority pairs prevent metadata or relabeled evidence
  from acting as observed library identity.
- Count, confidence, and freshness are evaluated together, so a high score
  cannot compensate for stale or too-sparse evidence.
- The intent audit reruns the eligibility check from persisted draft
  provenance. A broad genre with weak support is rejected even if another
  non-broad entry is present.
- The module is deterministic, side-effect free, and preserves direct operator
  authority for a deliberate policy choice.

## Verification

Focused coverage is in
`server/src/__tests__/services/policyBroadGenreIdentityEligibility.test.mjs`.
It verifies threshold equality, weak count, weak confidence, stale evidence,
metadata and malformed provenance, declared-intent override, and deterministic
ordering. The suggestion and intent-engine suites verify the policy is used for
proposal placement and for forged-draft detection.
