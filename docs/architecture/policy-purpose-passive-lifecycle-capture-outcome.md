# Passive Policy Lifecycle Capture Outcome

Status: implemented on 2026-09-08.

## Outcome

The administrator-only policy-purpose review is now
`policy_purpose_coverage_review.v8`. Its lifecycle receipt is version 2 and
counts verified terminal library-rebuild replacements separately from native
intent changes. The current-policy evidence inventory and the bounded lifecycle
panel use the same modular source definition, so the two aggregate views cannot
drift over which lifecycle paths qualify.

A rebuild contributes only when its terminal execution gate, immutable
no-difference verification run, replacement event, policy binding, transition
fingerprints, and source/target intent revisions agree. The returned response
contains only fixed aggregate counts and status IDs. It contains no library,
policy, intent, configuration, rule, receipt, fingerprint, actor, media, AI,
or routing data.

This makes evidence capture more automatic while preserving the platform's
library and configuration neutrality. It does not create a semantic cohort,
label an item, invoke AI, alter policy, or automatically route media.

## Implementation

- Added `policyPurposeLifecycleReceiptSources.mjs`, an ESM-only shared SQL CTE
  builder with active-inventory and bounded-history scopes.
- Added strict verified-rebuild bindings to the normal lifecycle source set.
- Updated inventory and lifecycle receipt persistence to consume that source
  set.
- Updated server and client contracts, Vue rendering, and tests for the new
  replacement aggregate and the versioned review response.
- Added an integration fixture that proves a valid ordinary verified rebuild
  qualifies while stale or incomplete evidence does not.
- Added no dependency or database migration.

## Validation

Focused server unit tests cover source SQL bindings, data minimization,
contract aggregation, and current-intent evidence. Client tests cover strict
response normalization and the passive display. The PostgreSQL integration test
covers the verified replacement lifecycle chain.

The public repository had zero open pull requests during discovery, so there
was no random open PR to implement locally or merge. [Open pull requests](https://github.com/cloudbyday90/Classifarr/pulls)

The build, static checks, no-cache Compose rebuild, and live administrator
review verification are recorded with the implementation commit.

## Follow-up

The next platform item is not semantic routing. Once the aggregate shows
complete current-policy evidence, run one real independently labelled 24–32
case cohort, use readiness and frozen-study preflight, and measure its error
profile. A good result can justify a later review-only semantic
counter-evidence experiment for ambiguous items; automatic routing remains out
of scope.
