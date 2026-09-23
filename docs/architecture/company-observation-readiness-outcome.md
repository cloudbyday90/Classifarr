# Company observation readiness: outcome

Date: 2026-09-23. See the separate
[design and recommendation stack](company-observation-readiness-design.md).

## Implemented

The existing authenticated observation-health response now includes additive
`companyCoveragePercent` and `counts.companiesCurrent`, `companiesKnown`,
`emptyCompanies`, and `companiesWithheld` fields per library. The denominator is
identified movie/TV source rows, not distinct titles or verified decisions.
No identified rows produces a null percentage. At capacity, counts remain withheld.

Company freshness uses the existing typed-identity company validator and its
30-day boundary. Empty company sets count as checked, but not as usable company
traits. The independently bounded envelope preserves its own acquisition time;
a fresh language/keyword capture does not imply a current company check. The
existing acquisition states and persisted historical counters remain unchanged.

The UI places this distinction inside the existing collapsed details, with no
new table column, acknowledgement, manual backfill button or extra live region.
An older server without these fields displays unavailable rather than false zero
coverage. No routing scores, confidence, safeguards or provider calls changed.

Selected [PR #546](https://github.com/cloudbyday90/Classifarr/pull/546) using the
random-selection step; it was the only open unapplied candidate. Applied its exact
server dotenv 18.0.1 manifest/lockfile changes and added installed-package tests
for ESM imports, parsing, file paths/URLs, and external-value precedence using
isolated synthetic configuration. The PR was not merged. No release or application
version change was made.

## Verification

- Full backend coverage: 1,383 suites / 40,590 tests passed.
- Full client coverage: 371 files / 5,174 tests passed.
- Focused PostgreSQL integration: 7 suites / 112 tests passed, including company
  capture/backfill, health projection, fair sampling, incremental scans, inventory
  projection, acquisition history and malformed-observation repair.
- Backend coverage: 90.36% statements/lines, 83.78% branches, 92.49% functions.
  Client: 85.62% statements, 77.60% branches, 85.12% functions, 87.69% lines.
  Coverage ratchet passed without lowering baselines.
- Server/client lint and typecheck, client production build, both dependency-usage
  checks, documentation lint, copyright, npm CLI flags, ESM import/mock checks and
  whitespace checks passed. Clean server installation used disabled lifecycle scripts.

Tests exercise movie and TV identities, valid empty sets, legacy missing fields,
malformed/mismatched records, exact expiry, future clocks, byte-limit withholding,
empty denominators, redacted output, existing authentication and unchanged scan
semantics. Repository totals are regression evidence, not measured model accuracy.

The preceding commit's [hosted CI](https://github.com/cloudbyday90/Classifarr/actions/runs/35805659517)
and security workflows passed. New hosted checks are separate from local results.

## Local deployment baseline

The approved restart targets only the existing `classifarr` container and retains
its mounts and settings. Before deployment, its revision was
`641ca6f0659421733b9e463b12b0455917f6633b`; neither company capture nor prospective
ranking capture existed in that image. There are no intervening schema migrations,
Dockerfile, entrypoint or Compose changes.

Read-only baseline: 5,033 movie rows / 5,018 identified, 1,663 TV rows / 1,654
identified, zero company observations, TMDB configured, and no pending/processing
tasks. Existing TMDB observations numbered 5,017 movie and 1,654 TV rows.

Retained the old immutable image under local tag
`classifarr:rollback-20260923-company`. A 76,457,242-byte PostgreSQL custom-format
backup is stored only in ignored `.tmp/company-readiness-deploy-20260923/`.
Its archive manifest is readable; a full restore has not been performed. It may
contain private configuration and must not be committed or shared. Docker could
not copy directly from the container tmpfs, so the archive was transferred via a
temporary file in the existing data bind mount and then moved to the ignored folder.

Build, restart and post-deployment observations will be recorded after validation.

## Next high-value item

Let automatic backfill and real classification traffic run, then use the existing
prospective report on a fixed window. Evaluate movie/TV and per-library paired
regressions, corrections and abstentions before validating a promotion decision on
a later cohort. Zero outcomes means awaiting evidence, not zero accuracy. Do not
create another benchmark or require operators to label every inventory item.
