# Policy Purpose Held-Out Source Readiness Outcome

Status: verified locally on 2026-09-08.

## Scope

This document records the outcome of the aggregate policy-source readiness
addition described in [the design](policy-purpose-held-out-source-readiness-design.md).
It is a read-only configuration observation. It is not a semantic evaluation,
a cohort receipt, an independent label set, or a routing change.

## Implemented Behavior

The existing administrator-only purpose-coverage endpoint now returns a v4
`studySourceReadiness` object alongside its bounded per-policy entries. The
object represents the full active validated native-policy population through
fixed counts and one status. The UI rejects unknown statuses and forces the
cohort, selection, and routing flags to false before rendering.

The source availability state only says whether declared specialized purpose
exists outside inferred library-profile evidence. It does not inspect media
items, call a provider, perform semantic retrieval, select a case, freeze a
study frame, collect labels, or apply a policy.

## Local Source Observation

After a no-cache Compose provenance rebuild, the healthy `classifarr` image
carried OCI revision `6aa4cda123e7129fb486256a838ae496f66c54a4`. A direct
read-only call to the service printed only the response version, aggregate
readiness state, fixed counts, and non-mutation flags:

| Measure | Result |
| --- | ---: |
| Response version | `policy_purpose_coverage_review.v4` |
| Active validated policies | 10 |
| Profile-only purpose policies | 10 |
| Retained-purpose policies | 0 |
| Held-out audit candidate source available | false |
| Semantic cohort ready | false |
| Semantic selection affected | false |
| Routing affected | false |
| Raw configuration exposed | false |

The existing private `study:audit:held-out-policy-eligibility` command then
completed against the same local dataset. It saw 6,641 canonical candidates
after the current source-conflict exclusion: 331 documentary, 5,236
genre-overlap, 831 ordinary, and 243 reality. Every candidate was
`not_pending_policy_decision` with `manual:none`; no stratum contained an
eligible case. Its policy source screen independently reported 10 active
policies, 15 inferred-profile purpose rules excluded, and zero retained purpose
rules.

This independently confirms the new aggregate status. It does not establish
that the policies are wrong or that a semantic study is complete.

## Validation

- Source-readiness service, coverage contract, persistence, and service tests:
  12 passing tests across 4 suites.
- PostgreSQL integration test for bounded coverage, provenance, and the new
  aggregate signal: 1 passing suite.
- Administrator route test: 9 passing tests.
- Vue panel and client fail-closed normalizer tests: 6 passing tests across 2
  files.
- Server lint and typecheck, client typecheck and production build, repository
  Markdown lint, and static ESM-import check: passed.
- `npm run docker:smart:provenance-rebuild`: passed with `--no-cache`, a
  provenance-verified image, forced recreation, and health wait.

## Next Item

If local data still has no retained declared-purpose source, keep the semantic
study gate closed and do not add semantic counter-evidence. If a separately
reviewed policy change later creates retained purpose, rerun the private
eligibility audit, then capture and independently label a frozen 24–32-case
cohort before considering review-only counter-evidence.
