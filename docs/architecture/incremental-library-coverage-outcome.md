# Incremental library coverage outcome

## Delivered behavior

The [design](incremental-library-coverage-design.md) extends fair library visits
to inventories above 20,000 rows. Each visit measures a bounded page; later turns
resume that library while smaller libraries keep their turns. Partial work shows
scanned rows with unknown complete coverage. Finished scans expose full counters,
their measurement baseline and completion time.

Inventory and observation-clock revisions bind every page. Changed inputs,
sampling interruptions, configuration changes and expired scans restart
automatically. A final write rechecks revisions and discards a page if its inputs
differ in that write's validation snapshot. Progress, cursor movement and history
share an atomic statement. No long-lived transaction spans visits and no manual
scan setup is required. Clock-only changes do not dirty acknowledged profiles.

Small ESM services separate scan planning SQL, counter/digest reduction and
persistence. The authenticated history GET remains read-only, bounded and
`no-store`; revisions, cursors and population digests remain private. Native
captions, scoped headers, keyboard pagination and disclosures distinguish
complete, partial and discarded measurements.

## Prior work and PR inspection

The preceding commits established fair library traversal (`8807b0d2`), per-library
trends, acquisition history, observation repair, health and overlap. The remaining
capacity boundary withheld coverage for each individual library above 20,000 rows.
GitHub MCP returned no open pull requests on 5 September 2026 local time, so no
random open PR was available to implement or merge.

## Validation findings

PostgreSQL checks passed 77 tests across six sampler, incremental coverage,
profile-revision, health and legacy-history suites. Tests cover complete scans,
partial status, restart reasons, exact bigint revisions, freshness at scan start,
post-read invalidation, concurrent workers, rollback, retention and legacy reads.
Clock triggers increment once per statement, ignore unchanged clocks, roll back
with source writes and tolerate items without library membership.

The first database run exposed a query-plan regression: the planner could filter
the global item-ID index and scan unrelated inventory when loading metadata.
A bounded composite key range and lateral primary-key lookups corrected it. The
120,000-item plan check now verifies the library-index range and bounded item
reads. A separate test-clock drift was fixed by using a stable transaction clock
for controlled visits; production comparisons correctly retain actual times.

Targeted client checks passed 35 tests, including complete/partial/invalidated
states, explicit freshness time, escaped names, local pagination, semantic tables
and the central API helper. The isolated schema snapshot was regenerated and
checked, retaining the existing 21 idempotent seed migrations.

Full client coverage passed 325 suites and 4,465 tests, with 87.83% lines, 85.84%
statements, 77.59% branches and 84.85% functions. The full backend run passed 1,060
suites and 30,064 tests with 90.11% line/statement, 80.55% branch and 92.74% function
coverage. The combined coverage ratchet passed without regressions.

All five Chromium checks passed across incremental sampling, retained v2 sampling,
legacy history, health and overlap. Keyboard pagination, disclosures, horizontal
scrolling, mobile containment, one automatic history GET and zero mutation
requests were verified. Desktop and mobile screenshots were visually inspected.
After making the browser fixture's previous complete counts consistent with its
comparison, the final focused client/API run passed 16 tests and the incremental
browser check passed again. The final database run also verifies the exact
20,000-row boundary and observation gains between complete scans.

Lint, type checks, static ESM imports, strict test mock shapes, both Knip checks,
migration/snapshot checks and the final local Docker build passed. All 1,004
Markdown documents passed lint. No live application deployment was performed.

## Local Compose assessment

The existing private runner selected 32 real typed inventory identities across
eight libraries, with 16 movie and 16 TV identities. All measurement data,
revision changes and padding used transaction-local temporary tables. Seven
controlled empty libraries exercised traversal beyond 12. Observation responses
and elapsed sampling time were controlled fixtures, not independent labels or a
real-time production study.

| Measurement | Result |
| --- | --- |
| Explicit valid / malformed observations | 6 / 26 |
| Added controlled rows in the large library | 20,000 |
| Complete large-library population | 20,001 rows |
| Completed large-library scans | 2 |
| Recorded visits across 15 libraries | 77 |
| Changed inventory during partial scan | Restarted automatically |
| Observation-clock change after reading | Page discarded before publication |
| Smaller libraries with comparable results | 14 |
| Missed sampling slots | Comparisons withheld |
| Controlled assessment / final read | 2,936 ms / 5 ms |
| Final history response | 43,170 bytes; private keys excluded |
| Provider requests / live writes / classification writes | 0 / 0 / 0 |
| Temporary-table rollback | Verified |

The running Compose application was not redeployed. This assessment supplements
the isolated PostgreSQL trigger and concurrency tests; its controlled revision
mutations are not evidence of classification accuracy.

## Recommendations and next item

| Approach | Pros | Cons or limit |
| --- | --- | --- |
| Fair bounded incremental scans | Measures large stable libraries without operator schedules | Completion time grows with library count and pages |
| Transactional revisions and final validation | Prevents mixed-input complete counters | Continuous enrichment or inventory changes can repeatedly restart work |
| Freshness at the scan baseline | Consistent counters across pages | Completed coverage can already be older than its final visit |
| Versioned complete-scan comparisons | Shows progress across partial visits honestly | First v3 completion needs a new baseline relative to retained v2 points |

The recommended stack is synchronized inventory → transactional observation
revisions → automatic profiles → fair incremental measurement → comparable
complete coverage → independently evaluated review-only semantic evidence.
Official PostgreSQL and W3C research, with the requested August date limitations,
is linked in the [design](incremental-library-coverage-design.md#official-research-and-august-2026-scope).

Next: derive automatic scan-completion and restart diagnostics from existing
history. Identify libraries that repeatedly restart or age out without a complete
measurement, with explicit observed windows and no automatic policy or routing
changes. Use those measurements before choosing a recovery strategy for
continuously changing libraries.

Follow-up completed: the [scan diagnostics design](library-scan-diagnostics-design.md)
and [measured outcome](library-scan-diagnostics-outcome.md) record the automatic
history projection, current catalog scope and controlled restart/recovery checks.

Readiness and frozen-study gates remain unchanged. Controlled fixtures and source
placement do not count as independent human labels. No release is created.
