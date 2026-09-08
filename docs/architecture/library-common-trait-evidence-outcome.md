# Cross-library common trait evidence outcome

## Implemented outcome

The Libraries overlap screen now includes **Common observed traits across
libraries**. For each movie or TV group, the disclosure shows only values that
occur in at least two selected libraries, the number of selected libraries with
the observation, and the number of identity occurrences. It distinguishes an
absence of recurring values from insufficient selected-library or trait
coverage.

The report reuses the bounded overlap snapshot and its exclusion of current
source-identity conflicts. A value is never shown with a media ID, title,
library-membership list, policy name, policy ID, or policy rule value. The
response remains capped at five entries per trait and no UI control changes
policy, selects a cohort, gathers a label, or routes media.

Administrators additionally see four aggregate policy-purpose provenance counts
for each recurring value. A standard authenticated caller, including an API-key
caller without an administrator user role, receives no such count and retains
the pre-existing single-query overlap read.

## Validation

Focused validation completed on 2026-09-08:

- Server unit tests: 39 tests across common-trait aggregation, policy-purpose
  reduction and persistence, existing trait prevalence, and overlap routing.
- PostgreSQL integration tests: 8 bounded-overlap tests, including source
  conflict exclusion from the new report.
- Client tests: 18 tests across the bounded response normalizer and Libraries
  overlap disclosure.
- Security diff scan: complete coverage of 15 changed executable files with no
  findings. The TAC advisory connector was unavailable, so protected-output
  access could not be verified.

The tests verify deterministic truncation, same-media-type aggregation,
insufficient-coverage states, source-conflict exclusion, no raw policy rule
values in the provenance query, administrator-only provenance, client property
allow-listing, escaped display text, and the non-routing explanation.

## Outcome against the platform goal

This reduces operator work by automatically describing what recurs in the
existing library. It does not claim that those recurrences are correct or
semantic. The held-out study remains blocked by its retained declared-purpose
source result, so the system has correctly not added semantic counter-evidence
or automatic routing.

The next item is passive policy-purpose provenance lifecycle observability: a
bounded, read-only receipt for normal policy creation and mutation paths that
shows whether declarative purpose was retained, profile-inferred, or absent.
That work should stay outside routing and semantic cohort selection until the
existing readiness and frozen-study preflight can pass.
