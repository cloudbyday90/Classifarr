# Policy Purpose Coverage Provenance Outcome

Status: verified locally on 2026-09-08.

## Scope

This outcome records the local Compose validation of the count-only v3 policy
purpose provenance review described in
[the design](policy-purpose-coverage-provenance-design.md). It is a
configuration-maintenance result, not a semantic classification evaluation.

## Build And Runtime Verification

The project was rebuilt with `npm run docker:smart:provenance-rebuild`, which
uses `docker compose build --no-cache`, requires image provenance, recreates
the service, and waits for health. The resulting healthy image carried OCI
revision `f28842194d6cf7500f2e69603c15716ca0cef01e`.

The running service was queried through the read-only coverage-review service
with a 100-row limit. The test printed only response version, fixed statuses,
aggregate counts, and the two non-mutation contract flags. It did not print
policy names, library names, terms, rule values, media, profiles, or provider
data.

| Measure | Result |
| --- | ---: |
| Reviewed policies | 10 |
| `broad_overlap_review_required` | 10 |
| `profile_only_specialized_purpose` | 10 |
| `retained_specialized_purpose_available` | 0 |
| `no_specialized_purpose` | 0 |
| Raw configuration exposed | false |
| Routing affected | false |
| Response version | `policy_purpose_coverage_review.v3` |

## Interpretation

The current active native policies all have specialized purpose supplied solely
by inferred media-server profile rules. This supports the earlier held-out
study audit conclusion: those profile observations must not be treated as
operator-declared semantic-study authority. It does not demonstrate that any
policy is incorrect, that an item belongs elsewhere, or that a semantic
counter-evidence rule is ready.

The correct operator action, where a policy needs revised intent, remains the
existing validated policy editor followed by the static review. The assessment
does not create work, change policies, collect labels, or route media.

## Validation

- Server provenance, contract, and persistence tests: 9 passing tests across 3
  suites.
- Full backend unit suite: 1,119 suites and 32,078 tests passed with two Jest
  workers and 512 MB idle-worker recycling. The `test:unit` script now uses
  that validated configuration because its previous in-band form exhausted
  Node's default heap on this repository.
- PostgreSQL integration test for profile-only provenance and value exclusion:
  1 passing suite.
- Vue review component tests: 3 passing tests.
- Server lint and typecheck, client typecheck and production build, and
  repository Markdown lint: passed.

## Next Item

Preserve the frozen-study gate: do not add semantic counter-evidence until a
real 24–32-case cohort is independently labeled and the existing readiness and
preflight reports show an acceptable measured error profile. If that threshold
is met, implement counter-evidence only as a review referral for ambiguous
items, never as automatic routing.
