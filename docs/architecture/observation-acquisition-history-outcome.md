# Automatic acquisition history outcome

## Design and behavior

Implemented the next item from [automatic repair](inventory-observation-repair-outcome.md).
Libraries automatically shows recorded acquisition outcomes and hourly coverage
history. No per-item setup, manual capture, provider calls on GET or semantic
routing changes were introduced.

Small ESM modules separate atomic outcome recording, hourly sample creation,
scheduling, bounded reading, API routing and accessible UI tables. Acquisition
counts distinguish captured from unavailable results after source-guarded
persistence. Coverage retains selected library IDs, excluded-library counts and
explicit denominators; capacity-exceeded samples preserve unknown counts.

Two fixed-slot tables each hold at most 168 rows. The visible window contains the
current UTC hour and preceding 167 hours. Unused slots can retain older aggregate
values physically until reuse; expired/future values are excluded from reads.
No media IDs, titles, library names, traits, provider payloads or credentials enter
history storage. This is committed acquisition activity, not provider billing or
an independently labeled classification study.

The authenticated parameterless history endpoint is read-only, rate limited and
`no-store`. Hourly/startup sampling runs in the scheduler. A transient sampling
failure leaves a gap, and first-sample conflict handling prevents duplicate hours.
Outcome counter errors roll back their associated metadata update rather than
silently presenting incomplete accounting. Existing worker retry behavior applies.

## Additional correctness finding

The Compose matrix exposed a pre-existing projection defect: missing
`original_language` became explicit JSON null before the shared reader saw it.
Health therefore counted seven valid records where the raw contract allowed six.
The migration now preserves field presence. Explicit null remains a valid unknown
language; missing language remains malformed. Affected library profiles are marked
dirty automatically, and all 32 validity expectations are checked through the SQL
projection for both migrated databases and the generated fresh-install schema.
The correction has its own migration so a snapshot that already includes the
history tables still applies it. This also benefits profile and overlap readers.

## Local Compose measurements

Reused 32 real typed inventory identities: 16 movies and 16 TV items across eight
libraries. Observations, provider responses and sample-time advancement were
controlled fixtures, with six valid and 26 malformed initial records. Production
selector, worker, guarded persistence, history sampler, reader and health services
ran against TEMP tables. All writes rolled back; the live image was not redeployed.

| Measurement | Result |
| --- | --- |
| Recorded guarded attempts | 52 |
| Unavailable / captured outcomes | 26 / 26 |
| Captured inventory rows in chronological samples | 6 → 6 → 32 |
| Final rows with known keywords / language | 18 / 17 |
| History read | 2 ms, 1,176 serialized bytes |
| Refill during cooldown or while already pending | Zero new tasks |
| Provider network requests / live writes / classification writes | 0 / 0 / 0 |
| TEMP rollback verification | Passed |

The sample clock was advanced in TEMP data to exercise successive hours. These are
controlled convergence checks, not elapsed production trends or provider accuracy
measurements. Private scripts/source fields remain in ignored `.tmp`.

## Validation and delivery

- Focused server and client checks passed for automatic capture/loading, population
  boundaries, empty captures, unavailable/error states and late UI responses.
- PostgreSQL checks cover guarded counters, atomic rollback, slot rollover,
  bounded storage, expiry, capacity withholding, first-hour sampling and projection
  validity: 37 checks passed across four suites. The nine history checks were
  repeated against the final migrated and fresh-install projection definitions.
- The final full backend run passed: 1,057 suites, 29,927 tests. Coverage is 90.08%
  lines/statements, 80.50% branches and 92.72% functions. The earlier coverage run
  encountered two snapshot-freshness assertions while the schema was being
  regenerated; both passed after regeneration, along with the full backend rerun.
  Final targeted migration/history/source-guard checks passed (49 tests).
- Three Chromium checks passed for history, health and overlap, including keyboard
  disclosures, mobile horizontal scrolling and zero UI writes. Mobile screenshots
  were visually inspected.
- Full client coverage passed: 322 suites, 4,400 tests; 87.76% lines, 85.75%
  statements, 77.38% branches and 84.73% functions.
- The local Docker image built successfully. Its isolated fresh database generated
  and verified `database/schema/current.sql` through both new migrations. A separate
  SQL behavior check verifies the generated projection rather than relying only
  on matching migration markers.
- Repository lint, both workspace type checks, static ESM imports, strict mock
  shapes, both server Knip checks, migration/schema integrity, Markdown lint and
  the coverage ratchet passed. No dependency or version changes were needed.

The GitHub MCP open-PR listing was empty at task start and delivery recheck; no random open PR could be
selected. No closed PR was substituted. README, Unreleased and the architecture
follow-up chain are updated. Delivery targets `origin/main` without a release.

## Recommendations and next item

The [design](observation-acquisition-history-design.md) documents search-discovered
official W3C, PostgreSQL and OWASP sources and the August 2026 date qualification.

| Recommendation | Pros | Cons |
| --- | --- | --- |
| Fixed-slot aggregate history | Automatic, bounded and excludes raw item data | Seven-day visible horizon; gaps remain unknown |
| Atomic guarded counters | Prevents counting rejected sources or losing updates | Counter persistence shares the metadata write's failure boundary |
| Separate activity and coverage populations | Avoids misleading success rates | Global counts cannot identify which library is stalled |
| Bounded per-library trends next | Makes uneven progress visible without operator queries | Requires explicit membership/denominator change handling |

Final recommendation stack: guarded inventory identity → attributable validator
→ bounded repair → automatic profiles/overlap → current health and acquisition
history → separately evaluated classification assistance.

**Follow-up delivered:** [per-library coverage trends](library-coverage-trends-outcome.md)
now expose explicit population changes and unchanged comparable intervals. They
do not infer an outage from unchanged coverage. That outcome records the next
sampling-scope improvement. Semantic readiness and human-review gates remain unchanged.
