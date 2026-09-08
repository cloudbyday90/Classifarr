# Policy Purpose Coverage Provenance Design

Status: implemented on 2026-09-08.

## Problem

The administrator-only policy purpose coverage review could identify missing and
overlapping specialized purpose configuration, but it could not distinguish
specialized purpose inherited from a media-server library profile from purpose
that remains available for a held-out semantic study. The distinction matters
because profile-derived terms describe observed library configuration; they are
not operator-declared policy authority for study eligibility or routing.

The system must provide that distinction without exposing configured terms,
profile observations, media metadata, or AI output. It must remain advisory and
must continue to use the existing policy editor for all corrections.

## Design

The existing administrator-only `GET
/api/policies/native-intent-reconciliation/purpose-coverage` response advances
from `policy_purpose_coverage_review.v2` to v3. PostgreSQL computes two
per-policy counts for active, validated native policies:

- `specializedPurposeRuleCount`: identity-purpose rules over `genres`,
  `keywords`, and `studios`;
- `inferredProfilePurposeRuleCount`: that subset whose source is
  `media_server_library_profile` and inference state is `inferred`.

The contract service derives a third count, `retainedPurposeRuleCount`, and one
fixed provenance status. No rule values, policy JSON, profile data, or item
data cross the persistence boundary.

| Status | Meaning |
| --- | --- |
| `no_specialized_purpose` | No specialized purpose rule is configured. |
| `profile_only_specialized_purpose` | Every specialized purpose rule is an inferred library-profile rule. |
| `retained_specialized_purpose_available` | At least one specialized purpose rule is not an inferred library-profile rule. |

The Vue review panel displays only the status and three counts. It remains
read-only and keeps its existing editor handoff. The endpoint authorization,
bounded 50-row default and 100-row maximum, route behavior, queues, audit
records, and classification decisions do not change.

## Security And Privacy Boundaries

- Authorization remains server-enforced for administrators on every request.
- The static SQL projection returns aggregate counts only; it never selects
  `policy_intent_rules.values` or profile observations.
- The status is a maintenance signal. It cannot select a destination, change a
  policy, enqueue work, or establish semantic correctness.
- Existing response limits and over-fetch truncation protect availability.

## Research

NIST's AI RMF Measure function calls for documented measurement and test-set
processes, including independent review where appropriate. This supports a
bounded, inspectable study-readiness signal instead of an automated semantic
claim. W3C Data on the Web Best Practices identifies provenance and data
quality as properties that should be communicated clearly. OWASP recommends
server-side authorization checks and least privilege.

Sources:

- [NIST AI RMF: Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| Keep the prior static coverage report | No implementation work. | Does not show whether purpose is profile-only. |
| Return raw configured terms and provenance | Detailed diagnosis. | Exposes configuration and profile-derived evidence unnecessarily. |
| Ask an AI service to infer provenance | Flexible wording. | Probabilistic, provider-dependent, and unsuitable for policy authority. |
| Return server-derived counts and fixed statuses | Deterministic, bounded, private, and directly usable in the existing review. | Does not explain which term caused the status. |

## Recommendation Stack

1. Use the v3 aggregate provenance status as an administrator maintenance cue.
2. Treat profile-only purpose as observed configuration, never semantic-study
   authority or automatic routing evidence.
3. Correct policy intent only through the existing validated editor and review
   its static coverage afterward.
4. Capture and independently label a frozen study cohort only after readiness
   and preflight report eligibility.
5. Consider semantic counter-evidence only after a measured cohort has a good
   error profile; ambiguous cases must go to review rather than routing.

No database migration is required because this is a read-only projection of
existing native intent data.
