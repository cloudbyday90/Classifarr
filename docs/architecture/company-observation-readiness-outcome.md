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

The first image build failed resolving GitHub during the checksum-pinned pgvector
download. The live container remained healthy and was not restarted. Inspection
also found that the existing Dockerfile cleanup fallback hid that upstream
failure. Grouped the `make clean` exception and made every variant's build/install/
copy sequence stop on failure. The additional focused build regression run passed
2 suites / 14 tests, including 32 stubbed shell scenarios across all four variants;
the full application coverage totals above precede this Dockerfile-only runtime
change. The new test passed ESLint. DNS lookup succeeded on a subsequent check.

The retry succeeded without changing network settings, download source or checksum.
Built from clean commit `06bf183ffea4c84ff098c0ff6565652003208478`; the local image
is `sha256:de73e6f74e12e7d88dd61031aee5c497e313b8bdf1f5b405b7e1aa36f9d6e523`.
The image includes the readiness change at `5dc1af53` and the preceding company/
prospective-capture changes. A subsequent documentation-only commit records these
observations and does not require another image build.

Recreated only `classifarr` using the existing smart Compose workflow with
`--no-build --no-deps --pull never --wait --wait-timeout 180`. It became healthy,
with zero restarts and the expected image revision. Both company and prospective
capture modules are present. HTTP `/health` returns 200; unauthenticated access to
the detailed observation-health API returns 401. Other containers were not changed.

At `2026-09-23T09:04:21.812Z`, the new read-only health service reported 6,696 rows
across all 10 active libraries, no excluded libraries, 40 current company checks
(37 with companies, 3 valid empty sets), and no withheld company envelopes.
This rose automatically from the zero-observation baseline after startup; no
manual queue refill, provider batch or reclassification was triggered. The normal
startup gap analysis and five-minute refill schedule remain responsible for the
rest of the inventory, subject to provider availability and existing cooldowns.
Backfill is in progress, not complete.

A subsequent read found 200 movie and 51 TV company observations, with 4,053 movie
and 1,586 TV enrichment tasks pending and two movie tasks processing. Both media
types are backfilling organically; these are acquisition counts, not evidence of
routing accuracy. The inventory still contains the same 6,696 source rows.

The actual deployed prospective CLI succeeded for the fixed starting window
`2026-09-23T09:03:40.000Z` to `2026-09-23T09:04:21.489Z`. It correctly reported zero
captures/outcomes, `awaiting_eligible_outcomes`, `promotionAllowed: false`, zero
evaluation provider calls and zero routing changes. That is expected before new
eligible classification traffic and later operator feedback; no accuracy gain is
claimed. Existing classifications were not fabricated into prospective captures.

Repeat the same start boundary with a later cutoff after real traffic accumulates:

```text
docker exec -e POSTGRES_HOST=/var/run/postgresql classifarr node src/scripts/runInventoryOutcomeCalibration.mjs --prospective --since 2026-09-23T09:03:40.000Z
```

This command is read-only and specific to the standard embedded-PostgreSQL local
deployment. External database deployments should use their configured connection.

## Next high-value item

Let automatic backfill and real classification traffic run, then use the existing
prospective report on a fixed window. Evaluate movie/TV and per-library paired
regressions, corrections and abstentions before validating a promotion decision on
a later cohort. Zero outcomes means awaiting evidence, not zero accuracy. Do not
create another benchmark or require operators to label every inventory item.
