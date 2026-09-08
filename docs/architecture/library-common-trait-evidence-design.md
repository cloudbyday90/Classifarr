# Cross-library common trait evidence design

## Decision

Add a read-only, bounded report of observed trait values that recur in two or
more selected libraries of the same media type. The report is descriptive
inventory evidence. It does not create policy purpose, counter-evidence,
classification confidence, cohort eligibility, automatic routing, or a review
task.

This is the appropriate next step after the held-out policy-source readiness
check. That check found no retained declared-purpose source for the semantic
study, so semantic counter-evidence must not be added yet. A recurrence report
can improve understanding of what exists across the library without changing
the study or decision boundary.

## Scope and data flow

`readLibraryOverlap` already retrieves a bounded snapshot of at most 12 active
libraries and 20,000 inventory rows. Before any cohort is built, rows with a
current source-identity conflict are excluded. `libraryCommonTraitEvidence`
receives only those private cohorts and emits the following fixed projection:

- media type and selected/known-library denominators;
- one of three coverage states: fewer than two typed libraries, fewer than two
  libraries with a trait observation, or evidence available;
- at most five repeated values per trait, ordered by number of libraries,
  identity occurrences, then value;
- the number of libraries and identity occurrences for each returned value.

No raw media item, TMDb ID, per-value library list, profile field, policy name,
policy ID, rule, or rule value is returned. The server reports a partial scope
when the active-library count exceeds the bounded selection. The Vue client
applies an independent allow-list normalizer before presenting the report.

For an authenticated administrator, the existing overlap route performs one
additional bounded query for the already selected library IDs. That query
reduces policy-purpose provenance to four mutually exclusive library counts for
each recurring value: no active validated native policy, profile-only
specialized purpose, no retained declared purpose, and retained declared
purpose. It never selects `policy_intent_rules.values`. Non-administrators and
API-key-only calls receive the same observation report with the provenance flag
set to `false`, and retain the original one-query path.

## Security and decision controls

- The report shares the current source-conflict exclusion, metadata limits,
  row limit, stable selection order, authentication, rate limit, and
  `Cache-Control: no-store` response controls.
- Policy provenance is requested only when `req.user.role` is `admin`; an API
  key does not acquire this context simply by being authenticated.
- The provenance query is parameterized with the server-selected integer IDs,
  revalidates the active library and validated native-intent predicates, and
  projects fixed counts only.
- The renderer uses Vue interpolation and accepts only normalized display text
  of at most 160 characters. It discards unknown response properties.
- Neither the server response nor the UI includes an action that can update a
  policy, select a semantic cohort, label media, or route media.

## Research and alternatives

The design follows the W3C Data on the Web Best Practices emphasis on clear
metadata, provenance, and data-quality information: the report names its
bounded scope and coverage rather than presenting recurrence as a complete
library fact. [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

NIST's AI RMF Measure guidance calls for rigorous, repeatable testing and
formalized reporting. This change therefore keeps the observation layer
separate from the future semantic-study and routing layers, with deterministic
tests for conflict exclusion, truncation, and provenance projection.
[NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)

OWASP identifies returning unnecessary object properties as a common API
authorization risk. The narrow aggregate contract and client-side allow-list
avoid returning policy terms, media IDs, or per-library value membership.
[OWASP API3: Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)

| Option | Advantages | Costs and risks |
| --- | --- | --- |
| Aggregate recurring-trait report (chosen) | Automatic, bounded, interpretable, preserves uncertainty, and adds no operator work | Does not prove semantic meaning or classification quality |
| Per-value library membership | Gives a direct manual drill-down | Increases disclosure and turns the view into an operator matching workflow |
| Treat recurrence as policy evidence | Could reduce apparent configuration work | Unsound: existing placement cannot establish intent and would risk automatic routing |
| Start semantic counter-evidence now | Moves closer to the automation goal | Violates the frozen-study readiness gate because retained declared purpose is unavailable |

## Recommendation stack

1. Keep the new recurrence report read-only, aggregate-only, and explicitly
   non-authoritative.
2. Show policy-purpose provenance only to administrators and only as fixed
   aggregate context.
3. Preserve the frozen-study gate: do not create semantic counter-evidence,
   labels, or routes until a real cohort has measured acceptable error and the
   retained-purpose source becomes ready.
4. Next, add passive provenance-lifecycle observability that detects whether
   declarative native-purpose material is retained during normal policy changes.
   It should report gaps automatically and remain unable to alter policies or
   route media.
